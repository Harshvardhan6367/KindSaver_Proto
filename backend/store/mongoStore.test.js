import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../config.js";
import { createIncidentService } from "../services/incidents.js";

const config = loadConfig();

test("MongoDB store persists and queries geospatial data", { skip: !config.mongodbUri }, async () => {
  const { createMongoStore } = await import("./mongoStore.js");
  const {
    confirmations,
    incidents,
    mediaAssets,
    officers,
    reports,
    statusUpdates,
    users,
    wards
  } = await import("../data/seed.js");

  const store = await createMongoStore({
    ...config,
    storageDriver: "mongodb"
  });
  const service = createIncidentService(store);

  try {
    await store.replaceAll({
      incidents,
      reports,
      wards,
      officers,
      confirmations,
      statusUpdates,
      users,
      mediaAssets
    });

    const ward = await service.detectWard(26.8543, 75.8069);
    const result = await service.submitReport({
      lat: 26.8543,
      lng: 75.8069,
      issueType: "overflowing_bin",
      description: "Mongo duplicate report",
      gpsAccuracyMeters: 8
    });

    assert.equal(ward.wardNumber, 38);
    assert.equal(result.merged, true);
    assert.equal(result.incident.reportCount, 20);
  } finally {
    await store.close();
  }
});
