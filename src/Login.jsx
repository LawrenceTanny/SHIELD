import { useState } from "react";
import "./Styles/Login.css";

export default function Login({ onClose }) {
  const [tab, setTab] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="login-overlay" onClick={handleOverlayClick}>
      <div className="login-modal">

        <button className="login-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="login-brand">
          <span className="login-logo">SHIELD</span>
          <p className="login-tagline">Synchronized Hazard Information &amp; Emergency Live Dashboard</p>
        </div>

        <div className="login-tabs">
          <button
            className={"ltab" + (tab === "signin"   ? " ltab--on" : "")}
            onClick={() => setTab("signin")}
          >Sign In</button>
          <button
            className={"ltab" + (tab === "register" ? " ltab--on" : "")}
            onClick={() => setTab("register")}
          >Register</button>
        </div>

        {tab === "signin" ? (
          <form className="login-form" onSubmit={(e) => e.preventDefault()}>
            <label className="lf-label">
              Email
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <label className="lf-label">
              Password
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="login-submit">Sign In</button>
            <p className="login-hint">
              Don&apos;t have an account?{" "}
              <button type="button" className="login-link" onClick={() => setTab("register")}>
                Register
              </button>
            </p>
          </form>
        ) : (
          <form className="login-form" onSubmit={(e) => e.preventDefault()}>
            <label className="lf-label">
              Full Name
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="Juan Dela Cruz"
                autoComplete="name"
              />
            </label>
            <label className="lf-label">
              Email
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <label className="lf-label">
              Password
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </label>
            <label className="lf-label">
              Confirm Password
              <input
                type="password"
                value={form.confirm}
                onChange={set("confirm")}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="login-submit">Create Account</button>
            <p className="login-hint">
              Already have an account?{" "}
              <button type="button" className="login-link" onClick={() => setTab("signin")}>
                Sign In
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
