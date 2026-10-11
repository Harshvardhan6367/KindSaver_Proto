import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inputPath = process.argv[2] || "data/raw/jaipur_wards_bharatlas.geojson";
const outputPath = process.argv[3] || "data/processed/jaipur_wards.normalized.geojson";
const reportPath = process.argv[4] || "data/validation/jaipur_wards.validation.json";

const raw = JSON.parse(await readFile(inputPath, "utf-8"));
if (raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) {
  throw new Error("Input must be a GeoJSON FeatureCollection.");
}

const sourceCoordinateOrder = detectCoordinateOrder(raw.features);
const normalizedFeatures = raw.features.map(normalizeFeature).sort((a, b) => {
  return a.properties.wardNumber - b.properties.wardNumber;
});

const normalized = {
  type: "FeatureCollection",
  metadata: {
    name: "Jaipur Ward Boundaries",
    sourceFile: inputPath,
    normalizedAt: new Date().toISOString(),
    expectedFeatureCount: 150,
    sourceCoordinateOrder,
    coordinateOrder: "[longitude, latitude]",
    targetDatabase: "MongoDB Atlas",
    targetIndex: "2dsphere"
  },
  features: normalizedFeatures
};

const validation = validateFeatureCollection(normalized);

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await mkdir(dirname(resolve(reportPath)), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(validation, null, 2)}\n`);

console.log(JSON.stringify({
  ok: validation.errors.length === 0,
  outputPath,
  reportPath,
  featureCount: validation.featureCount,
  bbox: validation.bbox,
  errors: validation.errors,
  warnings: validation.warnings
}, null, 2));

function normalizeFeature(feature, index) {
  const props = feature.properties || {};
  const wardNumber = parseWardNumber(props, index);
  const townName = stringOrNull(props.townname ?? props.townName ?? props.TOWNNAME);
  const wardLgdName = stringOrNull(props.ward_lgd_name ?? props.wardName ?? props.WARD_NAME ?? props.name);
  const zone = inferZone(townName, wardNumber);

  if (!feature.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) {
    throw new Error(`Feature ${index + 1} is not a Polygon or MultiPolygon.`);
  }

  return {
    type: "Feature",
    id: `ward-${wardNumber}`,
    geometry: normalizeGeometry(feature.geometry),
    properties: {
      id: `ward-${wardNumber}`,
      wardNumber,
      wardName: wardLgdName || `Ward ${wardNumber}`,
      zone,
      municipalBody: townName || "Jaipur Municipal Corporation",
      wardLgdCode: numberOrNull(props.ward_lgd_code),
      townLgdCode: numberOrNull(props.town_lgd_code),
      townCensusCode2011: stringOrNull(props.towncensuscode2011),
      state: stringOrNull(props.state),
      sourceObjectId: numberOrNull(props.objectid ?? props.OBJECTID),
      sourceProperties: props
    }
  };
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

function inferZone(townName, wardNumber) {
  if (townName && /heritage/i.test(townName)) return "Heritage";
  if (townName && /greater/i.test(townName)) return "Greater";
  if (wardNumber <= 100) return "Greater";
  return "Heritage";
}

function validateFeatureCollection(collection) {
  const errors = [];
  const warnings = [];
  const wardNumbers = [];
  const geometryTypes = new Map();
  let bbox = [Infinity, Infinity, -Infinity, -Infinity];

  for (const feature of collection.features) {
    const wardNumber = feature.properties.wardNumber;
    wardNumbers.push(wardNumber);
    geometryTypes.set(feature.geometry.type, (geometryTypes.get(feature.geometry.type) || 0) + 1);
    bbox = expandBbox(bbox, feature.geometry.coordinates);

    if (!Number.isInteger(wardNumber)) errors.push(`Invalid ward number for ${feature.id}`);
    if (!feature.properties.wardName) warnings.push(`Missing ward name for ${feature.id}`);
  }

  const duplicateWardNumbers = findDuplicates(wardNumbers);
  if (duplicateWardNumbers.length) {
    errors.push(`Duplicate ward numbers: ${duplicateWardNumbers.join(", ")}`);
  }

  if (collection.features.length !== collection.metadata.expectedFeatureCount) {
    warnings.push(`Expected ${collection.metadata.expectedFeatureCount} wards but found ${collection.features.length}.`);
  }

  const [minLng, minLat, maxLng, maxLat] = bbox;
  if (!(minLng >= 73 && maxLng <= 78 && minLat >= 24 && maxLat <= 29)) {
    errors.push(`Normalized bbox does not look like Jaipur WGS84 [lng,lat]: ${bbox.join(", ")}`);
  }

  const missingWardNumbers = [];
  for (let number = 1; number <= collection.metadata.expectedFeatureCount; number += 1) {
    if (!wardNumbers.includes(number)) missingWardNumbers.push(number);
  }
  if (missingWardNumbers.length) {
    warnings.push(`Missing ward numbers in 1-150 sequence: ${missingWardNumbers.join(", ")}`);
  }

  return {
    sourceFile: collection.metadata.sourceFile,
    normalizedAt: collection.metadata.normalizedAt,
    featureCount: collection.features.length,
    expectedFeatureCount: collection.metadata.expectedFeatureCount,
    geometryTypes: Object.fromEntries(geometryTypes),
    bbox,
    minWardNumber: Math.min(...wardNumbers),
    maxWardNumber: Math.max(...wardNumbers),
    duplicateWardNumbers,
    errors,
    warnings
  };
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

function expandBbox(bbox, coordinates) {
  if (typeof coordinates[0] === "number") {
    const [lng, lat] = coordinates;
    return [
      Math.min(bbox[0], lng),
      Math.min(bbox[1], lat),
      Math.max(bbox[2], lng),
      Math.max(bbox[3], lat)
    ];
  }
  return coordinates.reduce((nextBbox, child) => expandBbox(nextBbox, child), bbox);
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return Array.from(duplicates).sort((a, b) => a - b);
}

function stringOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
