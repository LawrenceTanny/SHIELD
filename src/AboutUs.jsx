import "./Styles/AboutUs.css";

export default function AboutUs() {
    const developers = [1,2,3,4,5];

    return(
        <div className = "about-us-page">
            <header className = "top-bar">
                <div className = "brand">
                    <span className = "brand-title">SHIELD</span>
                    <span classname = "brand-subtitle">
                        Synchronized Hazard Information & Emergency Live Dashboard</span>
                </div>

            </header>

            <main className = "about-us-container">
                <h1 className = "about-us-title">About Us</h1>
                <div className = "divider"></div>

                <section className = "card-grid">
                    <div className = "info-card large-card">
                        <h2>Our Vission</h2>
                        <p>Dko alams</p>
                    </div>

                    <div className = "info-card large-card">
                        <h2>DATA PARTNERS</h2>
                        <div className = "partners-grid">
                            {[1,2,3,4,5,6].map((item) => (
                                <div key = {item}
                                    className = "partner-circle">
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className = "dev-section">
                    <h2 className = "dev-title">DEVELOPMENT TEAM</h2>
                    <div className = "dev-grid">
                        {developers.map((dev) => (
                            <div key = {dev} className = "dev-card">
                                <div className = "dev-avatar"></div>
                                <p>description</p>
                            </div>
                        ))}

                    </div>
                </section>
            </main>
        </div>
    );
}