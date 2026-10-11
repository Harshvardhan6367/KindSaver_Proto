import React, { useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Eye,
  Filter,
  Image as ImageIcon,
  List,
  MapPin,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  Ticket
} from "lucide-react";
import { JaipurMap } from "./JaipurMap.jsx";
import { formatMediaUrl, issueTypes, priorities, statuses } from "../api.js";

export function MapScreen({
  filters,
  setFilters,
  mapData,
  wards,
  stats,
  incidents,
  selectedIncident,
  selectedFeature,
  setSelectedIncident,
  loading,
  onRefresh,
  onReport,
  onTrackTicket
}) {
  const [displayMode, setDisplayMode] = useState("map"); // "map" or "list"
  const [searchQuery, setSearchQuery] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Active filters count
  const activeFiltersCount = [filters.priority, filters.status !== "all" && filters.status, filters.issueType].filter(Boolean).length;

  // Filter incidents locally for search query
  const filteredIncidents = incidents.filter((inc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inc.ticketId?.toLowerCase().includes(q) ||
      inc.title?.toLowerCase().includes(q) ||
      inc.wardName?.toLowerCase().includes(q) ||
      inc.issueType?.toLowerCase().includes(q)
    );
  });

  return (
    <section className="map-screen-layout">
      {/* Banner */}
      <div className="civic-summary-banner">
        <div className="banner-stats">
          <div className="banner-item">
            <span className="banner-number">{stats?.totals?.reports ?? 0}</span>
            <span className="banner-label">Citizen Reports</span>
          </div>
          <div className="banner-item highlight">
            <span className="banner-number">{stats?.totals?.activeIncidents ?? 0}</span>
            <span className="banner-label">Active Incidents</span>
          </div>
          <div className="banner-item">
            <span className="banner-number">{stats?.totals?.criticalIncidents ?? 0}</span>
            <span className="banner-label">Critical Spots</span>
          </div>
          <div className="banner-item resolved">
            <span className="banner-number">{stats?.totals?.resolvedIncidents ?? 0}</span>
            <span className="banner-label">Resolved Cleanups</span>
          </div>
        </div>

        <div className="banner-cta">
          <button className="primary-report-btn" onClick={onReport}>
            <PlusCircle size={18} />
            <span>Report Civic Waste</span>
          </button>
        </div>
      </div>

      {/* Filter and control bar */}
      <div className="map-control-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search ticket, ward, or street..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery("")} aria-label="Clear search">
              &times;
            </button>
          )}
        </div>

        {/* Mobile Filter Toggle Button */}
        <button
          type="button"
          className={`mobile-filter-toggle-btn ${activeFiltersCount > 0 ? "has-active" : ""}`}
          onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          aria-expanded={mobileFiltersOpen}
        >
          <Filter size={15} />
          <span>Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}</span>
        </button>

        <div className={`filter-selects ${mobileFiltersOpen ? "mobile-filters-expanded" : ""}`}>
          <select
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            className="filter-select"
            aria-label="Filter by priority"
          >
            {priorities.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="filter-select"
            aria-label="Filter by status"
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={filters.issueType}
            onChange={(e) => setFilters({ ...filters, issueType: e.target.value })}
            className="filter-select"
            aria-label="Filter by issue type"
          >
            <option value="">All Issue Categories</option>
            {issueTypes.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>

          <button className="icon-action-btn" onClick={onRefresh} title="Refresh data" aria-label="Refresh data">
            <RefreshCw size={17} className={loading ? "spin" : ""} />
          </button>

          <div className="view-mode-toggle">
            <button
              className={`mode-btn ${displayMode === "map" ? "active" : ""}`}
              onClick={() => setDisplayMode("map")}
              title="Map View"
            >
              <MapPin size={16} />
              <span>Map</span>
            </button>
            <button
              className={`mode-btn ${displayMode === "list" ? "active" : ""}`}
              onClick={() => setDisplayMode("list")}
              title="List View"
            >
              <List size={16} />
              <span>List ({filteredIncidents.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main stage */}
      <div className="map-content-split">
        <div className="map-main-viewport">
          {displayMode === "map" ? (
            <JaipurMap
              mapData={mapData}
              wards={wards}
              selectedId={selectedIncident?.id}
              onSelect={(id) => {
                const found = incidents.find((i) => i.id === id);
                if (found) setSelectedIncident(found);
              }}
            />
          ) : (
            <div className="incident-cards-scroll">
              {filteredIncidents.length === 0 ? (
                <div className="empty-results-box">
                  <AlertCircle size={32} />
                  <h4>No waste incidents match your filters</h4>
                  <p>Try resetting severity or status filters.</p>
                </div>
              ) : (
                filteredIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className={`incident-list-card ${selectedIncident?.id === inc.id ? "active-card" : ""}`}
                    onClick={() => setSelectedIncident(inc)}
                  >
                    <div className="card-top">
                      <div className="card-badges">
                        <span className={`badge-pill badge-${inc.priority}`}>{inc.priority}</span>
                        <span className={`badge-pill badge-${inc.status}`}>
                          {inc.status.replace("_", " ")}
                        </span>
                      </div>
                      <span className="card-ticket">{inc.ticketId}</span>
                    </div>

                    <h4 className="card-title">{inc.title}</h4>
                    <p className="card-desc">{inc.description}</p>

                    <div className="card-meta-row">
                      <span className="meta-ward">
                        <MapPin size={14} />
                        {inc.wardName}
                      </span>
                      <span className="meta-reports">
                        <strong>{inc.reportCount}</strong> reports merged
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Side focus card / Bottom sheet */}
        <aside className={`incident-focus-panel ${selectedIncident ? "has-selected" : ""}`}>
          {selectedIncident ? (
            <div className="focus-card">
              <div className="focus-bottom-sheet-handle" onClick={() => setSelectedIncident(null)} />
              <div className="focus-header">
                <div className="focus-badges">
                  <span className={`badge-pill badge-${selectedIncident.priority}`}>
                    {selectedIncident.priority.toUpperCase()}
                  </span>
                  <span className={`badge-pill badge-${selectedIncident.status}`}>
                    {selectedIncident.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <div className="focus-header-right">
                  <span className="focus-ticket-id">{selectedIncident.ticketId}</span>
                  <button
                    type="button"
                    className="focus-close-btn"
                    onClick={() => setSelectedIncident(null)}
                    title="Close details"
                    aria-label="Close ticket details"
                  >
                    &times;
                  </button>
                </div>
              </div>

              <h3 className="focus-title">{selectedIncident.title}</h3>
              <p className="focus-desc">{selectedIncident.description}</p>

              {/* Photo preview if present */}
              {selectedIncident.photoUrl ? (
                <div
                  className="focus-photo-thumbnail"
                  onClick={() => setPreviewImage(formatMediaUrl(selectedIncident.photoUrl))}
                >
                  <img src={formatMediaUrl(selectedIncident.photoUrl)} alt="Incident Evidence" />
                  <div className="thumbnail-zoom-hint">
                    <Eye size={14} />
                    <span>View Photo</span>
                  </div>
                </div>
              ) : null}

              <dl className="focus-details-grid">
                <div className="detail-item">
                  <dt>Ward Boundary</dt>
                  <dd>
                    {selectedIncident.wardName}
                    {selectedIncident.wardNumber ? ` (Ward ${selectedIncident.wardNumber})` : ""}
                  </dd>
                </div>
                <div className="detail-item">
                  <dt>Municipal Zone</dt>
                  <dd>{selectedIncident.zone || "Jaipur Municipal Corporation"}</dd>
                </div>
                <div className="detail-item">
                  <dt>Citizen Signal</dt>
                  <dd>
                    <span className="highlight-count">{selectedIncident.reportCount}</span> Reports
                  </dd>
                </div>
                <div className="detail-item">
                  <dt>Assigned Officer</dt>
                  <dd>
                    {selectedIncident.assignedOfficer?.name || (
                      <span className="text-muted">Pending Assignment</span>
                    )}
                  </dd>
                </div>
                <div className="detail-item wide">
                  <dt>GPS Coordinates</dt>
                  <dd>
                    {selectedFeature?.geometry?.coordinates
                      ? `${selectedFeature.geometry.coordinates[1].toFixed(5)}, ${selectedFeature.geometry.coordinates[0].toFixed(5)}`
                      : `${selectedIncident.location?.coordinates?.[1]?.toFixed(5) || ""}, ${selectedIncident.location?.coordinates?.[0]?.toFixed(5) || ""}`}
                  </dd>
                </div>
              </dl>

              <div className="focus-actions">
                <button
                  type="button"
                  className="btn-track-ticket"
                  onClick={() => onTrackTicket(selectedIncident.ticketId)}
                >
                  <Ticket size={17} />
                  <span>Track Full Timeline</span>
                </button>
                <button type="button" className="btn-report-nearby" onClick={onReport}>
                  <Send size={17} />
                  <span>Report At Spot</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="focus-empty-state">
              <MapPin size={36} className="empty-pin" />
              <h4>Select an incident marker</h4>
              <p>Click on any marker on the map to inspect citizen reports, ward details, and tracking info.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Image Modal Lightbox */}
      {previewImage && (
        <div className="image-lightbox-modal" onClick={() => setPreviewImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Full resolution evidence" />
            <button className="lightbox-close" onClick={() => setPreviewImage(null)}>
              &times;
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
