import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { Header } from "./components/Header.jsx";
import { PublicLanding } from "./components/PublicLanding.jsx";
import { CitizenDashboard } from "./components/CitizenDashboard.jsx";
import { MapScreen } from "./components/MapScreen.jsx";
import { ReportScreen } from "./components/ReportScreen.jsx";
import { TrackScreen } from "./components/TrackScreen.jsx";
import { AdminScreen } from "./components/AdminScreen.jsx";
import { AuthModal } from "./components/AuthModal.jsx";
import {
  apiGet,
  apiGetAdminIncidents,
  apiGetMe,
  apiLogout,
  apiSend,
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  onAuthChange
} from "./api.js";
import { translations } from "./i18n.js";

const DEFAULT_REPORT_FORM = {
  issueType: "garbage_dump",
  lat: "26.8543",
  lng: "75.8069",
  description: "Waste pile visible near the road and needs municipal pickup.",
  gpsAccuracyMeters: 10,
  photoUrl: ""
};

export function App() {
  const [currentUser, setCurrentUser] = useState(() => getAuthUser());
  const [lang, setLang] = useState("en"); // "en" or "hi"
  const t = translations[lang] || translations.en;

  // Portals: "citizen" or "admin"
  const [portalMode, setPortalMode] = useState(() => {
    const user = getAuthUser();
    return user && (user.role === "admin" || user.role === "ward_officer") ? "admin" : "citizen";
  });

  // Views: "home", "citizen-dashboard", "map", "report", "track", "admin"
  const [view, setView] = useState(() => {
    const user = getAuthUser();
    if (user && (user.role === "admin" || user.role === "ward_officer")) return "admin";
    if (user && user.role === "citizen") return "citizen-dashboard";
    return "home";
  });

  const [filters, setFilters] = useState({ status: "all", priority: "", issueType: "" });
  const [mapData, setMapData] = useState({ type: "FeatureCollection", features: [] });
  const [wards, setWards] = useState({ type: "FeatureCollection", features: [] });
  const [incidents, setIncidents] = useState([]);
  const [adminIncidents, setAdminIncidents] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [ticketId, setTicketId] = useState("");
  const [ticketDetail, setTicketDetail] = useState(null);
  const [reportForm, setReportForm] = useState(DEFAULT_REPORT_FORM);
  const [lastReport, setLastReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverHealthy, setServerHealthy] = useState(false);
  const [notice, setNotice] = useState("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Initial load
  useEffect(() => {
    checkHealth();
    validateSession();
    refresh();

    const unsub = onAuthChange((user) => {
      setCurrentUser(user);
      if (!user) {
        setPortalMode("citizen");
        setView((prev) => (prev === "admin" || prev === "citizen-dashboard" ? "home" : prev));
      }
    });

    return () => unsub();
  }, []);

  async function validateSession() {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await apiGetMe();
      if (res?.user) {
        setCurrentUser(res.user);
      }
    } catch {
      clearAuthSession();
      setCurrentUser(null);
      setPortalMode("citizen");
      setView("home");
    }
  }

  // Re-fetch when filters change
  useEffect(() => {
    refresh();
  }, [filters.status, filters.priority, filters.issueType]);

  async function checkHealth() {
    try {
      const res = await apiGet("/health");
      setServerHealthy(Boolean(res?.ok));
    } catch {
      setServerHealthy(false);
    }
  }

  async function refresh() {
    setLoading(true);
    try {
      const isStaff = currentUser && (currentUser.role === "admin" || currentUser.role === "ward_officer");
      const promises = [
        apiGet("/api/incidents/map", filters),
        apiGet("/api/wards.geojson"),
        apiGet("/api/incidents", filters),
        apiGet("/api/dashboard/stats", filters),
        apiGet("/api/officers")
      ];

      if (isStaff) {
        promises.push(apiGetAdminIncidents(filters).catch(() => ({ incidents: [] })));
      }

      const results = await Promise.all(promises);
      const [nextMap, nextWards, nextIncidents, nextStats, nextOfficers, nextAdminIncidents] = results;

      setMapData(nextMap || { type: "FeatureCollection", features: [] });
      setWards(nextWards || { type: "FeatureCollection", features: [] });
      setIncidents(nextIncidents?.incidents || []);
      setStats(nextStats || null);
      setOfficers(nextOfficers?.officers || []);
      if (nextAdminIncidents?.incidents) {
        setAdminIncidents(nextAdminIncidents.incidents);
      } else {
        setAdminIncidents(nextIncidents?.incidents || []);
      }
      setServerHealthy(true);

      if (!selectedIncident && nextIncidents?.incidents?.[0]) {
        setSelectedIncident(nextIncidents.incidents[0]);
      } else if (selectedIncident) {
        const found = nextIncidents?.incidents?.find((i) => i.id === selectedIncident.id);
        if (found) setSelectedIncident(found);
      }
    } catch (err) {
      setNotice(err.message || "Failed to communicate with KindSaver server.");
      setServerHealthy(false);
    } finally {
      setLoading(false);
    }
  }

  async function submitReport(e) {
    if (e) e.preventDefault();
    setNotice("");
    try {
      const payload = {
        ...reportForm,
        lat: Number(reportForm.lat),
        lng: Number(reportForm.lng),
        gpsAccuracyMeters: Number(reportForm.gpsAccuracyMeters || 10)
      };

      const result = await apiSend("/api/reports", "POST", payload);
      setLastReport(result);
      setTicketId(result.incident.ticketId);
      setReportForm(DEFAULT_REPORT_FORM);

      await refresh();
      await loadTicket(result.incident.ticketId);
      setView("track");
    } catch (err) {
      setNotice(err.message || "Failed to submit civic report.");
    }
  }

  async function loadTicket(targetTicket = ticketId) {
    if (!targetTicket) return;
    setNotice("");
    try {
      const detail = await apiGet(`/api/incidents/ticket/${encodeURIComponent(targetTicket)}/details`);
      setTicketDetail(detail);
    } catch (err) {
      setTicketDetail(null);
      setNotice(err.message || "Could not find ticket.");
    }
  }

  function openTicket(targetTicket) {
    setTicketId(targetTicket);
    setView("track");
    loadTicket(targetTicket);
  }

  async function confirmIncident() {
    if (!ticketDetail?.incident?.id) return;
    try {
      await apiSend(`/api/incidents/${ticketDetail.incident.id}/confirm`, "POST", {
        lat: ticketDetail.incident.location.coordinates[1],
        lng: ticketDetail.incident.location.coordinates[0]
      });
      await loadTicket(ticketDetail.incident.ticketId);
      await refresh();
    } catch (err) {
      setNotice(err.message || "Could not record confirmation.");
      throw err;
    }
  }

  async function updateIncidentStatus(id, status, note = "", proofPhotoUrl = "") {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      await apiSend(`/api/admin/incidents/${id}/status`, "PATCH", {
        status,
        note: note || `Status moved to ${status} by ${currentUser.name}`,
        proofPhotoUrl: proofPhotoUrl || null
      });
      await refresh();
      if (ticketDetail && ticketDetail.incident.id === id) {
        await loadTicket(ticketDetail.incident.ticketId);
      }
    } catch (err) {
      setNotice(err.message || "Failed to update status.");
      throw err;
    }
  }

  async function assignOfficerOrDepartment(id, officerId = null, department = null, note = "", priority = null) {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      const payload = {
        officerId,
        department,
        note
      };
      if (priority) payload.priority = priority;
      await apiSend(`/api/admin/incidents/${id}/assign`, "PATCH", payload);
      await refresh();
      if (ticketDetail && ticketDetail.incident.id === id) {
        await loadTicket(ticketDetail.incident.ticketId);
      }
    } catch (err) {
      setNotice(err.message || "Failed to route incident.");
      throw err;
    }
  }

  function handleLoginSuccess(user) {
    setCurrentUser(user);
    setNotice("");
    if (user.role === "admin" || user.role === "ward_officer") {
      setPortalMode("admin");
      setView("admin");
    } else {
      setPortalMode("citizen");
      setView("citizen-dashboard");
    }
    refresh();
  }

  async function handleLogout() {
    await apiLogout();
    setCurrentUser(null);
    setPortalMode("citizen");
    setView("home");
    refresh();
  }

  const selectedFeature = useMemo(() => {
    if (!selectedIncident) return null;
    return mapData.features?.find((f) => f.id === selectedIncident.id) || null;
  }, [mapData.features, selectedIncident]);

  return (
    <div className="app-shell">
      <Header
        portalMode={portalMode}
        setPortalMode={setPortalMode}
        currentView={view}
        setView={setView}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        serverHealthy={serverHealthy}
        lang={lang}
        setLang={setLang}
        t={t}
      />

      {notice && (
        <div className="global-notification-bar">
          <AlertTriangle size={18} />
          <span>{notice}</span>
          <button className="close-notice-btn" onClick={() => setNotice("")}>
            &times;
          </button>
        </div>
      )}

      <main className="main-content-area">
        {/* EXPERIENCE A: Public Landing Page */}
        {portalMode === "citizen" && view === "home" && (
          <PublicLanding
            stats={stats}
            incidents={incidents}
            onReport={() => setView("report")}
            onOpenMap={() => setView("map")}
            onTrackTicket={openTicket}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            currentUser={currentUser}
            lang={lang}
            t={t}
          />
        )}

        {/* EXPERIENCE B: Citizen Dedicated Dashboard */}
        {portalMode === "citizen" && view === "citizen-dashboard" && (
          <CitizenDashboard
            currentUser={currentUser}
            onReport={() => setView("report")}
            onTrackTicket={openTicket}
            onOpenMap={() => setView("map")}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onLogout={handleLogout}
            onUpdateUser={(updated) => setCurrentUser(updated)}
            lang={lang}
            t={t}
          />
        )}

        {/* Live Public Map (Accessible from Public & Citizen portals) */}
        {view === "map" && (
          <MapScreen
            filters={filters}
            setFilters={setFilters}
            mapData={mapData}
            wards={wards}
            stats={stats}
            incidents={incidents}
            selectedIncident={selectedIncident}
            selectedFeature={selectedFeature}
            setSelectedIncident={setSelectedIncident}
            loading={loading}
            onRefresh={refresh}
            onReport={() => setView("report")}
            onTrackTicket={openTicket}
            lang={lang}
            t={t}
          />
        )}

        {/* Public / Citizen Report Submission Screen */}
        {view === "report" && (
          <ReportScreen
            form={reportForm}
            setForm={setReportForm}
            onSubmit={submitReport}
            lastReport={lastReport}
            onTrackTicket={openTicket}
            lang={lang}
            t={t}
          />
        )}

        {/* Public Ticket & Timeline Inspector */}
        {view === "track" && (
          <TrackScreen
            ticketId={ticketId}
            setTicketId={setTicketId}
            detail={ticketDetail}
            onSearch={loadTicket}
            onConfirm={confirmIncident}
            lastReport={lastReport}
            lang={lang}
            t={t}
          />
        )}

        {/* EXPERIENCE C: Administrator Workspace (with strict 403 guard) */}
        {portalMode === "admin" && view === "admin" && (
          <AdminScreen
            stats={stats}
            incidents={adminIncidents}
            officers={officers}
            filters={filters}
            setFilters={setFilters}
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onRefresh={refresh}
            onStatusChange={updateIncidentStatus}
            onAssign={assignOfficerOrDepartment}
            onSwitchToCitizen={() => {
              setPortalMode("citizen");
              setView("home");
            }}
            lang={lang}
            t={t}
          />
        )}
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
