import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./Styles/Header.css";
import Dashboard from "./Dashboard";
import AboutUs from "./AboutUs";
import HomeContent from "./Home.jsx";
import NewsReport from "./NewsReport.jsx";
import Login from "./Login";
import AccountSettings from "./AccountSettings";
import Footer from "./Footer";
import Preparedness from "./Preparedness.jsx";

const TAB_STORAGE_KEY = "shield.activeTab";
const THEME_STORAGE_KEY = "shield.theme";
const ALLOWED_TABS = new Set(["home", "dashboard", "news", "about"]);

function normalizeTheme(value) {
  return value === "dark" ? "dark" : "light";
}

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

function getInitialTab() {
  if (typeof window === "undefined") return "home";
  const savedTab = window.localStorage.getItem(TAB_STORAGE_KEY);
  return ALLOWED_TABS.has(savedTab) ? savedTab : "home";
}

function IconUser() {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      height="24px" 
      viewBox="0 -960 960 960" 
      width="24px" 
      fill="currentColor" 
    >
      <path d="M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm146.5-204.5Q340-521 340-580t40.5-99.5Q421-720 480-720t99.5 40.5Q620-639 620-580t-40.5 99.5Q539-440 480-440t-99.5-40.5ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm100-95.5q47-15.5 86-44.5-39-29-86-44.5T480-280q-53 0-100 15.5T294-220q39 29 86 44.5T480-160q53 0 100-15.5ZM523-537q17-17 17-43t-17-43q-17-17-43-17t-43 17q-17 17-17 43t17 43q17 17 43 17t43-17Zm-43-43Zm0 360Z"/>
    </svg>
  );
}

function IconMenu() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="22px"
      viewBox="0 -960 960 960"
      width="22px"
      fill="currentColor"
    >
      <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
    </svg>
  );
}

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [theme, setTheme] = useState(getInitialTheme);
  const [isLoading, setIsLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [acctSettingsOpen, setAcctSettingsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const userRef = useRef(null);
  const mobileNavRef = useRef(null);

  const applyTheme = (nextTheme, animate = true) => {
    const normalized = normalizeTheme(nextTheme);
    setTheme(normalized);
    document.documentElement.dataset.theme = normalized;
    document.body.dataset.theme = normalized;

    if (animate) {
      document.body.classList.add("theme-transition");
      window.setTimeout(() => {
        document.body.classList.remove("theme-transition");
      }, 420);
    }
  };

  const handleTabChange = (newTab) => {
    if (newTab !== activeTab) {
      setSettingsOpen(false);
      setMobileNavOpen(false);
      setIsLoading(true);
      setTimeout(() => {
        setActiveTab(newTab);
        setIsLoading(false);
      }, 300);
    }
  };

  useEffect(() => {
    if (!userMenuOpen && !mobileNavOpen) return;
    const handleClick = (e) => {
      const clickedUserMenu = userRef.current && userRef.current.contains(e.target);
      const clickedMobileMenu = mobileNavRef.current && mobileNavRef.current.contains(e.target);
      if (!clickedUserMenu && !clickedMobileMenu) {
        setUserMenuOpen(false);
        setMobileNavOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen, mobileNavOpen]);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 650);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();

    const loadSessionUser = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || "https://shield-app-wmz37.ondigitalocean.app"}/api/auth/me`, {
          credentials: "include",
          signal: controller.signal
        });

        if (!response.ok) {
          setCurrentUser(null);
          return;
        }

        const payload = await response.json();
        if (payload?.user) {
          setCurrentUser(payload.user);
          applyTheme(payload?.user?.preferences?.theme, false);
        } else {
          applyTheme(theme, false);
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          setCurrentUser(null);
          applyTheme(theme, false);
        }
      }

    };

    loadSessionUser();
    return () => controller.abort();
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    applyTheme(user?.preferences?.theme);
  };

  const handleUserUpdated = (user) => {
    setCurrentUser(user);
    applyTheme(user?.preferences?.theme);
  };

  const handleSignOut = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || "https://shield-app-wmz37.ondigitalocean.app"}/api/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch (error) {
      console.warn("Failed to log out cleanly:", error);
    }

    setCurrentUser(null);
    setAcctSettingsOpen(false);
    setUserMenuOpen(false);
  };

  return (
    <div className="main-layout">
      <header className="main-header">
        <div className="header-left">
          <div className="brand">
            <button
              type="button"
              className="brand-home-btn brand-name"
              onClick={() => handleTabChange("home")}
            >
              ALERT PH 
            </button>
            <span className="brand-sep" />
            <span className="brand-sub">Philippine Disaster & Monitoring System</span>
          </div>
        </div>

        <nav className="tab-nav">
          <button
            className={`tab-btn ${activeTab === "dashboard" ? "tab-active" : ""}`}
            onClick={() => handleTabChange("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={`tab-btn ${activeTab === "news" ? "tab-active" : ""}`}
            onClick={() => handleTabChange("news")}
          >
            News
          </button>
          
          <button
            className={`tab-btn ${activeTab === "about" ? "tab-active" : ""}`}
            onClick={() => handleTabChange("about")}
          >
            About Us
          </button>

        </nav>

        {/* RIGHT NAV (User) */}
        <nav className="topbar-nav">
          <div className="mobile-menu-wrap" ref={mobileNavRef}>
            <button
              className={"nav-btn" + (mobileNavOpen ? " nav-btn--on" : "")}
              title="Navigation"
              onClick={() => {
                setUserMenuOpen(false);
                setMobileNavOpen((prev) => !prev);
              }}
            >
              <IconMenu />
            </button>
            {mobileNavOpen && (
              <div className="mobile-tab-dropdown">
                <button
                  className={`mobile-tab-btn ${activeTab === "dashboard" ? "mobile-tab-active" : ""}`}
                  onClick={() => handleTabChange("dashboard")}
                >
                  Dashboard
                </button>
                <button
                  className={`mobile-tab-btn ${activeTab === "news" ? "mobile-tab-active" : ""}`}
                  onClick={() => handleTabChange("news")}
                >
                  News
                </button>
                <button
                  className={`mobile-tab-btn ${activeTab === "about" ? "mobile-tab-active" : ""}`}
                  onClick={() => handleTabChange("about")}
                >
                  About Us
                </button>
              </div>
            )}
          </div>

          <div className="user-wrap" ref={userRef}>
            <button
              className={"nav-btn" + (userMenuOpen ? " nav-btn--on" : "")}
              title="Account"
              onClick={() => {
                setMobileNavOpen(false);
                setUserMenuOpen((v) => !v);
              }}
            >
              <IconUser />
            </button>
            {userMenuOpen && (
              <div className="user-dropdown">
                {!currentUser && (
                  <button className="user-signin-btn" onClick={() => { setUserMenuOpen(false); setLoginOpen(true); }}>
                    Sign In
                  </button>
                )}
                {currentUser && (
                  <button
                    className="user-acct-btn"
                    onClick={() => { setUserMenuOpen(false); setAcctSettingsOpen(true); }}
                  >
                    Account Settings
                  </button>
                )}
              </div>
            )}
          </div>
        </nav>
      </header>

      <div className="layout-content">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="loading-skeleton"
            >
              <div className="skeleton-item skeleton-header"></div>
              <div className="skeleton-item skeleton-large"></div>
              <div className="skeleton-item skeleton-medium"></div>
              <div className="skeleton-item skeleton-medium"></div>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`tab-content tab-content--${activeTab}`}
            >
              {activeTab === "dashboard" && (
                <Dashboard
                  theme={theme}
                  settingsOpen={settingsOpen}
                  setSettingsOpen={setSettingsOpen}
                />
              )}
              {activeTab === "about" && <AboutUs />}
              {activeTab === "home" && (
                <HomeContent onGoDashboard={() => handleTabChange("dashboard")} />
              )}
              {activeTab === "news" && (
                <>
                  <NewsReport />
                  <Preparedness />
                </>
              )}
              <Footer />
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      {loginOpen && <Login onClose={() => setLoginOpen(false)} onLogin={handleLoginSuccess} />}
      {acctSettingsOpen && (
        <AccountSettings
          onClose={() => setAcctSettingsOpen(false)}
          currentUser={currentUser}
          currentTheme={theme}
          onUserUpdated={handleUserUpdated}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}
