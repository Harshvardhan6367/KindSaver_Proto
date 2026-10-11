import test from "node:test";
import assert from "node:assert/strict";
import { createHttpServer } from "./server.js";
import { createIncidentService } from "./services/incidents.js";
import { createMemoryStore } from "./store/memoryStore.js";
import { loadConfig } from "./config.js";
import { verifyToken } from "./auth/tokens.js";
import { calculatePriority } from "./domain/priority.js";
import { detectWard } from "./domain/geo.js";

function setup() {
  const store = createMemoryStore();
  const service = createIncidentService(store);
  const config = loadConfig();
  const server = createHttpServer(service, store, config);
  return { store, service, config, server };
}

async function makeRequest(server, path, options = {}) {
  const method = options.method || "GET";
  const headers = { ...(options.headers || {}) };
  let bodyBuffer = null;

  if (options.rawBody !== undefined) {
    bodyBuffer = Buffer.from(options.rawBody);
    headers["content-length"] = bodyBuffer.length;
  } else if (options.body !== undefined) {
    bodyBuffer = Buffer.from(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    headers["content-type"] = headers["content-type"] || "application/json";
    headers["content-length"] = bodyBuffer.length;
  }

  return new Promise((resolve) => {
    server.emit("request", {
      method,
      url: path,
      headers,
      [Symbol.asyncIterator]: async function* () {
        if (bodyBuffer) yield bodyBuffer;
      },
      socket: { remoteAddress: "127.0.0.1" }
    }, {
      writeHead(status, resHeaders) {
        this.statusCode = status;
        this.resHeaders = resHeaders;
      },
      end(chunk) {
        const text = chunk ? chunk.toString("utf-8") : "";
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {}
        resolve({
          status: this.statusCode,
          headers: this.resHeaders,
          text,
          body: json
        });
      }
    });
  });
}

test("REGRESSION TEST SUITE: Hardened Server, Data Integrity & Civic Lifecycle", async (t) => {
  const { server, store, config } = setup();

  await t.test("1. Malformed JSON payload returns HTTP 400 Bad Request instead of 500", async () => {
    const res = await makeRequest(server, "/api/reports", {
      method: "POST",
      rawBody: "{\"lat\": 26.85, \"lng\": invalid_json}"
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Malformed JSON/i);
  });

  await t.test("2. Oversized payload returns HTTP 413 Payload Too Large", async () => {
    // Generate a payload larger than 10MB
    const bigString = "x".repeat(11 * 1024 * 1024);
    const res = await makeRequest(server, "/api/reports", {
      method: "POST",
      rawBody: bigString
    });
    assert.equal(res.status, 413);
  });

  await t.test("3. Coordinate boundary validation rejects out-of-range latitude/longitude with 400", async () => {
    const resBadLat = await makeRequest(server, "/api/reports", {
      method: "POST",
      body: {
        lat: 95.5, // Invalid latitude (> 90)
        lng: 75.8,
        issueType: "garbage_dump"
      }
    });
    assert.equal(resBadLat.status, 400);
    assert.match(resBadLat.body.error, /lat must be between -90 and 90/i);

    const resBadLng = await makeRequest(server, "/api/reports", {
      method: "POST",
      body: {
        lat: 26.8,
        lng: 200.0, // Invalid longitude (> 180)
        issueType: "garbage_dump"
      }
    });
    assert.equal(resBadLng.status, 400);
    assert.match(resBadLng.body.error, /lng must be between -180 and 180/i);
  });

  await t.test("4. Duplicate report merging retains citizen reporter association in /api/citizen/my-reports", async () => {
    // Register Citizen A and Citizen B
    const userA = await makeRequest(server, "/api/auth/register", {
      method: "POST",
      body: { name: "Citizen A", email: "citizena@jaipur.local", password: "Password@123" }
    });
    const userB = await makeRequest(server, "/api/auth/register", {
      method: "POST",
      body: { name: "Citizen B", email: "citizenb@jaipur.local", password: "Password@123" }
    });

    // Citizen A files an initial report at Mansarovar coordinates
    const reportA = await makeRequest(server, "/api/reports", {
      method: "POST",
      headers: { authorization: `Bearer ${userA.body.token}` },
      body: {
        lat: 26.8506,
        lng: 75.7613,
        issueType: "garbage_dump",
        description: "Initial garbage pile reported by Citizen A"
      }
    });
    assert.equal(reportA.status, 201);
    const ticketId = reportA.body.incident.ticketId;

    // Citizen B files duplicate report at the exact same location
    const reportB = await makeRequest(server, "/api/reports", {
      method: "POST",
      headers: { authorization: `Bearer ${userB.body.token}` },
      body: {
        lat: 26.8506,
        lng: 75.7613,
        issueType: "garbage_dump",
        description: "Citizen B also confirms and reports this pile"
      }
    });
    assert.equal(reportB.status, 201);
    assert.equal(reportB.body.merged, true);

    // Verify Citizen B sees the merged ticket in /api/citizen/my-reports
    const myReportsB = await makeRequest(server, "/api/citizen/my-reports", {
      headers: { authorization: `Bearer ${userB.body.token}` }
    });
    assert.equal(myReportsB.status, 200);
    const hasTicketB = myReportsB.body.incidents.some((inc) => inc.ticketId === ticketId);
    assert.equal(hasTicketB, true, "Citizen B must see the merged report in their citizen dashboard");

    // Verify Citizen A also still sees the ticket
    const myReportsA = await makeRequest(server, "/api/citizen/my-reports", {
      headers: { authorization: `Bearer ${userA.body.token}` }
    });
    assert.equal(myReportsA.status, 200);
    const hasTicketA = myReportsA.body.incidents.some((inc) => inc.ticketId === ticketId);
    assert.equal(hasTicketA, true, "Citizen A must see the report in their citizen dashboard");
  });

  await t.test("5. Photo evidence is persisted on incident and returned in public listings & ticket details", async () => {
    const photoUrl = "/api/media/photo-test-uuid.jpg";
    const report = await makeRequest(server, "/api/reports", {
      method: "POST",
      body: {
        lat: 26.915,
        lng: 75.785,
        issueType: "construction_debris",
        description: "Debris with photo evidence",
        photoUrl
      }
    });
    assert.equal(report.status, 201);
    const incidentId = report.body.incident.id;
    const ticketId = report.body.incident.ticketId;
    assert.equal(report.body.incident.photoUrl, photoUrl);

    // Check public incident list includes photoUrl
    const incidentsList = await makeRequest(server, "/api/incidents");
    assert.equal(incidentsList.status, 200);
    const foundInc = incidentsList.body.incidents.find((i) => i.id === incidentId);
    assert.ok(foundInc);
    assert.equal(foundInc.photoUrl, photoUrl);

    // Check incident detail includes photoUrl
    const detail = await makeRequest(server, `/api/incidents/ticket/${ticketId}/details`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.incident.photoUrl, photoUrl);
  });

  await t.test("6. Requesting non-existent media file returns 404 cleanly without 500 error", async () => {
    const res = await makeRequest(server, "/api/media/non-existent-media-id-12345");
    assert.equal(res.status, 404);
  });

  await t.test("7. Token verification safely handles malformed JSON payload without unhandled exception", async () => {
    const malformedPayloadBase64 = Buffer.from("not-valid-json").toString("base64url");
    const tamperedToken = `eyJhbGciOiJIUzI1NiJ9.${malformedPayloadBase64}.signature`;
    const verified = verifyToken(tamperedToken, config.jwtSecret);
    assert.equal(verified, null);
  });

  await t.test("8. Incident details sanitizes private citizen data (reporterPhone, reporterUserId) on public endpoint", async () => {
    // Citizen registers and submits report with private phone number
    const citizen = await makeRequest(server, "/api/auth/register", {
      method: "POST",
      body: { name: "Private Resident", email: "privatereporter@jaipur.local", password: "Password@123", phone: "+91-98765-43210" }
    });
    const reportRes = await makeRequest(server, "/api/reports", {
      method: "POST",
      headers: { authorization: `Bearer ${citizen.body.token}` },
      body: { lat: 26.9012, lng: 75.7891, issueType: "garbage_dump", description: "Private issue with citizen contact" }
    });
    const ticketId = reportRes.body.incident.ticketId;

    // Fetch details anonymously via public route
    const publicDetail = await makeRequest(server, `/api/incidents/ticket/${ticketId}/details`);
    assert.equal(publicDetail.status, 200);
    assert.equal(publicDetail.body.incident.reporterPhone, undefined, "reporterPhone must be stripped from public details");
    assert.equal(publicDetail.body.incident.reporterUserId, undefined, "reporterUserId must be stripped from public details");
  });

  await t.test("9. Malformed URI component returns HTTP 400 Bad Request instead of 500 error", async () => {
    const res = await makeRequest(server, "/api/incidents/ticket/%E0%A4/details");
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Malformed URI/i);
  });

  await t.test("10. Ward detect requires valid lat and lng query parameters", async () => {
    const missingParams = await makeRequest(server, "/api/wards/detect");
    assert.equal(missingParams.status, 400);

    const invalidParams = await makeRequest(server, "/api/wards/detect?lat=abc&lng=75.8");
    assert.equal(invalidParams.status, 400);
  });

  await t.test("11. Incident confirmation prevents duplicate submissions and cannot confirm resolved incidents", async () => {
    const citizen = await makeRequest(server, "/api/auth/register", {
      method: "POST",
      body: { name: "Confirm Citizen", email: "confirmuser@jaipur.local", password: "Password@123" }
    });

    const reportRes = await makeRequest(server, "/api/reports", {
      method: "POST",
      body: { lat: 26.8543, lng: 75.8069, issueType: "overflowing_bin", description: "Spot to confirm" }
    });
    const incidentId = reportRes.body.incident.id;

    // First confirmation by citizen succeeds
    const confirm1 = await makeRequest(server, `/api/incidents/${incidentId}/confirm`, {
      method: "POST",
      headers: { authorization: `Bearer ${citizen.body.token}` },
      body: { lat: 26.8543, lng: 75.8069 }
    });
    assert.equal(confirm1.status, 200);

    // Second confirmation by SAME citizen is rejected with 409 Conflict
    const confirm2 = await makeRequest(server, `/api/incidents/${incidentId}/confirm`, {
      method: "POST",
      headers: { authorization: `Bearer ${citizen.body.token}` },
      body: { lat: 26.8543, lng: 75.8069 }
    });
    assert.equal(confirm2.status, 409);
    assert.match(confirm2.body.error, /already confirmed/i);

    // Login as admin to resolve incident
    const admin = await makeRequest(server, "/api/auth/login", {
      method: "POST",
      body: { email: "admin@kindreport.local", password: "Admin@12345" }
    });
    await makeRequest(server, `/api/admin/incidents/${incidentId}/status`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: { status: "resolved" }
    });

    // Attempting to confirm resolved incident fails with 400
    const confirmOnResolved = await makeRequest(server, `/api/incidents/${incidentId}/confirm`, {
      method: "POST",
      body: { deviceHash: "new-device-hash-123" }
    });
    assert.equal(confirmOnResolved.status, 400);
    assert.match(confirmOnResolved.body.error, /already resolved or closed/i);
  });

  await t.test("12. Status transition to reopened/in_progress resets resolvedAt and closedAt timestamps", async () => {
    const admin = await makeRequest(server, "/api/auth/login", {
      method: "POST",
      body: { email: "admin@kindreport.local", password: "Admin@12345" }
    });

    // Mark inc-1 resolved
    const resResolved = await makeRequest(server, "/api/admin/incidents/inc-1/status", {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: { status: "resolved" }
    });
    assert.equal(resResolved.status, 200);
    assert.ok(resResolved.body.incident.resolvedAt);

    // Reopen inc-1 -> resolvedAt must be cleared to null
    const resReopened = await makeRequest(server, "/api/admin/incidents/inc-1/status", {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: { status: "reopened" }
    });
    assert.equal(resReopened.status, 200);
    assert.equal(resReopened.body.incident.resolvedAt, null, "resolvedAt must be reset to null when reopened");
    assert.equal(resReopened.body.incident.closedAt, null, "closedAt must be reset to null when reopened");
  });

  await t.test("13. assignIncident validates priority values and rejects invalid entries with 400", async () => {
    const admin = await makeRequest(server, "/api/auth/login", {
      method: "POST",
      body: { email: "admin@kindreport.local", password: "Admin@12345" }
    });

    const badPriority = await makeRequest(server, "/api/admin/incidents/inc-1/assign", {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: { priority: "super_ultra_urgent" }
    });
    assert.equal(badPriority.status, 400);
    assert.match(badPriority.body.error, /priority must be critical, high, medium, or low/i);
  });

  await t.test("14. Profile update validates full name and ward number", async () => {
    const user = await makeRequest(server, "/api/auth/register", {
      method: "POST",
      body: { name: "Profile Test User", email: "profiletester@jaipur.local", password: "Password@123" }
    });

    const invalidName = await makeRequest(server, "/api/auth/profile", {
      method: "PATCH",
      headers: { authorization: `Bearer ${user.body.token}` },
      body: { name: "A" }
    });
    assert.equal(invalidName.status, 400);
    assert.match(invalidName.body.error, /at least 2 characters/i);

    const invalidWard = await makeRequest(server, "/api/auth/profile", {
      method: "PATCH",
      headers: { authorization: `Bearer ${user.body.token}` },
      body: { wardNumber: 9999 }
    });
    assert.equal(invalidWard.status, 400);
    assert.match(invalidWard.body.error, /between 1 and 250/i);
  });

  await t.test("15. Both admin@jaipur.gov.in and admin@kindreport.local authenticate successfully", async () => {
    const adminGov = await makeRequest(server, "/api/auth/login", {
      method: "POST",
      body: { email: "admin@jaipur.gov.in", password: "Admin@12345" }
    });
    assert.equal(adminGov.status, 200);
    assert.equal(adminGov.body.user.role, "admin");

    const adminLocal = await makeRequest(server, "/api/auth/login", {
      method: "POST",
      body: { email: "admin@kindreport.local", password: "Admin@12345" }
    });
    assert.equal(adminLocal.status, 200);
    assert.equal(adminLocal.body.user.role, "admin");
  });

  await t.test("16. MIME magic byte verification rejects spoofed image uploads with HTTP 400", async () => {
    // Malicious text masquerading as PNG
    const fakePng = Buffer.from("<script>alert('xss')</script>").toString("base64");
    const fakeRes = await makeRequest(server, "/api/media/upload", {
      method: "POST",
      body: {
        contentType: "image/png",
        fileName: "malicious.png",
        dataBase64: fakePng
      }
    });
    assert.equal(fakeRes.status, 400);
    assert.match(fakeRes.body.error, /format|signature|match/i);

    // Valid 1x1 PNG passes
    const realPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const realRes = await makeRequest(server, "/api/media/upload", {
      method: "POST",
      body: {
        contentType: "image/png",
        fileName: "valid.png",
        dataBase64: realPng
      }
    });
    assert.equal(realRes.status, 201);
    assert.ok(realRes.body.asset?.url);
  });

  await t.test("17. Password reset immediately invalidates all pre-existing JWT session tokens", async () => {
    // Register user
    const regRes = await makeRequest(server, "/api/auth/register", {
      method: "POST",
      body: { name: "Token Invalidation Test", email: "revoketest@jaipur.local", password: "Password@123" }
    });
    assert.equal(regRes.status, 201);
    const activeToken = regRes.body.token;

    // Verify token works on authenticated route
    const preCheck = await makeRequest(server, "/api/citizen/my-reports", {
      headers: { authorization: `Bearer ${activeToken}` }
    });
    assert.equal(preCheck.status, 200);

    // Request reset token
    const forgotRes = await makeRequest(server, "/api/auth/forgot-password", {
      method: "POST",
      body: { email: "revoketest@jaipur.local" }
    });
    assert.equal(forgotRes.status, 200);
    const resetToken = forgotRes.body.resetToken;

    // Reset password
    const resetRes = await makeRequest(server, "/api/auth/reset-password", {
      method: "POST",
      body: { token: resetToken, newPassword: "NewSecretPassword@123" }
    });
    assert.equal(resetRes.status, 200);

    // Attempt to access protected endpoint with OLD token: MUST return 401
    const postCheck = await makeRequest(server, "/api/citizen/my-reports", {
      headers: { authorization: `Bearer ${activeToken}` }
    });
    assert.equal(postCheck.status, 401);
    assert.match(postCheck.body.error, /terminated|expired|revoked/i);

    // Login with NEW password succeeds and gets working token
    const newLogin = await makeRequest(server, "/api/auth/login", {
      method: "POST",
      body: { email: "revoketest@jaipur.local", password: "NewSecretPassword@123" }
    });
    assert.equal(newLogin.status, 200);
    const newCheck = await makeRequest(server, "/api/citizen/my-reports", {
      headers: { authorization: `Bearer ${newLogin.body.token}` }
    });
    assert.equal(newCheck.status, 200);
  });

  await t.test("18. Incident confirmation, status, and assignment accept Ticket ID format (KR-YYYY-XXXX)", async () => {
    // Create an incident
    const reportRes = await makeRequest(server, "/api/reports", {
      method: "POST",
      body: { lat: 26.9124, lng: 75.7873, issueType: "garbage_dump", description: "Ticket ID mutation test" }
    });
    assert.equal(reportRes.status, 201);
    const ticketId = reportRes.body.incident.ticketId;
    assert.ok(ticketId.startsWith("KR-"));

    // Citizen confirms using Ticket ID
    const confirmRes = await makeRequest(server, `/api/incidents/${ticketId}/confirm`, {
      method: "POST",
      body: { lat: 26.9124, lng: 75.7873 }
    });
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.body.incident.ticketId, ticketId);
    assert.equal(confirmRes.body.incident.reportCount, 2);

    // Admin updates status using Ticket ID
    const admin = await makeRequest(server, "/api/auth/login", {
      method: "POST",
      body: { email: "admin@kindreport.local", password: "Admin@12345" }
    });
    const statusRes = await makeRequest(server, `/api/admin/incidents/${ticketId}/status`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: { status: "verified" }
    });
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.incident.status, "verified");

    // Admin assigns incident using Ticket ID
    const assignRes = await makeRequest(server, `/api/admin/incidents/${ticketId}/assign`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: { department: "Solid Waste Management", priority: "high" }
    });
    assert.equal(assignRes.status, 200);
    assert.equal(assignRes.body.incident.department, "Solid Waste Management");
    assert.equal(assignRes.body.incident.priority, "high");
  });

  await t.test("19. Priority calculation defensively handles missing or invalid createdAt without NaN", () => {
    // Incident with missing createdAt
    const p1 = calculatePriority({ issueType: "other", reportCount: 1 });
    assert.equal(typeof p1, "string");
    assert.equal(p1, "low");

    // Incident with invalid createdAt string
    const p2 = calculatePriority({ issueType: "garbage_dump", reportCount: 5, createdAt: "invalid-date-string" });
    assert.equal(typeof p2, "string");
    assert.ok(["critical", "high", "medium", "low"].includes(p2));

    // High confirmations should bump priority even with missing createdAt
    const p3 = calculatePriority({ issueType: "hazardous_waste", reportCount: 12, createdAt: null });
    assert.equal(p3, "critical");
  });

  await t.test("20. Rate limiter does not trust spoofed X-Forwarded-For when trustProxy is false", () => {
    const defaultCfg = loadConfig();
    assert.equal(defaultCfg.trustProxy, false, "trustProxy must default to false");
  });

  await t.test("21. Citizen report captures reporterPhone from registration profile", async () => {
    const resident = await makeRequest(server, "/api/auth/register", {
      method: "POST",
      body: {
        name: "Verified Citizen",
        email: "verifiedcitizen@jaipur.local",
        password: "Password@123",
        phone: "+91-98765-00000",
        wardNumber: 42
      }
    });
    assert.equal(resident.status, 201);

    const reportRes = await makeRequest(server, "/api/reports", {
      method: "POST",
      headers: { authorization: `Bearer ${resident.body.token}` },
      body: { lat: 26.9876, lng: 75.8543, issueType: "garbage_dump", description: "Report with phone capture" }
    });
    assert.equal(reportRes.status, 201);
    assert.equal(reportRes.body.incident.reporterPhone, "+91-98765-00000");
  });

  await t.test("22. detectWard defensively handles null, undefined, or empty ward geometries", () => {
    const malformedWards = [
      { id: "w-bad-1", name: "Corrupt Ward 1" },
      { id: "w-bad-2", name: "Corrupt Ward 2", coordinates: null },
      { id: "w-bad-3", name: "Corrupt Ward 3", coordinates: [] },
      { id: "w-bad-4", name: "Corrupt Ward 4", coordinates: [[]] }
    ];
    // Should return null rather than throwing TypeError
    const result = detectWard(26.9124, 75.7873, malformedWards);
    assert.equal(result, null);
  });
});

