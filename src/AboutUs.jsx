import React from 'react';
import "./Styles/AboutUs.css";

export default function AboutUs() {
    const developers = [
        { id: 1, name: "Lawrence Tan", position: "Lead Developer", photo: "Profiles/Lawrence.png" },
        { id: 2, name: "Wyeth Rellamas", position: "Frontend Developer", photo: "Profiles/Wyeth.jpg" },
        { id: 3, name: "Clark Maglaque", position: "Frontend Developer", photo: "Profiles/Clark.png" },
        { id: 4, name: "Kent Hipolito", position: "Backend Developer", photo: "Profiles/Kent.jpg" },
        { id: 5, name: "Erl Samson", position: "Backend Developer", photo: "Profiles/Erl.png" },
    ];

    const apiPartners = [
        { id: 1, name: "NASA (EONET API)", logo: "https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg" },
        { id: 2, name: "USGS", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1c/USGS_logo_green.svg" },
        { id: 3, name: "OpenWeather", logo: "https://openweathermap.org/_next/image?url=%2Fpayload%2Fapi%2Fmedia%2Ffile%2Flogo_white.png&w=128&q=75" },
        { id: 4, name: "GNews", logo: "https://gnews.io/build/assets/logo-black-CGTmaMaU.svg" },
        { id: 5, name: "OpenStreetMap Nominatim", logo: "https://nominatim.openstreetmap.org/ui/theme/logo.png" },
        { id: 6, name: "Leaflet", logo: "https://leafletjs.com/docs/images/logo.png" },
    ];

    return (
        <div className="about-us-page">
            
            <div className="about-us-header">
                <h1 className="about-us-title">ABOUT US</h1>
                <div className="divider"></div>
            </div>

            <main className="about-us-container">
                
                <section className="card-grid">
                    <div className="info-card large-card vision-card">
                        <h2>VISION</h2>
                        <p>
                            To empower communities and emergency responders with a high-precision, real-time intelligence hub that transforms complex environmental data into actionable insights, ensuring rapid response and minimizing the impact of natural disasters through seamless monitoring and instant alert systems.
                        </p>

                        <h2 style={{ marginTop: '20px' }}>MISSION</h2>
                        <p>
                            To provide reliable, high-speed data integration and advanced visualization tools that bridge the gap between complex environmental monitoring and effective emergency management, saving lives through technological excellence.                       
                        </p>
                    </div>

                    <div className="info-card large-card partners-card">
                        <h2>DATA PARTNERS</h2>
                        <div className="partners-grid">
                            {apiPartners.map((partner) => (
                                <div key={partner.id} className="partner-card">
                                    <div className="partner-logo">
                                        {partner.logo ? (
                                            <img src={partner.logo} alt={partner.name} className="partner-image" />
                                        ) : (
                                            <span className="placeholder-text">Add Logo</span>
                                        )}
                                    </div>
                                    <p className="partner-name">{partner.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="dev-section">
                    <h2 className="dev-title">DEVELOPMENT TEAM</h2>
                    <div className="dev-grid">
                        {developers.map((dev) => (
                            <div key={dev.id} className="dev-card">
                                <div className="dev-avatar">
                                    {dev.photo ? (
                                        <img src={dev.photo} alt={dev.name} className="dev-image" />
                                    ) : (
                                        <span className="placeholder-text">Add Photo</span>
                                    )}
                                </div>
                                <div className="dev-info">
                                    <p className="dev-name">{dev.name}</p>
                                    <p className="dev-position">{dev.position}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}