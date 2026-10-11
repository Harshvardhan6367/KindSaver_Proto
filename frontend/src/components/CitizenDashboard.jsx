import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Award,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  HelpCircle,
  LogOut,
  MapPin,
  Megaphone,
  Phone,
  PlusCircle,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  UserCheck
} from "lucide-react";
import { apiGetCitizenReports, apiUpdateProfile, formatMediaUrl } from "../api.js";

export function CitizenDashboard({
  currentUser,
  onReport,
  onTrackTicket,
  onOpenMap,
  onOpenAuth,
  onLogout,
  onUpdateUser,
  lang = "en",
  t = {}
}) {
  const [activeTab, setActiveTab] = useState("overview"); // "overview", "reports", "profile", "help"
  const [myReports, setMyReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || "",
    phone: currentUser?.phone || "",
    wardNumber: currentUser?.wardNumber || "38"
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");

  const isGuest = !currentUser || currentUser.role !== "citizen";

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name || "",
        phone: currentUser.phone || "",
        wardNumber: currentUser.wardNumber || "38"
      });
      loadMyReports();
    }
  }, [currentUser]);

  async function loadMyReports() {
    setLoadingReports(true);
    try {
      const res = await apiGetCitizenReports();
      setMyReports(res.incidents || []);
    } catch (err) {
      console.warn("Could not load citizen reports:", err);
    } finally {
      setLoadingReports(false);
    }
  }

  async function handleSaveProfile(e) {
    if (e) e.preventDefault();
    setProfileSaving(true);
    setProfileNotice("");
    try {
      const res = await apiUpdateProfile(profileForm);
      if (res?.user && onUpdateUser) {
        onUpdateUser(res.user);
      }
      setProfileNotice("Profile updated successfully!");
    } catch (err) {
      setProfileNotice(err.message || "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  const resolvedCount = myReports.filter((inc) => ["resolved", "closed"].includes(inc.status)).length;
  const activeCount = myReports.filter((inc) => !["resolved", "closed"].includes(inc.status)).length;
  const karmaPoints = myReports.length * 50 + resolvedCount * 100;

  if (isGuest) {
    return (
      <div className="citizen-guest-screen">
        <div className="guest-card-container">
          <div className="guest-icon-badge">
            <User size={32} />
          </div>
          <h2>{lang === "hi" ? "नागरिक डैशबोर्ड में प्रवेश करें" : "Sign In to Your Citizen Dashboard"}</h2>
          <p>
            {lang === "hi"
              ? "अपनी दर्ज कचरा शिकायतों को ट्रैक करने, सफाई प्रमाण देखने और स्वच्छ जयपुर बैज प्राप्त करने के लिए साइन इन करें।"
              : "Sign in or create a citizen account to track your submitted reports, monitor cleanup verification photos, and earn Clean Jaipur Civic Badges."}
          </p>
          <div className="guest-btn-actions">
            <button type="button" className="cta-btn primary-cta" onClick={onOpenAuth}>
              <User size={18} />
              <span>{t.signIn || "Sign In or Register"}</span>
            </button>
            <button type="button" className="cta-btn secondary-cta" onClick={onReport}>
              <PlusCircle size={18} />
              <span>{lang === "hi" ? "अतिथि के रूप में रिपोर्ट करें" : "Report as Guest (<30s)"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="citizen-portal-layout">
      {/* Top Welcome Bar */}
      <div className="citizen-portal-header">
        <div className="header-user-welcome">
          <h2>{lang === "hi" ? `नमस्ते, ${currentUser.name}` : `Welcome back, ${currentUser.name}`}</h2>
          <p>
            {lang === "hi"
              ? `वार्ड ${currentUser.wardNumber || "38"} (जयपुर नगर निगम) • नागरिक स्वच्छता भागीदारी`
              : `Ward ${currentUser.wardNumber || "38"} Resident (Jaipur Municipal Corporation)`}
          </p>
        </div>

        <div className="header-subnav-pills">
          <button
            type="button"
            className={`subnav-pill ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <span>{lang === "hi" ? "अवलोकन" : "Overview"}</span>
          </button>
          <button
            type="button"
            className={`subnav-pill ${activeTab === "reports" ? "active" : ""}`}
            onClick={() => { setActiveTab("reports"); loadMyReports(); }}
          >
            <span>{lang === "hi" ? `मेरी शिकायतें (${myReports.length})` : `My Reports (${myReports.length})`}</span>
          </button>
          <button
            type="button"
            className={`subnav-pill ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <span>{lang === "hi" ? "प्रोफ़ाइल" : "Profile & Settings"}</span>
          </button>
          <button
            type="button"
            className={`subnav-pill ${activeTab === "help" ? "active" : ""}`}
            onClick={() => setActiveTab("help")}
          >
            <span>{lang === "hi" ? "सहायता" : "Help & Support"}</span>
          </button>
        </div>
      </div>

      {/* SUBVIEW: Overview */}
      {activeTab === "overview" && (
        <div className="citizen-overview-tab">
          {/* Metrics Row */}
          <div className="citizen-stats-row">
            <div className="resident-stat-card">
              <div className="stat-icon-bubble bubble-reports">
                <Megaphone size={22} />
              </div>
              <div>
                <strong className="resident-stat-val">{myReports.length}</strong>
                <span className="resident-stat-lbl">{lang === "hi" ? "दर्ज शिकायतें" : "Your Reports Filed"}</span>
              </div>
            </div>

            <div className="resident-stat-card">
              <div className="stat-icon-bubble bubble-active">
                <Clock size={22} />
              </div>
              <div>
                <strong className="resident-stat-val text-amber">{activeCount}</strong>
                <span className="resident-stat-lbl">{lang === "hi" ? "प्रगति पर" : "In Progress / Active"}</span>
              </div>
            </div>

            <div className="resident-stat-card">
              <div className="stat-icon-bubble bubble-resolved">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <strong className="resident-stat-val text-emerald">{resolvedCount}</strong>
                <span className="resident-stat-lbl">{lang === "hi" ? "निस्तारित" : "Cleanups Resolved"}</span>
              </div>
            </div>

            <div className="resident-stat-card">
              <div className="stat-icon-bubble bubble-points">
                <Award size={22} />
              </div>
              <div>
                <strong className="resident-stat-val text-purple">{karmaPoints}</strong>
                <span className="resident-stat-lbl">{lang === "hi" ? "नागरिक कर्मा अंक" : "Civic Karma Points"}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Badges */}
          <div className="citizen-two-col-grid">
            {/* Clean Jaipur Badges Card */}
            <div className="clean-badges-card">
              <div className="card-heading-row">
                <Award size={20} className="text-amber" />
                <h3>{lang === "hi" ? "स्वच्छ जयपुर नागरिक बैज" : "Clean Jaipur Civic Badges"}</h3>
              </div>
              <p className="card-subtext">
                {lang === "hi"
                  ? "कचरा स्थलों की रिपोर्टिंग और सत्यापन द्वारा अर्जित नागरिक सम्मान"
                  : "Earned by actively reporting waste heaps and verifying municipal cleanups."}
              </p>

              <div className="badges-list">
                <div className={`badge-item ${myReports.length >= 1 ? "earned" : "locked"}`}>
                  <div className="badge-icon-coin">🌟</div>
                  <div className="badge-details">
                    <strong>{lang === "hi" ? "जागरूक नागरिक (Swachh Citizen)" : "Swachh Citizen"}</strong>
                    <span>{lang === "hi" ? "पहली शिकायत दर्ज करने पर" : "Submitted 1st civic report"}</span>
                  </div>
                </div>

                <div className={`badge-item ${myReports.length >= 3 ? "earned" : "locked"}`}>
                  <div className="badge-icon-coin">🛡️</div>
                  <div className="badge-details">
                    <strong>{lang === "hi" ? "वार्ड रक्षक (Ward Guardian)" : "Ward Guardian"}</strong>
                    <span>{lang === "hi" ? "3 या अधिक कचरा स्थल रिपोर्ट किए" : "Reported 3+ waste spots"}</span>
                  </div>
                </div>

                <div className={`badge-item ${resolvedCount >= 1 ? "earned" : "locked"}`}>
                  <div className="badge-icon-coin">🏆</div>
                  <div className="badge-details">
                    <strong>{lang === "hi" ? "स्वच्छता चैंपियन (Civic Champion)" : "Civic Champion"}</strong>
                    <span>{lang === "hi" ? "कम से कम 1 सफल निस्तारण सत्यापित" : "Verified 1+ municipal cleanups"}</span>
                  </div>
                </div>
              </div>

              <div className="badge-cta-row">
                <button type="button" className="hero-cta-primary" onClick={onReport}>
                  <PlusCircle size={16} />
                  <span>{t.reportCta || "Report Waste"}</span>
                </button>
              </div>
            </div>

            {/* Recent Activity summary */}
            <div className="recent-activity-card">
              <div className="card-heading-row">
                <Clock size={20} className="text-blue" />
                <h3>{lang === "hi" ? "हाल की शिकायतें" : "Recent Reports"}</h3>
              </div>
              <p className="card-subtext">
                {lang === "hi" ? "आपकी हाल ही में दर्ज शिकायतों की स्थिति" : "Latest updates on your submitted tickets."}
              </p>

              {myReports.length === 0 ? (
                <div className="empty-reports-box">
                  <Megaphone size={28} />
                  <p>{t.noReportsYet || "You haven't submitted any civic reports yet."}</p>
                  <button type="button" className="btn-file-new-report" onClick={onReport}>
                    {t.reportCta || "Report Waste Now"}
                  </button>
                </div>
              ) : (
                <div className="mini-tickets-list">
                  {myReports.slice(0, 4).map((ticket) => (
                    <div key={ticket.id} className="mini-ticket-row">
                      <div className="mini-ticket-left">
                        <span className={`issue-status-badge status-${ticket.status}`}>
                          {ticket.status.replace(/_/g, " ")}
                        </span>
                        <div>
                          <strong>{ticket.ticketId}</strong>
                          <span className="mini-ticket-loc">{ticket.wardName || `Ward ${ticket.wardNumber}`}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="track-arrow-btn"
                        onClick={() => onTrackTicket(ticket.ticketId)}
                        title="Track ticket"
                      >
                        <ExternalLink size={15} />
                      </button>
                    </div>
                  ))}
                  {myReports.length > 4 && (
                    <button
                      type="button"
                      className="view-all-link-btn"
                      onClick={() => setActiveTab("reports")}
                    >
                      <span>{lang === "hi" ? "सभी शिकायतें देखें" : "View All Reports"} →</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW: My Reports Full Table */}
      {activeTab === "reports" && (
        <div className="citizen-reports-tab">
          <div className="reports-tab-header">
            <div>
              <h3>{lang === "hi" ? "मेरी दर्ज शिकायतें" : "My Submitted Civic Reports"}</h3>
              <p>{lang === "hi" ? "आपकी शिकायतों की वर्तमान स्थिति एवं विभाग आवंटन" : "Track real-time status and assigned municipal departments."}</p>
            </div>
            <button type="button" className="btn-file-new-report" onClick={onReport}>
              <PlusCircle size={16} />
              <span>{lang === "hi" ? "नई शिकायत दर्ज करें" : "File New Report"}</span>
            </button>
          </div>

          {loadingReports ? (
            <div className="loading-state-box">
              <Clock size={24} className="animate-spin" />
              <p>Loading your reports...</p>
            </div>
          ) : myReports.length === 0 ? (
            <div className="empty-reports-box">
              <Megaphone size={36} />
              <p>{t.noReportsYet || "You haven't submitted any civic reports yet."}</p>
              <button type="button" className="btn-file-new-report" onClick={onReport}>
                {t.reportCta || "Report Waste Spot"}
              </button>
            </div>
          ) : (
            <div className="citizen-tickets-table-container">
              <table className="citizen-tickets-table">
                <thead>
                  <tr>
                    <th>{lang === "hi" ? "टिकट आईडी" : "Ticket ID"}</th>
                    <th>{lang === "hi" ? "विवरण / स्थल" : "Description / Location"}</th>
                    <th>{lang === "hi" ? "प्रकार" : "Type"}</th>
                    <th>{lang === "hi" ? "आवंटित विभाग" : "Department"}</th>
                    <th>{lang === "hi" ? "स्थिति" : "Status"}</th>
                    <th>{lang === "hi" ? "कार्रवाई" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {myReports.map((report) => (
                    <tr key={report.id} className="citizen-report-row">
                      <td data-label={lang === "hi" ? "टिकट आईडी" : "Ticket ID"}>
                        <strong className="ticket-id-strong">{report.ticketId}</strong>
                      </td>
                      <td data-label={lang === "hi" ? "विवरण / स्थल" : "Description / Location"}>
                        <div className="ticket-title-cell">
                          <span>{report.title || report.description}</span>
                          <span className="cell-ward-tag">{report.wardName || `Ward ${report.wardNumber}`}</span>
                        </div>
                      </td>
                      <td data-label={lang === "hi" ? "प्रकार" : "Type"}>
                        <span className={`issue-type-badge type-${report.issueType}`}>
                          {report.issueType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td data-label={lang === "hi" ? "आवंटित विभाग" : "Department"}>
                        <span className="dept-cell-tag">{report.department || "Solid Waste Management"}</span>
                      </td>
                      <td data-label={lang === "hi" ? "स्थिति" : "Status"}>
                        <span className={`issue-status-badge status-${report.status}`}>
                          {report.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td data-label={lang === "hi" ? "कार्रवाई" : "Action"}>
                        <button
                          type="button"
                          className="table-track-btn"
                          onClick={() => onTrackTicket(report.ticketId)}
                        >
                          <Ticket size={14} />
                          <span>{lang === "hi" ? "ट्रैक करें" : "Track"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW: Profile & Settings */}
      {activeTab === "profile" && (
        <div className="citizen-profile-tab">
          <div className="profile-card-container">
            <h3>{lang === "hi" ? "नागरिक प्रोफ़ाइल एवं सेटिंग्स" : "Resident Profile & Settings"}</h3>
            <p>{lang === "hi" ? "अपनी व्यक्तिगत जानकारी एवं गृह वार्ड अद्यतन करें" : "Manage your resident contact information and home ward."}</p>

            {profileNotice && (
              <div className="profile-notice-box">
                <CheckCircle2 size={16} />
                <span>{profileNotice}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="profile-edit-form">
              <div className="form-group">
                <label>{lang === "hi" ? "पूरा नाम" : "Full Name"}</label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>{lang === "hi" ? "ईमेल पता (अपरिवर्तनीय)" : "Email Address (Read-only)"}</label>
                <input type="email" disabled value={currentUser.email} />
              </div>

              <div className="form-group">
                <label>{lang === "hi" ? "मोबाइल नंबर" : "Phone Number"}</label>
                <input
                  type="tel"
                  placeholder="+91-98290-00000"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>{lang === "hi" ? "गृह वार्ड नंबर (जयपुर नगर निगम)" : "Home Ward Number"}</label>
                <input
                  type="number"
                  min="1"
                  max="250"
                  value={profileForm.wardNumber}
                  onChange={(e) => setProfileForm({ ...profileForm, wardNumber: e.target.value })}
                />
              </div>

              <div className="form-actions-row">
                <button type="submit" className="hero-cta-primary" disabled={profileSaving}>
                  <Save size={16} />
                  <span>{profileSaving ? "Saving..." : (lang === "hi" ? "सुरक्षित करें" : "Save Changes")}</span>
                </button>
                <button type="button" className="btn-logout-danger" onClick={onLogout}>
                  <LogOut size={16} />
                  <span>{t.signOut || "Sign Out"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBVIEW: Help & Support */}
      {activeTab === "help" && (
        <div className="citizen-help-tab">
          <div className="help-card-container">
            <h3>{lang === "hi" ? "नागरिक सहायता एवं सामान्य प्रश्न" : "Civic Help & Municipal Support"}</h3>
            <div className="faq-list">
              <div className="faq-item">
                <h4>{lang === "hi" ? "कचरा शिकायत का निस्तारण कितने समय में होता है?" : "How long does waste clearance take?"}</h4>
                <p>
                  {lang === "hi"
                    ? "ठोस अपशिष्ट (SWM) कचरा ढेर 4 से 8 घंटे के भीतर, चोक नाले 2 से 6 घंटे में और मृत पशु 2 घंटे के भीतर हटाए जाते हैं।"
                    : "Solid Waste black spots are resolved within 4-8 hours. Blocked stormwater drains within 2-6 hours. Critical medical waste is prioritized within 1-3 hours."}
                </p>
              </div>

              <div className="faq-item">
                <h4>{lang === "hi" ? "क्या मेरी व्यक्तिगत जानकारी सार्वजनिक होती है?" : "Is my personal identity visible publicly?"}</h4>
                <p>
                  {lang === "hi"
                    ? "नहीं। सार्वजनिक मैप और फीड पर आपका मोबाइल नंबर और ईमेल कभी प्रदर्शित नहीं होता।"
                    : "No. Your phone number and email are strictly protected and never displayed on public maps or feeds."}
                </p>
              </div>

              <div className="faq-item">
                <h4>{lang === "hi" ? "नगर निगम जयपुर संपर्क सूत्र" : "Jaipur Municipal Control Numbers"}</h4>
                <p>
                  {lang === "hi"
                    ? "कंट्रोल रूम: 0141-2742823 | स्वच्छता हेल्पलाइन: 1969 | राजस्थान संपर्क: 181"
                    : "Control Room: 0141-2742823 | Swachh Helpline: 1969 | Rajasthan Sampark: 181"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
