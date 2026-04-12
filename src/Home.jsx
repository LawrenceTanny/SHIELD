import { useMemo } from 'react';
import './Styles/Home.css';

export default function HomeContent({ onGoDashboard }) {
    const heroCards = useMemo(
        () => [
            {
                title: 'Live Hazard Tracking',
                description: 'MONITOR EARTHQUAKE AND HAZARD DATA FROM TRUSTED GLOBAL SOURCES IN ONE VIEW.',
            },
            {
                title: 'Weather Awareness',
                description: 'VIEW NATIONWIDE WEATHER CONTEXT TO BETTER ASSESS STORM AND TYPHOON FORMATION RISKS.',
            },
            {
                title: 'Preparedness Focus',
                description: 'SUPPORT SAFER DECISIONS WITH TIMELY INFORMATION FOR RESPONSE AND READINESS PLANNING.',
            },
        ],
        []
    );

    return (
        <section className="home-container">
        <section className="landing-hero">
            <div className="welcome-card">
                <h1 className="hero-title">ALERT PH</h1>
                <p className="hero-description">
                    ALERT PH is a disaster-monitoring platform built to help communities stay informed through
                    real-time hazard updates, weather intelligence, and emergency response awareness.
                </p>
            </div>

            <div className="hero-cards-row">
                {heroCards.map((card) => (
                    <div className="hero-highlight-card" key={card.title}>
                        <h3>{card.title}</h3>
                        <p>{card.description}</p>
                    </div>
                ))}
            </div>

            <div className="steps-container">
                <p className="steps-title">BE READY. BE PREPARED</p>
                <hr className="steps-divider" />

                <div className="steps-row">
                    <div className="step-pill">
                        <span className="step-number">1</span> Prepare Go Bag
                    </div>
                    <div className="step-pill">
                        <span className="step-number">2</span> Locate/Find Nearest Shelter
                    </div>
                    <div className="step-pill">
                        <span className="step-number">3</span> Join Local Drill
                    </div>
                </div>
            </div>

            <div className="scroll-indicator-shell">
                <button type="button" className="scroll-indicator" aria-label="Go to Dashboard" onClick={onGoDashboard}>
                    <div className="scroll-circle">
                        <svg className="scroll-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                            <path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z" />
                        </svg>
                    </div>
                    <p className="scroll-text">TO DASHBOARD</p>
                </button>
            </div>
        </section>
        </section>
    );
}