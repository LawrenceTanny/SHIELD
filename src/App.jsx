import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "./Styles/App.css";
import Login from "./Login";
import AccountSettings from "./AccountSettings";

const DISASTERS = [
  { id: 1, type: "Typhoon",           title: "Tropical Cyclone Wind Signal #2", severity: "High",   city: "Legazpi City",  lat: 13.1391, lng: 123.7438, source: "PAGASA",     updatedAt: "2026-03-14 08:30", status: "Active"     },
  { id: 2, type: "Earthquake",        title: "Magnitude 5.4",                   severity: "Medium", city: "Naga City",     lat: 13.6218, lng: 123.1948, source: "PHIVOLCS",   updatedAt: "2026-03-14 09:05", status: "Active"     },
  { id: 3, type: "Flood",             title: "Heavy Rainfall Advisory",         severity: "Low",    city: "Sorsogon City", lat: 12.9716, lng: 124.0053, source: "PAGASA",     updatedAt: "2026-03-14 10:20", status: "Monitoring" },
  { id: 4, type: "Landslide",         title: "Soil Movement Risk",              severity: "High",   city: "Tabaco City",   lat: 13.3587, lng: 123.7338, source: "Local DRRM", updatedAt: "2026-03-14 10:50", status: "Active"     },
  { id: 5, type: "Volcanic Activity", title: "Increased unrest near Kanlaon",  severity: "Medium", city: "Canlaon City",  lat: 10.3865, lng: 123.1966, source: "PHIVOLCS",   updatedAt: "2026-03-14 11:15", status: "Monitoring" },
  { id: 6, type: "Thunderstorm",      title: "Severe thunderstorm warning",     severity: "Low",    city: "Davao City",    lat:  7.1907, lng: 125.4553, source: "PAGASA",     updatedAt: "2026-03-14 11:40", status: "Active"     },
];

const PH_CENTER = [12.8797, 121.774];
const PH_BOUNDS = [[4.0, 114.0], [22.5, 129.0]];

function severityClass(lvl) {
  if (lvl === "High")   return "sev-high";
  if (lvl === "Medium") return "sev-med";
  return "sev-low";
}
function severityColor(lvl) {
  if (lvl === "High")   return "#ff4d6d";
  if (lvl === "Medium") return "#ffd166";
  return "#06d6a0";
}

function MapController({ focused }) {
  const map = useMap();
  useEffect(() => {
    if (focused) map.flyTo([focused.lat, focused.lng], 10, { animate: true, duration: 0.8 });
  }, [focused, map]);
  return null;
}

function IconGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export default function App() {
  const [focusedId,     setFocusedId]     = useState(null);
  const [settingsOpen,  setSettingsOpen]  = useState(false);
  const [userMenuOpen,  setUserMenuOpen]  = useState(false);
  const [loginOpen,       setLoginOpen]       = useState(false);
  const [acctSettingsOpen,setAcctSettingsOpen] = useState(false);
  const [inAppNotif,    setInAppNotif]    = useState(true);
  const [emailNotif,    setEmailNotif]    = useState(false);
  const [smsNotif,      setSmsNotif]      = useState(false);
  const [inclNeighbors, setInclNeighbors] = useState(true);
  const [selType,       setSelType]       = useState("All");
  const [selSev,        setSelSev]        = useState("All");

  const userRef = useRef(null);

  const typeOptions = useMemo(() => {
    const s = new Set(DISASTERS.map((d) => d.type));
    return ["All", ...Array.from(s).sort()];
  }, []);

  const filtered = useMemo(() => DISASTERS.filter((d) => {
    const tOk = selType === "All" || d.type     === selType;
    const sOk = selSev  === "All" || d.severity === selSev;
    return tOk && sOk;
  }), [selType, selSev]);

  const focused = useMemo(() => filtered.find((d) => d.id === focusedId), [filtered, focusedId]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const h = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [userMenuOpen]);

  const toggle = (id) => setFocusedId((p) => (p === id ? null : id));

  return (
    <div className="app">

      {/* HEADER */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">SHIELD</span>
          <span className="brand-sep" />
          <span className="brand-sub">Synchronized Hazard Information &amp; Emergency Live Dashboard</span>
        </div>
        <nav className="topbar-nav">
          <button
            className={"nav-btn" + (settingsOpen ? " nav-btn--on" : "")}
            title="Settings"
            onClick={() => { setSettingsOpen((v) => !v); setUserMenuOpen(false); }}
          >
            <IconGear />
          </button>
          <div className="user-wrap" ref={userRef}>
            <button
              className={"nav-btn" + (userMenuOpen ? " nav-btn--on" : "")}
              title="Account"
              onClick={() => { setUserMenuOpen((v) => !v); setSettingsOpen(false); }}
            >
              <IconUser />
            </button>
            {userMenuOpen && (
              <div className="user-dropdown">
                <p className="user-hint">Not signed in</p>
                <button className="user-signin-btn" onClick={() => { setUserMenuOpen(false); setLoginOpen(true); }}>Sign In</button>
                <button className="user-acct-btn"   onClick={() => { setUserMenuOpen(false); setAcctSettingsOpen(true); }}>Account Settings</button>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* CONTENT */}
      <div className="content">

        {/* DANGERS PANEL */}
        <aside className="danger-panel">
          <div className="danger-head">
            <h2>Active Dangers</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>
          <ul className="danger-list">
            {filtered.map((d) => (
              <li
                key={d.id}
                className={"danger-item" + (d.id === focusedId ? " is-focused" : "")}
                onClick={() => toggle(d.id)}
              >
                <div className="di-row">
                  <span className={"badge " + severityClass(d.severity)}>{d.severity}</span>
                  <span className="di-source">{d.source}</span>
                </div>
                <p className="di-title">{d.title}</p>
                <p className="di-meta">{d.type} &middot; {d.city} &middot; <em>{d.status}</em></p>
                <p className="di-time">{d.updatedAt}</p>
              </li>
            ))}
          </ul>
        </aside>

        {/* MAP */}
        <main className="map-wrap">
          <MapContainer
            center={PH_CENTER}
            zoom={6}
            minZoom={5}
            maxBounds={PH_BOUNDS}
            maxBoundsViscosity={1}
            scrollWheelZoom
            className="map-canvas"
          >
            <MapController focused={focused} />
            <TileLayer
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {filtered.map((item) => {
              const isFoc = item.id === focusedId;
              return (
                <CircleMarker
                  key={item.id}
                  center={[item.lat, item.lng]}
                  radius={isFoc ? 13 : 8}
                  pathOptions={{
                    color: severityColor(item.severity),
                    fillColor: severityColor(item.severity),
                    fillOpacity: isFoc ? 1 : 0.78,
                    weight: isFoc ? 3 : 1.5,
                  }}
                  eventHandlers={{ click: () => toggle(item.id) }}
                >
                  <Popup>
                    <strong>{item.title}</strong><br />
                    {item.type} &middot; {item.city}<br />
                    Severity: <b>{item.severity}</b><br />
                    Source: {item.source}<br />
                    <span style={{ opacity: 0.7, fontSize: "0.82em" }}>{item.updatedAt}</span>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <p>&#169; 2026 SHIELD &mdash; Placeholder footer</p>
      </footer>

      {/* SETTINGS DRAWER */}
      <aside className={"settings-drawer" + (settingsOpen ? " settings-drawer--open" : "")}>
        <div className="settings-head">
          <h3>Settings</h3>
          <button className="icon-btn" onClick={() => setSettingsOpen(false)}><IconX /></button>
        </div>
        <section className="settings-section">
          <p className="settings-label">Notifications</p>
          <label className="settings-toggle">
            <input type="checkbox" checked={inAppNotif}    onChange={(e) => setInAppNotif(e.target.checked)}    /> In-app alerts
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={emailNotif}    onChange={(e) => setEmailNotif(e.target.checked)}    /> Email alerts
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={smsNotif}      onChange={(e) => setSmsNotif(e.target.checked)}      /> SMS alerts
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={inclNeighbors} onChange={(e) => setInclNeighbors(e.target.checked)} /> Include neighboring cities
          </label>
        </section>
        <section className="settings-section">
          <p className="settings-label">Filter Dangers</p>
          <label className="settings-field">
            <span>Disaster Type</span>
            <select value={selType} onChange={(e) => setSelType(e.target.value)}>
              {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="settings-field">
            <span>Severity</span>
            <select value={selSev} onChange={(e) => setSelSev(e.target.value)}>
              {["All", "High", "Medium", "Low"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </section>
      </aside>
      {settingsOpen && <div className="settings-backdrop" onClick={() => setSettingsOpen(false)} />}

      {loginOpen        && <Login            onClose={() => setLoginOpen(false)}        />}
      {acctSettingsOpen && <AccountSettings  onClose={() => setAcctSettingsOpen(false)} />}

    </div>
  );
}
