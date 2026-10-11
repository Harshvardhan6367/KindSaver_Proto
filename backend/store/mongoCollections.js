export const COLLECTION_NAMES = {
  incidents: "incidents",
  reports: "reports",
  wards: "wards",
  officers: "officers",
  confirmations: "confirmations",
  statusUpdates: "status_updates",
  users: "users",
  mediaAssets: "media_assets",
  notifications: "notifications",
  auditLogs: "audit_logs",
  passwordResets: "password_resets",
  revokedTokens: "revoked_tokens"
};

export function getCollections(db) {
  return {
    incidents: db.collection(COLLECTION_NAMES.incidents),
    reports: db.collection(COLLECTION_NAMES.reports),
    wards: db.collection(COLLECTION_NAMES.wards),
    officers: db.collection(COLLECTION_NAMES.officers),
    confirmations: db.collection(COLLECTION_NAMES.confirmations),
    statusUpdates: db.collection(COLLECTION_NAMES.statusUpdates),
    users: db.collection(COLLECTION_NAMES.users),
    mediaAssets: db.collection(COLLECTION_NAMES.mediaAssets),
    notifications: db.collection(COLLECTION_NAMES.notifications),
    auditLogs: db.collection(COLLECTION_NAMES.auditLogs),
    passwordResets: db.collection(COLLECTION_NAMES.passwordResets),
    revokedTokens: db.collection(COLLECTION_NAMES.revokedTokens)
  };
}

export async function ensureMongoIndexes(db) {
  const collections = getCollections(db);
  await Promise.all([
    collections.incidents.createIndex({ location: "2dsphere" }),
    collections.incidents.createIndex({ ticketId: 1 }, { unique: true }),
    collections.incidents.createIndex({ status: 1, priority: 1, createdAt: -1 }),
    collections.incidents.createIndex({ wardNumber: 1, status: 1 }),
    collections.incidents.createIndex({ issueType: 1, status: 1 }),
    collections.incidents.createIndex({ reporterUserId: 1, createdAt: -1 }),
    collections.reports.createIndex({ location: "2dsphere" }),
    collections.reports.createIndex({ incidentId: 1, createdAt: -1 }),
    collections.reports.createIndex({ reporterUserId: 1, createdAt: -1 }),
    collections.reports.createIndex({ deviceHash: 1, createdAt: -1 }),
    collections.wards.createIndex({ boundary: "2dsphere" }),
    collections.wards.createIndex({ wardNumber: 1 }, { unique: true }),
    collections.wards.createIndex({ zone: 1, wardNumber: 1 }),
    collections.officers.createIndex({ id: 1 }, { unique: true }),
    collections.officers.createIndex({ role: 1, zone: 1 }),
    collections.confirmations.createIndex({ incidentId: 1, deviceHash: 1, createdAt: -1 }),
    collections.statusUpdates.createIndex({ incidentId: 1, createdAt: -1 }),
    collections.users.createIndex({ id: 1 }, { unique: true }),
    collections.users.createIndex({ deviceHash: 1 }),
    collections.users.createIndex({ email: 1 }, { unique: true, sparse: true }),
    collections.users.createIndex({ role: 1 }),
    collections.mediaAssets.createIndex({ incidentId: 1, createdAt: -1 }),
    collections.mediaAssets.createIndex({ id: 1 }, { unique: true }),
    collections.notifications.createIndex({ incidentId: 1, createdAt: -1 }),
    collections.auditLogs.createIndex({ actorId: 1, createdAt: -1 }),
    collections.passwordResets.createIndex({ token: 1 }, { unique: true }),
    collections.passwordResets.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    collections.revokedTokens.createIndex({ token: 1 }, { unique: true }),
    collections.revokedTokens.createIndex({ revokedAt: 1 }, { expireAfterSeconds: 86400 })
  ]);
}
