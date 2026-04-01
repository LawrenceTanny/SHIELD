import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { AttributionControl, ZoomControl } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import "./Styles/Dashboard.css";

const FALLBACK_DISASTERS = [
  { id: 1, type: "Typhoon",           title: "Tropical Cyclone Wind Signal #2", severity: "High",   city: "Legazpi City",  lat: 13.1391, lng: 123.7438, source: "PAGASA",     updatedAt: "2026-03-14 08:30", status: "Active"     },
  { id: 2, type: "Earthquake",        title: "Magnitude 5.4",                   severity: "Medium", city: "Naga City",     lat: 13.6218, lng: 123.1948, source: "PHIVOLCS",   updatedAt: "2026-03-14 09:05", status: "Active"     },
  { id: 3, type: "Flood",             title: "Heavy Rainfall Advisory",         severity: "Low",    city: "Sorsogon City", lat: 12.9716, lng: 124.0053, source: "PAGASA",     updatedAt: "2026-03-14 10:20", status: "Monitoring" },
  { id: 4, type: "Landslide",         title: "Soil Movement Risk",              severity: "High",   city: "Tabaco City",   lat: 13.3587, lng: 123.7338, source: "Local DRRM", updatedAt: "2026-03-14 10:50", status: "Active"     },
  { id: 5, type: "Volcanic Activity", title: "Increased unrest near Kanlaon",  severity: "Medium", city: "Canlaon City",  lat: 10.3865, lng: 123.1966, source: "PHIVOLCS",   updatedAt: "2026-03-14 11:15", status: "Monitoring" },
  { id: 6, type: "Thunderstorm",      title: "Severe thunderstorm warning",     severity: "Low",    city: "Davao City",    lat:  7.1907, lng: 125.4553, source: "PAGASA",     updatedAt: "2026-03-14 11:40", status: "Active"     }
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://shield-app-wmz37.ondigitalocean.app";

const PH_CENTER = [12.8797, 121.774];
const PH_BOUNDS = [[4.0, 114.0], [22.5, 129.0]];
const OPEN_METEO_FALLBACK_URL = `https://api.open-meteo.com/v1/forecast?latitude=${PH_CENTER[0]}&longitude=${PH_CENTER[1]}&current=temperature_2m,weather_code&timezone=Asia%2FManila`;

function severityColor(lvl) {
  if (lvl === "High")   return "#FD694F";
  if (lvl === "Medium") return "#FDCE4F";
  return "#6AB144";
}

function MapController({ focused }) {
  const map = useMap();
  useEffect(() => {
    if (focused) map.flyTo([focused.lat, focused.lng], 10, { animate: true, duration: 0.8 });
  }, [focused, map]);
  return null;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickValue(object, keys, fallback = null) {
  if (!object || typeof object !== "object") return fallback;
  for (const key of keys) {
    const value = object[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return fallback;
}

function normalizeWeatherStations(payload) {
  const candidates = [];

  if (Array.isArray(payload)) candidates.push(...payload);
  if (Array.isArray(payload?.data)) candidates.push(...payload.data);
  if (Array.isArray(payload?.stations)) candidates.push(...payload.stations);
  if (Array.isArray(payload?.features)) {
    payload.features.forEach((feature) => {
      if (feature?.properties) {
        candidates.push({
          ...feature.properties,
          lat: feature?.geometry?.coordinates?.[1],
          lng: feature?.geometry?.coordinates?.[0],
        });
      }
    });
  }

  return candidates
    .map((entry, index) => {
      const lat = toNumber(pickValue(entry, ["lat", "latitude", "station_lat", "station_latitude"]));
      const lng = toNumber(pickValue(entry, ["lng", "lon", "long", "longitude", "station_lon", "station_longitude"]));
      const tempC = toNumber(pickValue(entry, ["temp_c", "temperature", "temperature_c", "air_temp", "air_temperature", "t2m", "temp"]));
      const rainfall = toNumber(pickValue(entry, ["rain", "rainfall", "rain_1h", "rainfall_1h", "precipitation"]));
      const conditionRaw = pickValue(entry, ["weather", "condition", "weather_condition", "summary", "description"], "");

      let condition = String(conditionRaw || "").trim();
      if (!condition) {
        if (rainfall && rainfall > 0) condition = "Rainy";
        else if (tempC !== null && tempC >= 35) condition = "Hot";
        else if (tempC !== null && tempC >= 30) condition = "Sunny";
        else condition = "Cloudy";
      }

      return {
        id: String(pickValue(entry, ["id", "station_id", "name"], `station-${index}`)),
        name: String(pickValue(entry, ["name", "station_name", "station"], "PAGASA Station")),
        city: String(pickValue(entry, ["city", "municipality", "location", "province"], "Philippines")),
        lat,
        lng,
        tempC,
        condition,
      };
    })
    .filter((station) => station.tempC !== null || station.condition);
}

function selectWeatherStation(stations, focused) {
  if (!Array.isArray(stations) || stations.length === 0) return null;

  if (focused) {
    const withCoords = stations.filter((station) => station.lat !== null && station.lng !== null);
    if (withCoords.length > 0) {
      let closest = withCoords[0];
      let bestDistance = Infinity;

      for (const station of withCoords) {
        const dLat = focused.lat - station.lat;
        const dLng = focused.lng - station.lng;
        const distanceSq = dLat * dLat + dLng * dLng;
        if (distanceSq < bestDistance) {
          bestDistance = distanceSq;
          closest = station;
        }
      }
      return closest;
    }

    const cityNeedle = String(focused.city || "").toLowerCase();
    const byCity = stations.find((station) => {
      const city = String(station.city || "").toLowerCase();
      const name = String(station.name || "").toLowerCase();
      return cityNeedle && (city.includes(cityNeedle) || name.includes(cityNeedle));
    });
    if (byCity) return byCity;
  }

  return stations[0];
}

function weatherCodeToCondition(code) {
  if (code === 0) return "Sunny";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rainy";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Weather";
}

export default function Dashboard({ settingsOpen, setSettingsOpen }) {
  const [disasters,     setDisasters]     = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError,     setDataError]     = useState("");
  const [weatherStations, setWeatherStations] = useState([]);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [focusedId,     setFocusedId]     = useState(null);
  const [inAppNotif,    setInAppNotif]    = useState(true);
  const [emailNotif,    setEmailNotif]    = useState(false);
  const [smsNotif,      setSmsNotif]      = useState(false);
  const [inclNeighbors, setInclNeighbors] = useState(true);
  const [selType,       setSelType]       = useState("All");
  const [selSev,        setSelSev]        = useState("All");

  useEffect(() => {
    const controller = new AbortController();

    const fetchDisasters = async () => {
      try {
        setIsLoadingData(true);
        setDataError("");

        const response = await fetch(`${API_BASE_URL}/api/disasters`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch disasters: ${response.status}`);
        }

        const payload = await response.json();
        const normalized = Array.isArray(payload)
          ? payload
              .map((item, index) => {
                const lat = Number(item.lat);
                const lng = Number(item.lng);

                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                  return null;
                }

                return {
                  id: item.id || `${item.type || "disaster"}-${index}`,
                  type: item.type || "General Disaster",
                  title: item.title || "Disaster Update",
                  severity: item.severity || "Low",
                  city: item.city || "Unknown location",
                  lat,
                  lng,
                  source: item.source || "Unknown source",
                  updatedAt: item.updatedAt || "N/A",
                  status: item.status || "Active",
                };
              })
              .filter(Boolean)
          : [];

        setDisasters(normalized);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Error loading disasters:", error);
          setDataError("Could not load live disasters. Showing fallback data.");
          setDisasters(FALLBACK_DISASTERS);
        }
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchDisasters();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchWeather = async () => {
      try {
        setIsLoadingWeather(true);
        setWeatherError("");

        const response = await fetch(`${API_BASE_URL}/api/weather`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch weather: ${response.status}`);
        }

        const payload = await response.json();
        const stations = normalizeWeatherStations(payload);
        setWeatherStations(stations);

        if (stations.length === 0) {
          setWeatherError("No weather data available.");
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          try {
            const backupResponse = await fetch(OPEN_METEO_FALLBACK_URL, {
              signal: controller.signal,
            });

            if (!backupResponse.ok) {
              throw new Error(`Fallback weather failed: ${backupResponse.status}`);
            }

            const backupPayload = await backupResponse.json();
            const current = backupPayload?.current || {};
            const fallbackTemp = toNumber(current.temperature_2m);
            const weatherCode = Number(current.weather_code);

            setWeatherStations([
              {
                id: "open-meteo-fallback",
                name: "Open-Meteo",
                city: "Philippines",
                lat: PH_CENTER[0],
                lng: PH_CENTER[1],
                tempC: fallbackTemp,
                condition: weatherCodeToCondition(weatherCode),
              },
            ]);
            setWeatherError("");
          } catch (backupError) {
            if (backupError.name !== "AbortError") {
              setWeatherError("Weather unavailable");
            }
          }
        }
      } finally {
        setIsLoadingWeather(false);
      }
    };

    fetchWeather();

    return () => {
      controller.abort();
    };
  }, []);

  const typeOptions = useMemo(() => {
    const s = new Set(disasters.map((d) => d.type));
    return ["All", ...Array.from(s).sort()];
  }, [disasters]);

  const filtered = useMemo(() => disasters.filter((d) => {
    const tOk = selType === "All" || d.type     === selType;
    const sOk = selSev  === "All" || d.severity === selSev;
    return tOk && sOk;
  }), [disasters, selType, selSev]);

  const focused = useMemo(() => filtered.find((d) => d.id === focusedId), [filtered, focusedId]);

  const weatherDisplay = useMemo(() => {
    if (isLoadingWeather) {
      return { tempText: "--", condition: "Loading...", location: "PAGASA" };
    }

    const station = selectWeatherStation(weatherStations, focused);
    if (!station) {
      return { tempText: "--", condition: weatherError || "Unavailable", location: "PAGASA" };
    }

    return {
      tempText: station.tempC !== null ? `${Math.round(station.tempC)}C` : "--",
      condition: station.condition || "Weather",
      location: station.city || station.name || "PAGASA",
    };
  }, [focused, isLoadingWeather, weatherError, weatherStations]);

  useEffect(() => {
    if (focusedId !== null && !filtered.some((d) => d.id === focusedId)) {
      setFocusedId(null);
    }
  }, [filtered, focusedId]);

  const toggle = (id) => setFocusedId((p) => (p === id ? null : id));

  return (
    <div className="dashboard-wrapper">
      <button
        type="button"
        className={`dashboard-settings-btn${settingsOpen ? " is-open" : ""}`}
        onClick={() => setSettingsOpen((v) => !v)}
        aria-expanded={settingsOpen}
        aria-controls="dashboard-settings-drawer"
      >
        {settingsOpen ? "Close Settings" : "Settings"}
      </button>

      {/* CONTENT - Map and Danger Panel */}
      <div className="content">

        {/* DANGERS PANEL */}
        <aside className="danger-panel">
          <div className="danger-head">
            <h2>Active Dangers</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>
          <hr className="hr"></hr>
          <ul className="danger-list">
            {isLoadingData && (
              <li className="danger-item" style={{ minHeight: "auto" }}>
                Loading live disasters...
              </li>
            )}
            {!isLoadingData && dataError && (
              <li className="danger-item" style={{ minHeight: "auto" }}>
                {dataError}
              </li>
            )}
            {!isLoadingData && filtered.length === 0 && !dataError && (
              <li className="danger-item" style={{ minHeight: "auto" }}>
                No active disasters found right now.
              </li>
            )}
            <AnimatePresence mode="popLayout">
              
              {!isLoadingData && filtered.map((d) => (
                <motion.li 
                  key={d.id} 
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  whileHover={{ 
                    y: -5, 
                    backgroundColor: "#E2E2E2", 
                    transition: { duration: 0.2 } 
                  }}
                  whileTap={{ scale: 0.98 }}
                  className={`danger-item sev-${d.severity.toLowerCase()} type-${d.type.toLowerCase().replace(/\s+/g, '-')} ${focusedId === d.id ? 'is-focused' : ''}`}
                  onClick={() => toggle(d.id)}
                  style={{
                    backgroundColor: focusedId === d.id ? "rgba(116, 116, 116, 0.09)" : "#D9D9D9"
                  }}
                >
                <div className="di-content-wrapper">
                  <div className="di-row">
                    <h3 className="di-title">{d.title}</h3>
                    <span className="di-source">{d.source}</span>
                  </div>
                  <div className="di-meta-row">
                    {/* The status dot */}
                    <span className={`status-dot ${d.status.toLowerCase()}`}></span>
                    {/* The city text */}
                    <p className="di-meta">{d.city}</p>
                  </div>

                  <div className="di-time-row">
                    <span className="di-time">{d.updatedAt}</span>
                  </div>
                </div>
                
              </motion.li>
            ))}
            </AnimatePresence>
          </ul>
        </aside>

        {/* MAP */}
        <main className="map-wrap">
          <div className="weather-badge" aria-live="polite">
            <div className="weather-temp">{weatherDisplay.tempText}</div>
            <div className="weather-condition">{weatherDisplay.condition}</div>
            <div className="weather-location">{weatherDisplay.location}</div>
          </div>
          <MapContainer
            attributionControl={false}
            zoomControl={false}
            center={PH_CENTER}
            zoom={6}
            minZoom={5}
            maxBounds={PH_BOUNDS}
            maxBoundsViscosity={1}
            scrollWheelZoom
            className="map-canvas"
          >
            <AttributionControl position="bottomleft" prefix={false} />
            <ZoomControl position="bottomright" />
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
                  <Popup className="custom-popup">
                  <div style={{ color: '#D9D9D9', fontFamily: 'Geist' }}>
                    <h4 style={{ margin: 0, color: severityColor(item.severity) }}>
                      {item.type.toUpperCase()}
                    </h4>
                    <p style={{ fontSize: '1.1rem', fontWeight: '400', margin: '5px 0' }}>
                      {item.title}
                    </p>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                      {item.city} • {item.source}
                    </div>
                  </div>
                </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </main>
      </div>

      {/* SETTINGS DRAWER */}
      <aside id="dashboard-settings-drawer" className={"settings-drawer" + (settingsOpen ? " settings-drawer--open" : "")}>
        <div className="settings-head">
          <h3>Settings</h3>
        </div>
        <hr className="hr-settings"></hr>
        <section className="settings-section">
          <p className="settings-label">Notifications</p>
          <label className="settings-toggle">
            <input type="checkbox" checked={inAppNotif} onChange={(e) => setInAppNotif(e.target.checked)} /> In-app alerts
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} /> Email alerts
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={smsNotif} onChange={(e) => setSmsNotif(e.target.checked)} /> SMS alerts
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={inclNeighbors} onChange={(e) => setInclNeighbors(e.target.checked)} /> Include neighboring cities
          </label>
        </section>
        <hr className="hr-settings"></hr>
        <section className="settings-section">
          <div className="filter-group">
            <span className="settings-label">Disaster Type</span>
            <div className="filter-list">
              {typeOptions.map((t) => (
                <button
                  key={t}
                  className={`filter-item ${selType === t ? "active" : ""} type-${t.toLowerCase()}`}
                  onClick={() => setSelType(t)}
                >
                  {t !== "All" && (
                    <span className={`filter-indicator type-${t.toLowerCase().replace(/\s+/g, "-")}`} />
                  )}
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="settings-label">Severity</span>
            <div className="filter-list">
              {["All", "High", "Medium", "Low"].map((s) => (
                <button
                  key={s}
                  className={`filter-item ${selSev === s ? "active" : ""}`}
                  onClick={() => setSelSev(s)}
                >
                  {s !== "All" && <span className={`severity-dot dot-${s.toLowerCase()}`} />}
                  {s}
                </button>
              ))}
            </div>
          </div>
        </section>
      </aside>

      {settingsOpen && (
        <div
          className={`settings-backdrop ${settingsOpen ? "active" : ""}`}
          onClick={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
