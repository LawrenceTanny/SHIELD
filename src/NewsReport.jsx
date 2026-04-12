import { useEffect, useRef, useState } from 'react';
import './Styles/News.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://shield-app-wmz37.ondigitalocean.app';
const LATEST_NEWS_LIMIT = 7;


const displayDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: '2-digit',
  year: 'numeric',
});

function formatDisplayDate(value) {
  if (!value) {
    return 'N/A';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return displayDateFormatter.format(parsedDate);
}

export default function NewsReport() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [newsItems, setNewsItems] = useState([]);
  const [disasterAlerts, setDisasterAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const carouselRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchNews = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/news`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch news: ${response.status}`);
        }

        const payload = await response.json();
        const normalized = Array.isArray(payload)
          ? payload
              .map((item, index) => ({
                id: item.id || index + 1,
                title: item.title || 'News Update',
                description: item.description || 'No details available.',
                date: formatDisplayDate(item.publishedAt || item.date),
                publishedAt: item.publishedAt || item.date || null,
                source: item.source || 'SHIELD',
                url: item.url || '#',
                image: item.image || null,
              }))
              .filter((item) => item.title)
          : [];

        setNewsItems(normalized);
        setLoadError('');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setNewsItems([]);
          setLoadError('Unable to load news right now. Please try again later.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchNews();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchDisasters = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/disasters`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch disasters: ${response.status}`);
        }

        const payload = await response.json();
        const alerts = Array.isArray(payload)
          ? payload.slice(0, 2).map((item, index) => ({
              id: item.id || index + 1,
              type: item.type || 'Alert',
              title: item.title || 'Alert Update',
              location: item.city || item.province || 'Philippines',
              severity: item.severity || 'Medium',
              timestamp: item.updatedAt || new Date().toLocaleDateString('en-PH'),
            }))
          : [];

        setDisasterAlerts(alerts);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn('Failed to fetch disaster alerts:', error);
        }
      }
    };

    fetchDisasters();
    return () => controller.abort();
  }, []);

  const sortedNews = [...newsItems].sort((a, b) => {
    const aTime = new Date(a.publishedAt || a.date || 0).getTime();
    const bTime = new Date(b.publishedAt || b.date || 0).getTime();
    return bTime - aTime;
  });

  const latestNews = sortedNews.slice(0, LATEST_NEWS_LIMIT);
  const bottomNewsCards = sortedNews.slice(LATEST_NEWS_LIMIT);

  useEffect(() => {
    if (currentSlide >= latestNews.length) {
      setCurrentSlide(0);
    }
  }, [currentSlide, latestNews.length]);

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? latestNews.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev === latestNews.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="news-report-container">
      <div className="news-header">
        <h1>News Report</h1>
        {loadError && <p className="news-load-error">{loadError}</p>}
      </div>

      <div className="news-main">
        <div className="latest-news">
          <div className="section-header">
            <h2>Latest News</h2>
          </div>

          <div className="carousel-container" ref={carouselRef}>
            <button className="carousel-btn prev-btn" onClick={handlePrevSlide} disabled={isLoading || latestNews.length <= 1}>
              ‹
            </button>

            <div className="carousel-content">
              {isLoading ? (
                <div className="news-card news-skeleton-card">
                  <div className="skeleton-line skeleton-title" />
                  <div className="skeleton-line skeleton-text" />
                  <div className="skeleton-line skeleton-text short" />
                  <div className="skeleton-line skeleton-date" />
                </div>
              ) : latestNews.length === 0 ? (
                <div className="news-card active">
                  <h3>No fresh headlines for today</h3>
                  <p>New stories published today will automatically appear here.</p>
                  <span className="news-date">Waiting for today&apos;s updates</span>
                </div>
              ) : (
                <a
                  className={`news-card active news-card-link ${latestNews[currentSlide]?.url === '#' ? 'disabled-link' : ''}`}
                  href={latestNews[currentSlide]?.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div
                    className="news-card-media"
                    style={{
                      backgroundImage: latestNews[currentSlide]?.image
                        ? `url('${latestNews[currentSlide].image}')`
                        : 'linear-gradient(135deg, rgba(255, 68, 0, 0.25) 0%, rgba(15, 15, 15, 0.9) 100%)',
                    }}
                  />
                  <div className="news-card-body">
                    <h3>{latestNews[currentSlide]?.title}</h3>
                    <p>{latestNews[currentSlide]?.description}</p>
                    <div className="news-card-meta">
                      <span className="news-date">{latestNews[currentSlide]?.date}</span>
                      <span className="news-read-more">Read full article</span>
                    </div>
                  </div>
                </a>
              )}
            </div>

            <button className="carousel-btn next-btn" onClick={handleNextSlide} disabled={isLoading || latestNews.length <= 1}>
              ›
            </button>
          </div>

          {!isLoading && latestNews.length > 0 && (
            <div className="carousel-indicators">
              {latestNews.map((_, index) => (
                <div
                  key={index}
                  className={`indicator ${index === currentSlide ? 'active' : ''}`}
                  onClick={() => setCurrentSlide(index)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="social-section">
          <div className="section-header">
            <h2>Active Alerts</h2>
          </div>

          <div className="social-feed-container">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="social-feed-item social-skeleton-item">
                  <div className="skeleton-line skeleton-title" />
                  <div className="skeleton-line skeleton-text" />
                  <div className="skeleton-line skeleton-date" />
                </div>
              ))
            ) : disasterAlerts.length === 0 ? (
              <div className="social-feed-item">
                <h4>No Active Alerts</h4>
                <p>Currently no active disaster alerts. Continue monitoring for updates.</p>
              </div>
            ) : (
              disasterAlerts.map((alert) => (
                <div key={alert.id} className="social-feed-item alert-item">
                  <div className="alert-header">
                    <h4>{alert.type}</h4>
                    <span className={`severity-badge severity-${alert.severity.toLowerCase()}`}>{alert.severity}</span>
                  </div>
                  <p className="alert-title">{alert.title}</p>
                  <div className="alert-meta">
                    <span className="alert-location">📍 {alert.location}</span>
                    <span className="alert-timestamp">{alert.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bottom-news-section">
        <div className="news-dashboard-layout">
          <div className="news-grid">
            {isLoading ? (
              Array.from({ length: LATEST_NEWS_LIMIT }).map((_, index) => (
                <div key={index} className="news-item-card news-skeleton-card">
                  <div className="skeleton-line skeleton-title" />
                  <div className="skeleton-line skeleton-text" />
                  <div className="skeleton-line skeleton-text short" />
                </div>
              ))
            ) : bottomNewsCards.length === 0 ? (
              <div className="news-item-card">
                <h3>No older headlines yet</h3>
                <p>Stories from yesterday and earlier will appear in this section.</p>
              </div>
            ) : (
              bottomNewsCards.map((item) => (
                <a
                  key={item.id}
                  className={`news-item-card news-item-link ${item.url === '#' ? 'disabled-link' : ''}`}
                  href={item.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div
                    className="news-item-media"
                    style={{
                      backgroundImage: item.image
                        ? `url('${item.image}')`
                        : 'linear-gradient(135deg, rgba(255, 68, 0, 0.2) 0%, rgba(16, 16, 16, 0.85) 100%)',
                    }}
                  />
                  <div className="news-item-body">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span className="news-date">{item.date}</span>
                  </div>
                </a>
              ))
            )}
          </div>

          <div className="news-side-panel">
            <div className="side-widget">
              <h3>Preparedness Tip</h3>
              <p>Keep flashlights, batteries, water, and emergency contacts ready.</p>
            </div>

            <div className="side-widget">
              <h3>Quick Alert</h3>
              <p>Monitor typhoon movement and check local advisories regularly.</p>
            </div>

            <div className="side-widget">
              <h3>Emergency Hotline</h3>
              <p>911 / Local DRRM Office</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}