import { readFile } from "node:fs/promises";
import { loadConfig } from "../config.js";
import { ensureMongoIndexes } from "../store/mongoCollections.js";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: npm run backend:import:wards -- path/to/jaipur-wards.geojson");
  process.exit(1);
}

const config = loadConfig();
const { MongoClient } = await import("mongodb");
if (!config.mongodbUri) {
  console.error("MONGODB_URI is required for ward import.");
  process.exit(1);
}
const client = new MongoClient(config.mongodbUri);

try {
  await client.connect();
  const raw = await readFile(filePath, "utf-8");
  const geojson = JSON.parse(raw);
  if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    throw new Error("Input must be a GeoJSON FeatureCollection.");
  }

  const sourceCoordinateOrder = geojson.metadata?.coordinateOrder === "[longitude, latitude]"
    ? "[longitude, latitude]"
    : detectCoordinateOrder(geojson.features);
  const docs = geojson.features.map((feature, index) => normalizeWardFeature(feature, index));
  const database = client.db(config.mongodbDb);
  const existingCount = await database.collection("wards").countDocuments();
  if (existingCount) {
    console.warn(`Replacing ${existingCount} existing ward boundaries.`);
  }
  await database.collection("wards").deleteMany({});
  await database.collection("wards").insertMany(docs);
  await ensureMongoIndexes(database);

  console.log(`Imported ${docs.length} Jaipur ward boundaries into ${config.mongodbDb}.wards`);
  console.log(`Source coordinate order: ${sourceCoordinateOrder}`);
} finally {
  await client.close();
}

function normalizeWardFeature(feature, index) {
  const props = feature.properties || {};
  const wardNumber = parseWardNumber(props, index);
  const townName = stringOrNull(props.townname ?? props.townName ?? props.TOWNNAME ?? props.municipalBody);
  const wardName = String(
    props.wardName ??
    props.ward_lgd_name ??
    props.ward_name ??
    props.WARD_NAME ??
    props.name ??
    `Ward ${wardNumber}`
  );
  const zone = String(props.zone ?? props.ZONE ?? props.zone_name ?? inferZone(townName, wardNumber));

  if (!feature.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) {
    throw new Error(`Feature ${index + 1} is not a Polygon or MultiPolygon.`);
  }

  return {
    id: `ward-${wardNumber}`,
    wardNumber,
    wardName,
    zone,
    municipalBody: townName || "Jaipur Municipal Corporation",
    officerId: props.officerId || null,
    boundary: normalizeGeometry(feature.geometry),
    sourceProperties: props
  };
}

function parseWardNumber(props, index) {
  const rawNumber =
    props.wardcode ??
    props.ward_number ??
    props.wardNumber ??
    props.WARD_NO ??
    props.Ward_No ??
    props.ward_no ??
    props.number;

  const fromField = Number(rawNumber);
  if (Number.isInteger(fromField) && fromField > 0) return fromField;

  const name = String(props.ward_lgd_name ?? props.wardName ?? props.WARD_NAME ?? props.name ?? "");
  const match = name.match(/Ward\s*No\.?\s*(\d+)/i);
  if (match) return Number(match[1]);

  return index + 1;
}

function detectCoordinateOrder(features) {
  const sample = [];
  for (const feature of features.slice(0, 20)) {
    collectCoordinatePairs(feature.geometry?.coordinates, sample, 50);
  }
  const firstAverage = average(sample.map(([first]) => first));
  const secondAverage = average(sample.map(([, second]) => second));
  if (firstAverage >= 24 && firstAverage <= 29 && secondAverage >= 73 && secondAverage <= 78) {
    return "[latitude, longitude]";
  }
  return "[longitude, latitude]";
}

function normalizeGeometry(geometry) {
  return {
    ...geometry,
    coordinates: sourceCoordinateOrder === "[latitude, longitude]"
      ? flipCoordinates(geometry.coordinates)
      : geometry.coordinates
  };
}

function inferZone(townName, wardNumber) {
  if (townName && /heritage/i.test(townName)) return "Heritage";
  if (townName && /greater/i.test(townName)) return "Greater";
  if (wardNumber <= 100) return "Greater";
  return "Heritage";
}

function collectCoordinatePairs(coordinates, output, limit) {
  if (!coordinates || output.length >= limit) return;
  if (typeof coordinates[0] === "number") {
    output.push(coordinates);
    return;
  }
  for (const child of coordinates) {
    collectCoordinatePairs(child, output, limit);
    if (output.length >= limit) return;
  }
}

function flipCoordinates(coordinates) {
  if (typeof coordinates[0] === "number") {
    return [coordinates[1], coordinates[0]];
  }
  return coordinates.map(flipCoordinates);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function stringOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}
