import { loadConfig } from "../config.js";
import { createIncidentService } from "../services/incidents.js";
import { createMongoStore } from "../store/mongoStore.js";

const config = loadConfig();

if (config.storageDriver !== "mongodb") {
  console.error("Set STORAGE_DRIVER=mongodb before verifying MongoDB.");
  process.exit(1);
}

const store = await createMongoStore(config);
const service = createIncidentService(store);

try {
  const snapshot = await store.snapshot();
  const ward = await service.detectWard(26.8543, 75.8069);
  const map = await service.getMapIncidents({});

  console.log(JSON.stringify({
    ok: true,
    database: config.mongodbDb,
    counts: {
      incidents: snapshot.incidents.length,
      reports: snapshot.reports.length,
      wards: snapshot.wards.length,
      officers: snapshot.officers.length
    },
    sampleWardDetection: ward ? {
      wardNumber: ward.wardNumber,
      wardName: ward.wardName,
      zone: ward.zone
    } : null,
    mapFeatureCount: map.features.length
  }, null, 2));
} finally {
  await store.close();
}
