import React from 'react';
import "./Styles/AboutUs.css";

export default function AboutUs() {
    const developers = [
        { id: 1, firstName: "Lawrence", lastName: "Tan", position: "Lead Developer", photo: "../tan_1x1.png", github: "https://github.com/LawrenceTanny" },
        { id: 2, firstName: "Wyeth", lastName: "Rellamas", position: "Frontend Developer", photo: "../wyeth_1x1.png", github: "https://github.com/Rellamas" },
        { id: 3, firstName: "Clark", lastName: "Maglaque", position: "Frontend Developer", photo: "../clark_1x1.png", github: "https://github.com/def-Antoni" },
        { id: 4, firstName: "Kent", lastName: "Hipolito", position: "Backend Developer", photo: "../kent_1x1.png", github: "https://github.com/KentHipolito" },
        { id: 5, firstName: "Erl", lastName: "Samson", position: "Backend Developer", photo: "../erl_1x1.png", github: "https://github.com/yaziz26" },
    ];

    const apiPartners = [
        { id: 1, name: "NASA (EONET API)", logo: "https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg", url: "https://eonet.gsfc.nasa.gov/" },
        { id: 2, name: "OpenWeather", logo: "https://vectorseek.com/wp-content/uploads/2023/10/OpenWeather-Logo-Vector.svg-.png", url: "https://openweathermap.org/" },
        { id: 3, name: "LeafLet", logo: "https://leafletjs.com/docs/images/logo.png", url: "https://leafletjs.com/" },
        { id: 4, name: "USGS", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1c/USGS_logo_green.svg", url: "https://www.usgs.gov/" },
        { id: 5, name: "GNews", logo: "https://gnews.io/build/assets/logo-black-CGTmaMaU.svg", url: "https://gnews.io/" },
        { id: 6, name: "OpenStreetMap Nominatim", logo: "https://nominatim.openstreetmap.org/ui/theme/logo.png", url: "https://nominatim.openstreetmap.org/" },
    ];

    return (
        <div className="about-us-page">

            {/* HEADER */}
            <div className="au-header">
                <h1 className="au-title">About Us</h1>
                <div className="au-divider" />
            </div>

            <main className="au-body">

                {/* VISION / MISSION */}
                <section className="vm-section">
                    <div className="vm-row">
                        <span className="vm-label">Vision</span>
                        <p className="vm-text">
                            TO EMPOWER COMMUNITIES AND EMERGENCY RESPONDERS WITH A HIGH-PRECISION,
                            REAL-TIME INTELLIGENCE HUB THAT TRANSFORMS COMPLEX ENVIRONMENTAL DATA INTO
                            ACTIONABLE INSIGHTS, ENSURING RAPID RESPONSE AND MINIMIZING THE IMPACT OF
                            NATURAL DISASTERS THROUGH SEAMLESS MONITORING AND INSTANT ALERT SYSTEMS.
                        </p>
                    </div>
                    <div className="vm-row">
                        <span className="vm-label">Mission</span>
                        <p className="vm-text">
                            TO PROVIDE RELIABLE, HIGH-SPEED DATA INTEGRATION AND ADVANCED VISUALIZATION
                            TOOLS THAT BRIDGE THE GAP BETWEEN COMPLEX ENVIRONMENTAL MONITORING AND
                            EFFECTIVE EMERGENCY MANAGEMENT, SAVING LIVES THROUGH TECHNOLOGICAL EXCELLENCE.
                        </p>
                    </div>
                </section>

                {/* DATA PARTNERS */}
                <section className="partners-section">
                    <h2 className="au-section-title">Data Partners</h2>
                    <div className="partners-grid">
                        {apiPartners.map((partner) => (
                            <a
                                key={partner.id}
                                href={partner.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="partner-card"
                            >
                                <div className="partner-logo-area">
                                    <img src={partner.logo} alt={partner.name} className="partner-img" />
                                </div>
                                <div className="partner-footer">
                                    <span className="partner-name">{partner.name}</span>
                                    <span className="partner-arrow">
                                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                            <path d="M2 6.5H11M7 2.5L11 6.5L7 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                </div>
                            </a>
                        ))}
                    </div>
                </section>

                {/* DEVELOPMENT TEAM */}
                <section className="dev-section">
                    <h2 className="au-section-title">Development Team</h2>
                    <div className="dev-grid">
                        {developers.map((dev) => (
                            <a
                                key={dev.id}
                                href={dev.github}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="dev-card"
                            >
                                <div className="dev-photo">
                                    {/* New Banner Logic */}
                                    <div className="github-banner">
                                        <div className="github-user-wrapper">
                                            <img src="../mark-github-24.svg" alt="github icon" className="github-icon" />
                                            <span>{dev.github.split('/').pop()}</span>
                                        </div>
                                        <span className="github-arrow">
                                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                                <path d="M2 6.5H11M7 2.5L11 6.5L7 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </span>
                                    </div>

                                    <img src={dev.photo} alt={dev.firstName} className="dev-img" />
                                </div>

                                <div className="dev-info">
                                    <p className="dev-lastname">{dev.lastName}</p>
                                    <p className="dev-firstname">{dev.firstName}</p>
                                    <div className="dev-rule" />
                                    <p className="dev-position">{dev.position}</p>
                                </div>
                            </a>
                        ))}
                    </div>
                </section>

            </main>
        </div>
    );
}