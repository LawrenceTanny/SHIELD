import { useEffect, useState } from "react";
import "./Styles/AccountSettings.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://shield-app-wmz37.ondigitalocean.app";

async function readJsonSafe(response) {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

export default function AccountSettings({ onClose, currentUser, onUserUpdated, onSignOut }) {
  const [displayName, setDisplayName] = useState(currentUser?.name || "");
  const [email] = useState(currentUser?.email || "");
  const [province, setProvince] = useState(currentUser?.province || "");
  const [city, setCity] = useState(currentUser?.city || "");
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [citySourceProvinceCode, setCitySourceProvinceCode] = useState("");
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [receiveAlerts, setReceiveAlerts] = useState(true);
  const [newsletter, setNewsletter] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [messageType, setMessageType] = useState("neutral");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const normalize = (value) => String(value || "").trim().toLowerCase();

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const fetchCitiesByProvinceCode = async (provinceCode) => {
    if (!provinceCode) {
      setCities([]);
      setCitySourceProvinceCode("");
      return [];
    }

    setIsLocationLoading(true);
    try {
      const response = await fetch(`https://psgc.cloud/api/provinces/${provinceCode}/cities-municipalities`);
      const data = await response.json();
      const sorted = Array.isArray(data) ? data.sort((a, b) => a.name.localeCompare(b.name)) : [];
      setCities(sorted);
      setCitySourceProvinceCode(provinceCode);
      return sorted;
    } catch (_error) {
      setCities([]);
      setCitySourceProvinceCode(provinceCode);
      return [];
    } finally {
      setIsLocationLoading(false);
    }
  };

  const handleProvinceChange = async (e) => {
    const nextProvince = e.target.value;
    setProvince(nextProvince);
    setCity("");

    const selectedProvince = provinces.find((item) => item.name === nextProvince);
    if (!selectedProvince) {
      setCities([]);
      setCitySourceProvinceCode("");
      return;
    }

    await fetchCitiesByProvinceCode(selectedProvince.code);
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadProfile = async () => {
      if (!currentUser?.email) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/account`, {
          credentials: "include",
          signal: controller.signal
        });

        const payload = await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(payload?.message || `Failed to fetch account profile (${response.status}).`);
        }

        const user = payload?.user;
        if (user) {
          setDisplayName(user.name || currentUser.name || "");
          setProvince(user.province || currentUser.province || "");
          setCity(user.city || currentUser.city || "");
          setReceiveAlerts(user?.preferences?.receiveDisasterAlerts !== false);
          setNewsletter(user?.preferences?.subscribeNewsletter === true);
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          setStatusMessage("Failed to load account settings.");
          setMessageType("error");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => controller.abort();
  }, [currentUser?.email, currentUser?.name]);

  useEffect(() => {
    let isCancelled = false;

    const loadProvinces = async () => {
      try {
        const response = await fetch("https://psgc.cloud/api/provinces");
        const data = await response.json();
        const sorted = Array.isArray(data) ? data.sort((a, b) => a.name.localeCompare(b.name)) : [];
        if (!isCancelled) {
          setProvinces(sorted);
        }
      } catch (_error) {
        if (!isCancelled) {
          setProvinces([]);
        }
      }
    };

    loadProvinces();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const selectedProvince = provinces.find((item) => normalize(item.name) === normalize(province));
    if (!selectedProvince) {
      setCities([]);
      setCitySourceProvinceCode("");
      return;
    }

    if (selectedProvince.code === citySourceProvinceCode) {
      return;
    }

    fetchCitiesByProvinceCode(selectedProvince.code);
  }, [province, provinces]);

  const handleSave = async () => {
    if (!currentUser?.email) {
      setStatusMessage("You need to sign in first.");
      setMessageType("error");
      return;
    }

    if (!displayName.trim()) {
      setStatusMessage("Display name cannot be empty.");
      setMessageType("error");
      return;
    }

    const selectedProvince = provinces.find((item) => normalize(item.name) === normalize(province));
    if (!selectedProvince) {
      setStatusMessage("Please select a valid Province.");
      setMessageType("error");
      return;
    }

    let cityOptions = cities;
    if (selectedProvince.code !== citySourceProvinceCode) {
      cityOptions = await fetchCitiesByProvinceCode(selectedProvince.code);
    }

    const selectedCity = cityOptions.find((item) => normalize(item.name) === normalize(city));
    if (!selectedCity) {
      setStatusMessage("Please select a valid City.");
      setMessageType("error");
      return;
    }

    const wantsPasswordChange = currentPassword || newPassword || confirmPassword;
    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setStatusMessage("Fill out the current password, new password, and confirmation.");
        setMessageType("error");
        return;
      }

      if (newPassword.length < 6) {
        setStatusMessage("New password must be at least 6 characters.");
        setMessageType("error");
        return;
      }

      if (newPassword !== confirmPassword) {
        setStatusMessage("New passwords do not match.");
        setMessageType("error");
        return;
      }
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: displayName.trim(),
          province: selectedProvince.name,
          city: selectedCity.name,
          currentPassword: wantsPasswordChange ? currentPassword : undefined,
          newPassword: wantsPasswordChange ? newPassword : undefined,
          confirmPassword: wantsPasswordChange ? confirmPassword : undefined,
          preferences: {
            receiveDisasterAlerts: receiveAlerts,
            subscribeNewsletter: newsletter
          }
        })
      });

      const payload = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to save account settings.");
      }

      if (typeof onUserUpdated === "function" && payload?.user) {
        onUserUpdated(payload.user);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setStatusMessage("Account settings saved.");
      setMessageType("success");
    } catch (error) {
      setStatusMessage(error?.message || "Failed to save account settings.");
      setMessageType("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOutClick = async () => {
    if (typeof onSignOut === "function") {
      await onSignOut();
    }
    onClose();
  };

  if (!currentUser) {
    return (
      <div className="as-overlay" onClick={handleOverlayClick}>
        <div className="as-modal">
          <div className="as-head">
            <h2>Account Settings</h2>
            <button className="as-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="as-body">
            <section className="as-section">
              <h3 className="as-section-title">Sign in required</h3>
              <p className="as-hint">Please sign in first to manage your account settings.</p>
            </section>
          </div>
          <div className="as-footer">
            <button className="as-btn-cancel" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="as-overlay" onClick={handleOverlayClick}>
      <div className="as-modal">

        {/* Header */}
        <div className="as-head">
          <h2>Account Settings</h2>
          <button className="as-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <hr className="hr"></hr>

        <div className="as-body">
          {/* Profile Info */}
          <section className="as-section">
            <h3 className="as-section-title">Profile</h3>
            {statusMessage && (
              <p className={`as-hint ${messageType === "error" ? "as-error" : "as-success"}`}>{statusMessage}</p>
            )}
            <label className="as-field">
              <span>Display Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                disabled={isLoading || isSaving}
              />
            </label>
            <label className="as-field">
              <span>Email <em className="as-readonly-tag">read-only</em></span>
              <input type="email" value={email} readOnly className="as-input-readonly" />
            </label>

            <div className="as-field-grid">
              <label className="as-field">
                <span>Province</span>
                <select
                  value={province}
                  onChange={handleProvinceChange}
                  disabled={isLoading || isSaving || !provinces.length || isLocationLoading}
                >
                  <option value="" disabled>
                    {provinces.length ? "Select a Province" : "Loading Provinces..."}
                  </option>
                  {provinces.map((item) => (
                    <option key={item.code} value={item.name}>{item.name}</option>
                  ))}
                </select>
              </label>

              <label className="as-field">
                <span>City</span>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isLoading || isSaving || !province || isLocationLoading || !cities.length}
                >
                  <option value="" disabled>
                    {!province
                      ? "Select Province First"
                      : isLocationLoading
                        ? "Loading Cities..."
                        : cities.length
                          ? "Select a City"
                          : "No Cities Available"}
                  </option>
                  {cities.map((item) => (
                    <option key={item.code} value={item.name}>{item.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <hr className="hr"></hr>

          <section className="as-section">
            <h3 className="as-section-title">Security</h3>
            <label className="as-field">
              <span>Current Password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                disabled={isLoading || isSaving}
              />
            </label>
            <label className="as-field">
              <span>New Password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={isLoading || isSaving}
              />
            </label>
            <label className="as-field">
              <span>Confirm New Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                disabled={isLoading || isSaving}
              />
            </label>
          </section>

          <hr className="hr"></hr>

          {/* Email Preferences */}
          <section className="as-section">
            <h3 className="as-section-title">Email Preferences</h3>
            <label className="as-toggle">
              <input
                type="checkbox"
                checked={receiveAlerts}
                onChange={(e) => setReceiveAlerts(e.target.checked)}
                disabled={isLoading || isSaving}
              />
              <span>Receive disaster alert emails</span>
            </label>
            <label className="as-toggle">
              <input
                type="checkbox"
                checked={newsletter}
                onChange={(e) => setNewsletter(e.target.checked)}
                disabled={isLoading || isSaving}
              />
              <span>Subscribe to ALERT PH newsletter</span>
            </label>
          </section>

          <hr className="hr"></hr>

          <section className="as-section">
            <h3 className="as-section-title">Account</h3>
            <button className="as-btn-signout" type="button" onClick={handleSignOutClick}>
              Sign Out
            </button>
          </section>




        </div>

        <hr className="hr"></hr>

        {/* Footer */}
        <div className="as-footer">
          <button className="as-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="as-btn-save" onClick={handleSave} disabled={isLoading || isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>

      </div>
    </div>
  );
}
