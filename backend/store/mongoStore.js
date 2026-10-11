import dns from "node:dns";
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore if custom DNS not allowed in environment
}
import { ensureMongoIndexes, getCollections } from "./mongoCollections.js";

export async function createMongoStore(config) {
  const { MongoClient } = await import("mongodb");
  if (!config.mongodbUri) {
    throw new Error("MONGODB_URI is required when STORAGE_DRIVER=mongodb.");
  }

  const client = new MongoClient(config.mongodbUri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    retryWrites: true
  });

  let connected = false;
  let attempts = 0;
  while (!connected && attempts < 3) {
    try {
      attempts++;
      await client.connect();
      connected = true;
    } catch (err) {
      if (attempts >= 3) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const db = client.db(config.mongodbDb);

  await ensureMongoIndexes(db);
  const collections = getCollections(db);
  await ensureInitialData(collections);

  const revokedTokensCache = new Set();
  const initialRevoked = await collections.revokedTokens.find({}).toArray();
  initialRevoked.forEach((item) => revokedTokensCache.add(item.token));

  const userRevocationsCache = new Map();
  const usersWithChangedPassword = await collections.users.find({ passwordChangedAt: { $ne: null } }).toArray();
  usersWithChangedPassword.forEach((u) => {
    userRevocationsCache.set(u.id, Math.floor(new Date(u.passwordChangedAt).getTime() / 1000));
  });

  return {
    storageName: "mongodb",
    async close() {
      await client.close();
    },
    async reset() {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Refusing to reset MongoDB in production.");
      }
      await Promise.all(writableCollections(collections).map((collection) => collection.deleteMany({})));
    },
    async replaceAll(nextState) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Refusing to replace MongoDB data in production.");
      }
      await Promise.all(writableCollections(collections).map((collection) => collection.deleteMany({})));
      await insertIfAny(collections.incidents, nextState.incidents);
      await insertIfAny(collections.reports, nextState.reports);
      await insertIfAny(collections.wards, nextState.wards);
      await insertIfAny(collections.officers, nextState.officers);
      await insertIfAny(collections.confirmations, nextState.confirmations);
      await insertIfAny(collections.statusUpdates, nextState.statusUpdates);
      await insertIfAny(collections.users, nextState.users);
      await insertIfAny(collections.mediaAssets, nextState.mediaAssets);
    },
    async listIncidents(filters = {}) {
      const query = {};
      if (filters.status && filters.status !== "all") query.status = filters.status;
      if (filters.issueType) query.issueType = filters.issueType;
      if (filters.priority) query.priority = filters.priority;
      if (filters.wardNumber) query.wardNumber = Number(filters.wardNumber);
      if (filters.zone) query.zone = filters.zone;
      if (filters.assignedOfficerId) query.assignedOfficerId = filters.assignedOfficerId;
      if (filters.active === "true") query.status = { $nin: ["resolved", "closed"] };
      return collections.incidents.find(query).sort({ reportCount: -1, createdAt: -1 }).toArray();
    },
    async getIncidentById(id) {
      return collections.incidents.findOne({ id });
    },
    async getIncidentByTicketId(ticketId) {
      return collections.incidents.findOne({ ticketId: String(ticketId).toUpperCase() });
    },
    async createIncident(incident) {
      await collections.incidents.insertOne(incident);
      return incident;
    },
    async updateIncident(id, patch) {
      const updatedAt = new Date().toISOString();
      await collections.incidents.updateOne({ id }, { $set: { ...patch, updatedAt } });
      return collections.incidents.findOne({ id });
    },
    async createReport(report) {
      await collections.reports.insertOne(report);
      return report;
    },
    async listReportsByIncidentId(incidentId) {
      return collections.reports.find({ incidentId }).sort({ createdAt: -1 }).toArray();
    },
    async listReportsByReporterUserId(userId) {
      return collections.reports.find({ reporterUserId: userId }).sort({ createdAt: -1 }).toArray();
    },
    async createConfirmation(confirmation) {
      await collections.confirmations.insertOne(confirmation);
      return confirmation;
    },
    async listConfirmationsByIncidentId(incidentId) {
      return collections.confirmations.find({ incidentId }).sort({ createdAt: -1 }).toArray();
    },
    async createStatusUpdate(update) {
      await collections.statusUpdates.insertOne(update);
      return update;
    },
    async listStatusUpdatesByIncidentId(incidentId) {
      return collections.statusUpdates.find({ incidentId }).sort({ createdAt: -1 }).toArray();
    },
    async listWards() {
      return collections.wards.find({}).sort({ wardNumber: 1 }).toArray();
    },
    async getWardByNumber(wardNumber) {
      return collections.wards.findOne({ wardNumber: Number(wardNumber) });
    },
    async listOfficers() {
      return collections.officers.find({}).sort({ name: 1 }).toArray();
    },
    async getOfficerById(id) {
      return collections.officers.findOne({ id });
    },
    async getUserById(id) {
      return collections.users.findOne({ id });
    },
    async getUserByEmail(email) {
      return collections.users.findOne({ email: String(email).toLowerCase() });
    },
    async createUser(user) {
      await collections.users.insertOne(user);
      return user;
    },
    async updateUser(id, patch) {
      const updatedAt = new Date().toISOString();
      await collections.users.updateOne({ id }, { $set: { ...patch, updatedAt } });
      return collections.users.findOne({ id });
    },
    async listUsers() {
      return collections.users.find({}).toArray();
    },
    async savePasswordResetToken(tokenRecord) {
      if (collections.passwordResets) {
        await collections.passwordResets.insertOne(tokenRecord);
      }
      return tokenRecord;
    },
    async getPasswordResetToken(token) {
      if (collections.passwordResets) {
        return collections.passwordResets.findOne({ token });
      }
      return null;
    },
    async invalidatePasswordResetToken(token) {
      if (collections.passwordResets) {
        await collections.passwordResets.updateOne({ token }, { $set: { used: true } });
        return collections.passwordResets.findOne({ token });
      }
      return null;
    },
    async revokeToken(token) {
      revokedTokensCache.add(token);
      if (collections.revokedTokens) {
        await collections.revokedTokens.insertOne({ token, revokedAt: new Date().toISOString() });
      }
    },
    isTokenRevoked(token) {
      return revokedTokensCache.has(token);
    },
    async revokeUser(userId, timestampMs = Date.now()) {
      userRevocationsCache.set(userId, timestampMs);
      if (collections.users) {
        await collections.users.updateOne(
          { id: userId },
          { $set: { passwordChangedAt: new Date(timestampMs).toISOString(), revokedAtMs: timestampMs } }
        );
      }
    },
    isUserRevoked(userId, iat, iatMs = null) {
      const cutoff = userRevocationsCache.get(userId);
      if (cutoff === undefined) return false;
      if (iatMs !== null && iatMs !== undefined) {
        return iatMs <= cutoff;
      }
      return (iat ? iat * 1000 : 0) <= cutoff;
    },
    async createMediaAsset(asset) {
      await collections.mediaAssets.insertOne(asset);
      return asset;
    },
    async getMediaAssetById(id) {
      return collections.mediaAssets.findOne({ id });
    },
    async findWardByPoint(point) {
      return collections.wards.findOne({
        boundary: {
          $geoIntersects: {
            $geometry: point
          }
        }
      });
    },
    async snapshot() {
      const [incidents, reports, wards, officers, confirmations, statusUpdates] = await Promise.all([
        collections.incidents.find({}).toArray(),
        collections.reports.find({}).toArray(),
        collections.wards.find({}).toArray(),
        collections.officers.find({}).toArray(),
        collections.confirmations.find({}).toArray(),
        collections.statusUpdates.find({}).toArray()
      ]);
      return { incidents, reports, wards, officers, confirmations, statusUpdates };
    }
  };
}

async function insertIfAny(collection, docs = []) {
  if (docs.length) await collection.insertMany(docs);
}

function writableCollections(collections) {
  return [
    collections.incidents,
    collections.reports,
    collections.wards,
    collections.officers,
    collections.confirmations,
    collections.statusUpdates,
    collections.users,
    collections.mediaAssets,
    collections.notifications,
    collections.auditLogs,
    collections.passwordResets,
    collections.revokedTokens
  ];
}

async function ensureInitialData(collections) {
  const wardCount = await collections.wards.countDocuments();
  if (wardCount === 0) {
    const initialWards = [
      {
        id: "ward-42",
        wardNumber: 42,
        wardName: "Mansarovar Sector 7",
        zone: "South",
        municipalBody: "Jaipur Municipal Corporation",
        officerId: null,
        boundary: rectanglePolygon(75.753, 26.843, 75.770, 26.858)
      },
      {
        id: "ward-51",
        wardNumber: 51,
        wardName: "Vaishali Nagar Main Road",
        zone: "West",
        municipalBody: "Jaipur Municipal Corporation",
        officerId: null,
        boundary: rectanglePolygon(75.732, 26.905, 75.754, 26.923)
      },
      {
        id: "ward-38",
        wardNumber: 38,
        wardName: "Malviya Nagar Circle",
        zone: "East",
        municipalBody: "Jaipur Municipal Corporation",
        officerId: null,
        boundary: rectanglePolygon(75.795, 26.846, 75.818, 26.864)
      },
      {
        id: "ward-12",
        wardNumber: 12,
        wardName: "Civil Lines",
        zone: "Central",
        municipalBody: "Jaipur Municipal Corporation",
        officerId: null,
        boundary: rectanglePolygon(75.771, 26.900, 75.790, 26.918)
      },
      {
        id: "ward-15",
        wardNumber: 15,
        wardName: "C-Scheme",
        zone: "Central",
        municipalBody: "Jaipur Municipal Corporation",
        officerId: null,
        boundary: rectanglePolygon(75.790, 26.906, 75.806, 26.922)
      },
      {
        id: "ward-67",
        wardNumber: 67,
        wardName: "Sanganer Industrial Area",
        zone: "South",
        municipalBody: "Jaipur Municipal Corporation",
        officerId: null,
        boundary: rectanglePolygon(75.776, 26.799, 75.802, 26.820)
      }
    ];
    await collections.wards.insertMany(initialWards);
  }

  // Bootstrap official administrator account if none exists
  const adminCount = await collections.users.countDocuments({ role: "admin" });
  if (adminCount === 0) {
    const { hashPassword } = await import("../auth/passwords.js");
    const { passwordSalt, passwordHash } = await hashPassword("Admin@12345");
    await collections.users.insertOne({
      id: "user-admin",
      name: "Jaipur Municipal Administrator",
      email: "admin@jaipur.gov.in",
      phone: null,
      wardNumber: null,
      role: "admin",
      officerId: null,
      passwordSalt,
      passwordHash,
      createdAt: new Date().toISOString()
    });
  }
}

function rectanglePolygon(west, south, east, north) {
  return {
    type: "Polygon",
    coordinates: [[
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south]
    ]]
  };
}
