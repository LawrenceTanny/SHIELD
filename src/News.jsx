import { useState, useRef } from 'react';
import './Styles/News.css';

export default function NewsReport() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const carouselRef = useRef(null);
    
    const latestNews = [
    {
        id: 1,
        title: 'Breaking News Update',
        description: 'Latest emergency updates and alerts',
        date: '2024-04-03',
    },
    {
        id: 2,
        title: 'Weather Alert',
        description: 'Severe weather conditions reported',
        date: '2024-04-02',
    },
    {
        id: 3,
        title: 'Safety Information',
        description: 'Important safety guidelines and updates',
        date: '2024-04-01',
    },
  ];

    const socialMediaFeed = [
    {
        id: 1,
        source: 'Disaster Alert',
        content: 'Real-time updates from disaster alert channels',
        timestamp: '2 hours ago',
    },
    {
        id: 2,
        source: 'Emergency Services',
        content: 'Official emergency response information',
        timestamp: '4 hours ago',
    },
  ];

    const newsItems = [
    {
      id: 1,
      title: 'News Item 1',
      description: 'Latest updates and information',
    },
    {
      id: 2,
      title: 'News Item 2',
      description: 'Important alerts and notices',
    },
    {
      id: 3,
      title: 'News Item 3',
      description: 'Community announcements',
    },
  ];

    const handlePrevSlide = () => {
        setCurrentSlide((prev) => (prev === 0 ? latestNews.length - 1 : prev - 1));
  };

    const handleNextSlide = () => {
        setCurrentSlide((prev) => (prev === latestNews.length - 1 ? 0 : prev + 1));
  };

    return (
        <div className="news-container">
            <div className="news-header">
                <h1>News Report</h1>
        </div>

    <div className="news-main">
        <div className="latest-news">
            <div className="section-header">
                <h2>Latest News</h2>
            </div>
          
            <div className="carousel-container" ref={carouselRef}>
                <button className="carousel-btn prev-btn" onClick={handlePrevSlide}>
                ‹
                </button>

            <div className="carousel-content">
                <div className="news-card active">
                    <h3>{latestNews[currentSlide].title}</h3>
                        <p>{latestNews[currentSlide].description}</p>
                    
                    <span className="news-date">{latestNews[currentSlide].date}</span>
                </div>
            </div>
            
            <button className="carousel-btn next-btn" onClick={handleNextSlide}>
                ›
            </button>
        </div>

            <div className="carousel-indicators">
                {latestNews.map((_, index) => (
                <div
                    key={index}
                    className={`indicator ${index === currentSlide ? 'active' : ''}`}
                    onClick={() => setCurrentSlide(index)}
                />
            ))}
                </div>
            </div>

        <div className="social-section">
            <div className="section-header">
                <h2>Social Media Feed</h2>
            </div>

            <div className="social-feed-container">
                {socialMediaFeed.map((item) => (
                    <div key={item.id} className="social-feed-item">
                        <h4>{item.source}</h4>
                            <p>{item.content}</p>
                                <span className="feed-timestamp">{item.timestamp}</span>
                    </div>
                    ))}
            </div>
        </div>
    </div>

        <div className="bottom-news-section">
            <div className="news-grid">
                {newsItems.map((item) => (
                    <div key={item.id} className="news-item-card">
                        <h3>{item.title}</h3>
                            <p>{item.description}</p>
                    </div>
                    ))}
            </div>
        </div>
    </div>
  );
}