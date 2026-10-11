const ISSUE_TYPES = new Set([
  "garbage_dump",
  "missed_collection",
  "overflowing_bin",
  "drain_blocked",
  "construction_debris",
  "hazardous_waste",
  "other"
]);

const STATUSES = new Set(["open", "verified", "assigned", "in_progress", "resolved", "closed", "reopened"]);

export function validateReportPayload(body) {
  if (!body || typeof body !== "object") {
    const error = new Error("Request body must be a valid JSON object.");
    error.status = 400;
    throw error;
  }
  const errors = [];
  if (!ISSUE_TYPES.has(body.issueType)) errors.push("issueType is invalid.");
  const latNum = Number(body.lat);
  const lngNum = Number(body.lng);
  if (!Number.isFinite(latNum)) {
    errors.push("lat is required and must be a number.");
  } else if (latNum < -90 || latNum > 90) {
    errors.push("lat must be between -90 and 90 degrees.");
  }
  if (!Number.isFinite(lngNum)) {
    errors.push("lng is required and must be a number.");
  } else if (lngNum < -180 || lngNum > 180) {
    errors.push("lng must be between -180 and 180 degrees.");
  }
  if (body.description && String(body.description).length > 1000) {
    errors.push("description must be 1000 characters or less.");
  }
  if (errors.length) {
    const error = new Error(errors.join(" "));
    error.status = 400;
    throw error;
  }
}

export function validateStatus(status) {
  if (!STATUSES.has(status)) {
    const error = new Error("status is invalid.");
    error.status = 400;
    throw error;
  }
}

const PRIORITIES = new Set(["critical", "high", "medium", "low"]);

export function validatePriority(priority) {
  if (!PRIORITIES.has(priority)) {
    const error = new Error("priority must be critical, high, medium, or low.");
    error.status = 400;
    throw error;
  }
}
