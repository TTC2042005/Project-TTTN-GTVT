import { useState } from 'react';
import { fetchJson } from '../lib/api';

const suggestedTopics = [
  'Best labs in Hà Nội for C41 scanning',
  'Film stock for portraits',
  'Compare lab scanning quality',
  'Best value combo packages',
  'How to store film properly?',
  'Why are my photos overexposed?',
];

export default function Chatbot() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError('');
    const userMessage = { sender: 'user', text: question.trim(), time: new Date().toLocaleTimeString() };
    setHistory((prev) => [...prev, userMessage]);

    try {
      const response = await fetchJson('/api/ai/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      const botMessage = {
        sender: 'bot',
        text: response.answer || 'Sorry, I could not find an answer. Please try again.',
        time: new Date().toLocaleTimeString(),
      };
      setHistory((prev) => [...prev, botMessage]);
      setQuestion('');
    } catch (err) {
      setError(err.message || 'Unable to connect to the assistant.');
    } finally {
      setLoading(false);
    }
  }

  function handleTopicClick(topic) {
    setQuestion(topic);
  }

  function clearConversation() {
    setHistory([]);
    setError('');
  }

  return (
    <main className="register-page">
      <div className="register-shell">
        <section className="register-hero-panel chatbot-hero">
          <div className="hero-copy-panel">
            <span className="hero-tag">Film Lab Assistant</span>
            <h1>Your expert guide in the film photography world.</h1>
            <p className="hero-description">Ask anything about film photography, development, scanning, gear, labs, and more.</p>
          </div>
          <div className="chatbot-side-card">
            <img src="/Film-camera.png" alt="Film camera" className="hero-visual-img" />
            <div className="suggested-topics">
              <strong>Suggested topics</strong>
              <ul>
                {suggestedTopics.map((topic) => (
                  <li key={topic}>
                    <button type="button" className="link-button" onClick={() => handleTopicClick(topic)}>{topic}</button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="recent-conversations">
              <strong>Conversation</strong>
              <button type="button" className="button secondary" onClick={clearConversation}>Clear conversation</button>
            </div>
          </div>
        </section>

        <section className="register-card chatbot-card">
          <div className="register-header">
            <p className="eyebrow">Hi An! 👋</p>
            <h2>I’m your Film Lab Assistant.</h2>
            <p className="register-subtitle">Ask me anything about film photography, labs, gear, development, scanning, or the analog community.</p>
          </div>

          <div className="chat-flow">
            {history.length === 0 ? (
              <div className="chat-helper">
                <p>Type your question to get started. The assistant uses lab and photography knowledge to answer questions with helpful recommendations.</p>
              </div>
            ) : (
              history.map((message, index) => (
                <div key={`${message.sender}-${index}`} className={`chat-message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}>
                  {message.sender === 'bot' ? <p>{message.text}</p> : <span>{message.text}</span>}
                  <small>{message.time}</small>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmit} className="register-form chatbot-form">
            <label className="input-group">
              <span>Ask anything about film photography...</span>
              <textarea
                className="input textarea"
                rows={4}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Type your question here..."
              />
            </label>
            <div className="chatbot-footer">
              {error && <div className="form-error">{error}</div>}
              <button type="submit" className="btn-register" disabled={loading || !question.trim()}>
                {loading ? 'Searching...' : 'Send message'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
