import React, { useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Shield,
  User,
  UserPlus,
  X
} from "lucide-react";
import { apiForgotPassword, apiLogin, apiRegister, apiResetPassword } from "../api.js";

const JAIPUR_WARDS = [
  { number: 12, name: "Civil Lines" },
  { number: 15, name: "C-Scheme" },
  { number: 38, name: "Malviya Nagar Circle" },
  { number: 42, name: "Mansarovar Sector 7" },
  { number: 51, name: "Vaishali Nagar Main Road" },
  { number: 67, name: "Sanganer Industrial Area" },
  { number: 102, name: "Amer / Heritage" }
];

export function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [mode, setMode] = useState("login"); // "login", "register", "forgot", "reset"
  const [loginRoleTab, setLoginRoleTab] = useState("citizen"); // "citizen" or "staff"

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regWard, setRegWard] = useState("38");
  const [customWard, setCustomWard] = useState("");

  // Forgot & Reset state
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPasswordVal, setResetPasswordVal] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  if (!isOpen) return null;

  function switchMode(newMode) {
    setMode(newMode);
    setError("");
    setSuccessNotice("");
  }

  async function handleLogin(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessNotice("");
    try {
      const res = await apiLogin(email, password);
      onLoginSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    if (e) e.preventDefault();
    setError("");
    setSuccessNotice("");

    if (!regName.trim() || regName.trim().length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }

    if (!regEmail.trim() || !regEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    const finalWard = regWard === "custom" ? (Number(customWard) || 38) : Number(regWard);

    setLoading(true);
    try {
      const res = await apiRegister({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        phone: regPhone.trim() || null,
        wardNumber: finalWard
      });
      onLoginSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessNotice("");
    try {
      const res = await apiForgotPassword(forgotEmail);
      setSuccessNotice(res.message);
      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
    } catch (err) {
      setError(err.message || "Failed to request password reset.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessNotice("");
    try {
      const res = await apiResetPassword(resetToken, resetPasswordVal);
      setSuccessNotice(res.message || "Password updated successfully. Please sign in.");
      switchMode("login");
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card auth-dual-modal" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="modal-header">
          <div className="modal-title">
            <div>
              <h3>
                {mode === "login" && (loginRoleTab === "citizen" ? "Citizen Portal Sign In" : "Municipal Operations Sign In")}
                {mode === "register" && "Create Verified Citizen Account"}
                {mode === "forgot" && "Recover Account Password"}
                {mode === "reset" && "Set New Account Password"}
              </h3>
              <p>
                {mode === "login" && (loginRoleTab === "citizen"
                  ? "Sign in to track your submitted reports, verify cleanups, and view civic karma."
                  : "Sign in with authorized municipal credentials to access triage queue and department routing.")}
                {mode === "register" && "Register to submit waste complaints and monitor verified cleanup across Jaipur."}
                {mode === "forgot" && "Enter your registered email address to receive password reset instructions."}
                {mode === "reset" && "Enter the single-use reset token and choose a secure new password."}
              </p>
            </div>
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Primary Mode Tabs (Sign In vs Create Account) */}
        {(mode === "login" || mode === "register") && (
          <div className="auth-tab-switcher">
            <button
              type="button"
              className={`auth-tab-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              <LogIn size={16} />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => switchMode("register")}
            >
              <UserPlus size={16} />
              <span>Create Account</span>
            </button>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}
        {successNotice && (
          <div className="auth-success-banner">
            <CheckCircle2 size={16} />
            <span>{successNotice}</span>
          </div>
        )}

        {/* 1. LOGIN MODE */}
        {mode === "login" && (
          <>
            {/* Citizen vs Staff Switcher */}
            <div className="auth-sub-role-switcher">
              <button
                type="button"
                className={`sub-role-btn ${loginRoleTab === "citizen" ? "active" : ""}`}
                onClick={() => {
                  setLoginRoleTab("citizen");
                  setError("");
                }}
              >
                <User size={15} />
                <span>Resident / Citizen</span>
              </button>
              <button
                type="button"
                className={`sub-role-btn ${loginRoleTab === "staff" ? "active" : ""}`}
                onClick={() => {
                  setLoginRoleTab("staff");
                  setError("");
                }}
              >
                <Shield size={15} />
                <span>Municipal Staff & Admin</span>
              </button>
            </div>

            {loginRoleTab === "staff" && (
              <div className="admin-hint-callout">
                <Shield size={14} />
                <span>
                  <strong>Municipal Operations:</strong> Use your official admin email (e.g. <code>admin@jaipur.gov.in</code>) to access the operations console.
                </span>
              </div>
            )}

            <form onSubmit={handleLogin} className="auth-form">
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder={loginRoleTab === "staff" ? "admin@jaipur.gov.in" : "name@example.com"}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div className="label-with-action">
                  <label>Password</label>
                  <button
                    type="button"
                    className="link-sub-action"
                    onClick={() => {
                      switchMode("forgot");
                      setForgotEmail(email);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="hero-cta-primary auth-submit-btn" disabled={loading}>
                <LogIn size={16} />
                <span>{loading ? "Signing In..." : "Sign In"}</span>
              </button>
            </form>

            <div className="auth-footer-toggle">
              <p>
                Don't have an account yet?{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => switchMode("register")}
                >
                  Register as Citizen
                </button>
              </p>
            </div>
          </>
        )}

        {/* 2. REGISTER CITIZEN MODE */}
        {mode === "register" && (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Harshvardhan Singh"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                placeholder="e.g. harsh@example.com"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label>Mobile Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="+91-98290-00000"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Home Ward (Jaipur)</label>
                <select value={regWard} onChange={(e) => setRegWard(e.target.value)}>
                  {JAIPUR_WARDS.map((w) => (
                    <option key={w.number} value={w.number}>
                      Ward {w.number} — {w.name}
                    </option>
                  ))}
                  <option value="custom">Other Jaipur Ward Number...</option>
                </select>
              </div>
            </div>

            {regWard === "custom" && (
              <div className="form-group">
                <label>Enter Jaipur Ward Number (1–250)</label>
                <input
                  type="number"
                  min="1"
                  max="250"
                  placeholder="e.g. 74"
                  required
                  value={customWard}
                  onChange={(e) => setCustomWard(e.target.value)}
                />
              </div>
            )}

            <div className="form-row-2">
              <div className="form-group">
                <label>Create Password *</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Confirm Password *</label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  required
                  minLength={6}
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="security-policy-tag">
              <Shield size={14} />
              <span>Public registration creates a verified resident account. Your data is stored securely in MongoDB.</span>
            </div>

            <button type="submit" className="hero-cta-primary auth-submit-btn" disabled={loading}>
              <UserPlus size={16} />
              <span>{loading ? "Creating Account..." : "Create Citizen Account"}</span>
            </button>

            <div className="auth-footer-toggle">
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => switchMode("login")}
                >
                  Sign In
                </button>
              </p>
            </div>
          </form>
        )}

        {/* 3. FORGOT PASSWORD MODE */}
        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} className="auth-form">
            <div className="form-group">
              <label>Registered Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </div>

            {resetToken && (
              <div className="dev-token-helper">
                <span>Reset Token Generated:</span>
                <code>{resetToken}</code>
                <button
                  type="button"
                  className="btn-use-token"
                  onClick={() => switchMode("reset")}
                >
                  Proceed to Reset Password →
                </button>
              </div>
            )}

            <button type="submit" className="hero-cta-primary auth-submit-btn" disabled={loading}>
              <Mail size={16} />
              <span>{loading ? "Requesting..." : "Send Reset Instructions"}</span>
            </button>

            <div className="auth-footer-toggle">
              <button
                type="button"
                className="link-button"
                onClick={() => switchMode("login")}
              >
                ← Back to Sign In
              </button>
              {resetToken && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => switchMode("reset")}
                >
                  I already have a token
                </button>
              )}
            </div>
          </form>
        )}

        {/* 4. RESET PASSWORD MODE */}
        {mode === "reset" && (
          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="form-group">
              <label>Single-Use Reset Token</label>
              <input
                type="text"
                placeholder="Paste reset token"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>New Secure Password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                required
                minLength={6}
                value={resetPasswordVal}
                onChange={(e) => setResetPasswordVal(e.target.value)}
              />
            </div>

            <button type="submit" className="hero-cta-primary auth-submit-btn" disabled={loading}>
              <KeyRound size={16} />
              <span>{loading ? "Updating..." : "Update Password"}</span>
            </button>

            <div className="auth-footer-toggle">
              <button
                type="button"
                className="link-button"
                onClick={() => switchMode("login")}
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
