import test from "node:test";
import assert from "node:assert/strict";
import { createIncidentService } from "./incidents.js";
import { nearestWard, toPoint } from "../domain/geo.js";
import { createMemoryStore } from "../store/memoryStore.js";

test("detects Jaipur ward from GPS point", async () => {
  const service = createIncidentService(createMemoryStore());
  const ward = await service.detectWard(26.8543, 75.8069);
  assert.equal(ward.wardNumber, 38);
});

test("merges duplicate report into nearby active incident", async () => {
  const service = createIncidentService(createMemoryStore());
  const result = await service.submitReport({
    lat: 26.8543,
    lng: 75.8069,
    issueType: "overflowing_bin",
    description: "Same bin reported again",
    gpsAccuracyMeters: 10
  });
  assert.equal(result.merged, true);
  assert.equal(result.incident.ticketId, "KR-2026-0004");
  assert.equal(result.incident.reportCount, 20);
});

test("creates new incident for a non-duplicate report", async () => {
  const service = createIncidentService(createMemoryStore());
  const result = await service.submitReport({
    lat: 26.912,
    lng: 75.799,
    issueType: "hazardous_waste",
    description: "New hazardous waste point",
    gpsAccuracyMeters: 9
  });
  assert.equal(result.merged, false);
  assert.equal(result.incident.ticketId, "KR-2026-0016");
});

test("updates incident status", async () => {
  const service = createIncidentService(createMemoryStore());
  const result = await service.updateStatus("inc-2", {
    status: "in_progress",
    note: "Field team dispatched"
  });
  assert.equal(result.status, "in_progress");
});

test("builds dashboard stats for active Jaipur operations", async () => {
  const service = createIncidentService(createMemoryStore());
  const stats = await service.getDashboardStats({ active: "true" });

  assert.equal(stats.totals.activeIncidents, 11);
  assert.equal(stats.totals.resolvedIncidents, 0);
  assert.equal(stats.byPriority.critical, 5);
  assert.equal(stats.wardHotspots[0].wardNumber, 67);
  assert.ok(stats.officerWorkload.some((row) => row.officerId === "officer-mukesh" && row.criticalCount === 1));
});

test("returns citizen-safe incident detail with timeline", async () => {
  const service = createIncidentService(createMemoryStore());
  await service.confirmIncident("inc-4", { deviceHash: "device-1" });
  await service.updateStatus("inc-4", {
    status: "in_progress",
    actorId: "officer-anita",
    note: "Cleanup vehicle assigned"
  });

  const detail = await service.getIncidentDetail("KR-2026-0004");
  assert.equal(detail.incident.id, "inc-4");
  assert.equal(detail.reports.length, 1);
  assert.equal(detail.confirmations.length, 1);
  assert.equal(detail.statusUpdates.length, 1);
  assert.ok(detail.timeline.some((event) => event.type === "citizen_confirmation"));
  assert.ok(detail.timeline.some((event) => event.toStatus === "in_progress"));
  assert.equal("deviceHash" in detail.reports[0], false);
  assert.equal("deviceHash" in detail.confirmations[0], false);
});

test("computes nearest ward for diagnostics", async () => {
  const store = createMemoryStore();
  const nearest = nearestWard(toPoint(75.8069, 26.8543), await store.listWards());
  assert.equal(nearest.ward.wardNumber, 38);
  assert.ok(nearest.distanceMeters >= 0);
});
