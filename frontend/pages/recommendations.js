import { useState } from 'react';
import { fetchJson } from '../lib/api';

const quickItems = [
  'Best labs in Hà Nội for C41 scanning',
  'Film stock for portraits',
  'Compare lab scanning quality',
  'Best value combo packages',
  'How to store film properly?',
  'Why are my photos overexposed?'
];

const stats = [
  { label: 'Film Labs', value: '500+' },
  { label: 'Photographers', value: '50K+' },
  { label: 'Photos shared', value: '100K+' },
  { label: 'Response accuracy', value: '98%' }
];

export default function Recommendations() {
  const [city, setCity] = useState('Hà Nội');
  const [serviceType, setServiceType] = useState('Scanning, Printing');
  const [minPrice, setMinPrice] = useState('100000');
  const [maxPrice, setMaxPrice] = useState('300000');
  const [filmStyle, setFilmStyle] = useState('Negative Color (C41)');
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body = {
        history: [],
        location: { city, country: 'Vietnam' },
        price: { minPrice: Number(minPrice) || null, maxPrice: Number(maxPrice) || null },
        preferences: {
          serviceType,
          filmStyle,
          favoriteGenres: [],
          budget: Number(maxPrice) || null,
        },
      };

      const data = await fetchJson('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      setRecommendation(data.recommendations || null);
    } catch (err) {
      setError(err.message);
      setRecommendation(null);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickSelect(topic) {
    setServiceType(topic);
  }

  return (
    <main className="register-page">
      <div className="register-shell">
        <aside className="ai-left-panel">
          <div className="ai-intro-card">
            <span className="hero-tag">AI Assistant</span>
            <h1>Your intelligent film photography companion</h1>
            <p>Get personalized recommendations for film labs, film stocks, and services based on your needs and preferences.</p>
            <div className="ai-badges">
              <span>Trusted data</span>
              <span>Expert knowledge</span>
              <span>Real community feedback</span>
            </div>
            <img src="/Film-camera.png" alt="Film camera" className="hero-visual-img" />
          </div>

          <div className="ai-quick-card">
            <h2>Quick suggestions</h2>
            <div className="quick-grid">
              {quickItems.map((item) => (
                <button key={item} type="button" className="quick-pill" onClick={() => handleQuickSelect(item)}>{item}</button>
              ))}
            </div>
          </div>

          <div className="ai-options-card">
            <h2>What we can help with</h2>
            <ul>
              <li>Find the best Film Labs</li>
              <li>Recommend film stocks</li>
              <li>Compare scanning quality</li>
              <li>Analyze scan quality</li>
              <li>Suggest packages & prices</li>
              <li>Answer photography questions</li>
            </ul>
          </div>

          <div className="ai-powered-card">
            <strong>Powered by</strong>
            <p>Advanced AI trained on photography expertise and community insights.</p>
          </div>
        </aside>

        <section className="ai-right-panel">
          <div className="ai-summary-card">
            <div>
              <p className="eyebrow">Hi An! 👋</p>
              <h2>I’m your Film Lab AI Assistant.</h2>
              <p>I can help you find the best film labs, recommend film stocks, analyze scans, and answer all your photography questions.</p>
            </div>
            <div className="ai-confidence-card">
              <span>AI Confidence</span>
              <strong>98%</strong>
              <div className="confidence-bar"><div /></div>
              <small>High reliability</small>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="ai-form-card">
            <div className="ai-form-grid">
              <div className="form-control">
                <label>Location</label>
                <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="form-control">
                <label>Service type</label>
                <input className="input" value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
              </div>
              <div className="form-control">
                <label>Film type</label>
                <select className="select" value={filmStyle} onChange={(e) => setFilmStyle(e.target.value)}>
                  <option>Negative Color (C41)</option>
                  <option>Black & White</option>
                  <option>Slide Film (E6)</option>
                </select>
              </div>
              <div className="form-control">
                <label>Min budget</label>
                <input className="input" type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              </div>
              <div className="form-control">
                <label>Max budget</label>
                <input className="input" type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </div>
            </div>

            <button type="submit" className="btn-register" disabled={loading}>{loading ? 'Loading...' : 'Get AI Recommendations ✨'}</button>
            {error && <div className="form-error">{error}</div>}
          </form>

          {recommendation && (
            <div className="ai-results-card">
              <div className="results-head">
                <h3>Recommended results</h3>
                <span>Based on your preferences</span>
              </div>
              <div className="result-grid">
                <article className="highlight-card">
                  <h4>Recommended Film Lab</h4>
                  <p><strong>{recommendation.filmLab?.name || 'No lab found'}</strong></p>
                  <p>{recommendation.filmLab?.city}, {recommendation.filmLab?.country}</p>
                  <p>Rating: {recommendation.filmLab?.rating || 'N/A'}</p>
                  <p>Price range: {recommendation.filmLab?.priceRange || 'N/A'}</p>
                </article>
                <article className="highlight-card">
                  <h4>Suggested package</h4>
                  {recommendation.package ? (
                    <>
                      <p><strong>{recommendation.package.title}</strong></p>
                      <p>{recommendation.package.description}</p>
                      <p>Price: {recommendation.package.price ? `${recommendation.package.price}đ` : 'N/A'}</p>
                    </>
                  ) : (
                    <p>No package match found.</p>
                  )}
                </article>
                <article className="highlight-card">
                  <h4>Film type</h4>
                  <p>{recommendation.filmType || 'Not available'}</p>
                  <p>Recommended for your project and preferences.</p>
                </article>
              </div>
            </div>
          )}

          <div className="ai-footer-card">
            <div>
              <strong>Why these recommendations?</strong>
              <ul>
                <li>High quality scanning results</li>
                <li>Based on available lab and package data</li>
                <li>Tailored to your location and budget</li>
              </ul>
            </div>
            <div>
              <strong>Why this matters</strong>
              <ul>
                <li>Fast turnaround time</li>
                <li>Convenient location</li>
                <li>Trusted analog results</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
