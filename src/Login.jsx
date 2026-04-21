import { useState, useEffect, useRef } from "react";
import validator from "validator";
import { Eye, EyeOff } from "lucide-react"; 
import "./Styles/Login.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://shield-app-wmz37.ondigitalocean.app";

export default function Login({ onClose, onLogin }) {
  const morphTimerRef = useRef(null);
  const [tab, setTab] = useState("signin");
  const [modalFlipClass, setModalFlipClass] = useState("");
  const [isMorphing, setIsMorphing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false); // Separate state for confirm field
  const [submitAttempted, setSubmitAttempted] = useState(false);
  
  const [form, setForm] = useState({ 
    username: "",
    email: "", password: "", confirm: "", province: "", city: "" 
  });
  
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [citySourceProvinceCode, setCitySourceProvinceCode] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [messageType, setMessageType] = useState("neutral");
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);

  const isRequiredMissing = (key) => !form[key]?.trim();
  const normalize = (value) => value.trim().toLowerCase();

  const set = (k) => (e) => {
    setStatusMessage("");
    setMessageType("neutral");
    if (k === "email") setEmailError(false);
    setForm((p) => ({ ...p, [k]: e.target.value }));
  };

  const switchTab = (nextTab) => {
    if (nextTab === tab || isMorphing) return;
    const nextFlip = nextTab === "register" ? "flip-ltr" : "flip-rtl";
    if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
    setIsMorphing(true);
    setModalFlipClass("");
    requestAnimationFrame(() => setModalFlipClass(nextFlip));
    morphTimerRef.current = setTimeout(() => setIsMorphing(false), 430);
    setTab(nextTab);
    setSubmitAttempted(false);
    setStatusMessage("");
    setMessageType("neutral");
    setEmailError(false);
  };

  const isPasswordStrong = (password) => {
    return password.length >= 6;
  };

  const validateEmail = (email) => {
    const atPos = email.indexOf("@");
    const dotPos = email.lastIndexOf(".");
    return validator.isEmail(email) && atPos > 0 && dotPos > atPos + 1;
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

  useEffect(() => {
    return () => {
      if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
    };
  }, []);

  const handleProvinceChange = (e) => {
    const provinceName = e.target.value;
    setForm((p) => ({ ...p, province: provinceName, city: "" }));
    const selectedProv = provinces.find((p) => p.name === provinceName);
    if (selectedProv) {
      setCitySourceProvinceCode(selectedProv.code);
      fetch(`https://psgc.cloud/api/provinces/${selectedProv.code}/cities-municipalities`)
        .then((res) => res.json())
        .then((data) => {
          const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
          setCities(sorted);
        })
        .catch(() => {
          console.error("Error loading cities");
          setCities([]);
        });
    } else {
      setCitySourceProvinceCode("");
      setCities([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setStatusMessage("");
    setMessageType("neutral");
    setEmailError(false);

    if (!validateEmail(form.email)) {
      setEmailError(true);
      setStatusMessage("Invalid Email! Use format: name@example.com");
      setMessageType("error");
      return;
    }

    if (tab === "register") {
      if (!provinces.length) {
        setStatusMessage("Location list is still loading. Please try again in a moment.");
        setMessageType("error");
        return;
      }

      const selectedProvince = provinces.find(
        (p) => normalize(p.name) === normalize(form.province)
      );

      if (!selectedProvince) {
        setStatusMessage("Please select a valid Province from the suggestions.");
        setMessageType("error");
        return;
      }

      let citiesToValidate = cities;
      if (selectedProvince.code !== citySourceProvinceCode) {
        try {
          const res = await fetch(`https://psgc.cloud/api/provinces/${selectedProvince.code}/cities-municipalities`);
          const data = await res.json();
          citiesToValidate = data.sort((a, b) => a.name.localeCompare(b.name));
          setCities(citiesToValidate);
          setCitySourceProvinceCode(selectedProvince.code);
        } catch {
          setStatusMessage("Unable to verify City right now. Please try again.");
          setMessageType("error");
          return;
        }
      }

      const selectedCity = citiesToValidate.find(
        (c) => normalize(c.name) === normalize(form.city)
      );

      if (!selectedCity) {
        setStatusMessage("Please select a valid City from the suggestions.");
        setMessageType("error");
        return;
      }

      if (!isPasswordStrong(form.password)) {
        setStatusMessage("Password must be at least 6 characters.");
        setMessageType("error");
        return;
      }
      if (form.password !== form.confirm) {
        setStatusMessage("Passwords do not match!");
        setMessageType("error");
        return;
      }
    }

    setIsLoading(true);
    const endpoint = tab === "register" ? "signup" : "login";
    const { username, ...registerData } = form;
    const signupPayload = { ...registerData, name: username };
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(tab === "register" ? signupPayload : { email: form.email, password: form.password }),
      });
      const result = await response.json();
      if (response.ok) {
        setStatusMessage(tab === "register" ? "Account created" : "Login Successful");
        setMessageType("success");
        if (tab === "signin") {
          if (typeof onLogin === "function" && result?.user) {
            onLogin(result.user);
          }
          setTimeout(() => onClose(), 600);
        }
        else switchTab("signin");
      } else {
        const backendMessage = (result.message || "").toLowerCase();
        const emailExists =
          response.status === 409 ||
          (tab === "register" &&
            (backendMessage.includes("email") &&
              (backendMessage.includes("exist") ||
                backendMessage.includes("already") ||
                backendMessage.includes("duplicate"))));

        if (emailExists) {
          setStatusMessage("Email already exists. Please sign in instead.");
        } else {
          setStatusMessage(`${result.message || "Action failed."}`);
        }
        setMessageType("error");
      }
    } catch (error) {
      setStatusMessage("Server connection error.");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="login-modal-shell">
      <div
        className={`login-modal ${modalFlipClass}`}
        onAnimationEnd={() => {
          setModalFlipClass("");
        }}
      >
        <button className="login-close" onClick={onClose}>✕</button>
        <div className="login-brand">
          <span className="login-logo">ALERT PH</span>
          <p className="login-tagline">Philippine Disaster & Monitoring System</p>
        </div>

        <div className="login-tabs">
          <button type="button" className={`ltab ${tab === "signin" ? "ltab--on" : ""}`} onClick={() => switchTab("signin")} disabled={isMorphing}>Sign In</button>
          <button type="button" className={`ltab ${tab === "register" ? "ltab--on" : ""}`} onClick={() => switchTab("register")} disabled={isMorphing}>Register</button>
        </div>

        {isMorphing ? (
          <div className="login-skeleton" aria-hidden="true">
            <div className="sk-line sk-status"></div>
            <div className="sk-line sk-label"></div>
            <div className="sk-line sk-input"></div>
            <div className="sk-line sk-label"></div>
            <div className="sk-line sk-input"></div>
            <div className="sk-row">
              <div className="sk-col">
                <div className="sk-line sk-label"></div>
                <div className="sk-line sk-input"></div>
              </div>
              <div className="sk-col">
                <div className="sk-line sk-label"></div>
                <div className="sk-line sk-input"></div>
              </div>
            </div>
            <div className="sk-line sk-button"></div>
          </div>
        ) : (
          <>
        {statusMessage && (
          <div className="status-indicator" style={{ 
            textAlign: "center", padding: "10px", marginBottom: "15px", borderRadius: "8px", fontSize: "0.85em",
            backgroundColor: "#1a1a1a",
            color: messageType === "success" ? "#2e7d32" : "#c41c3b",
            border: `1px solid ${messageType === "success" ? "#2e7d32" : "#c41c3b"}`
          }}>{statusMessage}</div>
        )}

        <form className="login-form" onSubmit={handleSubmit} onInvalid={() => setSubmitAttempted(true)}>
          <div key={tab} className="login-fields-animated">
          {tab === "register" && (
            <>
              <div>
                <label className="lf-label">
                  <span>User Name {submitAttempted && isRequiredMissing("username") && <span className="required-mark">*</span>}</span>
                  <input type="text" value={form.username} onChange={set("username")} placeholder="juan123" required />
                </label>
              </div>

              <div className="login-row">
                <label className="lf-label lf-col-1">
                  <span>Province {submitAttempted && isRequiredMissing("province") && <span className="required-mark">*</span>}</span>
                  <select value={form.province} onChange={handleProvinceChange} required>
                    <option value="" disabled>Select a Province</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </label>
                <label className="lf-label lf-col-1">
                  <span>City {submitAttempted && isRequiredMissing("city") && <span className="required-mark">*</span>}</span>
                  <input list="c-list" value={form.city} onChange={set("city")} disabled={!form.province} placeholder="Enter a Province First" required />
                  <datalist id="c-list">{cities.map(c => <option key={c.code} value={c.name} />)}</datalist>
                </label>
              </div>
            </>
          )}

          <label className="lf-label">
            <span>Email {submitAttempted && isRequiredMissing("email") && <span className="required-mark">*</span>}</span>
            <input 
              type="text" value={form.email} onChange={set("email")} placeholder="juan@example.com" 
              required style={{ border: emailError ? "2px solid #ff4d6d" : "1px solid #ddd" }}
            />
          </label>

          <label className="lf-label">
            <span>Password {submitAttempted && isRequiredMissing("password") && <span className="required-mark">*</span>}</span>
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
              <span>Confirm Password {submitAttempted && isRequiredMissing("confirm") && <span className="required-mark">*</span>}</span>
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
          </div>
        </form>
          </>
        )}
      </div>
      </div>
    </div>
  );
}