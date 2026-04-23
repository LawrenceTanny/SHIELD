import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { AttributionControl } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import "./Styles/Dashboard.css";

const FALLBACK_DISASTERS = [
  { id: 1, type: "Typhoon", title: "Tropical Cyclone Wind Signal #2", severity: "High", city: "Legazpi City", lat: 13.1391, lng: 123.7438, source: "PAGASA", updatedAt: "2026-03-14 08:30", status: "Active" },
  { id: 2, type: "Earthquake", title: "Magnitude 5.4", severity: "Medium", city: "Naga City", lat: 13.6218, lng: 123.1948, source: "PHIVOLCS", updatedAt: "2026-03-14 09:05", status: "Active" },
  { id: 3, type: "Flood", title: "Heavy Rainfall Advisory", severity: "Low", city: "Sorsogon City", lat: 12.9716, lng: 124.0053, source: "PAGASA", updatedAt: "2026-03-14 10:20", status: "Monitoring" },
  { id: 4, type: "Landslide", title: "Soil Movement Risk", severity: "High", city: "Tabaco City", lat: 13.3587, lng: 123.7338, source: "Local DRRM", updatedAt: "2026-03-14 10:50", status: "Active" },
  { id: 5, type: "Volcanic Activity", title: "Increased unrest near Kanlaon", severity: "Medium", city: "Canlaon City", lat: 10.3865, lng: 123.1966, source: "PHIVOLCS", updatedAt: "2026-03-14 11:15", status: "Monitoring" },
  { id: 6, type: "Thunderstorm", title: "Severe thunderstorm warning", severity: "Low", city: "Davao City", lat: 7.1907, lng: 125.4553, source: "PAGASA", updatedAt: "2026-03-14 11:40", status: "Active" }
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://shield-app-wmz37.ondigitalocean.app";
const OWM_CLOUDS_TILE_URL = `${API_BASE_URL}/api/weather/clouds-tile/{z}/{x}/{y}.png`;

const PH_CENTER = [12.8797, 121.774];
const PH_BOUNDS = [[4.0, 114.0], [22.5, 129.0]];
const OPEN_METEO_FALLBACK_URL = `https://api.open-meteo.com/v1/forecast?latitude=${PH_CENTER[0]}&longitude=${PH_CENTER[1]}&current=temperature_2m,weather_code&timezone=Asia%2FManila`;

function severityColor(lvl) {
  if (lvl === "High") return "#FD694F";
  if (lvl === "Medium") return "#FDCE4F";
  return "#6AB144";
}

function IconSettings() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" /></svg>
  );
}

function IconClose() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" /></svg>
  );
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

function normalizeWeatherIcon(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[0-9]{2}[dn]$/i.test(raw)) {
    return `https://openweathermap.org/img/wn/${raw.toLowerCase()}@2x.png`;
  }
  return null;
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
      const iconValue = pickValue(entry, ["icon", "icon_url", "weather_icon", "weatherIcon"], null);
      const iconUrl = normalizeWeatherIcon(iconValue);

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
        iconUrl,
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

function summarizePhilippinesWeather(stations) {
  if (!Array.isArray(stations) || stations.length === 0) return null;

  const validTemps = stations
    .map((station) => toNumber(station.tempC))
    .filter((value) => value !== null);

  const tempC = validTemps.length > 0
    ? validTemps.reduce((sum, value) => sum + value, 0) / validTemps.length
    : null;

  const conditionCounts = new Map();
  for (const station of stations) {
    const condition = String(station.condition || "").trim();
    if (!condition) continue;
    conditionCounts.set(condition, (conditionCounts.get(condition) || 0) + 1);
  }

  let topCondition = "Weather";
  let topCount = -1;
  for (const [condition, count] of conditionCounts.entries()) {
    if (count > topCount) {
      topCondition = condition;
      topCount = count;
    }
  }

  const iconStation = stations.find((station) =>
    station.iconUrl && String(station.condition || "").trim() === topCondition
  ) || stations.find((station) => station.iconUrl) || null;

  return {
    tempC,
    condition: topCondition,
    iconUrl: iconStation?.iconUrl || null,
  };
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

function formatDisasterLocation(city, province) {
  const cityText = String(city || "Unknown location").trim();
  const provinceText = String(province || "").trim();

  if (!provinceText) return cityText;
  if (cityText.toLowerCase().includes(provinceText.toLowerCase())) return cityText;
  return `${cityText}, ${provinceText}`;
}

export default function Dashboard({ theme = "light", settingsOpen, setSettingsOpen }) {
  const skeletonRows = [1, 2, 3, 4];
  const dangerPanelRef = useRef(null);
  const dangerHeadRef = useRef(null);
  const dangerListRef = useRef(null);
  const dragStateRef = useRef({
    active: false,
    startY: 0,
    startHeight: 0,
    collapsedHeight: 0,
    expandedHeight: 0,
  });
  const [disasters, setDisasters] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [weatherStations, setWeatherStations] = useState([]);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [focusedId, setFocusedId] = useState(null);
  const [showCloudLayer, setShowCloudLayer] = useState(false);
  const [cloudLayerAvailable, setCloudLayerAvailable] = useState(false);
  const [selType, setSelType] = useState("All");
  const [selSev, setSelSev] = useState("All");
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(null);

  const mapTileUrl = theme === "light"
    ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateSheetMode = () => {
      setIsMobileSheet(window.innerWidth < 640);
    };

    updateSheetMode();
    window.addEventListener("resize", updateSheetMode);

    return () => window.removeEventListener("resize", updateSheetMode);
  }, []);

  const clampSheetHeight = (nextHeight) => {
    const { collapsedHeight, expandedHeight } = dragStateRef.current;
    return Math.min(expandedHeight, Math.max(collapsedHeight, nextHeight));
  };

  const handleDangerDragStart = (event) => {
    if (!isMobileSheet) return;

    const panel = dangerPanelRef.current;
    if (!panel) return;

    dragStateRef.current.active = true;
    dragStateRef.current.startY = event.clientY;
    dragStateRef.current.startHeight = sheetHeight ?? panel.getBoundingClientRect().height;

    if (event.currentTarget?.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
  };

  const handleDangerDragMove = (event) => {
    if (!dragStateRef.current.active) return;

    const deltaY = dragStateRef.current.startY - event.clientY;
    setSheetHeight(clampSheetHeight(dragStateRef.current.startHeight + deltaY));
  };

  const handleDangerDragEnd = (event) => {
    if (!dragStateRef.current.active) return;

    dragStateRef.current.active = false;
    const { collapsedHeight, expandedHeight } = dragStateRef.current;
    const midpoint = (collapsedHeight + expandedHeight) / 2;
    const currentHeight = sheetHeight ?? dragStateRef.current.startHeight;
    setSheetHeight(currentHeight >= midpoint ? expandedHeight : collapsedHeight);

    if (event.currentTarget?.releasePointerCapture) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore pointer-capture cleanup failures on mobile browsers.
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    const fetchDisasters = async () => {
      const maxAttempts = 3;
      const retryDelayMs = 900;

      try {
        setIsLoadingData(true);
        setDataError("");

        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          if (controller.signal.aborted) return;

          try {
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
                    province: item.province || "",
                    lat,
                    lng,
                    source: item.source || "Unknown source",
                    updatedAt: item.updatedAt || "N/A",
                    status: item.status || "Active",
                  };
                })
                .filter(Boolean)
              : [];

            // if (normalized.length === 0) {
            //   throw new Error("Disaster API returned empty data.");
            // }

            setDisasters(normalized);
            setDataError("");
            return;
          } catch (error) {
            if (error.name === "AbortError") return;
            lastError = error;
          }

          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          }
        }

        console.error("Error loading disasters after retries:", lastError);
        setDataError("Could not load live disasters. Showing fallback data.");
        setDisasters(FALLBACK_DISASTERS);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Error loading disasters:", error);
          setDataError("Could not load live disasters. Showing fallback data.");
          setDisasters(FALLBACK_DISASTERS);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingData(false);
        }
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
        setCloudLayerAvailable(Boolean(payload?.cloudsLayerAvailable));

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
              setCloudLayerAvailable(false);
            }
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingWeather(false);
        }
      }
    };

    fetchWeather();

    return () => {
      controller.abort();
    };
  }, []);

const DEFAULT_TYPES = [
  "Earthquake",
  "Typhoon",
  "Flood",
  "Landslide",
  "Volcanic Activity",
  "Thunderstorm",
  "Wildfire"
];

const typeOptions = useMemo(() => {
  const dynamic = new Set(disasters.map((d) => d.type));
  const combined = new Set([...DEFAULT_TYPES, ...dynamic]);
  return ["All", ...Array.from(combined).sort()];
}, [disasters]);

const filtered = useMemo(() => disasters.filter((d) => {
  const tOk =
    selType === "All" ||
    d.type?.toLowerCase() === selType.toLowerCase();

  const sOk =
    selSev === "All" ||
    d.severity?.toLowerCase() === selSev.toLowerCase();

  return tOk && sOk;
}), [disasters, selType, selSev]);

  useEffect(() => {
    if (!isMobileSheet || typeof window === "undefined") {
      setSheetHeight(null);
      return undefined;
    }

    const headHeight = dangerHeadRef.current?.getBoundingClientRect().height || 56;
    const listHeight = dangerListRef.current?.scrollHeight || 0;
    const viewportHeight = window.innerHeight;
    const availableHeight = Math.max(240, viewportHeight - 65 - 36 - 20);
    const collapsedHeight = Math.min(Math.max(214, viewportHeight * 0.32), availableHeight * 0.6);
    const expandedHeight = Math.min(availableHeight, Math.max(headHeight + listHeight + 16, collapsedHeight));

    dragStateRef.current.collapsedHeight = collapsedHeight;
    dragStateRef.current.expandedHeight = expandedHeight;

    setSheetHeight((currentHeight) => {
      const nextHeight = currentHeight === null ? collapsedHeight : currentHeight;
      return Math.min(expandedHeight, Math.max(collapsedHeight, nextHeight));
    });
  }, [isMobileSheet, disasters.length, isLoadingData, dataError]);

  const focused = useMemo(() => filtered.find((d) => d.id === focusedId), [filtered, focusedId]);

  const weatherDisplay = useMemo(() => {
    if (isLoadingWeather) {
      return { tempText: "--", condition: "Loading...", iconUrl: null };
    }

    const summary = summarizePhilippinesWeather(weatherStations);
    if (!summary) {
      return { tempText: "--", condition: weatherError || "Unavailable", iconUrl: null };
    }

    return {
      tempText: summary.tempC !== null ? `${Math.round(summary.tempC)}C` : "--",
      condition: summary.condition || "Weather",
      iconUrl: summary.iconUrl,
    };
  }, [isLoadingWeather, weatherError, weatherStations]);

  const weatherStackStyle = isMobileSheet
    ? {
      bottom: `calc(max(8px, env(safe-area-inset-bottom)) + ${(sheetHeight ?? dragStateRef.current.collapsedHeight ?? 0) + 8}px)`,
    }
    : undefined;

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
        {settingsOpen ? <IconClose /> : <IconSettings />}

      </button>
      <div className="content">
        <aside
          ref={dangerPanelRef}
          className="danger-panel"
          style={isMobileSheet && sheetHeight ? { height: `${sheetHeight}px` } : undefined}
        >
          <div
            ref={dangerHeadRef}
            className="danger-head"
            onPointerDown={handleDangerDragStart}
            onPointerMove={handleDangerDragMove}
            onPointerUp={handleDangerDragEnd}
            onPointerCancel={handleDangerDragEnd}
          >
            <h2>Active Dangers</h2>
            <span className="count-pill">
              {isLoadingData ? "--" : filtered.length || 0}
              </span>
          </div>
          <hr className="hr"></hr>
          <ul ref={dangerListRef} className="danger-list">
            {isLoadingData && (
              skeletonRows.map((row) => (
                <li key={row} className="danger-item danger-item-skeleton" aria-hidden="true">
                  <div className="skeleton-line skeleton-line-title" />
                  <div className="skeleton-line skeleton-line-meta" />
                  <div className="skeleton-line skeleton-line-time" />
                </li>
              ))
            )}
            {!isLoadingData && dataError && disasters.length === 0 && (
              <li className="danger-item" style={{ minHeight: "auto" }}>
                {dataError}
              </li>
            )}
            {!isLoadingData && filtered.length === 0 && (
              <li className="danger-item-empty" style={{ minHeight: "auto" }}>
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
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.98 }}
                  className={`danger-item sev-${d.severity.toLowerCase()} type-${d.type.toLowerCase().replace(/\s+/g, '-')} ${focusedId === d.id ? 'is-focused' : ''}`}
                  onClick={() => toggle(d.id)}
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
                      <p className="di-meta">{formatDisasterLocation(d.city, d.province)}</p>
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
          <div className="weather-stack" style={weatherStackStyle}>
            <button
              type="button"
              className={`map-layer-toggle${showCloudLayer && cloudLayerAvailable ? " layer-on" : ""}`}
              onClick={() => setShowCloudLayer((prev) => !prev)}
              disabled={!cloudLayerAvailable}
              title={cloudLayerAvailable ? "Toggle cloud map overlay" : "Cloud overlay unavailable (check backend OPENWEATHERMAP_API_KEY)"}
            >
              {showCloudLayer ? "Clouds: ON" : "Clouds: OFF"}
            </button>
            <div className="weather-badge" aria-live="polite">
              {weatherDisplay.iconUrl && (
                <img
                  className="weather-icon"
                  src={weatherDisplay.iconUrl}
                  alt={weatherDisplay.condition}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              )}
              <div className="weather-temp">{weatherDisplay.tempText}</div>
              <div className="weather-condition">{weatherDisplay.condition}</div>
            </div>
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
            <MapController focused={focused} />
            <TileLayer
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              url={mapTileUrl}
            />
            {showCloudLayer && cloudLayerAvailable && (
              <TileLayer
                attribution='&copy; OpenWeather'
                url={OWM_CLOUDS_TILE_URL}
                opacity={theme === "light" ? 0.88 : 0.65}
                className={theme === "light" ? "cloud-layer cloud-layer--light" : "cloud-layer"}
              />
            )}
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
                        {formatDisasterLocation(item.city, item.province)} • {item.source}
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
          <h3>Disaster Settings</h3>
        </div>
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
