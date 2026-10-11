import {
  confirmations as seedConfirmations,
  incidents as seedIncidents,
  officers as seedOfficers,
  reports as seedReports,
  statusUpdates as seedStatusUpdates,
  users as seedUsers,
  wards as seedWards
} from "../data/seed.js";
import { detectWard } from "../domain/geo.js";

export function createMemoryStore() {
  const state = resetState();

  return {
    storageName: "memory",
    reset() {
      const fresh = resetState();
      Object.keys(state).forEach((key) => {
        state[key] = fresh[key];
      });
      return state;
    },
    replaceAll(nextState) {
      state.incidents = structuredClone(nextState.incidents || []);
      state.reports = structuredClone(nextState.reports || []);
      state.wards = structuredClone(nextState.wards || []);
      state.officers = structuredClone(nextState.officers || []);
      state.confirmations = structuredClone(nextState.confirmations || []);
      state.statusUpdates = structuredClone(nextState.statusUpdates || []);
      return state;
    },
    listIncidents(filters = {}) {
      return state.incidents.filter((incident) => {
        if (filters.status && filters.status !== "all" && incident.status !== filters.status) return false;
        if (filters.issueType && incident.issueType !== filters.issueType) return false;
        if (filters.priority && incident.priority !== filters.priority) return false;
        if (filters.wardNumber && incident.wardNumber !== Number(filters.wardNumber)) return false;
        if (filters.zone && incident.zone !== filters.zone) return false;
        if (filters.assignedOfficerId && incident.assignedOfficerId !== filters.assignedOfficerId) return false;
        if (filters.active === "true" && ["resolved", "closed"].includes(incident.status)) return false;
        return true;
      });
    },
    getIncidentById(id) {
      return state.incidents.find((incident) => incident.id === id) || null;
    },
    getIncidentByTicketId(ticketId) {
      return state.incidents.find((incident) => incident.ticketId.toUpperCase() === ticketId.toUpperCase()) || null;
    },
    createIncident(incident) {
      state.incidents.unshift(incident);
      return incident;
    },
    updateIncident(id, patch) {
      const incident = this.getIncidentById(id);
      if (!incident) return null;
      Object.assign(incident, patch, { updatedAt: new Date().toISOString() });
      return incident;
    },
    createReport(report) {
      state.reports.push(report);
      return report;
    },
    listReportsByIncidentId(incidentId) {
      return state.reports
        .filter((report) => report.incidentId === incidentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    listReportsByReporterUserId(userId) {
      return state.reports
        .filter((report) => report.reporterUserId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    createConfirmation(confirmation) {
      state.confirmations.push(confirmation);
      return confirmation;
    },
    listConfirmationsByIncidentId(incidentId) {
      return state.confirmations
        .filter((confirmation) => confirmation.incidentId === incidentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    createStatusUpdate(update) {
      state.statusUpdates.push(update);
      return update;
    },
    listStatusUpdatesByIncidentId(incidentId) {
      return state.statusUpdates
        .filter((update) => update.incidentId === incidentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    listWards() {
      return state.wards;
    },
    findWardByPoint(point) {
      return detectWard(point, state.wards);
    },
    getWardByNumber(wardNumber) {
      return state.wards.find((ward) => ward.wardNumber === Number(wardNumber)) || null;
    },
    listOfficers() {
      return state.officers;
    },
    getOfficerById(id) {
      return state.officers.find((officer) => officer.id === id) || null;
    },
    getUserById(id) {
      return state.users.find((user) => user.id === id) || null;
    },
    getUserByEmail(email) {
      return state.users.find((user) => user.email?.toLowerCase() === String(email).toLowerCase()) || null;
    },
    createUser(user) {
      state.users.push(user);
      return user;
    },
    updateUser(id, patch) {
      const user = this.getUserById(id);
      if (!user) return null;
      Object.assign(user, patch, { updatedAt: new Date().toISOString() });
      return user;
    },
    listUsers() {
      return state.users;
    },
    savePasswordResetToken(tokenRecord) {
      state.passwordResetTokens = state.passwordResetTokens || [];
      state.passwordResetTokens.push(tokenRecord);
      return tokenRecord;
    },
    getPasswordResetToken(token) {
      state.passwordResetTokens = state.passwordResetTokens || [];
      return state.passwordResetTokens.find((r) => r.token === token) || null;
    },
    invalidatePasswordResetToken(token) {
      state.passwordResetTokens = state.passwordResetTokens || [];
      const record = state.passwordResetTokens.find((r) => r.token === token);
      if (record) record.used = true;
      return record;
    },
    revokeToken(token) {
      state.revokedTokens = state.revokedTokens || new Set();
      state.revokedTokens.add(token);
    },
    isTokenRevoked(token) {
      state.revokedTokens = state.revokedTokens || new Set();
      return state.revokedTokens.has(token);
    },
    revokeUser(userId, timestampMs = Date.now()) {
      state.userRevocations = state.userRevocations || new Map();
      state.userRevocations.set(userId, timestampMs);
    },
    isUserRevoked(userId, iat, iatMs = null) {
      state.userRevocations = state.userRevocations || new Map();
      const cutoff = state.userRevocations.get(userId);
      if (cutoff === undefined) return false;
      if (iatMs !== null && iatMs !== undefined) {
        return iatMs <= cutoff;
      }
      return (iat ? iat * 1000 : 0) <= cutoff;
    },
    createMediaAsset(asset) {
      state.mediaAssets.push(asset);
      return asset;
    },
    getMediaAssetById(id) {
      return state.mediaAssets.find((asset) => asset.id === id) || null;
    },
    snapshot() {
      return structuredClone(state);
    }
  };
}

function resetState() {
  return {
    incidents: structuredClone(seedIncidents),
    reports: structuredClone(seedReports),
    wards: structuredClone(seedWards),
    officers: structuredClone(seedOfficers),
    confirmations: structuredClone(seedConfirmations),
    statusUpdates: structuredClone(seedStatusUpdates),
    users: structuredClone(seedUsers),
    mediaAssets: [],
    passwordResetTokens: [],
    revokedTokens: new Set()
  };
}
