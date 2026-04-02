import "./Styles/AboutUs.css";

export default function AboutUs() {
    const developers = [
        { id: 1, name: "Lawrence Tan", position: "Lead Developer", photo: "Profiles/Lawrence.png" },
        { id: 2, name: "Sunset Raven", position: "Frontend Developer", photo: "Profiles/Wyeth.jpg" },
        { id: 3, name: "Clark Antonii", position: "Frontend Developer", photo: "Profiles/Clark.png" },
        { id: 4, name: "Kent Hipolito", position: "Backend Developer", photo: "Profiles/Kent.jpg" },
        { id: 5, name: "Erl Samson", position: "Backend Developer", photo: "Profiles/Erl.png" },
    ];

    const apiPartners = [
        { id: 1, name: "NASA (EONET API)", logo: "https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg" },
        { id: 2, name: "USGS", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1c/USGS_logo_green.svg" },
        { id: 3, name: "DOST-PAGASA", logo: "API/PAGASA.png" },
        { id: 4, name: "Mediastack", logo: "https://mediastack.com/site_images/mediastack_logo.svg" },
        { id: 5, name: "OpenStreetMap Nominatim", logo: "https://nominatim.openstreetmap.org/ui/theme/logo.png" },
    ];

    return(
        <div className="about-us-page">
            <main className="about-us-container">
                <h1 className="about-us-title">About Us</h1>
                <div className="divider"></div>

                <section className="card-grid">
                    <div className="info-card large-card">
                        <h2>Our Vision</h2>
                        <p>Empowering communities through real-time hazard information and emergency response coordination.</p>
                    </div>

                    <div className="info-card large-card">
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