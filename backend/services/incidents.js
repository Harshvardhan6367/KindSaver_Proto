import { randomUUID } from "node:crypto";
import { areCompatibleIssueTypes, calculatePriority } from "../domain/priority.js";
import { detectWard, distanceMeters, toPoint } from "../domain/geo.js";
import { generateTicketId, nextSequenceFromIncidents } from "../domain/tickets.js";
import { validatePriority, validateReportPayload, validateStatus } from "../domain/validation.js";
import { inferDepartment } from "../data/seed.js";

const DUPLICATE_DISTANCE_METERS = 20;
const DUPLICATE_WINDOW_HOURS = 72;

export function createIncidentService(store) {
  return {
    async listCitizenReports(userId) {
      if (!userId) return [];
      const allIncidents = await store.listIncidents();
      const userIncidentIds = new Set();
      
      // Fast path: Check directly assigned reporterUserId
      for (const inc of allIncidents) {
        if (inc.reporterUserId === userId) {
          userIncidentIds.add(inc.id);
        }
      }

      // Check merged reports using indexed/dedicated method if supported, else scan
      if (typeof store.listReportsByReporterUserId === "function") {
        const userReports = await store.listReportsByReporterUserId(userId);
        userReports.forEach((r) => userIncidentIds.add(r.incidentId));
      } else if (typeof store.listReportsByIncidentId === "function") {
        for (const inc of allIncidents) {
          if (userIncidentIds.has(inc.id)) continue;
          const reports = await store.listReportsByIncidentId(inc.id);
          if (reports.some((r) => r.reporterUserId === userId)) {
            userIncidentIds.add(inc.id);
          }
        }
      }
      return allIncidents.filter((inc) => userIncidentIds.has(inc.id));
    },
    async getMapIncidents(filters) {
      return toFeatureCollection(await store.listIncidents(filters));
    },
    async getDashboardStats(filters = {}) {
      const [incidents, officers] = await Promise.all([
        store.listIncidents(filters),
        store.listOfficers()
      ]);
      return buildDashboardStats(incidents, officers);
    },
    async getIncident(ticketId) {
      return store.getIncidentByTicketId(ticketId);
    },
    async getIncidentDetail(identifier) {
      const incident = String(identifier).toUpperCase().startsWith("KR-")
        ? await store.getIncidentByTicketId(identifier)
        : await store.getIncidentById(identifier);
      if (!incident) return null;

      const [reports, confirmations, statusUpdates] = await Promise.all([
        store.listReportsByIncidentId(incident.id),
        store.listConfirmationsByIncidentId(incident.id),
        store.listStatusUpdatesByIncidentId(incident.id)
      ]);

      const incidentWithOfficer = await withOfficer(incident, store);
      if (!incidentWithOfficer.photoUrl) {
        const reportWithPhoto = reports.find((r) => r.photoUrl);
        if (reportWithPhoto) {
          incidentWithOfficer.photoUrl = reportWithPhoto.photoUrl;
        }
      }

      // SECURITY: Sanitize public incident details so private citizen reporter contact
      // info (phone, user ID) is never leaked on public tracking endpoints.
      const sanitizedIncident = toPublicIncident(incidentWithOfficer);
      sanitizedIncident.assignedOfficer = incidentWithOfficer.assignedOfficer;

      return {
        incident: sanitizedIncident,
        reports: reports.map(toPublicReport),
        confirmations: confirmations.map(toPublicConfirmation),
        statusUpdates: statusUpdates.map(toPublicStatusUpdate),
        timeline: buildTimeline(incident, reports, confirmations, statusUpdates)
      };
    },
    async detectWard(lat, lng) {
      if (lat === null || lng === null || lat === undefined || lng === undefined || lat === "" || lng === "") {
        const error = new Error("lat and lng query parameters are required.");
        error.status = 400;
        throw error;
      }
      const point = toPoint(lng, lat);
      return resolveWard(store, point);
    },
    async submitReport(payload, actor = null) {
      validateReportPayload(payload);
      const now = new Date().toISOString();
      const point = toPoint(payload.lng, payload.lat);
      const existingIncidents = await store.listIncidents();
      const ward = await resolveWard(store, point);
      const officer = ward ? await store.getOfficerById(ward.officerId) : null;
      const duplicate = findDuplicateIncident(existingIncidents, point, payload.issueType);

      // SECURITY: If authenticated, derive reporter details strictly from verified token (actor).
      // If guest/anonymous, never trust client-supplied reporterUserId.
      const reporterUserId = actor ? actor.sub : null;
      const reporterName = actor ? (actor.name || "Verified Citizen") : "Anonymous Resident";
      const reporterPhone = actor ? (actor.phone || null) : (payload.phone ? String(payload.phone).trim() : null);

      if (duplicate) {
        const report = await store.createReport({
          id: randomUUID(),
          incidentId: duplicate.id,
          reporterUserId,
          deviceHash: payload.deviceHash || (actor ? actor.sub : "anonymous-device"),
          issueType: payload.issueType,
          description: payload.description || null,
          location: point,
          gpsAccuracyMeters: Number(payload.gpsAccuracyMeters || payload.gpsAccuracy || 0),
          photoUrl: payload.photoUrl || null,
          createdAt: now,
          capturedAt: payload.capturedAt || now
        });

        const reportCount = duplicate.reportCount + 1;
        const patch = {
          reportCount,
          description: payload.description || duplicate.description,
          priority: calculatePriority({ ...duplicate, reportCount })
        };
        if (!duplicate.photoUrl && payload.photoUrl) {
          patch.photoUrl = payload.photoUrl;
        }
        const updated = await store.updateIncident(duplicate.id, patch);

        return {
          merged: true,
          report,
          incident: await withOfficer(updated, store),
          ward,
          officer
        };
      }

      const incidentId = randomUUID();
      const ticketId = generateTicketId(new Date(), nextSequenceFromIncidents(existingIncidents));
      const incident = {
        id: incidentId,
        ticketId,
        title: payload.title || (ward ? `Ward ${ward.wardNumber} - ${ward.wardName}` : "Jaipur Waste Report"),
        description: payload.description || "Civic waste report submitted with GPS evidence.",
        issueType: payload.issueType,
        department: payload.department || inferDepartment(payload.issueType),
        status: "open",
        priority: "medium",
        reportCount: 1,
        location: point,
        wardNumber: ward?.wardNumber || null,
        wardName: ward?.wardName || "Ward pending detection",
        zone: ward?.zone || "Jaipur Municipal Jurisdiction",
        assignedOfficerId: officer?.id || null,
        reporterUserId,
        reporterName,
        reporterPhone,
        photoUrl: payload.photoUrl || null,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
        closedAt: null
      };
      incident.priority = calculatePriority(incident);

      await store.createIncident(incident);
      const report = await store.createReport({
        id: randomUUID(),
        incidentId,
        reporterUserId,
        deviceHash: payload.deviceHash || (actor ? actor.sub : "anonymous-device"),
        issueType: payload.issueType,
        description: payload.description || null,
        location: point,
        gpsAccuracyMeters: Number(payload.gpsAccuracyMeters || payload.gpsAccuracy || 0),
        photoUrl: payload.photoUrl || null,
        createdAt: now,
        capturedAt: payload.capturedAt || now
      });

      return {
        merged: false,
        report,
        incident: await withOfficer(incident, store),
        ward,
        officer
      };
    },
    async confirmIncident(id, payload = {}, actor = null) {
      const incident = String(id).toUpperCase().startsWith("KR-")
        ? await store.getIncidentByTicketId(id)
        : await store.getIncidentById(id);
      if (!incident) return null;

      if (["resolved", "closed"].includes(incident.status)) {
        const error = new Error("Cannot confirm an incident that is already resolved or closed.");
        error.status = 400;
        throw error;
      }

      const deviceHash = (actor ? actor.sub : payload.deviceHash) || "anonymous-device";
      if (deviceHash !== "anonymous-device") {
        const existingConfirmations = await store.listConfirmationsByIncidentId(incident.id);
        if (existingConfirmations.some((c) => c.deviceHash === deviceHash)) {
          const error = new Error("You have already confirmed this civic incident.");
          error.status = 409;
          throw error;
        }
      }

      let confirmationPoint = null;
      if (payload.lng !== undefined && payload.lat !== undefined && payload.lng !== null && payload.lat !== null) {
        confirmationPoint = toPoint(payload.lng, payload.lat);
      }

      const now = new Date().toISOString();
      const confirmation = await store.createConfirmation({
        id: randomUUID(),
        incidentId: incident.id,
        deviceHash,
        location: confirmationPoint,
        createdAt: now
      });
      const reportCount = incident.reportCount + 1;
      const updated = await store.updateIncident(incident.id, {
        reportCount,
        priority: calculatePriority({ ...incident, reportCount })
      });
      return { confirmation, incident: await withOfficer(updated, store) };
    },
    async updateStatus(id, payload, actor = null) {
      validateStatus(payload.status);
      const incident = String(id).toUpperCase().startsWith("KR-")
        ? await store.getIncidentByTicketId(id)
        : await store.getIncidentById(id);
      if (!incident) return null;
      const now = new Date().toISOString();
      const isResolved = payload.status === "resolved";
      const isClosed = payload.status === "closed";
      const patch = {
        status: payload.status,
        resolvedAt: isResolved ? now : (isClosed ? incident.resolvedAt : null),
        closedAt: isClosed ? now : null
      };
      const updated = await store.updateIncident(incident.id, patch);
      await store.createStatusUpdate({
        id: randomUUID(),
        incidentId: incident.id,
        actorId: actor ? actor.sub : (payload.actorId || "admin-system"),
        fromStatus: incident.status,
        toStatus: payload.status,
        note: payload.note || null,
        proofPhotoUrl: payload.proofPhotoUrl || null,
        createdAt: now
      });
      return withOfficer(updated, store);
    },
    async assignIncident(id, payload, actor = null) {
      const incident = String(id).toUpperCase().startsWith("KR-")
        ? await store.getIncidentByTicketId(id)
        : await store.getIncidentById(id);
      if (!incident) return null;
      let officer = null;
      if (payload.officerId) {
        officer = await store.getOfficerById(payload.officerId);
        if (!officer) {
          const error = new Error("officerId was not found.");
          error.status = 400;
          throw error;
        }
      }
      const department = payload.department || incident.department || inferDepartment(incident.issueType);
      let assignedOfficerId = incident.assignedOfficerId;
      if (officer) {
        assignedOfficerId = officer.id;
      } else if (payload.officerId === "" || payload.officerId === null) {
        assignedOfficerId = null;
      }

      const patch = {
        department,
        assignedOfficerId,
        status: incident.status === "open" ? "assigned" : incident.status
      };
      if (payload.priority) {
        validatePriority(payload.priority);
        patch.priority = payload.priority;
      }
      const updated = await store.updateIncident(incident.id, patch);

      const now = new Date().toISOString();
      const note = payload.note || (officer
        ? `Routed to Department: ${department}; Assigned to Officer ${officer.name}`
        : `Routed to Department: ${department}`);

      await store.createStatusUpdate({
        id: randomUUID(),
        incidentId: incident.id,
        actorId: actor ? actor.sub : (payload.actorId || "admin-system"),
        fromStatus: incident.status,
        toStatus: patch.status,
        note,
        createdAt: now
      });

      return withOfficer(updated, store);
    },
    async getWardRanking() {
      const ranking = new Map();
      for (const incident of await store.listIncidents()) {
        const key = incident.wardNumber || "unknown";
        const row = ranking.get(key) || {
          wardNumber: incident.wardNumber,
          wardName: incident.wardName,
          zone: incident.zone,
          reportCount: 0,
          incidentCount: 0,
          openCount: 0,
          criticalCount: 0
        };
        row.reportCount += incident.reportCount;
        row.incidentCount += 1;
        if (!["resolved", "closed"].includes(incident.status)) row.openCount += 1;
        if (incident.priority === "critical") row.criticalCount += 1;
        ranking.set(key, row);
      }
      return Array.from(ranking.values()).sort((a, b) => b.reportCount - a.reportCount);
    },
    async listOfficers() {
      return store.listOfficers();
    },
    async listWards() {
      return store.listWards();
    },
    async reset() {
      await store.reset();
      return { ok: true };
    }
  };
}

async function resolveWard(store, point) {
  if (typeof store.findWardByPoint === "function") {
    return store.findWardByPoint(point);
  }
  return detectWard(point, await store.listWards());
}

function findDuplicateIncident(incidents, point, issueType) {
  const cutoff = Date.now() - DUPLICATE_WINDOW_HOURS * 36e5;
  return incidents
    .filter((incident) => !["resolved", "closed"].includes(incident.status))
    .filter((incident) => new Date(incident.createdAt).getTime() >= cutoff)
    .filter((incident) => areCompatibleIssueTypes(incident.issueType, issueType))
    .map((incident) => ({ incident, distance: distanceMeters(point, incident.location) }))
    .filter((candidate) => candidate.distance <= DUPLICATE_DISTANCE_METERS)
    .sort((a, b) => a.distance - b.distance)[0]?.incident || null;
}

async function withOfficer(incident, store) {
  if (!incident) return null;
  return {
    ...incident,
    assignedOfficer: incident.assignedOfficerId ? await store.getOfficerById(incident.assignedOfficerId) : null
  };
}

function toFeatureCollection(incidents) {
  return {
    type: "FeatureCollection",
    features: incidents.map((incident) => ({
      type: "Feature",
      id: incident.id,
      geometry: incident.location,
      properties: {
        id: incident.id,
        ticketId: incident.ticketId,
        title: incident.title,
        issueType: incident.issueType,
        department: incident.department || inferDepartment(incident.issueType),
        status: incident.status,
        priority: incident.priority,
        reportCount: incident.reportCount,
        wardNumber: incident.wardNumber,
        wardName: incident.wardName,
        zone: incident.zone,
        // Privacy protection: Do not expose private resident names/contacts on public map
        reporterLabel: incident.wardNumber ? `Ward ${incident.wardNumber} Resident` : "Jaipur Resident",
        photoUrl: incident.photoUrl || null,
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt
      }
    }))
  };
}

export function toPublicIncident(incident) {
  if (!incident) return null;
  return {
    id: incident.id,
    ticketId: incident.ticketId,
    title: incident.title,
    description: incident.description,
    issueType: incident.issueType,
    department: incident.department || inferDepartment(incident.issueType),
    status: incident.status,
    priority: incident.priority,
    reportCount: incident.reportCount,
    location: incident.location,
    photoUrl: incident.photoUrl || null,
    wardNumber: incident.wardNumber,
    wardName: incident.wardName,
    zone: incident.zone,
    assignedOfficerId: incident.assignedOfficerId,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    resolvedAt: incident.resolvedAt,
    closedAt: incident.closedAt
  };
}

function buildDashboardStats(incidents, officers) {
  const activeStatuses = new Set(["open", "verified", "assigned", "in_progress", "reopened"]);
  const totals = {
    incidents: incidents.length,
    reports: sum(incidents, "reportCount"),
    activeIncidents: incidents.filter((incident) => activeStatuses.has(incident.status)).length,
    resolvedIncidents: incidents.filter((incident) => ["resolved", "closed"].includes(incident.status)).length,
    criticalIncidents: incidents.filter((incident) => incident.priority === "critical").length
  };

  return {
    totals,
    byStatus: countBy(incidents, "status"),
    byPriority: countBy(incidents, "priority"),
    byIssueType: countBy(incidents, "issueType"),
    byDepartment: countBy(incidents, "department"),
    wardHotspots: wardHotspots(incidents),
    officerWorkload: officers.map((officer) => {
      const assigned = incidents.filter((incident) => incident.assignedOfficerId === officer.id);
      return {
        officerId: officer.id,
        name: officer.name,
        role: officer.role,
        zone: officer.zone,
        organisation: officer.organisation,
        activeCount: assigned.filter((incident) => activeStatuses.has(incident.status)).length,
        totalAssigned: assigned.length,
        criticalCount: assigned.filter((incident) => incident.priority === "critical").length
      };
    }).sort((a, b) => b.activeCount - a.activeCount || b.criticalCount - a.criticalCount)
  };
}

function wardHotspots(incidents) {
  const rows = new Map();
  for (const incident of incidents) {
    const key = incident.wardNumber || "unknown";
    const row = rows.get(key) || {
      wardNumber: incident.wardNumber,
      wardName: incident.wardName,
      zone: incident.zone,
      reportCount: 0,
      incidentCount: 0,
      activeCount: 0,
      criticalCount: 0
    };
    row.reportCount += incident.reportCount;
    row.incidentCount += 1;
    if (!["resolved", "closed"].includes(incident.status)) row.activeCount += 1;
    if (incident.priority === "critical") row.criticalCount += 1;
    rows.set(key, row);
  }
  return Array.from(rows.values()).sort((a, b) => b.reportCount - a.reportCount);
}

function countBy(items, key) {
  return items.reduce((result, item) => {
    const value = item[key] || "unknown";
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function buildTimeline(incident, reports, confirmations, statusUpdates) {
  return [
    {
      type: "incident_created",
      label: "Incident created",
      status: incident.status,
      createdAt: incident.createdAt
    },
    ...reports.map((report) => ({
      type: "report_received",
      label: "Citizen report received",
      issueType: report.issueType,
      createdAt: report.createdAt
    })),
    ...confirmations.map((confirmation) => ({
      type: "citizen_confirmation",
      label: "Citizen confirmed this issue",
      createdAt: confirmation.createdAt
    })),
    ...statusUpdates.map((update) => ({
      type: "status_update",
      label: `Status changed to ${update.toStatus}`,
      fromStatus: update.fromStatus,
      toStatus: update.toStatus,
      note: update.note,
      proofPhotoUrl: update.proofPhotoUrl,
      createdAt: update.createdAt
    }))
  ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function toPublicReport(report) {
  return {
    id: report.id,
    incidentId: report.incidentId,
    issueType: report.issueType,
    description: report.description,
    location: report.location,
    gpsAccuracyMeters: report.gpsAccuracyMeters,
    photoUrl: report.photoUrl,
    createdAt: report.createdAt,
    capturedAt: report.capturedAt
  };
}

function toPublicConfirmation(confirmation) {
  return {
    id: confirmation.id,
    incidentId: confirmation.incidentId,
    location: confirmation.location,
    createdAt: confirmation.createdAt
  };
}

function toPublicStatusUpdate(update) {
  return {
    id: update.id,
    incidentId: update.incidentId,
    actorId: update.actorId,
    fromStatus: update.fromStatus,
    toStatus: update.toStatus,
    note: update.note,
    proofPhotoUrl: update.proofPhotoUrl,
    createdAt: update.createdAt
  };
}
