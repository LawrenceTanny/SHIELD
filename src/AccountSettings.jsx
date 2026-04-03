import { useRef, useState } from "react";
import "./Styles/AccountSettings.css";

export default function AccountSettings({ onClose }) {
  const [photo,         setPhoto]         = useState(null);
  const [displayName,   setDisplayName]   = useState("Juan Dela Cruz");
  const [email]                           = useState("juan@example.com");
  const [receiveAlerts, setReceiveAlerts] = useState(true);
  const [receiveDigest, setReceiveDigest] = useState(false);
  const [newsletter,    setNewsletter]    = useState(false);
  const [smsViaEmail,   setSmsViaEmail]   = useState(false);
  const [oldPw,         setOldPw]         = useState("");
  const [newPw,         setNewPw]         = useState("");
  const [confirmPw,     setConfirmPw]     = useState("");

  const fileRef = useRef(null);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (file) setPhoto(URL.createObjectURL(file));
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

          {/* Profile Photo */}
          <section className="as-section">
            <h3 className="as-section-title">Profile Photo</h3>
            <div className="as-photo-row">
              <div className="as-avatar" onClick={() => fileRef.current.click()} title="Click to change">
                {photo
                  ? <img src={photo} alt="avatar" />
                  : <span>{initials || "?"}</span>
                }
                <div className="as-avatar-overlay">Edit</div>
              </div>
              <div className="as-photo-info">
                <button className="as-btn-outline" onClick={() => fileRef.current.click()}>
                  Change Photo
                </button>
                <p className="as-hint">JPG or PNG, max 2 MB</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handlePhoto}
                hidden
              />
            </div>
          </section>

          <hr className="hr"></hr>

          {/* Profile Info */}
          <section className="as-section">
            <h3 className="as-section-title">Profile</h3>
            <label className="as-field">
              <span>Display Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
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
              <input type="checkbox" checked={receiveAlerts} onChange={(e) => setReceiveAlerts(e.target.checked)} />
              <span>Receive disaster alert emails</span>
            </label>
            <label className="as-toggle">
              <input type="checkbox" checked={receiveDigest} onChange={(e) => setReceiveDigest(e.target.checked)} />
              <span>Receive daily situation digest</span>
            </label>
            <label className="as-toggle">
              <input type="checkbox" checked={smsViaEmail} onChange={(e) => setSmsViaEmail(e.target.checked)} />
              <span>Receive SMS alerts via email gateway</span>
            </label>
            <label className="as-toggle">
              <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
              <span>Subscribe to SHIELD newsletter</span>
            </label>
          </section>

          <hr className="hr"></hr>

          {/* Change Password */}
          <section className="as-section">
            <h3 className="as-section-title">Change Password</h3>
            <label className="as-field">
              <span>Current Password</span>
              <input
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
            <label className="as-field">
              <span>New Password</span>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </label>
            <label className="as-field">
              <span>Confirm New Password</span>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </label>
          </section>

        </div>

        <hr className="hr"></hr>

        {/* Footer */}
        <div className="as-footer">
          <button className="as-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="as-btn-save"   onClick={onClose}>Save Changes</button>
        </div>

      </div>
    </div>
  );
}
