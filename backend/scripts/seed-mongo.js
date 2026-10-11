import { loadConfig } from "../config.js";
import {
  confirmations,
  incidents,
  mediaAssets,
  officers,
  reports,
  statusUpdates,
  users,
  wards
} from "../data/seed.js";
import { hashPassword } from "../auth/passwords.js";
import { createMongoStore } from "../store/mongoStore.js";

const config = loadConfig();

if (!config.allowDbSeed) {
  console.error("Refusing to seed database. Set ALLOW_DB_SEED=true in .env to continue.");
  process.exit(1);
}

if (config.storageDriver !== "mongodb") {
  console.error("Set STORAGE_DRIVER=mongodb before seeding MongoDB.");
  process.exit(1);
}

const store = await createMongoStore(config);

try {
  await store.replaceAll({
    incidents,
    reports,
    wards,
    officers,
    confirmations,
    statusUpdates,
    users: await Promise.all(users.map(toStoredUser)),
    mediaAssets
  });
  console.log(`Seeded MongoDB database "${config.mongodbDb}" with demo Jaipur data.`);
  console.log(`Incidents: ${incidents.length}`);
  console.log(`Reports: ${reports.length}`);
  console.log(`Wards: ${wards.length}`);
  console.log(`Officers: ${officers.length}`);
  console.log(`Users: ${users.length}`);
} finally {
  await store.close();
}

async function toStoredUser(user) {
  const { devPassword, ...rest } = user;
  return {
    ...rest,
    email: rest.email.toLowerCase(),
    ...await hashPassword(devPassword)
  };
}
