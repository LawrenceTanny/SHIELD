import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./Styles/Header.css";
import Dashboard from "./Dashboard";
import AboutUs from "./AboutUs";
import Login from "./Login";
import AccountSettings from "./AccountSettings";
import Footer from "./Footer";
import Preparedness from "./Preparedness.jsx";

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [acctSettingsOpen, setAcctSettingsOpen] = useState(false);
  
  const userRef = useRef(null);

  // Handle tab switching with loading effect
  const handleTabChange = (newTab) => {
    if (newTab !== activeTab) {
      setSettingsOpen(false);
      setIsLoading(true);
      // Simulate loading for smooth transition
      setTimeout(() => {
        setActiveTab(newTab);
        setIsLoading(false);
      }, 300);
    }
  };

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClick = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 650);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="main-layout">
      <header className="main-header">
        <div className="header-left">
          <div className="brand">
            <span className="brand-name">SHIELD</span>
            <span className="brand-sep" />
            <span className="brand-sub">Synchronized Hazard Information &amp; Emergency Live Dashboard</span>
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
            className={`tab-btn ${activeTab === "preparedness" ? "tab-active" : ""}`}
            onClick={() => handleTabChange("preparedness")}
          >
            Preparedness
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
          <div className="user-wrap" ref={userRef}>
            <button
              className={"nav-btn" + (userMenuOpen ? " nav-btn--on" : "")}
              title="Account"
              onClick={() => setUserMenuOpen((v) => !v)}
            >
              <IconUser />
            </button>
            {userMenuOpen && (
              <div className="user-dropdown">
                <p className="user-hint">Not signed in</p>
                <button className="user-signin-btn" onClick={() => { setUserMenuOpen(false); setLoginOpen(true); }}>Sign In</button>
                <button className="user-acct-btn" onClick={() => { setUserMenuOpen(false); setAcctSettingsOpen(true); }}>
                  Account Settings
                </button>
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
              className="tab-content"
            >
              {activeTab === "dashboard" && (
                <Dashboard
                  settingsOpen={settingsOpen}
                  setSettingsOpen={setSettingsOpen}
                />
              )}
              {activeTab === "about" && <AboutUs />}
              {activeTab === "preparedness" && <Preparedness />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer />


      {loginOpen && <Login onClose={() => setLoginOpen(false)} />}
      {acctSettingsOpen && <AccountSettings onClose={() => setAcctSettingsOpen(false)} />}
    </div>
  );
}
