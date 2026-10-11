import test from "node:test";
import assert from "node:assert/strict";
import { createHttpServer } from "./server.js";
import { createIncidentService } from "./services/incidents.js";
import { createMemoryStore } from "./store/memoryStore.js";
import { loadConfig } from "./config.js";

test("HTTP API returns map data, detects ward, and merges duplicate report", async () => {
  const store = createMemoryStore();
  const service = createIncidentService(store);
  const server = createHttpServer(service, store);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const health = await getJson(`${baseUrl}/health`);
    const map = await getJson(`${baseUrl}/api/incidents/map`);
    const stats = await getJson(`${baseUrl}/api/dashboard/stats?active=true`);
    const ward = await getJson(`${baseUrl}/api/wards/detect?lat=26.8543&lng=75.8069`);
    const detail = await getJson(`${baseUrl}/api/incidents/ticket/KR-2026-0004/details`);
    const report = await postJson(`${baseUrl}/api/reports`, {
      lat: 26.8543,
      lng: 75.8069,
      issueType: "overflowing_bin",
      description: "Same Malviya bin from API smoke test",
      gpsAccuracyMeters: 8
    });

    assert.equal(health.ok, true);
    assert.equal(map.features.length, 15);
    assert.equal(stats.totals.activeIncidents, 11);
    assert.equal(ward.ward.wardNumber, 38);
    assert.equal(detail.incident.id, "inc-4");
    assert.ok(detail.timeline.length >= 2);
    assert.equal(report.merged, true);
    assert.equal(report.incident.ticketId, "KR-2026-0004");
    assert.equal(report.incident.reportCount, 20);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("HTTP API handles authentication, media upload, and protected admin endpoints", async () => {
  const store = createMemoryStore();
  const service = createIncidentService(store);
  const config = loadConfig();
  const server = createHttpServer(service, store, config);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Unauthenticated request to admin endpoint must fail with 401
    const unauthRes = await fetch(`${baseUrl}/api/admin/incidents/inc-1/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" })
    });
    assert.equal(unauthRes.status, 401);

    // 2. Login as admin succeeds and returns token
    const loginRes = await postJson(`${baseUrl}/api/auth/login`, {
      email: "admin@kindreport.local",
      password: "Admin@12345"
    });
    assert.equal(loginRes.user.role, "admin");
    assert.ok(loginRes.token);
    const adminToken = loginRes.token;

    // 3. /api/auth/me returns current user
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.email, "admin@kindreport.local");

    // 4. Authenticated admin can update incident status
    const updateRes = await fetch(`${baseUrl}/api/admin/incidents/inc-1/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: "in_progress",
        actorId: loginRes.user.id,
        note: "Field team dispatched by admin"
      })
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.incident.status, "in_progress");

    // 5. Authenticated admin can assign officer
    const assignRes = await fetch(`${baseUrl}/api/admin/incidents/inc-1/assign`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ officerId: "officer-priya" })
    });
    assert.equal(assignRes.status, 200);
    const assigned = await assignRes.json();
    assert.equal(assigned.incident.assignedOfficerId, "officer-priya");

    // 6. Media upload handles base64 image and serves it back
    // 1x1 transparent PNG base64
    const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const uploadRes = await postJson(`${baseUrl}/api/media/upload`, {
      contentType: "image/png",
      fileName: "test-evidence.png",
      dataBase64: tinyPng,
      incidentId: "inc-1"
    });
    assert.ok(uploadRes.asset.id);
    assert.ok(uploadRes.asset.url);

    const mediaGet = await fetch(`${baseUrl}${uploadRes.asset.url}`);
    assert.equal(mediaGet.status, 200);
    assert.equal(mediaGet.headers.get("Content-Type"), "image/png");
    const bytes = await mediaGet.arrayBuffer();
    assert.ok(bytes.byteLength > 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

async function getJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true);
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true);
  return response.json();
}
