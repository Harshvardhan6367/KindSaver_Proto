export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4000";

const TOKEN_KEY = "kindsaver_auth_token";
const USER_KEY = "kindsaver_auth_user";

export const departments = [
  { value: "Solid Waste Management (SWM)", label: "Solid Waste Management (SWM)", desc: "General waste piles, overflowing bins, open garbage heaps" },
  { value: "Drainage & Sewerage", label: "Drainage & Sewerage Department", desc: "Blocked stormwater drains, choked nallahs, overflowing gutters" },
  { value: "C&D Debris Management", label: "C&D Debris & Encroachment", desc: "Construction rubble, road debris, building demolition waste" },
  { value: "Hazardous & Biomedical Waste", label: "Hazardous & Bio-Waste Unit", desc: "Toxic materials, chemical refuse, clinic/hospital waste" },
  { value: "Door-to-Door Collection & Transport", label: "Door-to-Door Collection Vendor", desc: "Missed household pickup, tipper vehicle routes" },
  { value: "Sanitation Operations", label: "General Sanitation & Sweeping", desc: "Commercial market sweeping, public litter spots" }
];

export const issueTypes = [
  { value: "garbage_dump", label: "Garbage Dump", icon: "Trash2", color: "#ef4444", defaultDept: "Solid Waste Management (SWM)" },
  { value: "missed_collection", label: "Missed Collection", icon: "Clock", color: "#f97316", defaultDept: "Door-to-Door Collection & Transport" },
  { value: "overflowing_bin", label: "Overflowing Bin", icon: "AlertCircle", color: "#eab308", defaultDept: "Solid Waste Management (SWM)" },
  { value: "drain_blocked", label: "Blocked Drain", icon: "Droplets", color: "#06b6d4", defaultDept: "Drainage & Sewerage" },
  { value: "construction_debris", label: "Construction Debris", icon: "Hammer", color: "#8b5cf6", defaultDept: "C&D Debris Management" },
  { value: "hazardous_waste", label: "Hazardous Waste", icon: "Biohazard", color: "#ec4899", defaultDept: "Hazardous & Biomedical Waste" },
  { value: "other", label: "Other Waste Issue", icon: "HelpCircle", color: "#6b7280", defaultDept: "Sanitation Operations" }
];

export const statuses = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "verified", label: "Verified" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "reopened", label: "Reopened" }
];

export const priorities = [
  { value: "", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" }
];

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("kindreport_auth_token") || null;
  } catch {
    return null;
  }
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(USER_KEY) || localStorage.getItem("kindreport_auth_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const authListeners = new Set();

export function onAuthChange(callback) {
  authListeners.add(callback);
  return () => authListeners.delete(callback);
}

function notifyAuthChange(user) {
  authListeners.forEach((fn) => {
    try {
      fn(user);
    } catch (err) {
      console.error("Auth listener error:", err);
    }
  });
}

export function saveAuthSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    notifyAuthChange(user);
  } catch (err) {
    console.error("Failed to persist auth session", err);
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    notifyAuthChange(null);
  } catch (err) {
    console.error("Failed to clear auth session", err);
  }
}

export async function apiLogin(email, password) {
  const result = await apiSend("/api/auth/login", "POST", { email, password });
  if (result.token && result.user) {
    saveAuthSession(result.token, result.user);
  }
  return result;
}

export async function apiRegister(payload) {
  const result = await apiSend("/api/auth/register", "POST", payload);
  if (result.token && result.user) {
    saveAuthSession(result.token, result.user);
  }
  return result;
}

export async function apiGetMe() {
  return apiGet("/api/auth/me");
}

export async function apiLogout() {
  try {
    await apiSend("/api/auth/logout", "POST");
  } catch (err) {
    console.warn("Logout notification error:", err);
  } finally {
    clearAuthSession();
  }
}

export async function apiForgotPassword(email) {
  return apiSend("/api/auth/forgot-password", "POST", { email });
}

export async function apiResetPassword(token, newPassword) {
  return apiSend("/api/auth/reset-password", "POST", { token, newPassword });
}

export async function apiUpdateProfile(payload) {
  const result = await apiSend("/api/auth/profile", "PATCH", payload);
  if (result.user) {
    const token = getAuthToken();
    saveAuthSession(token, result.user);
  }
  return result;
}

export async function apiGetCitizenReports() {
  return apiGet("/api/citizen/my-reports");
}

export async function apiGetAdminIncidents(filters = {}) {
  return apiGet("/api/admin/incidents", filters);
}

export async function apiGetAdminUsers() {
  return apiGet("/api/admin/users");
}

export async function apiGetAdminAuditLogs() {
  return apiGet("/api/admin/audit-logs");
}

export async function apiRouteDepartment(incidentId, { department, officerId = null, note = "" }) {
  return apiSend(`/api/admin/incidents/${incidentId}/department`, "PATCH", {
    department,
    officerId,
    note
  });
}

export async function apiGet(path, params = {}) {
  const url = new URL(path, API_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      url.searchParams.set(key, value);
    }
  });
  return request(url, { method: "GET" });
}

export async function apiSend(path, method, body = {}) {
  return request(new URL(path, API_BASE_URL), {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function apiUploadMedia(file, incidentId = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        const res = await apiSend("/api/media/upload", "POST", {
          contentType: file.type || "image/jpeg",
          fileName: file.name || "evidence.jpg",
          dataBase64: base64Data,
          incidentId
        });
        resolve(res.asset);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

async function request(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    Accept: "application/json",
    ...(options.headers || {})
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearAuthSession();
    }
    const message = data.error || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.detail = data.detail;
    throw error;
  }

  return data;
}

export function formatMediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}
