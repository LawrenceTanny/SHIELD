import { useState, useEffect } from "react";
import isEmail from "validator/lib/isEmail";
import { Eye, EyeOff } from "lucide-react"; 
import "./Styles/Login.css";

export default function Login({ onClose }) {
  const [tab, setTab] = useState("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false); // Separate state for confirm field
  
  const [form, setForm] = useState({ 
    firstName: "", lastName: "", middleName: "", extensionName: "", 
    email: "", password: "", confirm: "", province: "", city: "" 
  });
  
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);

  const set = (k) => (e) => {
    setStatusMessage("");
    if (k === "email") setEmailError(false);
    setForm((p) => ({ ...p, [k]: e.target.value }));
  };

  const isPasswordStrong = (password) => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
    );
  };

  const validateEmail = (email) => {
    const atPos = email.indexOf("@");
    const dotPos = email.lastIndexOf(".");
    return isEmail(email) && atPos > 0 && dotPos > atPos + 1;
  };

  useEffect(() => {
    fetch("https://psgc.cloud/api/provinces")
      .then((res) => res.json())
      .then((data) => {
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        setProvinces(sorted);
      })
      .catch(() => console.error("Error loading provinces"));
  }, []);

  const handleProvinceChange = (e) => {
    const provinceName = e.target.value;
    setForm((p) => ({ ...p, province: provinceName, city: "" }));
    const selectedProv = provinces.find((p) => p.name === provinceName);
    if (selectedProv) {
      fetch(`https://psgc.cloud/api/provinces/${selectedProv.code}/cities-municipalities`)
        .then((res) => res.json())
        .then((data) => {
          const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
          setCities(sorted);
        })
        .catch(() => console.error("Error loading cities"));
    } else {
      setCities([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage("");
    setEmailError(false);

    if (!validateEmail(form.email)) {
      setEmailError(true);
      setStatusMessage("❌ Invalid Email! Use format: name@example.com");
      return;
    }

    if (tab === "register") {
      if (!isPasswordStrong(form.password)) {
        setStatusMessage("❌ Password needs 8+ chars, Upper, Lower, and a Number.");
        return;
      }
      if (form.password !== form.confirm) {
        setStatusMessage("❌ Passwords do not match!");
        return;
      }
    }

    setIsLoading(true);
    const endpoint = tab === "register" ? "signup" : "login";
    
    try {
      const response = await fetch(`https://shield-mfoi.onrender.com/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tab === "register" ? form : { email: form.email, password: form.password }),
      });
      const result = await response.json();
      if (response.ok) {
        setStatusMessage(tab === "register" ? "✅ Account created!" : `✅ Welcome back!`);
        if (tab === "signin") setTimeout(() => onClose(), 1500);
        else setTab("signin");
      } else {
        setStatusMessage(`❌ ${result.message || "Action failed."}`);
      }
    } catch (error) {
      setStatusMessage("❌ Server connection error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="login-modal">
        <button className="login-close" onClick={onClose}>✕</button>
        <div className="login-brand">
          <span className="login-logo">SHIELD</span>
          <p className="login-tagline">Synchronized Hazard Information Dashboard</p>
        </div>

        <div className="login-tabs">
          <button className={`ltab ${tab === "signin" ? "ltab--on" : ""}`} onClick={() => setTab("signin")}>Sign In</button>
          <button className={`ltab ${tab === "register" ? "ltab--on" : ""}`} onClick={() => setTab("register")}>Register</button>
        </div>

        {statusMessage && (
          <div className="status-indicator" style={{ 
            textAlign: "center", padding: "10px", marginBottom: "15px", borderRadius: "8px", fontSize: "0.85em",
            backgroundColor: statusMessage.includes("✅") ? "#e6fff4" : "#fff0f2",
            color: statusMessage.includes("✅") ? "#06d6a0" : "#ff4d6d",
            border: `1px solid ${statusMessage.includes("✅") ? "#06d6a0" : "#ff4d6d"}`
          }}>{statusMessage}</div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {tab === "register" && (
            <>
              <div style={{ display: "flex", gap: "10px" }}>
                <label className="lf-label" style={{ flex: 2 }}>
                  <span>First Name <span style={{ color: "red" }}>*</span></span>
                  <input type="text" value={form.firstName} onChange={set("firstName")} placeholder="Juan" required />
                </label>
                <label className="lf-label" style={{ flex: 1 }}>
                  <span>Middle Name</span>
                  <input type="text" value={form.middleName} onChange={set("middleName")} placeholder="Santos" />
                </label>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <label className="lf-label" style={{ flex: 2 }}>
                  <span>Last Name <span style={{ color: "red" }}>*</span></span>
                  <input type="text" value={form.lastName} onChange={set("lastName")} placeholder="Dela Cruz" required />
                </label>
                <label className="lf-label" style={{ flex: 1 }}>
                  <span>Ext.</span>
                  <input type="text" value={form.extensionName} onChange={set("extensionName")} placeholder="Jr." />
                </label>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <label className="lf-label" style={{ flex: 1 }}>
                  <span>Province <span style={{ color: "red" }}>*</span></span>
                  <input list="p-list" value={form.province} onChange={handleProvinceChange} required />
                  <datalist id="p-list">{provinces.map(p => <option key={p.code} value={p.name} />)}</datalist>
                </label>
                <label className="lf-label" style={{ flex: 1 }}>
                  <span>City <span style={{ color: "red" }}>*</span></span>
                  <input list="c-list" value={form.city} onChange={set("city")} disabled={!form.province} required />
                  <datalist id="c-list">{cities.map(c => <option key={c.code} value={c.name} />)}</datalist>
                </label>
              </div>
            </>
          )}

          <label className="lf-label">
            <span>Email <span style={{ color: "red" }}>*</span></span>
            <input 
              type="text" value={form.email} onChange={set("email")} placeholder="juan@example.com" 
              required style={{ border: emailError ? "2px solid #ff4d6d" : "1px solid #ddd" }}
            />
          </label>

          <label className="lf-label">
            <span>Password <span style={{ color: "red" }}>*</span></span>
            <div style={{ position: "relative" }}>
              <input 
                type={showPassword ? "text" : "password"} value={form.password} onChange={set("password")} 
                placeholder="••••••••" required style={{ width: "100%", paddingRight: "40px" }}
              />
              <span 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#666" }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            </div>
          </label>

          {tab === "register" && (
            <label className="lf-label">
              <span>Confirm Password <span style={{ color: "red" }}>*</span></span>
              <div style={{ position: "relative" }}>
                <input 
                  type={showConfirm ? "text" : "password"} 
                  value={form.confirm} 
                  onChange={set("confirm")} 
                  placeholder="••••••••"
                  required 
                  style={{ width: "100%", paddingRight: "40px" }}
                />
                <span 
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#666" }}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </span>
              </div>
            </label>
          )}

          <button type="submit" className="login-submit" disabled={isLoading}>
            {isLoading ? "Please wait..." : tab === "signin" ? "Sign In" : "Register"}
          </button>
        </form>
      </div>
    </div>
  );
}