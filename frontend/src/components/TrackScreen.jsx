import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  Share2,
  Shield,
  ThumbsUp,
  Ticket,
  User,
  UserCheck
} from "lucide-react";
import { formatMediaUrl } from "../api.js";

const WORKFLOW_STEPS = [
  { key: "open", label: "Reported" },
  { key: "verified", label: "Verified" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" }
];

export function TrackScreen({
  ticketId,
  setTicketId,
  detail,
  onSearch,
  onConfirm,
  lastReport
}) {
  const [searchInput, setSearchInput] = useState(ticketId || "");
  const [confirming, setConfirming] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchedId, setSearchedId] = useState(ticketId || "");
  const [copied, setCopied] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);

  useEffect(() => {
    if (ticketId) {
      setSearchInput(ticketId);
      setSearchedId(ticketId);
    }
  }, [ticketId]);

  async function handleFormSearch(e) {
    if (e) e.preventDefault();
    const query = searchInput.trim().toUpperCase();
    if (!query) return;
    setSearching(true);
    setSearchedId(query);
    setTicketId(query);
    try {
      await onSearch(query);
    } finally {
      setSearching(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    setConfirmSuccess(false);
    setConfirmError(null);
    try {
      await onConfirm();
      setConfirmSuccess(true);
      setTimeout(() => setConfirmSuccess(false), 4000);
    } catch (err) {
      setConfirmError(err.message || "Unable to confirm issue. You may have already confirmed this or the ticket is closed.");
      setTimeout(() => setConfirmError(null), 5000);
    } finally {
      setConfirming(false);
    }
  }

  function handleCopyTicket() {
    navigator.clipboard.writeText(detail?.incident?.ticketId || searchInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const incident = detail?.incident;
  const currentStatus = incident?.status || "open";

  // Compute active step index for progress bar
  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.key === currentStatus);
  const isResolvedOrClosed = ["resolved", "closed"].includes(currentStatus);

  return (
    <section className="track-screen-layout">
      {/* Search Header */}
      <div className="track-search-card">
        <form onSubmit={handleFormSearch} className="track-search-form">
          <div className="search-input-wrap">
            <Ticket size={20} className="search-ticket-icon" />
            <input
              type="text"
              placeholder="Enter Jaipur ticket ID (e.g. KR-2026-0004)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="track-search-btn" disabled={searching}>
            {searching ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
            <span>{searching ? "Searching..." : "Track Progress"}</span>
          </button>
        </form>

        {lastReport?.incident?.ticketId ? (
          <div className="sample-tickets-row">
            <span className="sample-label">Your Recent Report:</span>
            <button
              type="button"
              className="sample-ticket-chip"
              onClick={() => {
                setSearchInput(lastReport.incident.ticketId);
                setTicketId(lastReport.incident.ticketId);
                onSearch(lastReport.incident.ticketId);
              }}
            >
              {lastReport.incident.ticketId}
            </button>
          </div>
        ) : (
          <div className="sample-tickets-row">
            <span className="sample-label">Ticket Format:</span>
            <span className="sample-ticket-chip">KR-YYYY-XXXX</span>
          </div>
        )}
      </div>

      {incident ? (
        <div className="ticket-full-details-view">
          {/* Status Progression Stepper */}
          <div className="stepper-card">
            <div className="stepper-title">
              <h4>Civic Resolution Progress</h4>
              <span className={`badge-pill badge-${incident.status}`}>
                {incident.status.replace("_", " ").toUpperCase()}
              </span>
            </div>

            <div className="stepper-bar">
              {WORKFLOW_STEPS.map((step, idx) => {
                const isPassed = isResolvedOrClosed || (currentStepIndex >= 0 && idx <= currentStepIndex);
                const isCurrent = currentStatus === step.key;
                return (
                  <div key={step.key} className={`stepper-node ${isPassed ? "completed" : ""} ${isCurrent ? "current" : ""}`}>
                    <div className="node-marker">
                      {isPassed ? <CheckCircle size={16} /> : <span>{idx + 1}</span>}
                    </div>
                    <span className="node-label">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ticket-content-columns">
            {/* Left Card: Incident Metadata */}
            <div className="ticket-main-info-card">
              <div className="info-card-header">
                <div>
                  <div className="ticket-id-tag">
                    <Ticket size={16} />
                    <strong>{incident.ticketId}</strong>
                    <button
                      className="copy-btn"
                      onClick={handleCopyTicket}
                      title="Copy Ticket ID"
                    >
                      {copied ? <CheckCircle2 size={14} className="text-emerald" /> : <Copy size={14} />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <h2 className="incident-headline">{incident.title}</h2>
                </div>
                <div className="badges-group">
                  <span className={`badge-pill badge-${incident.priority}`}>
                    {incident.priority.toUpperCase()} PRIORITY
                  </span>
                </div>
              </div>

              <p className="incident-full-desc">{incident.description}</p>

              {/* Photo Evidence if uploaded */}
              {(incident.photoUrl || detail?.reports?.find((r) => r.photoUrl)?.photoUrl) && (
                <div className="incident-photo-wrapper">
                  <span className="photo-section-label">Citizen Photo Evidence</span>
                  <div
                    className="photo-thumb-container"
                    onClick={() =>
                      setLightboxImg(
                        formatMediaUrl(incident.photoUrl || detail?.reports?.find((r) => r.photoUrl)?.photoUrl)
                      )
                    }
                  >
                    <img
                      src={formatMediaUrl(incident.photoUrl || detail?.reports?.find((r) => r.photoUrl)?.photoUrl)}
                      alt="Civic issue evidence"
                    />
                    <div className="zoom-hint">
                      <Eye size={16} />
                      <span>Click to enlarge photo</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="metadata-specs-grid">
                <div className="spec-card">
                  <span className="spec-label">Municipal Ward</span>
                  <strong className="spec-val">
                    {incident.wardName} {incident.wardNumber ? `(Ward ${incident.wardNumber})` : ""}
                  </strong>
                </div>

                <div className="spec-card">
                  <span className="spec-label">Zone</span>
                  <strong className="spec-val">{incident.zone || "Jaipur Nagar Nigam"}</strong>
                </div>

                <div className="spec-card">
                  <span className="spec-label">Citizen Endorsements</span>
                  <strong className="spec-val text-red">
                    {incident.reportCount} Verified Reports
                  </strong>
                </div>

                <div className="spec-card">
                  <span className="spec-label">Location Point</span>
                  <strong className="spec-val">
                    {incident.location?.coordinates?.[1]?.toFixed(5)}, {incident.location?.coordinates?.[0]?.toFixed(5)}
                  </strong>
                </div>
              </div>

              {/* Assigned Officer Section */}
              <div className="assigned-officer-box">
                <div className="officer-box-header">
                  <UserCheck size={18} className="text-emerald" />
                  <h4>Responsible Ward Officer</h4>
                </div>
                {incident.assignedOfficer ? (
                  <div className="officer-profile-row">
                    <div className="officer-avatar">
                      <User size={20} />
                    </div>
                    <div className="officer-info">
                      <strong>{incident.assignedOfficer.name}</strong>
                      <span>
                        {incident.assignedOfficer.role?.replace("_", " ")} · {incident.assignedOfficer.organisation}
                      </span>
                      <small className="officer-contact">
                        Phone: {incident.assignedOfficer.phone} | Email: {incident.assignedOfficer.email}
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="officer-unassigned-note">
                    <Clock size={16} />
                    <span>Triage pending in Municipal Operations Queue</span>
                  </div>
                )}
              </div>

              {/* Community Confirmation Action */}
              <div className="community-confirm-box">
                <div className="confirm-text">
                  <strong>Are you at this location?</strong>
                  <p>Confirming this issue still exists alerts ward supervisors and boosts ticket priority.</p>
                </div>
                <button
                  type="button"
                  className="confirm-button"
                  disabled={confirming}
                  onClick={handleConfirm}
                >
                  <ThumbsUp size={16} />
                  <span>{confirming ? "Recording..." : "Confirm Issue Still Exists"}</span>
                </button>
              </div>

              {confirmSuccess && (
                <div className="confirm-toast-success">
                  <CheckCircle2 size={18} />
                  <span>Thank you! Your civic confirmation has been registered and urgency updated.</span>
                </div>
              )}

              {confirmError && (
                <div className="confirm-toast-error">
                  <AlertCircle size={18} />
                  <span>{confirmError}</span>
                </div>
              )}
            </div>

            {/* Right Card: Full Event Timeline */}
            <div className="ticket-timeline-card">
              <div className="timeline-header">
                <Clock size={20} />
                <h3>Event & Resolution Timeline</h3>
              </div>

              <div className="timeline-flow-list">
                {(detail.timeline || []).map((event, index) => {
                  let eventIcon = <CheckCircle2 size={16} />;
                  let eventColor = "default";

                  if (event.type === "incident_created") {
                    eventColor = "created";
                  } else if (event.type === "citizen_confirmation") {
                    eventIcon = <ThumbsUp size={14} />;
                    eventColor = "confirmation";
                  } else if (event.type === "status_update") {
                    eventColor = "status";
                  }

                  return (
                    <div key={`${event.type}-${event.createdAt}-${index}`} className={`timeline-entry ${eventColor}`}>
                      <div className="timeline-marker">{eventIcon}</div>
                      <div className="timeline-entry-content">
                        <div className="entry-head">
                          <strong>{event.label}</strong>
                          <span className="entry-time">
                            {new Date(event.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                            , {new Date(event.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {event.note && (
                          <div className="entry-note-box">
                            <MessageSquare size={14} />
                            <span>{event.note}</span>
                          </div>
                        )}

                        {event.proofPhotoUrl && (
                          <div
                            className="entry-proof-photo"
                            onClick={() => setLightboxImg(formatMediaUrl(event.proofPhotoUrl))}
                          >
                            <img src={formatMediaUrl(event.proofPhotoUrl)} alt="Resolution Proof" />
                            <span>Resolution Proof Photo</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : searchedId ? (
        <div className="empty-tracking-state ticket-not-found-state">
          <AlertCircle size={48} className="empty-ticket-icon text-danger" />
          <h3>No Ticket Record Found for "{searchedId}"</h3>
          <p>
            Please check the ticket reference code. Jaipur civic tickets follow the format <strong>KR-YYYY-XXXX</strong> (e.g., KR-2026-0001).
          </p>
        </div>
      ) : (
        <div className="empty-tracking-state">
          <Ticket size={48} className="empty-ticket-icon" />
          <h3>Enter a Ticket ID to View Full Timeline</h3>
          <p>
            Citizens receive a ticket reference immediately upon report submission. Use the search bar above to
            track progress, view assigned officers, and confirm resolution.
          </p>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div className="image-lightbox-modal" onClick={() => setLightboxImg(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImg} alt="Evidence full view" />
            <button className="lightbox-close" onClick={() => setLightboxImg(null)}>
              &times;
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
