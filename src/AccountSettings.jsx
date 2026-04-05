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
  const [receiveAlerts, setReceiveAlerts] = useState(true);
  const [newsletter, setNewsletter] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [messageType, setMessageType] = useState("neutral");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
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

    setIsSaving(true);
    setStatusMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: displayName.trim(),
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
              <span>Subscribe to SHIELD newsletter</span>
            </label>
          </section>

        </div>

        <hr className="hr"></hr>

        {/* Footer */}
        <div className="as-footer">
          <button className="as-btn-signout" onClick={handleSignOutClick}>
            Sign Out
          </button>
          <button className="as-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="as-btn-save" onClick={handleSave} disabled={isLoading || isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>

      </div>
    </div>
  );
}
