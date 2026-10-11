import { createMemoryStore } from "./memoryStore.js";

export async function createStore(config) {
  if (config.storageDriver === "mongodb") {
    const { createMongoStore } = await import("./mongoStore.js");
    return createMongoStore(config);
  }
  return createMemoryStore();
}
