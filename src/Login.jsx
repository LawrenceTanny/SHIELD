import { useState } from "react";
import "./Styles/Login.css";

export default function Login({ onClose }) {
  const [tab, setTab] = useState("signin");
  
  // 1. Added province and city to the form state
  const [form, setForm] = useState({ 
    name: "", email: "", password: "", confirm: "", province: "", city: "" 
  });
  
  // 2. State for loading and success/error messages
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // 3. The function that talks to your backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage("");

    if (tab === "register") {
      // Validate passwords match
      if (form.password !== form.confirm) {
        setStatusMessage("Passwords do not match!");
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch("http://localhost:5000/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            province: form.province,
            city: form.city
          }),
        });

        const result = await response.json();

        if (response.ok) {
          setStatusMessage("Account created successfully! You can now sign in.");
          // Clear form and switch to the sign-in tab
          setForm({ name: "", email: "", password: "", confirm: "", province: "", city: "" });
          setTab("signin");
        } else {
          setStatusMessage(result.message || "Error creating account.");
        }
      } catch (error) {
        setStatusMessage("Server offline. Make sure node server.js is running!");
      } finally {
        setIsLoading(false);
      }
} else {

      setIsLoading(true);
      try {
        const response = await fetch("http://localhost:5000/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
          }),
        });

        const result = await response.json();

        if (response.ok) {

          setStatusMessage("Login successful! Welcome back, " + result.user.name);

          setTimeout(() => {
            onClose();
          }, 1500);
          
        } else {
          setStatusMessage(result.message || "Invalid credentials.");
        }
      } catch (error) {
        setStatusMessage("Server offline. Make sure node server.js is running!");
      } finally {
        setIsLoading(false);
      }
    }
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
            className={"ltab" + (tab === "signin" ? " ltab--on" : "")}
            onClick={() => { setTab("signin"); setStatusMessage(""); }}
          >Sign In</button>
          <button
            className={"ltab" + (tab === "register" ? " ltab--on" : "")}
            onClick={() => { setTab("register"); setStatusMessage(""); }}
          >Register</button>
        </div>

        {/* Status Message Display */}
        {statusMessage && (
          <div style={{ textAlign: "center", marginBottom: "10px", color: statusMessage.includes("success") ? "#06d6a0" : "#ff4d6d", fontSize: "0.9em" }}>
            {statusMessage}
          </div>
        )}

        {tab === "signin" ? (
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="lf-label">
              Email
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                autoComplete="email"
                required
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
                required
              />
            </label>
            <button type="submit" className="login-submit" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
            <p className="login-hint">
              Don&apos;t have an account?{" "}
              <button type="button" className="login-link" onClick={() => { setTab("register"); setStatusMessage(""); }}>
                Register
              </button>
            </p>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="lf-label">
              Full Name
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="Juan Dela Cruz"
                autoComplete="name"
                required
              />
            </label>
            
            {/* Added Province and City Fields */}
            <div style={{ display: "flex", gap: "10px" }}>
              <label className="lf-label" style={{ flex: 1 }}>
                Province
                <input
                  type="text"
                  value={form.province}
                  onChange={set("province")}
                  placeholder="Bulacan"
                  required
                />
              </label>
              <label className="lf-label" style={{ flex: 1 }}>
                City
                <input
                  type="text"
                  value={form.city}
                  onChange={set("city")}
                  placeholder="San Jose Del Monte"
                  required
                />
              </label>
            </div>

            <label className="lf-label">
              Email
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                autoComplete="email"
                required
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
                required
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
                required
              />
            </label>
            <button type="submit" className="login-submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Account"}
            </button>
            <p className="login-hint">
              Already have an account?{" "}
              <button type="button" className="login-link" onClick={() => { setTab("signin"); setStatusMessage(""); }}>
                Sign In
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}