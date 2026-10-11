import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Building,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  History,
  Inbox,
  Layers,
  Lock,
  LogIn,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Trash2,
  Truck,
  Upload,
  User,
  UserCheck,
  UserRoundCog,
  Users,
  X,
  XCircle
} from "lucide-react";
import { PhotoUpload } from "./PhotoUpload.jsx";
import {
  apiGet,
  apiGetAdminAuditLogs,
  apiGetAdminUsers,
  departments,
  formatMediaUrl,
  issueTypes,
  priorities,
  statuses
} from "../api.js";

const JAIPUR_OFFICIAL_WARDS = [
  { number: 12, name: "Civil Lines", zone: "Central" },
  { number: 15, name: "C-Scheme", zone: "Central" },
  { number: 38, name: "Malviya Nagar Circle", zone: "East" },
  { number: 42, name: "Mansarovar Sector 7", zone: "South" },
  { number: 51, name: "Vaishali Nagar Main Road", zone: "West" },
  { number: 67, name: "Sanganer Industrial Area", zone: "South" },
  { number: 102, name: "Amer / Heritage", zone: "North" }
];

export function AdminScreen({
  stats,
  incidents = [],
  officers = [],
  filters,
  setFilters,
  currentUser,
  onOpenAuth,
  onRefresh,
  onStatusChange,
  onAssign,
  onSwitchToCitizen,
  lang = "en",
  t = {}
}) {
  const isAuthorizedStaff =
    currentUser && (currentUser.role === "admin" || currentUser.role === "ward_officer");

  // Tab State: "queue", "hotspots", "users", "audit"
  const [adminTab, setAdminTab] = useState("queue");

  // Local Queue Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWardFilter, setSelectedWardFilter] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");

  // Secondary Tab Search States
  const [citizenSearchQuery, setCitizenSearchQuery] = useState("");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");

  // Modals state
  const [statusModalIncident, setStatusModalIncident] = useState(null);
  const [modalStatus, setModalStatus] = useState("in_progress");
  const [modalNote, setModalNote] = useState("");
  const [modalProofPhoto, setModalProofPhoto] = useState("");

  const [deptModalIncident, setDeptModalIncident] = useState(null);
  const [targetDept, setTargetDept] = useState("Solid Waste Management (SWM)");
  const [targetOfficerId, setTargetOfficerId] = useState("");
  const [targetPriority, setTargetPriority] = useState("medium");
  const [deptNote, setDeptNote] = useState("");

  const [rejectModalIncident, setRejectModalIncident] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  // Incident Inspector Modal (New)
  const [inspectIncident, setInspectIncident] = useState(null);

  // Action Loading & UI Feedback State
  const [actionLoading, setActionLoading] = useState(false);
  const [copyFeedbackId, setCopyFeedbackId] = useState(null);
  const [adminNotification, setAdminNotification] = useState("");

  // Ward Hotspots & Risk Ranking data
  const [wardRankings, setWardRankings] = useState([]);
  const [loadingRankings, setLoadingRankings] = useState(false);

  // Admin users and audit logs
  const [userList, setUserList] = useState([]);
  const [auditList, setAuditList] = useState([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  useEffect(() => {
    if (isAuthorizedStaff) {
      if (adminTab === "hotspots") loadWardRankings();
      if (adminTab === "users") loadUsers();
      if (adminTab === "audit") loadAudit();
    }
  }, [adminTab, isAuthorizedStaff]);

  function notify(msg) {
    setAdminNotification(msg);
    setTimeout(() => setAdminNotification(""), 4000);
  }

  async function loadWardRankings() {
    setLoadingRankings(true);
    try {
      const res = await apiGet("/api/wards/ranking");
      setWardRankings(res.wards || []);
    } catch (err) {
      console.warn("Could not load ward rankings:", err);
    } finally {
      setLoadingRankings(false);
    }
  }

  async function loadUsers() {
    setLoadingExtra(true);
    try {
      const res = await apiGetAdminUsers();
      setUserList(res.users || []);
    } catch (err) {
      console.warn("Could not load user list:", err);
    } finally {
      setLoadingExtra(false);
    }
  }

  async function loadAudit() {
    setLoadingExtra(true);
    try {
      const res = await apiGetAdminAuditLogs();
      setAuditList(res.auditLogs || []);
    } catch (err) {
      console.warn("Could not load audit logs:", err);
    } finally {
      setLoadingExtra(false);
    }
  }

  // 1. STRICT ROUTE GUARD: If user is not authorized staff, render 403 Forbidden Screen
  if (!isAuthorizedStaff) {
    return (
      <div className="admin-unauthorized-container">
        <div className="unauthorized-card">
          <div className="unauthorized-icon-circle">
            <ShieldAlert size={44} className="text-danger" />
          </div>
          <h2>{t.unauthorizedTitle || "403 Access Denied — Municipal Workspace Restricted"}</h2>
          <p className="unauthorized-lead">
            {t.unauthorizedDesc ||
              "This operations console is strictly restricted to authorized Jaipur Municipal Corporation administrators and ward officers."}
          </p>
          <div className="unauthorized-details-box">
            <p>
              {currentUser
                ? `You are currently signed in as an ordinary citizen account (${currentUser.name} — Role: ${currentUser.role}). Citizen accounts cannot access internal triage queues, route tickets, or inspect internal municipal workloads.`
                : "No authenticated municipal staff session was found. Please sign in with authorized municipal staff credentials to proceed."}
            </p>
          </div>
          <div className="unauthorized-actions-group">
            <button type="button" className="cta-btn primary-cta" onClick={onOpenAuth}>
              <LogIn size={18} />
              <span>{t.loginAsStaff || "Sign In as Municipal Staff"}</span>
            </button>
            {onSwitchToCitizen && (
              <button type="button" className="cta-btn secondary-cta" onClick={onSwitchToCitizen}>
                <ArrowRight size={18} />
                <span>{t.backToCitizen || "Return to Citizen Portal"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // KPI Calculations
  const totalQueueCount = incidents.length;
  const triageNeededCount = incidents.filter((i) => i.status === "open").length;
  const inProgressCount = incidents.filter((i) => ["assigned", "in_progress"].includes(i.status)).length;
  const criticalCount = incidents.filter((i) => i.priority === "critical").length;
  const resolvedCount = incidents.filter((i) => ["resolved", "closed"].includes(i.status)).length;

  // Filtered queue for operations triage
  const filteredQueue = incidents.filter((inc) => {
    if (selectedWardFilter && String(inc.wardNumber) !== String(selectedWardFilter)) {
      return false;
    }
    if (selectedDeptFilter && inc.department !== selectedDeptFilter) {
      return false;
    }
    if (selectedPriorityFilter && inc.priority !== selectedPriorityFilter) {
      return false;
    }
    if (selectedStatusFilter && selectedStatusFilter !== "all" && inc.status !== selectedStatusFilter) {
      return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (inc.ticketId && inc.ticketId.toLowerCase().includes(q)) ||
      (inc.title && inc.title.toLowerCase().includes(q)) ||
      (inc.description && inc.description.toLowerCase().includes(q)) ||
      (inc.wardName && inc.wardName.toLowerCase().includes(q)) ||
      (inc.department && inc.department.toLowerCase().includes(q)) ||
      (inc.reporterName && inc.reporterName.toLowerCase().includes(q))
    );
  });

  const hasActiveFilters = Boolean(
    searchQuery ||
    selectedWardFilter ||
    selectedDeptFilter ||
    selectedPriorityFilter ||
    (selectedStatusFilter && selectedStatusFilter !== "all")
  );

  function resetAllFilters() {
    setSearchQuery("");
    setSelectedWardFilter("");
    setSelectedDeptFilter("");
    setSelectedPriorityFilter("");
    setSelectedStatusFilter("all");
    if (setFilters && filters.status !== "all") {
      setFilters({ ...filters, status: "all" });
    }
  }

  // Quick filter toggle from KPI cards
  function toggleKpiFilter(filterType, filterValue) {
    if (filterType === "status") {
      setSelectedStatusFilter(selectedStatusFilter === filterValue ? "all" : filterValue);
    } else if (filterType === "priority") {
      setSelectedPriorityFilter(selectedPriorityFilter === filterValue ? "" : filterValue);
    }
  }

  // Copy Ticket ID to clipboard
  function handleCopyTicket(ticketCode, e) {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(ticketCode);
    setCopyFeedbackId(ticketCode);
    notify(`Ticket ${ticketCode} copied to clipboard!`);
    setTimeout(() => setCopyFeedbackId(null), 2000);
  }

  // Modal Openers
  function openStatusModal(incident, targetStatus = null) {
    setStatusModalIncident(incident);
    setModalStatus(targetStatus || incident.status || "in_progress");
    setModalNote("");
    setModalProofPhoto("");
  }

  function openDeptModal(incident) {
    setDeptModalIncident(incident);
    setTargetDept(incident.department || "Solid Waste Management (SWM)");
    setTargetOfficerId(incident.assignedOfficerId || "");
    setTargetPriority(incident.priority || "medium");
    setDeptNote("");
  }

  function openRejectModal(incident) {
    setRejectModalIncident(incident);
    setRejectReason("Duplicate report already being serviced");
    setRejectNote("");
  }

  function openInspectorModal(incident) {
    setInspectIncident(incident);
  }

  // Modal Handlers
  async function handleConfirmStatusModal(e) {
    if (e) e.preventDefault();
    if (!statusModalIncident) return;
    setActionLoading(true);
    try {
      await onStatusChange(statusModalIncident.id, modalStatus, modalNote, modalProofPhoto);
      notify(`Status updated to ${modalStatus.replace(/_/g, " ")} for ${statusModalIncident.ticketId}`);
      setStatusModalIncident(null);
      if (inspectIncident?.id === statusModalIncident.id) {
        setInspectIncident(null);
      }
    } catch (err) {
      notify(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmDeptModal(e) {
    if (e) e.preventDefault();
    if (!deptModalIncident) return;
    setActionLoading(true);
    try {
      await onAssign(
        deptModalIncident.id,
        targetOfficerId || null,
        targetDept,
        deptNote,
        targetPriority
      );
      notify(`Ticket ${deptModalIncident.ticketId} successfully routed to ${targetDept}`);
      setDeptModalIncident(null);
      if (inspectIncident?.id === deptModalIncident.id) {
        setInspectIncident(null);
      }
    } catch (err) {
      notify(`Failed to route ticket: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectIncident(e) {
    if (e) e.preventDefault();
    if (!rejectModalIncident) return;
    setActionLoading(true);
    try {
      const fullReason = rejectNote
        ? `Rejected: ${rejectReason} — ${rejectNote}`
        : `Rejected: ${rejectReason}`;
      await onStatusChange(rejectModalIncident.id, "closed", fullReason, "");
      notify(`Ticket ${rejectModalIncident.ticketId} marked as rejected/closed.`);
      setRejectModalIncident(null);
      if (inspectIncident?.id === rejectModalIncident.id) {
        setInspectIncident(null);
      }
    } catch (err) {
      notify(`Failed to reject ticket: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  function handleExportCsv() {
    const headers = [
      "Ticket ID",
      "Title",
      "Issue Type",
      "Department",
      "Status",
      "Priority",
      "Ward Number",
      "Ward Name",
      "Report Count",
      "Assigned Officer",
      "Created At"
    ];
    const rows = filteredQueue.map((i) => {
      const officer = officers.find((o) => o.id === i.assignedOfficerId);
      return [
        i.ticketId,
        `"${(i.title || "").replace(/"/g, '""')}"`,
        i.issueType,
        `"${(i.department || "Solid Waste Management").replace(/"/g, '""')}"`,
        i.status,
        i.priority,
        i.wardNumber || "Unassigned",
        `"${(i.wardName || "").replace(/"/g, '""')}"`,
        i.reportCount,
        `"${(officer ? officer.name : "Unassigned").replace(/"/g, '""')}"`,
        i.createdAt
      ];
    });
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `kindsaver-jaipur-queue-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Exported ${filteredQueue.length} tickets to CSV.`);
  }

  // Filtered Citizen accounts
  const filteredCitizens = userList.filter((u) => {
    if (!citizenSearchQuery) return true;
    const q = citizenSearchQuery.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.toLowerCase().includes(q)) ||
      (u.wardNumber && String(u.wardNumber).includes(q))
    );
  });

  // Filtered Audit logs
  const filteredAudit = auditList.filter((l) => {
    if (!auditSearchQuery) return true;
    const q = auditSearchQuery.toLowerCase();
    return (
      (l.incidentId && l.incidentId.toLowerCase().includes(q)) ||
      (l.actorId && l.actorId.toLowerCase().includes(q)) ||
      (l.toStatus && l.toStatus.toLowerCase().includes(q)) ||
      (l.note && l.note.toLowerCase().includes(q))
    );
  });

  return (
    <section className="admin-screen-layout">
      {/* Toast Notification */}
      {adminNotification && (
        <div className="admin-toast-banner">
          <CheckCircle2 size={18} />
          <span>{adminNotification}</span>
        </div>
      )}

      {/* Top Operations Header */}
      <div className="admin-page-header">
        <div className="admin-header-titles">
          <div className="admin-title-badge">
            <Shield size={15} />
            <span>Jaipur Municipal Corporation — Nagar Nigam Operations Hub</span>
          </div>
          <h2>Jaipur Waste Triage, Moderation & Department Forwarding</h2>
          <p>
            Logged in as <strong>{currentUser.name}</strong> •{" "}
            <span className="admin-role-tag">
              {currentUser.role === "admin" ? "City Administrator" : "Ward Sanitation Officer"}
            </span>
          </p>
        </div>

        <div className="header-actions-group">
          {onSwitchToCitizen && (
            <button
              type="button"
              className="admin-switch-btn"
              onClick={onSwitchToCitizen}
              title="Return to Citizen Portal"
            >
              <User size={15} />
              <span>Citizen Portal</span>
            </button>
          )}
          <button
            type="button"
            className="export-csv-btn"
            onClick={handleExportCsv}
            title="Export filtered queue to CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="icon-action-btn"
            onClick={onRefresh}
            title="Refresh dashboard data"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="admin-kpi-row">
        <div
          className={`admin-kpi-card ${selectedStatusFilter === "all" && !selectedPriorityFilter ? "active-kpi" : ""}`}
          onClick={() => { setSelectedStatusFilter("all"); setSelectedPriorityFilter(""); }}
          title="Click to view all incidents"
        >
          <div className="kpi-icon kpi-icon-blue">
            <Inbox size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-number">{totalQueueCount}</span>
            <span className="kpi-label">Total Active Reports</span>
          </div>
        </div>

        <div
          className={`admin-kpi-card ${selectedStatusFilter === "open" ? "active-kpi" : ""}`}
          onClick={() => toggleKpiFilter("status", "open")}
          title="Click to filter by Open / Needs Triage"
        >
          <div className="kpi-icon kpi-icon-amber">
            <AlertTriangle size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-number">{triageNeededCount}</span>
            <span className="kpi-label">Needs Triage (Open)</span>
          </div>
        </div>

        <div
          className={`admin-kpi-card ${selectedStatusFilter === "in_progress" ? "active-kpi" : ""}`}
          onClick={() => toggleKpiFilter("status", "in_progress")}
          title="Click to filter by In Progress / Dispatched"
        >
          <div className="kpi-icon kpi-icon-purple">
            <Truck size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-number">{inProgressCount}</span>
            <span className="kpi-label">In Progress / Dispatched</span>
          </div>
        </div>

        <div
          className={`admin-kpi-card ${selectedPriorityFilter === "critical" ? "active-kpi" : ""}`}
          onClick={() => toggleKpiFilter("priority", "critical")}
          title="Click to filter by Critical Severity"
        >
          <div className="kpi-icon kpi-icon-red">
            <Flame size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-number">{criticalCount}</span>
            <span className="kpi-label">Critical Priority</span>
          </div>
        </div>

        <div
          className={`admin-kpi-card ${selectedStatusFilter === "resolved" ? "active-kpi" : ""}`}
          onClick={() => toggleKpiFilter("status", "resolved")}
          title="Click to filter by Resolved"
        >
          <div className="kpi-icon kpi-icon-emerald">
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-number">{resolvedCount}</span>
            <span className="kpi-label">Verified Cleared</span>
          </div>
        </div>
      </div>

      {/* Admin Subnav Tabs */}
      <div className="admin-subnav-tabs">
        <button
          type="button"
          className={`admin-tab-btn ${adminTab === "queue" ? "active" : ""}`}
          onClick={() => setAdminTab("queue")}
        >
          <Filter size={16} />
          <span>Operations Queue</span>
          <span className="tab-count-badge">{filteredQueue.length}</span>
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${adminTab === "hotspots" ? "active" : ""}`}
          onClick={() => setAdminTab("hotspots")}
        >
          <Flame size={16} />
          <span>Hotspots & Workload</span>
          {wardRankings.length > 0 && <span className="tab-count-badge">{wardRankings.length} Wards</span>}
        </button>
        {currentUser?.role === "admin" && (
          <button
            type="button"
            className={`admin-tab-btn ${adminTab === "users" ? "active" : ""}`}
            onClick={() => setAdminTab("users")}
          >
            <Users size={16} />
            <span>Registered Citizens</span>
            {userList.length > 0 && <span className="tab-count-badge">{userList.length}</span>}
          </button>
        )}
        <button
          type="button"
          className={`admin-tab-btn ${adminTab === "audit" ? "active" : ""}`}
          onClick={() => setAdminTab("audit")}
        >
          <History size={16} />
          <span>Audit Logs & Proof</span>
          {auditList.length > 0 && <span className="tab-count-badge">{auditList.length}</span>}
        </button>
      </div>

      {/* ========================================================
          TAB 1: OPERATIONS QUEUE
          ======================================================== */}
      {adminTab === "queue" && (
        <div className="admin-queue-view">
          {/* Department Breakdown Cards */}
          <div className="dept-section-header">
            <h4>Filter by Municipal Department</h4>
            {selectedDeptFilter && (
              <button
                type="button"
                className="btn-clear-inline"
                onClick={() => setSelectedDeptFilter("")}
              >
                Clear Department Filter
              </button>
            )}
          </div>

          <div className="dept-summary-cards-row">
            {/* All Departments Card */}
            <div
              className={`dept-summary-card ${selectedDeptFilter === "" ? "selected" : ""}`}
              onClick={() => setSelectedDeptFilter("")}
            >
              <div className="dept-card-top">
                <span className="dept-count">{incidents.length}</span>
                <Layers size={18} className="dept-icon-muted" />
              </div>
              <strong className="dept-name">All Municipal Units</strong>
              <span className="dept-sub">Complete municipal operations</span>
            </div>

            {/* Specific Department Cards */}
            {departments.map((d) => {
              const count = incidents.filter((i) => i.department === d.value).length;
              return (
                <div
                  key={d.value}
                  className={`dept-summary-card ${selectedDeptFilter === d.value ? "selected" : ""}`}
                  onClick={() =>
                    setSelectedDeptFilter(selectedDeptFilter === d.value ? "" : d.value)
                  }
                >
                  <div className="dept-card-top">
                    <span className="dept-count">{count}</span>
                    <Building size={18} className="dept-icon-muted" />
                  </div>
                  <strong className="dept-name">{d.label}</strong>
                  <span className="dept-sub">{d.desc}</span>
                </div>
              );
            })}
          </div>

          {/* Filters Bar */}
          <div className="queue-filter-toolbar">
            <div className="filter-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search ticket, ward, description, reporter, officer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="filter-selects-group">
              {/* Department Dropdown */}
              <select
                className="filter-select"
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>

              {/* Ward Dropdown */}
              <select
                className="filter-select"
                value={selectedWardFilter}
                onChange={(e) => setSelectedWardFilter(e.target.value)}
              >
                <option value="">All Jaipur Wards</option>
                {JAIPUR_OFFICIAL_WARDS.map((w) => (
                  <option key={w.number} value={w.number}>
                    Ward {w.number} — {w.name}
                  </option>
                ))}
              </select>

              {/* Status Dropdown */}
              <select
                className="filter-select"
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {/* Priority Dropdown */}
              <select
                className="filter-select"
                value={selectedPriorityFilter}
                onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              >
                {priorities.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>

              {/* Reset All Filters Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-clear-filters"
                  onClick={resetAllFilters}
                  title="Clear all active filters"
                >
                  <RotateCcw size={14} />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Results Summary Bar */}
          <div className="queue-results-summary">
            <span>
              Showing <strong>{filteredQueue.length}</strong> of <strong>{incidents.length}</strong> tickets
            </span>
            {hasActiveFilters && (
              <span className="filters-active-tag">Filters Active</span>
            )}
          </div>

          {/* Triage Table */}
          <div className="triage-table-card">
            {filteredQueue.length === 0 ? (
              <div className="empty-state-card">
                <Inbox size={48} className="empty-state-icon" />
                <h3>No Tickets Match Current Filters</h3>
                <p>
                  No incidents in the queue match your search criteria. Try modifying your search term
                  or resetting the filters.
                </p>
                <button
                  type="button"
                  className="hero-cta-secondary"
                  onClick={resetAllFilters}
                >
                  <RotateCcw size={15} />
                  <span>Reset All Filters</span>
                </button>
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table className="operations-table">
                  <thead>
                    <tr>
                      <th style={{ width: "160px" }}>Ticket ID</th>
                      <th style={{ minWidth: "260px" }}>Location & Details</th>
                      <th style={{ minWidth: "170px" }}>Department</th>
                      <th style={{ width: "105px" }}>Priority</th>
                      <th style={{ width: "115px" }}>Status</th>
                      <th style={{ minWidth: "160px" }}>Assigned Officer</th>
                      <th style={{ width: "180px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.map((incident) => {
                      const assignedOfficer = officers.find(
                        (o) => o.id === incident.assignedOfficerId
                      );
                      const issueMeta = issueTypes.find(
                        (it) => it.value === incident.issueType
                      );
                      const isCopied = copyFeedbackId === incident.ticketId;

                      return (
                        <tr key={incident.id} className="operations-table-row">
                          {/* Ticket Cell */}
                          <td>
                            <div className="ticket-cell-content">
                              <div className="ticket-code-row">
                                <strong className="ticket-code">{incident.ticketId}</strong>
                                <button
                                  type="button"
                                  className="btn-copy-ticket"
                                  onClick={(e) => handleCopyTicket(incident.ticketId, e)}
                                  title="Copy Ticket ID"
                                >
                                  {isCopied ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                                </button>
                              </div>
                              <span className="table-reports-badge">
                                {incident.reportCount} {incident.reportCount === 1 ? "report" : "reports"}
                              </span>
                              {incident.createdAt && (
                                <span className="ticket-time-hint">
                                  {new Date(incident.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Description & Location Cell */}
                          <td>
                            <div className="desc-cell">
                              <div className="desc-title-row">
                                <strong className="incident-title-text">{incident.title}</strong>
                                {issueMeta && (
                                  <span
                                    className="issue-badge"
                                    style={{
                                      backgroundColor: `${issueMeta.color}15`,
                                      color: issueMeta.color,
                                      borderColor: `${issueMeta.color}30`
                                    }}
                                  >
                                    {issueMeta.label}
                                  </span>
                                )}
                              </div>
                              <p className="desc-subtext">{incident.description}</p>
                              <div className="desc-meta-row">
                                <span className="ward-pill">
                                  <MapPin size={12} />
                                  <span>{incident.wardName || `Ward ${incident.wardNumber || "N/A"}`}</span>
                                </span>
                                {incident.zone && (
                                  <span className="zone-pill">{incident.zone} Zone</span>
                                )}
                                {incident.photoUrl && (
                                  <button
                                    type="button"
                                    className="evidence-photo-pill"
                                    onClick={() => openInspectorModal(incident)}
                                    title="View evidence photograph"
                                  >
                                    <Eye size={11} />
                                    <span>Photo Evidence</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Department Cell */}
                          <td>
                            <span className="dept-pill-badge">
                              {incident.department || "Solid Waste Management (SWM)"}
                            </span>
                          </td>

                          {/* Priority Cell */}
                          <td>
                            <span className={`priority-badge priority-${incident.priority || "medium"}`}>
                              {incident.priority === "critical" && <Flame size={12} />}
                              <span>{incident.priority || "medium"}</span>
                            </span>
                          </td>

                          {/* Status Cell */}
                          <td>
                            <span className={`status-pill status-${incident.status || "open"}`}>
                              {(incident.status || "open").replace(/_/g, " ")}
                            </span>
                          </td>

                          {/* Assigned Officer Cell */}
                          <td>
                            {assignedOfficer ? (
                              <div className="officer-assigned-tag">
                                <UserCheck size={14} className="officer-icon" />
                                <div>
                                  <span className="officer-name">{assignedOfficer.name}</span>
                                  <span className="officer-org-sub">{assignedOfficer.organisation}</span>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="unassigned-btn"
                                onClick={() => openDeptModal(incident)}
                                title="Click to assign an officer"
                              >
                                <span className="unassigned-dot" />
                                <span>Unassigned</span>
                              </button>
                            )}
                          </td>

                          {/* Actions Cell */}
                          <td style={{ textAlign: "right" }}>
                            <div className="table-row-actions">
                              <button
                                type="button"
                                className="action-btn-inspect"
                                onClick={() => openInspectorModal(incident)}
                                title="Inspect Ticket Details & Photo"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn-action-route"
                                onClick={() => openDeptModal(incident)}
                                title="Route to Municipal Department & Assign Officer"
                              >
                                <Send size={13} />
                                <span>Route</span>
                              </button>
                              <button
                                type="button"
                                className="btn-action-status"
                                onClick={() => openStatusModal(incident)}
                                title="Update Status & Cleanup Proof"
                              >
                                <CheckCircle2 size={13} />
                                <span>Status</span>
                              </button>
                              <button
                                type="button"
                                className="btn-action-reject"
                                onClick={() => openRejectModal(incident)}
                                title="Reject as Spam or Duplicate"
                              >
                                <XCircle size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: HOTSPOTS & WORKLOAD
          ======================================================== */}
      {adminTab === "hotspots" && (
        <div className="admin-hotspots-view">
          {/* Section 1: Jaipur Ward Hotspots & Vulnerability Ranking */}
          <div className="triage-table-card hotspot-ranking-card">
            <div className="table-card-header">
              <div className="header-icon-title">
                <Flame size={20} className="text-danger" />
                <div>
                  <h3>Jaipur Ward Hotspots & Cleanliness Vulnerability Index</h3>
                  <p>Real-time analytics of civic waste burden across Jaipur municipal wards.</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-refresh-sm"
                onClick={loadWardRankings}
                disabled={loadingRankings}
              >
                <RefreshCw size={13} className={loadingRankings ? "spin" : ""} />
                <span>Refresh Rankings</span>
              </button>
            </div>

            {loadingRankings ? (
              <p className="loading-p">Computing ward rankings from municipal database...</p>
            ) : wardRankings.length === 0 ? (
              <p className="loading-p">No ward rankings available yet.</p>
            ) : (
              <div className="table-responsive-wrapper">
                <table className="operations-table">
                  <thead>
                    <tr>
                      <th style={{ width: "70px" }}>Rank</th>
                      <th>Ward & Locality</th>
                      <th>Zone</th>
                      <th style={{ textAlign: "center" }}>Total Reports</th>
                      <th style={{ textAlign: "center" }}>Open Issues</th>
                      <th style={{ textAlign: "center" }}>Critical Severity</th>
                      <th style={{ width: "160px" }}>Sanitation Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wardRankings.map((w, idx) => {
                      const isHigh = w.openCount >= 5 || w.criticalCount > 0;
                      const isMod = w.openCount >= 2;
                      return (
                        <tr key={w.wardNumber || idx}>
                          <td>
                            <strong className={`rank-number ${idx === 0 ? "rank-1" : ""}`}>
                              #{idx + 1}
                            </strong>
                          </td>
                          <td>
                            <strong>Ward {w.wardNumber}</strong> — {w.wardName}
                          </td>
                          <td>
                            <span className="zone-pill">{w.zone} Zone</span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <strong>{w.reportCount}</strong>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className="badge-open-count">{w.openCount}</span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {w.criticalCount > 0 ? (
                              <span className="badge-critical-count">{w.criticalCount}</span>
                            ) : (
                              <span className="text-muted">0</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`risk-meter-pill ${
                                isHigh ? "risk-high" : isMod ? "risk-medium" : "risk-low"
                              }`}
                            >
                              {isHigh ? "High Attention" : isMod ? "Moderate" : "Normal"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Municipal Officer Workload & Dispatch Grid */}
          <div className="officers-workload-section">
            <div className="section-title-row">
              <Users size={18} />
              <h3>Ward Officer Deployment & Active Field Workloads</h3>
            </div>

            <div className="officer-workload-grid">
              {officers.map((officer) => {
                const assigned = incidents.filter((i) => i.assignedOfficerId === officer.id);
                const active = assigned.filter((i) => !["resolved", "closed"].includes(i.status));
                const resolved = assigned.filter((i) => ["resolved", "closed"].includes(i.status));

                return (
                  <div key={officer.id} className="officer-workload-card">
                    <div className="officer-top-row">
                      <div className="officer-avatar-info">
                        <div className="officer-avatar-circle">
                          {officer.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4>{officer.name}</h4>
                          <span className="officer-zone">
                            {officer.zone} Zone • Wards {officer.wardNumbers.join(", ")}
                          </span>
                        </div>
                      </div>
                      <span className={`workload-count-chip ${active.length > 5 ? "chip-heavy" : ""}`}>
                        {active.length} Active
                      </span>
                    </div>

                    <div className="officer-metrics-row">
                      <div className="metric-box">
                        <span className="metric-label">Active Tickets</span>
                        <strong className="metric-val">{active.length}</strong>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Resolved</span>
                        <strong className="metric-val text-emerald">{resolved.length}</strong>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Total Handled</span>
                        <strong className="metric-val">{assigned.length}</strong>
                      </div>
                    </div>

                    <div className="officer-contact-details">
                      {officer.email && (
                        <div className="contact-item">
                          <Mail size={13} />
                          <span>{officer.email}</span>
                        </div>
                      )}
                      {officer.phone && (
                        <div className="contact-item">
                          <Phone size={13} />
                          <span>{officer.phone}</span>
                        </div>
                      )}
                      <div className="contact-item">
                        <Building size={13} />
                        <span>{officer.organisation}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: REGISTERED CITIZENS
          ======================================================== */}
      {adminTab === "users" && (
        <div className="admin-users-view">
          <div className="triage-table-card">
            <div className="table-card-header">
              <div>
                <h3>Verified Resident Citizen Directory ({userList.length})</h3>
                <p>Citizens registered in Jaipur Nagar Nigam with affiliated home wards.</p>
              </div>

              <div className="filter-search-box search-box-compact">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search resident by name, email, phone, ward..."
                  value={citizenSearchQuery}
                  onChange={(e) => setCitizenSearchQuery(e.target.value)}
                />
                {citizenSearchQuery && (
                  <button type="button" className="clear-search-btn" onClick={() => setCitizenSearchQuery("")}>
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {loadingExtra ? (
              <p className="loading-p">Loading citizen accounts from municipal directory...</p>
            ) : filteredCitizens.length === 0 ? (
              <div className="empty-state-card">
                <Users size={36} className="empty-state-icon" />
                <p>No citizen accounts found matching "{citizenSearchQuery}".</p>
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table className="operations-table">
                  <thead>
                    <tr>
                      <th>Resident Name</th>
                      <th>Email Address</th>
                      <th>Phone Number</th>
                      <th>Home Ward</th>
                      <th>Account Role</th>
                      <th>Registration Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCitizens.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="user-name-cell">
                            <div className="user-icon-badge">
                              {u.name ? u.name[0].toUpperCase() : "U"}
                            </div>
                            <strong>{u.name}</strong>
                          </div>
                        </td>
                        <td>{u.email}</td>
                        <td>{u.phone || <span className="text-muted">—</span>}</td>
                        <td>
                          <span className="ward-pill">
                            <MapPin size={11} />
                            <span>Ward {u.wardNumber || "Unspecified"}</span>
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-pill status-${
                              u.role === "admin"
                                ? "assigned"
                                : u.role === "ward_officer"
                                ? "verified"
                                : "open"
                            }`}
                          >
                            {u.role === "admin"
                              ? "Administrator"
                              : u.role === "ward_officer"
                              ? "Ward Officer"
                              : "Resident"}
                          </span>
                        </td>
                        <td>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 4: AUDIT LOGS & PROOF
          ======================================================== */}
      {adminTab === "audit" && (
        <div className="admin-audit-view">
          <div className="triage-table-card">
            <div className="table-card-header">
              <div>
                <h3>Municipal Action & Status Transition Audit Trail</h3>
                <p>Tamper-evident record of all status transitions, officer dispatches, and notes.</p>
              </div>

              <div className="filter-search-box search-box-compact">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Filter logs by ticket ID, actor, note..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                />
                {auditSearchQuery && (
                  <button type="button" className="clear-search-btn" onClick={() => setAuditSearchQuery("")}>
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {loadingExtra ? (
              <p className="loading-p">Loading municipal audit log records...</p>
            ) : filteredAudit.length === 0 ? (
              <div className="empty-state-card">
                <History size={36} className="empty-state-icon" />
                <p>No audit trail records found.</p>
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table className="operations-table">
                  <thead>
                    <tr>
                      <th style={{ width: "170px" }}>Timestamp</th>
                      <th style={{ width: "150px" }}>Incident Ticket</th>
                      <th style={{ width: "140px" }}>Municipal Actor</th>
                      <th style={{ width: "200px" }}>Transition</th>
                      <th>Resolution Note & Cleanup Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudit.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <span className="audit-timestamp">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <strong className="ticket-code">{log.incidentId}</strong>
                        </td>
                        <td>
                          <span className="actor-code">{log.actorId}</span>
                        </td>
                        <td>
                          <span className="transition-badge">
                            <span className="from-status">{log.fromStatus}</span>
                            <ArrowRight size={12} className="trans-arrow" />
                            <strong className="to-status">{log.toStatus}</strong>
                          </span>
                        </td>
                        <td>
                          <div className="audit-note-cell">
                            <p>{log.note || "No remarks entered"}</p>
                            {log.proofPhotoUrl && (
                              <a
                                href={formatMediaUrl(log.proofPhotoUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="proof-link-pill"
                              >
                                <Eye size={12} />
                                <span>Inspect Cleanup Proof Photo</span>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 1: Department Forwarding & Officer Assignment
          ======================================================== */}
      {deptModalIncident && (
        <div className="modal-backdrop" onClick={() => setDeptModalIncident(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Forward Ticket to Municipal Department</h3>
                <p>
                  Ticket: <strong>{deptModalIncident.ticketId}</strong> — {deptModalIncident.title}
                </p>
              </div>
              <button
                type="button"
                className="icon-close"
                onClick={() => setDeptModalIncident(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmDeptModal}>
              <div className="form-group">
                <label>Responsible Municipal Department</label>
                <select
                  className="modal-select"
                  value={targetDept}
                  onChange={(e) => setTargetDept(e.target.value)}
                  required
                >
                  {departments.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Assign Ward Officer</label>
                <select
                  className="modal-select"
                  value={targetOfficerId}
                  onChange={(e) => setTargetOfficerId(e.target.value)}
                >
                  <option value="">No officer assignment (Keep Unassigned)</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.zone} Zone — Wards {o.wardNumbers.join(", ")}) — {o.organisation}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Operational Priority Level</label>
                <select
                  className="modal-select"
                  value={targetPriority}
                  onChange={(e) => setTargetPriority(e.target.value)}
                >
                  <option value="low">Low (Standard Routine Cleanup)</option>
                  <option value="medium">Medium (Requires Action within 24-48 hrs)</option>
                  <option value="high">High (Major Public Inconvenience)</option>
                  <option value="critical">Critical (Severe Health / Drainage Hazard)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Dispatch Note / Routing Instructions</label>
                <textarea
                  className="modal-textarea"
                  rows={3}
                  placeholder="e.g., Dispatched priority tipper vehicle; cleanup required within 4 hours."
                  value={deptNote}
                  onChange={(e) => setDeptNote(e.target.value)}
                />
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setDeptModalIncident(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="hero-cta-primary" disabled={actionLoading}>
                  {actionLoading ? "Routing..." : "Confirm & Route to Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: Status Update & Resolution Proof Photo
          ======================================================== */}
      {statusModalIncident && (
        <div className="modal-backdrop" onClick={() => setStatusModalIncident(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Update Incident Resolution Status</h3>
                <p>
                  Ticket: <strong>{statusModalIncident.ticketId}</strong> — {statusModalIncident.title}
                </p>
              </div>
              <button
                type="button"
                className="icon-close"
                onClick={() => setStatusModalIncident(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmStatusModal}>
              <div className="form-group">
                <label>New Operational Status</label>
                <select
                  className="modal-select"
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value)}
                  required
                >
                  <option value="open">Open (Awaiting Review)</option>
                  <option value="verified">Verified (Confirmed by Ward Inspector)</option>
                  <option value="assigned">Assigned (Dispatched to Sanitation Crew)</option>
                  <option value="in_progress">In Progress (Crew On Site)</option>
                  <option value="resolved">Resolved (Cleanup Verified with Photo Proof)</option>
                  <option value="closed">Closed (Permanently Cleared & Archived)</option>
                  <option value="reopened">Reopened (Follow-up Required / Recurred)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Resolution Note / Audit Remarks</label>
                <textarea
                  className="modal-textarea"
                  rows={3}
                  placeholder="Enter operational notes, vehicle tipper numbers, or justification..."
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Cleanup Evidence Photo (Before / After Proof)</label>
                <PhotoUpload
                  value={modalProofPhoto}
                  onChange={(url) => setModalProofPhoto(url)}
                  label="Upload Resolution Proof Photo"
                  hint="Provide a clear photo of the cleared area as proof of resolution"
                />
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStatusModalIncident(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="hero-cta-primary" disabled={actionLoading}>
                  {actionLoading ? "Saving Transition..." : "Save Status Transition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: Reject / Mark Spam
          ======================================================== */}
      {rejectModalIncident && (
        <div className="modal-backdrop" onClick={() => setRejectModalIncident(null)}>
          <div className="modal-card modal-card-danger" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Reject or Flag Civic Report</h3>
                <p>
                  Ticket: <strong>{rejectModalIncident.ticketId}</strong> — {rejectModalIncident.title}
                </p>
              </div>
              <button
                type="button"
                className="icon-close"
                onClick={() => setRejectModalIncident(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRejectIncident}>
              <div className="form-group">
                <label>Official Reason for Rejection</label>
                <select
                  className="modal-select"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                >
                  <option value="Duplicate report already being serviced">
                    Duplicate report already being serviced
                  </option>
                  <option value="Location outside Jaipur municipal boundary">
                    Location outside Jaipur municipal boundary
                  </option>
                  <option value="Private property / non-municipal jurisdiction">
                    Private property / non-municipal jurisdiction
                  </option>
                  <option value="Spam / invalid photograph submitted">
                    Spam / invalid photograph submitted
                  </option>
                  <option value="Not a municipal waste issue">
                    Not a municipal waste issue
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label>Additional Notes / Explanation</label>
                <textarea
                  className="modal-textarea"
                  rows={2}
                  placeholder="Specify details for the rejection record..."
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                />
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRejectModalIncident(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-danger-confirm" disabled={actionLoading}>
                  {actionLoading ? "Processing..." : "Confirm Rejection & Close"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: Incident Detail & Evidence Inspector
          ======================================================== */}
      {inspectIncident && (
        <div className="modal-backdrop" onClick={() => setInspectIncident(null)}>
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="inspector-header-left">
                <span className="ticket-code-lg">{inspectIncident.ticketId}</span>
                <h3>{inspectIncident.title}</h3>
              </div>
              <button
                type="button"
                className="icon-close"
                onClick={() => setInspectIncident(null)}
              >
                &times;
              </button>
            </div>

            <div className="inspector-body">
              {/* Top metadata grid */}
              <div className="inspector-grid">
                <div className="inspector-item">
                  <span className="inspector-label">Operational Status</span>
                  <span className={`status-pill status-${inspectIncident.status || "open"}`}>
                    {(inspectIncident.status || "open").replace(/_/g, " ")}
                  </span>
                </div>

                <div className="inspector-item">
                  <span className="inspector-label">Severity Priority</span>
                  <span className={`priority-badge priority-${inspectIncident.priority || "medium"}`}>
                    {inspectIncident.priority || "medium"}
                  </span>
                </div>

                <div className="inspector-item">
                  <span className="inspector-label">Responsible Department</span>
                  <strong>{inspectIncident.department || "Solid Waste Management (SWM)"}</strong>
                </div>

                <div className="inspector-item">
                  <span className="inspector-label">Assigned Ward Officer</span>
                  <span>
                    {officers.find((o) => o.id === inspectIncident.assignedOfficerId)?.name ||
                      "Unassigned"}
                  </span>
                </div>

                <div className="inspector-item">
                  <span className="inspector-label">Location / Ward</span>
                  <span>
                    {inspectIncident.wardName || `Ward ${inspectIncident.wardNumber}`} (
                    {inspectIncident.zone} Zone)
                  </span>
                </div>

                <div className="inspector-item">
                  <span className="inspector-label">GPS Coordinates</span>
                  <span className="font-mono text-xs">
                    {inspectIncident.location?.coordinates
                      ? `${inspectIncident.location.coordinates[1].toFixed(5)}, ${inspectIncident.location.coordinates[0].toFixed(5)}`
                      : "GPS attached"}
                  </span>
                </div>

                <div className="inspector-item">
                  <span className="inspector-label">Citizen Reporter</span>
                  <span>
                    {inspectIncident.reporterName || "Anonymous Resident"}
                    {inspectIncident.reporterPhone && ` • ${inspectIncident.reporterPhone}`}
                  </span>
                </div>

                <div className="inspector-item">
                  <span className="inspector-label">Created At</span>
                  <span>
                    {inspectIncident.createdAt
                      ? new Date(inspectIncident.createdAt).toLocaleString()
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="inspector-desc-box">
                <span className="inspector-label">Report Description</span>
                <p>{inspectIncident.description}</p>
              </div>

              {/* Evidence Photograph */}
              {inspectIncident.photoUrl && (
                <div className="inspector-photo-section">
                  <span className="inspector-label">Citizen Photo Evidence</span>
                  <div className="inspector-photo-wrapper">
                    <img
                      src={formatMediaUrl(inspectIncident.photoUrl)}
                      alt="Citizen evidence"
                      className="inspector-photo-img"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer-actions">
              <button
                type="button"
                className="btn-action-reject"
                onClick={() => {
                  setRejectModalIncident(inspectIncident);
                  setRejectReason("Duplicate report already being serviced");
                  setRejectNote("");
                }}
              >
                <XCircle size={14} />
                <span>Reject / Spam</span>
              </button>

              <button
                type="button"
                className="btn-action-route"
                onClick={() => openDeptModal(inspectIncident)}
              >
                <Send size={14} />
                <span>Route Department</span>
              </button>

              <button
                type="button"
                className="btn-action-status"
                onClick={() => openStatusModal(inspectIncident)}
              >
                <CheckCircle2 size={14} />
                <span>Update Status</span>
              </button>

              <button
                type="button"
                className="hero-cta-secondary"
                onClick={() => setInspectIncident(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
