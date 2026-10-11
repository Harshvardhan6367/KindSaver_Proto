const baseUrl = process.argv[2] || "http://127.0.0.1:4000";

console.log(`Running KindSaver Jaipur end-to-end smoke check against ${baseUrl}...`);

// 1. Health check
const health = await getJson("/health");

// 2. Map GeoJSON
const map = await getJson("/api/incidents/map");

// 3. Ward detection
const ward = await getJson("/api/wards/detect?lat=26.8543&lng=75.8069");

// 4. Citizen report submission
const report = await postJson("/api/reports", {
  lat: 26.8543,
  lng: 75.8069,
  issueType: "overflowing_bin",
  description: "Smoke test duplicate report near Malviya Nagar",
  gpsAccuracyMeters: 8,
  deviceHash: "smoke-test-device"
});

// 5. Citizen ticket tracking
const ticketDetail = await getJson(`/api/incidents/ticket/${encodeURIComponent(report.incident.ticketId)}/details`);

// 6. Citizen confirmation
const confirmation = await postJson(`/api/incidents/${report.incident.id}/confirm`, {
  lat: 26.8543,
  lng: 75.8069,
  deviceHash: "smoke-test-confirm-device"
});

// 7. Civic staff authentication
const auth = await postJson("/api/auth/login", {
  email: "admin@kindreport.local",
  password: "Admin@12345"
});

// 8. Media evidence upload
const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const mediaUpload = await postJson("/api/media/upload", {
  contentType: "image/png",
  fileName: "smoke-evidence.png",
  dataBase64: tinyPng,
  incidentId: report.incident.id
}, auth.token);

// 9. Admin status update with note and photo
const statusUpdate = await patchJson(`/api/admin/incidents/${report.incident.id}/status`, {
  status: "in_progress",
  actorId: auth.user.id,
  note: "Field team assigned via smoke test",
  proofPhotoUrl: mediaUpload.asset.url
}, auth.token);

// 10. Admin officer assignment
const assignment = await patchJson(`/api/admin/incidents/${report.incident.id}/assign`, {
  officerId: "officer-anita"
}, auth.token);

console.log(JSON.stringify({
  ok: true,
  service: health.service,
  storage: health.storage,
  mapFeatureCount: map.features.length,
  detectedWard: ward.ward?.wardNumber,
  submittedReport: {
    ticketId: report.incident.ticketId,
    merged: report.merged,
    reportCount: confirmation.incident.reportCount
  },
  timelineEventsCount: ticketDetail.timeline.length,
  auth: {
    userName: auth.user.name,
    userRole: auth.user.role
  },
  mediaAssetId: mediaUpload.asset.id,
  adminWorkflow: {
    newStatus: statusUpdate.incident.status,
    assignedOfficer: assignment.incident.assignedOfficer?.name
  }
}, null, 2));

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
  return response.json();
}

async function postJson(path, body, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
  return response.json();
}

async function patchJson(path, body, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
  return response.json();
}
