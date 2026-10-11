import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Award,
  Building,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Filter,
  Flame,
  HelpCircle,
  MapPin,
  Megaphone,
  Phone,
  PlusCircle,
  Search,
  Shield,
  Sparkles,
  Ticket,
  Trash2,
  Users
} from "lucide-react";
import { departments, formatMediaUrl, issueTypes } from "../api.js";

export function PublicLanding({
  stats,
  incidents = [],
  onReport,
  onOpenMap,
  onTrackTicket,
  onOpenAuth,
  currentUser,
  lang = "en",
  t = {}
}) {
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredIncidents = incidents.filter((inc) => {
    if (filterType !== "all" && inc.issueType !== filterType) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inc.ticketId?.toLowerCase().includes(q) ||
      inc.title?.toLowerCase().includes(q) ||
      inc.wardName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="public-landing-container">
      {/* 1. Hero Section */}
      <section className="landing-hero-section">
        <div className="landing-hero-backdrop">
          <div className="hero-pill-badge">
            <Sparkles size={16} />
            <span>{t.heroTitle || "Clean Jaipur Civic Initiative"}</span>
          </div>

          <h1 className="hero-headline">
            {lang === "hi"
              ? "जयपुर को स्वच्छ और सुंदर बनाएं — कचरे की शिकायत 30 सेकंड में दर्ज करें"
              : "Keep Jaipur Clean & Beautiful — Report Civic Waste in 30 Seconds"}
          </h1>

          <p className="hero-subtext">
            {t.heroSubtitle ||
              "Report garbage black spots, overflowing bins, and blocked drains with GPS evidence. Attributed to Jaipur municipal wards, tracked publicly until verified cleanup."}
          </p>

          <div className="hero-cta-group">
            <button type="button" className="cta-btn primary-cta" onClick={onReport}>
              <PlusCircle size={20} />
              <span>{t.reportCta || "Report Waste Now"}</span>
            </button>
            <button type="button" className="cta-btn secondary-cta" onClick={onOpenMap}>
              <Compass size={20} />
              <span>{t.exploreMapCta || "Explore Live Map"}</span>
            </button>
          </div>
        </div>

        {/* 2. Real-time Database Statistics Cards */}
        <div className="landing-stats-grid">
          <div className="landing-stat-card">
            <div className="stat-icon-wrapper reports-icon">
              <Megaphone size={24} />
            </div>
            <div className="stat-info">
              <strong className="stat-value">{stats?.totals?.reports || incidents.length}</strong>
              <span className="stat-label">{t.statTotalReports || "Civic Complaints"}</span>
            </div>
          </div>

          <div className="landing-stat-card">
            <div className="stat-icon-wrapper active-icon">
              <Flame size={24} />
            </div>
            <div className="stat-info">
              <strong className="stat-value">{stats?.totals?.activeIncidents || 0}</strong>
              <span className="stat-label">{t.statActiveSpots || "Active Hotspots"}</span>
            </div>
          </div>

          <div className="landing-stat-card">
            <div className="stat-icon-wrapper resolved-icon">
              <CheckCircle2 size={24} />
            </div>
            <div className="stat-info">
              <strong className="stat-value">{stats?.totals?.resolvedIncidents || 0}</strong>
              <span className="stat-label">{t.statResolved || "Cleanups Verified"}</span>
            </div>
          </div>

          <div className="landing-stat-card">
            <div className="stat-icon-wrapper wards-icon">
              <Building size={24} />
            </div>
            <div className="stat-info">
              <strong className="stat-value">{stats?.wardHotspots?.length || (incidents.length > 0 ? 1 : 0)}</strong>
              <span className="stat-label">{t.statWardsCovered || "Jaipur Wards Active"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. How Civic Reporting Works (3-step flow) */}
      <section className="how-it-works-section">
        <div className="section-header-center">
          <span className="section-eyebrow">{lang === "hi" ? "पारदर्शी प्रक्रिया" : "Transparent Process"}</span>
          <h2>{t.howItWorks || "How Civic Reporting Works"}</h2>
          <p>
            {lang === "hi"
              ? "जयपुर नगर निगम और नागरिकों के बीच त्वरित और पारदर्शी समन्वय"
              : "Fast, accountable collaboration between Jaipur residents and municipal sanitation teams."}
          </p>
        </div>

        <div className="steps-cards-grid">
          <div className="step-card">
            <div className="step-number-badge">1</div>
            <div className="step-icon">
              <MapPin size={28} />
            </div>
            <h3>{t.step1Title || "1. Capture & Geotag"}</h3>
            <p>{t.step1Desc || "Take a photo of the waste spot. GPS coordinates stamp the exact Jaipur location."}</p>
          </div>

          <div className="step-card">
            <div className="step-number-badge">2</div>
            <div className="step-icon">
              <Building size={28} />
            </div>
            <h3>{t.step2Title || "2. Automatic Ward Routing"}</h3>
            <p>{t.step2Desc || "Our geospatial engine identifies your municipal ward and forwards to the right department."}</p>
          </div>

          <div className="step-card">
            <div className="step-number-badge">3</div>
            <div className="step-icon">
              <CheckCircle2 size={28} />
            </div>
            <h3>{t.step3Title || "3. Tracked Until Cleared"}</h3>
            <p>{t.step3Desc || "Municipal officers resolve the dump and upload before/after cleanup photo verification."}</p>
          </div>
        </div>
      </section>

      {/* 4. Live Public Issues Feed & Search */}
      <section className="public-feed-section">
        <div className="feed-header-row">
          <div>
            <h2>{lang === "hi" ? "हाल की कचरा शिकायतें" : "Recent Public Civic Reports"}</h2>
            <p>{lang === "hi" ? "जयपुर के विभिन्न वार्डों में दर्ज वास्तविक शिकायतें" : "Live civic complaints submitted across Jaipur wards"}</p>
          </div>

          <div className="feed-controls">
            <div className="feed-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder={lang === "hi" ? "टिकट आईडी या वार्ड खोजें..." : "Search ticket or ward..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="feed-filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">{lang === "hi" ? "सभी प्रकार" : "All Categories"}</option>
              {issueTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="public-cards-grid">
          {filteredIncidents.length === 0 ? (
            <div className="empty-public-feed-box">
              <CheckCircle2 size={36} className="text-emerald" />
              <h4>{lang === "hi" ? "कोई सक्रिय शिकायत दर्ज नहीं है" : "No Civic Complaints Found"}</h4>
              <p>
                {lang === "hi"
                  ? "वर्तमान में कोई समस्या दर्ज नहीं है। जयपुर को स्वच्छ रखने हेतु कचरे का स्थान रिपोर्ट करें।"
                  : "No civic reports filed yet in this view. Be the first to report an overflowing bin or waste spot in your ward!"}
              </p>
              <button type="button" className="btn-file-new-report" onClick={onReport}>
                <PlusCircle size={16} />
                <span>{t.reportCta || "Report Waste Spot"}</span>
              </button>
            </div>
          ) : (
            filteredIncidents.slice(0, 6).map((incident) => {
              const isResolved = ["resolved", "closed"].includes(incident.status);
              return (
                <div key={incident.id} className="public-issue-card">
                  <div className="issue-card-top">
                    <span className={`issue-type-badge type-${incident.issueType}`}>
                      {incident.issueType.replace(/_/g, " ")}
                    </span>
                    <span className={`issue-status-badge status-${incident.status}`}>
                      {incident.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <h4 className="issue-card-title">{incident.title}</h4>
                  <p className="issue-card-desc">{incident.description}</p>

                  <div className="issue-card-meta">
                    <div className="meta-item">
                      <MapPin size={14} />
                      <span>{incident.wardName || `Ward ${incident.wardNumber}`}</span>
                    </div>
                    <div className="meta-item">
                      <Building size={14} />
                      <span>{incident.department || "Solid Waste Management"}</span>
                    </div>
                  </div>

                  <div className="issue-card-footer">
                    <span className="issue-ticket-tag">{incident.ticketId}</span>
                    <button
                      type="button"
                      className="view-ticket-btn"
                      onClick={() => onTrackTicket(incident.ticketId)}
                    >
                      <span>{lang === "hi" ? "ट्रैक करें" : "Track Ticket"}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="view-more-container">
          <button type="button" className="view-all-map-btn" onClick={onOpenMap}>
            <span>{lang === "hi" ? "सभी शिकायतें मैप पर देखें" : "View All Reports on Jaipur Map"}</span>
            <Compass size={18} />
          </button>
        </div>
      </section>

      {/* 5. Municipal Directory & Accountability Info */}
      <section className="municipal-accountability-section">
        <div className="section-header-center">
          <span className="section-eyebrow">{lang === "hi" ? "नगर निगम व्यवस्था" : "Municipal Jurisdiction"}</span>
          <h2>{lang === "hi" ? "जयपुर नगर निगम संरचना" : "Jaipur Municipal Responsibilities"}</h2>
          <p>
            {lang === "hi"
              ? "जयपुर में स्वच्छता व्यवस्था दो प्रमुख नगर निगमों एवं 6 विशेष विभागों द्वारा संचालित होती है"
              : "Sanitation operations are managed across Jaipur Nagar Nigam Greater & Heritage departments"}
          </p>
        </div>

        <div className="dept-directory-grid">
          {departments.map((dept) => (
            <div key={dept.value} className="dept-directory-card">
              <div className="dept-icon-circle">
                <Building size={20} />
              </div>
              <div className="dept-text">
                <h4>{dept.label}</h4>
                <p>{dept.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="public-civic-footer">
        <div className="footer-columns-grid">
          <div className="footer-col brand-col">
            <div className="footer-brand">
              <span className="footer-logo">KS</span>
              <div>
                <strong>KindSaver Jaipur</strong>
                <p>{t.municipalBody || "Jaipur Nagar Nigam (Greater & Heritage)"}</p>
              </div>
            </div>
            <p className="footer-desc">
              {t.footerAboutText ||
                  "A community-powered platform for reporting civic waste and monitoring municipal cleanup across Jaipur Nagar Nigam Greater and Heritage."}
            </p>
          </div>

          <div className="footer-col">
            <h4>{t.footerHelplines || "Municipal Helplines"}</h4>
            <ul className="footer-links">
              <li>
                <Phone size={14} />
                <span>Jaipur Nagar Nigam Control: 0141-2742823</span>
              </li>
              <li>
                <Phone size={14} />
                <span>Swachh Bharat Helpline: 1969</span>
              </li>
              <li>
                <Phone size={14} />
                <span>Rajasthan Sampark Portal: 181</span>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>{lang === "hi" ? "त्वरित लिंक" : "Quick Links"}</h4>
            <ul className="footer-links">
              <li>
                <button type="button" className="footer-link-btn" onClick={onReport}>
                  {t.navReport || "Report Waste"}
                </button>
              </li>
              <li>
                <button type="button" className="footer-link-btn" onClick={onOpenMap}>
                  {t.navMap || "Live Map"}
                </button>
              </li>
              <li>
                <button type="button" className="footer-link-btn" onClick={onOpenAuth}>
                  {t.signIn || "Sign In"}
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-row">
          <p>© 2026 KindSaver Jaipur. Civic Open-Data Initiative for Pink City Cleanliness.</p>
          <div className="footer-legal-links">
            <a href="#privacy" onClick={(e) => { e.preventDefault(); alert("Privacy Policy: KindSaver does not sell or distribute personal data. Citizen GPS coordinates are used exclusively for municipal cleanup routing."); }}>
              {t.footerPrivacy || "Privacy Policy"}
            </a>
            <a href="#terms" onClick={(e) => { e.preventDefault(); alert("Terms of Service: Reports submitted must be authentic civic issues in Jaipur. Misuse or fake reports may result in account restriction."); }}>
              {t.footerTerms || "Terms of Service"}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
