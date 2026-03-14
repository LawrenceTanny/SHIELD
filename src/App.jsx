import { useMemo, useState } from "react";
import "./App.css";

const DISASTERS = [
  {
    id: 1,
    type: "Typhoon",
    title: "Tropical Cyclone Wind Signal #2",
    severity: "High",
    city: "Legazpi City",
    source: "PAGASA",
    updatedAt: "2026-03-14 08:30",
    status: "Active"
  },
  {
    id: 2,
    type: "Earthquake",
    title: "Magnitude 5.4",
    severity: "Medium",
    city: "Naga City",
    source: "PHIVOLCS",
    updatedAt: "2026-03-14 09:05",
    status: "Active"
  },
  {
    id: 3,
    type: "Flood",
    title: "Heavy Rainfall Advisory",
    severity: "Low",
    city: "Sorsogon City",
    source: "PAGASA",
    updatedAt: "2026-03-14 10:20",
    status: "Monitoring"
  },
  {
    id: 4,
    type: "Landslide",
    title: "Soil Movement Risk",
    severity: "High",
    city: "Tabaco City",
    source: "Local DRRM",
    updatedAt: "2026-03-14 10:50",
    status: "Active"
  }
];

const NEIGHBOR_CITIES = {
  "Legazpi City": ["Daraga", "Tabaco City", "Guinobatan"],
  "Naga City": ["Pili", "Calabanga", "Canaman"],
  "Sorsogon City": ["Casiguran", "Bulan", "Barcelona"],
  "Tabaco City": ["Legazpi City", "Malilipot", "Tiwi"]
};

function severityClass(level) {
  if (level === "High") return "sev-high";
  if (level === "Medium") return "sev-med";
  return "sev-low";
}

export default function DisasterMonitorApp() {
  const [selectedCity, setSelectedCity] = useState("Legazpi City");
  const [includeNeighbors, setIncludeNeighbors] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);

  const uniqueCities = useMemo(() => {
    const set = new Set(DISASTERS.map((d) => d.city));
    return Array.from(set).sort();
  }, []);

  const watchCities = useMemo(() => {
    if (!includeNeighbors) return [selectedCity];
    const neighbors = NEIGHBOR_CITIES[selectedCity] || [];
    return [selectedCity, ...neighbors];
  }, [selectedCity, includeNeighbors]);

  const myAlerts = useMemo(() => {
    return DISASTERS.filter((d) => watchCities.includes(d.city));
  }, [watchCities]);

  const activeCount = DISASTERS.filter((d) => d.status === "Active").length;
  const highCount = DISASTERS.filter((d) => d.severity === "High").length;

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="kicker">SHIELD Disaster Monitor</p>
          <h1>Philippines Hazard Dashboard</h1>
          <p className="subtitle">
            Real-time awareness for weather, earthquakes, and local hazards.
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <span>Active incidents</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="stat">
            <span>High severity</span>
            <strong>{highCount}</strong>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel controls">
          <h2>Your Alert Preferences</h2>

          <label className="field">
            <span>City / Municipality</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={includeNeighbors}
              onChange={(e) => setIncludeNeighbors(e.target.checked)}
            />
            Include neighboring cities
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={inAppNotif}
              onChange={(e) => setInAppNotif(e.target.checked)}
            />
            In-app notifications
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={emailNotif}
              onChange={(e) => setEmailNotif(e.target.checked)}
            />
            Email notifications
          </label>

          <div className="watchlist">
            <p className="watch-title">Watching</p>
            <div className="chips">
              {watchCities.map((city) => (
                <span key={city} className="chip">
                  {city}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Alerts For You</h2>
          {myAlerts.length === 0 ? (
            <p className="empty">No active alerts in your selected areas.</p>
          ) : (
            <div className="cards">
              {myAlerts.map((item) => (
                <article className="card" key={item.id}>
                  <div className="card-top">
                    <span className={"badge " + severityClass(item.severity)}>
                      {item.severity}
                    </span>
                    <span className="source">{item.source}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p className="meta">
                    {item.type} • {item.city} • {item.status}
                  </p>
                  <p className="time">Updated: {item.updatedAt}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel full">
          <h2>All Active Disasters</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Severity</th>
                  <th>City</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {DISASTERS.map((d) => (
                  <tr key={d.id}>
                    <td>{d.type}</td>
                    <td>{d.title}</td>
                    <td>
                      <span className={"badge " + severityClass(d.severity)}>
                        {d.severity}
                      </span>
                    </td>
                    <td>{d.city}</td>
                    <td>{d.source}</td>
                    <td>{d.status}</td>
                    <td>{d.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Notification channels: {inAppNotif ? "In-app " : ""}
          {emailNotif ? "Email" : ""}
          {!inAppNotif && !emailNotif ? "None selected" : ""}
        </p>
      </footer>
    </div>
  );
}