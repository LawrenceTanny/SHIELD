import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./Styles/Header.css";
import Dashboard from "./Dashboard";
import AboutUs from "./AboutUs";
import News from "./News";
import Login from "./Login";
import AccountSettings from "./AccountSettings";
import Footer from "./Footer";
import Preparedness from "./Preparedness.jsx";

function IconUser() {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      height="24px" 
      viewBox="0 -960 960 960" 
      width="24px" 
      fill="currentColor" /* Inherits from CSS 'color' */
    >
      <path d="M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm146.5-204.5Q340-521 340-580t40.5-99.5Q421-720 480-720t99.5 40.5Q620-639 620-580t-40.5 99.5Q539-440 480-440t-99.5-40.5ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm100-95.5q47-15.5 86-44.5-39-29-86-44.5T480-280q-53 0-100 15.5T294-220q39 29 86 44.5T480-160q53 0 100-15.5ZM523-537q17-17 17-43t-17-43q-17-17-43-17t-43 17q-17 17-17 43t17 43q17 17 43 17t43-17Zm-43-43Zm0 360Z"/>
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

          <button
            className={`tab-btn ${activeTab === "news" ? "tab-active" : ""}`}
            onClick={() => handleTabChange("news")}
          >
            News
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
              {activeTab === "news" && <News />}
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
