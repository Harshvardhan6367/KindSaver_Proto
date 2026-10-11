import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Megaphone,
  Send,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { LocationPicker } from "./LocationPicker.jsx";
import { PhotoUpload } from "./PhotoUpload.jsx";
import { issueTypes } from "../api.js";

export function ReportScreen({ form, setForm, onSubmit, lastReport, onTrackTicket }) {
  const [detectedWard, setDetectedWard] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="report-screen-layout">
      {/* Full-Width Civic Banner */}
      <div className="report-header-banner">
        <div className="heading-icon">
          <Megaphone size={26} />
        </div>
        <div className="heading-content">
          <div className="heading-badge-row">
            <span className="civic-live-pill">
              <span className="live-dot" />
              Jaipur Nagar Nigam Operations
            </span>
            <span className="civic-meta-pill">Instant Ward Routing</span>
            <span className="civic-meta-pill">Smart Duplicate Merging</span>
          </div>
          <h2>Report Civic Waste in Jaipur</h2>
          <p>
            Pinpoint field evidence with real-time GPS precision. Duplicate reports automatically cluster
            to elevate urgency and accelerate municipal dispatch.
          </p>
        </div>
      </div>

      {lastReport && (
        <div className="submission-success-banner">
          <CheckCircle2 size={24} className="success-icon" />
          <div className="success-content">
            <strong>Report Successfully Registered!</strong>
            <span>
              Ticket: <strong>{lastReport.incident.ticketId}</strong> (
              {lastReport.merged
                ? "Merged with nearby active incident to elevate urgency"
                : "New incident opened and routed to ward"}
              )
            </span>
          </div>
          <button
            type="button"
            className="track-submitted-btn"
            onClick={() => onTrackTicket(lastReport.incident.ticketId)}
          >
            <span>Track Ticket</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Full-Width Desktop Workspace Grid */}
      <form onSubmit={handleSubmit} className="report-desktop-grid">
        {/* LEFT COLUMN: Map & Geographic Pinpoint Studio */}
        <div className="report-grid-left">
          <div className="report-card map-studio-card">
            <div className="card-header-bar">
              <div className="card-title-group">
                <span className="card-step-badge">1</span>
                <div>
                  <h3 className="card-title-text">Incident Location</h3>
                  <span className="card-subtitle-text">
                    Drag the pin or click anywhere on the 3D / Satellite map to pinpoint the exact waste spot
                  </span>
                </div>
              </div>
            </div>

            <LocationPicker
              lat={form.lat}
              lng={form.lng}
              gpsAccuracyMeters={form.gpsAccuracyMeters}
              onChange={({ lat, lng, gpsAccuracyMeters }) => {
                setForm((prev) => ({
                  ...prev,
                  lat,
                  lng,
                  gpsAccuracyMeters
                }));
              }}
              onWardDetected={(ward) => setDetectedWard(ward)}
            />

            <div className="picker-geo-hints-grid">
              <div className="geo-hint-item">
                <span className="geo-hint-badge">3D & Satellite</span>
                <p>Toggle 3D view to see building geometry or Satellite view to identify real street corners.</p>
              </div>
              <div className="geo-hint-item">
                <span className="geo-hint-badge">Auto Ward Routing</span>
                <p>Pins within Jaipur automatically match the local ward and sanitary inspector for fast dispatch.</p>
              </div>
              <div className="geo-hint-item">
                <span className="geo-hint-badge">Duplicate Merge</span>
                <p>Reports in the same proximity automatically consolidate to escalate municipal cleanup urgency.</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Classification, Evidence & Description */}
        <div className="report-grid-right">
          {/* Issue Classification */}
          <div className="report-card">
            <div className="card-header-bar">
              <div className="card-title-group">
                <span className="card-step-badge">2</span>
                <div>
                  <h3 className="card-title-text">Select Issue Type</h3>
                  <span className="card-subtitle-text">Choose the classification of municipal waste</span>
                </div>
              </div>
              <span className="required-star">*Required</span>
            </div>

            <div className="category-chips-grid">
              {issueTypes.map((type) => {
                const isSelected = form.issueType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    className={`category-chip ${isSelected ? "selected" : ""}`}
                    onClick={() => setForm({ ...form, issueType: type.value })}
                  >
                    <span className="chip-indicator" style={{ backgroundColor: type.color }} />
                    <span className="chip-name">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Evidence */}
          <div className="report-card">
            <div className="card-header-bar">
              <div className="card-title-group">
                <span className="card-step-badge">3</span>
                <div>
                  <h3 className="card-title-text">Photo Evidence</h3>
                  <span className="card-subtitle-text">Attach field photo to help sanitation workers verify the spot</span>
                </div>
              </div>
            </div>
            <PhotoUpload
              value={form.photoUrl}
              onChange={(url) => setForm((prev) => ({ ...prev, photoUrl: url }))}
              label="Photo Evidence"
              hint="Attach a photo to help sanitation workers locate and verify the waste pile"
            />
          </div>

          {/* Description & Landmark */}
          <div className="report-card">
            <div className="card-header-bar">
              <div className="card-title-group">
                <span className="card-step-badge">4</span>
                <div>
                  <h3 className="card-title-text">Description & Landmark Details</h3>
                  <span className="card-subtitle-text">Nearby road, landmark, shop, or gate instructions</span>
                </div>
              </div>
              <span className="char-count">{(form.description || "").length}/1000</span>
            </div>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="e.g. Near corner of Malviya Nagar Sector 3 market, overflowing container spilling into road..."
              value={form.description}
              maxLength={1000}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Action Row */}
          <div className="report-submit-card">
            <div className="submit-assurance">
              <ShieldCheck size={22} className="text-emerald" />
              <div>
                <strong>Direct Nagar Nigam Routing</strong>
                <p>Instant Ticket ID generated · Field officer dispatched to assigned ward</p>
              </div>
            </div>
            <button
              type="submit"
              className="submit-report-button"
              disabled={submitting || !form.lat || !form.lng || !form.issueType}
            >
              <Send size={18} />
              <span>{submitting ? "Submitting Report..." : "Submit Waste Report"}</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
