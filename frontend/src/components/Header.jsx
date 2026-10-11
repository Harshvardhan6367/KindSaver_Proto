import React, { useEffect, useState } from "react";
import {
  Building2,
  Globe,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Send,
  Shield,
  Ticket,
  User,
  UserCheck,
  UserRoundCog,
  X
} from "lucide-react";

export function Header({
  portalMode,
  setPortalMode,
  currentView,
  setView,
  currentUser,
  onOpenAuth,
  onLogout,
  serverHealthy,
  lang = "en",
  setLang,
  t = {}
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isStaff =
    currentUser && (currentUser.role === "admin" || currentUser.role === "ward_officer");

  // Close mobile drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  function handleNavigate(targetView) {
    setView(targetView);
    setMobileMenuOpen(false);
  }

  function handleSwitchPortal(mode) {
    setPortalMode(mode);
    if (mode === "citizen") {
      if (currentView === "admin") setView("home");
    } else {
      setView("admin");
      if (!isStaff) onOpenAuth();
    }
    setMobileMenuOpen(false);
  }

  return (
    <>
      <header className="topbar">
        {/* Brand logo & title */}
        <div
          className="brand"
          onClick={() => {
            setPortalMode("citizen");
            setView("home");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setPortalMode("citizen");
              setView("home");
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="KindSaver Jaipur Homepage"
        >
          <div className="brand-mark">
            <span>KS</span>
          </div>
          <div className="brand-info">
            <div className="brand-title">
              <strong>{t.brandTitle || "KindSaver Jaipur"}</strong>
              <span className="city-pill">Jaipur Nagar Nigam</span>
            </div>
            <span className="brand-subtitle">{t.brandSubtitle || "Civic Waste Reporting & Operations"}</span>
          </div>
        </div>

        {/* Center Portal Switcher & Navigation Tabs (Desktop / Tablet-wide) */}
        <div className="topbar-center-nav">
          {/* Portal Mode Toggle */}
          <div className="portal-mode-pill-toggle">
            <button
              type="button"
              className={`portal-toggle-btn ${portalMode === "citizen" ? "active-citizen" : ""}`}
              onClick={() => handleSwitchPortal("citizen")}
            >
              <User size={15} />
              <span>{t.citizenPortal || "Citizen Portal"}</span>
            </button>

            <button
              type="button"
              className={`portal-toggle-btn ${portalMode === "admin" ? "active-admin" : ""}`}
              onClick={() => handleSwitchPortal("admin")}
            >
              <Shield size={15} />
              <span>{t.adminConsole || "Admin Console"}</span>
            </button>
          </div>

          {/* Dynamic Nav Tabs based on Active Portal */}
          <nav className="tabs" aria-label="Portal Navigation">
            {portalMode === "citizen" ? (
              <>
                <button
                  className={`tab ${currentView === "home" ? "active" : ""}`}
                  onClick={() => setView("home")}
                  title="Public Home"
                >
                  <Home size={16} />
                  <span>{t.navHome || "Home"}</span>
                </button>

                <button
                  className={`tab ${currentView === "map" ? "active" : ""}`}
                  onClick={() => setView("map")}
                  title="Interactive Jaipur Map"
                >
                  <MapPin size={16} />
                  <span>{t.navMap || "Live Map"}</span>
                </button>

                <button
                  className={`tab ${currentView === "report" ? "active" : ""}`}
                  onClick={() => setView("report")}
                  title="Report Waste Issue"
                >
                  <Send size={16} />
                  <span>{t.navReport || "Report Waste"}</span>
                </button>

                <button
                  className={`tab ${currentView === "track" ? "active" : ""}`}
                  onClick={() => setView("track")}
                  title="Track Public Ticket"
                >
                  <Ticket size={16} />
                  <span>{t.navTrack || "Track Ticket"}</span>
                </button>

                {currentUser && (
                  <button
                    className={`tab ${currentView === "citizen-dashboard" ? "active" : ""}`}
                    onClick={() => setView("citizen-dashboard")}
                    title="Resident Dashboard & My Complaints"
                  >
                    <LayoutDashboard size={16} />
                    <span>{t.navDashboard || "My Dashboard"}</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  className={`tab ${currentView === "admin" ? "active" : ""}`}
                  onClick={() => setView("admin")}
                  title="Operations Triage & Department Routing"
                >
                  <UserRoundCog size={16} />
                  <span>{t.navOperations || "Operations Queue"}</span>
                </button>

                <button
                  className={`tab ${currentView === "map" ? "active" : ""}`}
                  onClick={() => setView("map")}
                  title="Map View"
                >
                  <MapPin size={16} />
                  <span>{t.navMap || "Map View"}</span>
                </button>

                <button
                  className={`tab ${currentView === "track" ? "active" : ""}`}
                  onClick={() => setView("track")}
                  title="Inspect Ticket Timeline"
                >
                  <Ticket size={16} />
                  <span>{t.navTrack || "Ticket Inspector"}</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Right Actions: Language Switcher, API Status, User Menu & Mobile Hamburger */}
        <div className="topbar-actions">
          {/* Language Switcher */}
          {setLang && (
            <button
              type="button"
              className="lang-switcher-btn"
              onClick={() => setLang(lang === "en" ? "hi" : "en")}
              title="Toggle Language / भाषा बदलें"
              aria-label="Toggle Language"
            >
              <Globe size={14} />
              <span>{lang === "en" ? "हिन्दी" : "English"}</span>
            </button>
          )}

          <div className="system-status-indicator" title="Backend service status">
            <span className={`status-dot ${serverHealthy ? "online" : "offline"}`} />
            <span className="status-label">{serverHealthy ? "API Live" : "Connecting..."}</span>
          </div>

          {currentUser ? (
            <div className="user-profile-menu">
              <div className="user-badge-chip">
                {currentUser.role === "admin" ? (
                  <Shield size={16} className="text-amber" />
                ) : currentUser.role === "ward_officer" ? (
                  <UserCheck size={16} className="text-emerald" />
                ) : (
                  <User size={16} className="text-blue" />
                )}
                <div className="user-details">
                  <span className="user-name">{currentUser.name}</span>
                  <span className="user-role-label">
                    {currentUser.role === "admin"
                      ? "City Administrator"
                      : currentUser.role === "ward_officer"
                      ? "Ward Officer"
                      : `Resident (Ward ${currentUser.wardNumber || "38"})`}
                  </span>
                </div>
              </div>
              <button className="logout-btn" onClick={onLogout} title="Sign out" aria-label="Sign out">
                <LogOut size={16} />
                <span>{t.signOut || "Sign Out"}</span>
              </button>
            </div>
          ) : (
            <button className="login-trigger-btn" onClick={onOpenAuth} aria-label="Sign in">
              <LogIn size={16} />
              <span>{t.signIn || "Sign In"}</span>
            </button>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            className="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Accessible Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <nav
            className="mobile-nav-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Mobile Navigation Drawer"
          >
            <div className="mobile-drawer-header">
              <div className="brand-mark-sm">
                <span>KS</span>
              </div>
              <div>
                <strong>KindSaver Jaipur</strong>
                <span className="drawer-subtitle">Nagar Nigam Civic System</span>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Portal Switcher within Mobile Drawer */}
            <div className="drawer-portal-switcher">
              <button
                type="button"
                className={`drawer-portal-btn ${portalMode === "citizen" ? "active-citizen" : ""}`}
                onClick={() => handleSwitchPortal("citizen")}
              >
                <User size={16} />
                <span>{t.citizenPortal || "Citizen Portal"}</span>
              </button>
              <button
                type="button"
                className={`drawer-portal-btn ${portalMode === "admin" ? "active-admin" : ""}`}
                onClick={() => handleSwitchPortal("admin")}
              >
                <Shield size={16} />
                <span>{t.adminConsole || "Admin Console"}</span>
              </button>
            </div>

            {/* Navigation Links */}
            <div className="drawer-links-list">
              {portalMode === "citizen" ? (
                <>
                  <button
                    className={`drawer-nav-item ${currentView === "home" ? "active" : ""}`}
                    onClick={() => handleNavigate("home")}
                  >
                    <Home size={18} />
                    <span>{t.navHome || "Home"}</span>
                  </button>
                  <button
                    className={`drawer-nav-item ${currentView === "map" ? "active" : ""}`}
                    onClick={() => handleNavigate("map")}
                  >
                    <MapPin size={18} />
                    <span>{t.navMap || "Live Map"}</span>
                  </button>
                  <button
                    className={`drawer-nav-item ${currentView === "report" ? "active" : ""}`}
                    onClick={() => handleNavigate("report")}
                  >
                    <Send size={18} />
                    <span>{t.navReport || "Report Waste"}</span>
                  </button>
                  <button
                    className={`drawer-nav-item ${currentView === "track" ? "active" : ""}`}
                    onClick={() => handleNavigate("track")}
                  >
                    <Ticket size={18} />
                    <span>{t.navTrack || "Track Ticket"}</span>
                  </button>
                  {currentUser && (
                    <button
                      className={`drawer-nav-item ${currentView === "citizen-dashboard" ? "active" : ""}`}
                      onClick={() => handleNavigate("citizen-dashboard")}
                    >
                      <LayoutDashboard size={18} />
                      <span>{t.navDashboard || "My Dashboard"}</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    className={`drawer-nav-item ${currentView === "admin" ? "active" : ""}`}
                    onClick={() => handleNavigate("admin")}
                  >
                    <UserRoundCog size={18} />
                    <span>{t.navOperations || "Operations Queue"}</span>
                  </button>
                  <button
                    className={`drawer-nav-item ${currentView === "map" ? "active" : ""}`}
                    onClick={() => handleNavigate("map")}
                  >
                    <MapPin size={18} />
                    <span>{t.navMap || "Map View"}</span>
                  </button>
                  <button
                    className={`drawer-nav-item ${currentView === "track" ? "active" : ""}`}
                    onClick={() => handleNavigate("track")}
                  >
                    <Ticket size={18} />
                    <span>{t.navTrack || "Ticket Inspector"}</span>
                  </button>
                </>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="drawer-footer-actions">
              {setLang && (
                <button
                  type="button"
                  className="drawer-lang-btn"
                  onClick={() => {
                    setLang(lang === "en" ? "hi" : "en");
                    setMobileMenuOpen(false);
                  }}
                >
                  <Globe size={16} />
                  <span>{lang === "en" ? "भाषा: हिन्दी में बदलें" : "Language: Switch to English"}</span>
                </button>
              )}

              {currentUser ? (
                <div className="drawer-user-info">
                  <div className="drawer-user-card">
                    <User size={18} />
                    <div>
                      <strong>{currentUser.name}</strong>
                      <small>
                        {currentUser.role === "admin"
                          ? "City Administrator"
                          : currentUser.role === "ward_officer"
                          ? "Ward Officer"
                          : `Resident · Ward ${currentUser.wardNumber || "38"}`}
                      </small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="drawer-logout-btn"
                    onClick={() => {
                      onLogout();
                      setMobileMenuOpen(false);
                    }}
                  >
                    <LogOut size={16} />
                    <span>{t.signOut || "Sign Out"}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="drawer-signin-btn"
                  onClick={() => {
                    onOpenAuth();
                    setMobileMenuOpen(false);
                  }}
                >
                  <LogIn size={16} />
                  <span>{t.signIn || "Sign In to Account"}</span>
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
