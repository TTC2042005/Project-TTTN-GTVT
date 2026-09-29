import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetchJson } from '../lib/api';

const suggestedTopics = [
  'Máy ảnh nào có giá niêm yết cao nhất trên website?',
  'Ống kính nào đắt nhất trong Marketplace?',
  'Marketplace hiện có những loại sản phẩm nào?',
  'Phim nào phù hợp chụp chân dung?',
  'Phim nào hay nhất để chụp phong cảnh?',
  'Website hiện có những dịch vụ Film Lab nào?',
  'Có workshop hoặc photowalk nào sắp tới?',
  'Website của tôi đang dùng những công nghệ gì?',
  'Làm sao để theo dõi đơn hàng Film Lab?',
  'Website phân tích chất lượng ảnh như thế nào?',
  'Best labs in Hà Nội for C41 scanning',
  'Phòng phim tốt nhất ở Vũng Tàu nằm ở đâu?',
  'Phòng phim nào có ở Đà Lạt và Tây Ninh?',
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
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [history, loading]);

  async function handleSubmit(e) {
    e.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion || loading) return;

    setLoading(true);
    setError('');
    setQuestion('');
    const userMessage = { sender: 'user', text: submittedQuestion, time: new Date().toLocaleTimeString() };
    setHistory((prev) => [...prev, userMessage]);

    try {
      const response = await fetchJson('/api/ai/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: submittedQuestion,
          history: history.slice(-8).map((message) => ({
            role: message.sender === 'bot' ? 'assistant' : 'user',
            content: message.text,
          })),
        }),
      });
      const botMessage = {
        sender: 'bot',
        text: response.answer || 'Chưa tìm được câu trả lời phù hợp. Vui lòng thử câu hỏi khác.',
        time: new Date().toLocaleTimeString(),
        source: response.source,
        fallback: response.fallback,
        items: response.items || [],
        documents: response.documents || [],
      };
      setHistory((prev) => [...prev, botMessage]);
    } catch (err) {
      setError(err.message || 'Unable to connect to the assistant.');
      setQuestion(submittedQuestion);
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
            <span className="hero-tag">Trợ lý AI Film Lab</span>
            <h1>Hỏi về phim, máy ảnh và dữ liệu trên website.</h1>
            <p className="hero-description">AI có thể tư vấn chọn film, tìm sản phẩm có giá cao nhất trong catalog và trả lời về Film Lab. Câu hỏi về website sẽ dựa trên dữ liệu hiện có.</p>
          </div>
          <div className="chatbot-side-card">
            <img src="/Film-camera.png" alt="Film camera" className="hero-visual-img" />
            <div className="suggested-topics">
              <strong>Gợi ý câu hỏi</strong>
              <ul>
                {suggestedTopics.map((topic) => (
                  <li key={topic}>
                    <button type="button" className="link-button" onClick={() => handleTopicClick(topic)}>{topic}</button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="recent-conversations">
              <strong>Cuộc trò chuyện</strong>
              <button type="button" className="button secondary" onClick={clearConversation}>Xóa hội thoại</button>
            </div>
          </div>
        </section>

        <section className="register-card chatbot-card">
          <div className="register-header">
            <p className="eyebrow">Film Lab AI 👋</p>
            <h2>Tôi có thể giúp gì cho bạn?</h2>
            <p className="register-subtitle">Ví dụ: “Máy ảnh nào có giá cao nhất trên website?”, “Phim nào hay cho chân dung?” hoặc “Lab nào ở Hà Nội có dịch vụ scan?”.</p>
          </div>

          <div className="chat-flow">
            {history.length === 0 ? (
              <div className="chat-helper">
                <p>Hỏi bằng tiếng Việt hoặc tiếng Anh. Câu trả lời về sản phẩm lấy từ catalog hiện tại; câu hỏi chọn phim là gợi ý tham khảo theo thể loại chụp.</p>
              </div>
            ) : (
                history.map((message, index) => (
                  <div key={`${message.sender}-${index}`} className={`chat-message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}>
                    {message.sender === 'bot' ? <p>{message.text}</p> : <span>{message.text}</span>}
                    {message.items?.map((item) => (
                      <article className="chat-result-card" key={item.title}>
                        {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" />}
                        <div><strong>{item.title}</strong><span>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: item.currency || 'USD', maximumFractionDigits: 0 }).format(item.price)}</span></div>
                        <Link href="/marketplace">Xem Marketplace</Link>
                      </article>
                    ))}
                    {message.documents?.length > 0 && <small>Nguồn kiến thức: {message.documents.map((doc) => doc.title).join(', ')}</small>}
                    {message.source && <small>Nguồn trả lời: {message.source}{message.fallback ? ' · trả lời theo dữ liệu cục bộ' : ''}</small>}
                    <small>{message.time}</small>
                  </div>
                ))
            )}
            {loading && <div className="chat-message bot-message" aria-live="polite"><p>Đang tìm thông tin phù hợp…</p></div>}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="register-form chatbot-form">
            <label className="input-group">
              <span>Câu hỏi của bạn</span>
              <textarea
                className="input textarea"
                rows={4}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ví dụ: Máy ảnh nào có giá niêm yết cao nhất trên website?"
                maxLength={1000}
              />
            </label>
            <div className="chatbot-footer">
              {error && <div className="form-error" role="alert">{error}</div>}
              <button type="submit" className="btn-register" disabled={loading || !question.trim()}>
                {loading ? 'Đang trả lời…' : 'Gửi câu hỏi'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
