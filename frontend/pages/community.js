import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { API_BASE, fetchJson } from '../lib/api';
import { authHeaders, getToken } from '../lib/auth';

const categoryPills = [
  'All Posts',
  'Discussions',
  'Reviews',
  'Showcase',
  'Tips & Tutorials',
  'Lab Experiences',
  'Gear Talk',
  'Events',
];

const trendingDiscussions = [
  {
    label: 'Discussion',
    title: 'Best 35mm film for street photography?',
    replies: '24 replies',
    time: '2h ago',
    image: '/film-camera.jpg',
  },
  {
    label: 'Tips',
    title: 'How I scan my films for the best quality',
    replies: '18 replies',
    time: '5h ago',
    image: '/Film-camera.png',
  },
  {
    label: 'Gear',
    title: 'Contax T2 vs Olympus mju III',
    replies: '31 replies',
    time: '8h ago',
    image: '/film-camera.jpg',
  },
  {
    label: 'Lab Review',
    title: 'Sông Hồng Lab experience review',
    replies: '15 replies',
    time: '1d ago',
    image: '/Film-camera.png',
  },
];

const tags = ['#filmstock', '#streetphotography', '#filmdeveloping', '#analog', '#35mm', '#labreview'];

const communityStats = [
  { label: 'Active Members', value: '12.5K+' , change: '+8% this month'},
  { label: 'Posts Created', value: '45.2K+' , change: '+12% this month'},
  { label: 'Discussions', value: '3.1K+' , change: '+15% this month'},
  { label: 'Photos Shared', value: '18.7K+' , change: '+10% this month'},
];

const topContributors = [
  { name: 'Linh Le', handle: '@linhle.film', role: 'Expert', points: '2.1K' },
  { name: 'Hoàng Nam', handle: '@hn.film', role: 'Pro', points: '1.8K' },
  { name: 'Mai Phương', handle: '@maip', role: 'Pro', points: '1.4K' },
];

export default function Community() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [composerMode, setComposerMode] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const debounceTimer = window.setTimeout(() => {
      async function load() {
        setLoading(true);
        setError('');
        try {
          const response = await fetchJson(`/api/community/posts?q=${encodeURIComponent(query)}`, { signal: controller.signal });
          setPosts(response);
        } catch (err) {
          if (err.name === 'AbortError') return;
          setError(err.message);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      }
      load();
    }, 300);

    return () => {
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => () => imagePreviews.forEach((url) => URL.revokeObjectURL(url)), [imagePreviews]);

  function openComposer(mode) {
    if (!getToken()) {
      router.push(`/login?returnTo=${encodeURIComponent('/community')}`);
      return;
    }
    setComposerMode(mode);
    setSubmitError('');
  }

  function closeComposer() {
    setComposerMode('');
    setTitle('');
    setBody('');
    setTagInput('');
    setImageFiles([]);
    setImagePreviews([]);
    setSubmitError('');
  }

  function handleImageSelection(event) {
    const files = Array.from(event.target.files || []);
    if (files.length > 5) {
      setSubmitError('Bạn chỉ có thể đăng tối đa 5 ảnh trong một bài.');
      event.target.value = '';
      return;
    }
    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
    setSubmitError('');
  }

  async function submitPost(event) {
    event.preventDefault();
    if (composerMode === 'photo' && imageFiles.length === 0) {
      setSubmitError('Hãy chọn ít nhất một ảnh để chia sẻ.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const imageIds = [];
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append('photo', file);
        const response = await fetch(`${API_BASE}/api/uploads`, {
          method: 'POST',
          headers: authHeaders(),
          body: formData,
        });
        const upload = await response.json();
        if (!response.ok) throw new Error(upload.error || 'Không thể tải ảnh lên.');
        imageIds.push(upload.id);
      }

      const createdPost = await fetchJson('/api/community/posts', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          tags: tagInput.split(',').map((tag) => tag.trim()).filter(Boolean),
          visibility: 'public',
          imageIds,
        }),
      });
      setPosts((currentPosts) => [createdPost, ...currentPosts]);
      closeComposer();
    } catch (err) {
      setSubmitError(err.message || 'Không thể đăng bài. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="community-page">
      <section className="community-hero container">
        <div className="community-hero-copy">
          <p className="hero-tag">Join the film photography community.</p>
          <h1>Share stories, get inspired, ask questions, and connect with film lovers around the world.</h1>
          <p>Discover trending discussions, showcase your work, and learn from an active analog photography community.</p>
          <div className="community-actions">
            <button type="button" className="button" onClick={() => openComposer('post')}>Tạo bài viết</button>
            <button type="button" className="button secondary" onClick={() => openComposer('photo')}>Chia sẻ ảnh</button>
          </div>
          <div className="community-stats-row">
            <div className="member-stack">👤👤👤👤👤</div>
            <span>12.5K+ film lovers • 2.3K+ posts this month</span>
          </div>
        </div>
        <div className="community-hero-visual">
          <img src="/film-camera.jpg" alt="Community hero" className="hero-visual-img" />
        </div>
      </section>

      <section className="community-topbar container">
        <div className="pill-list">
          {categoryPills.map((pill) => (
            <button key={pill} className={`pill ${pill === 'All Posts' ? 'active' : ''}`}>{pill}</button>
          ))}
        </div>
      </section>

      <section className="community-main container">
        <div className="community-main-left">
          <div className="section-heading">
            <h2>🔥 Trending Discussions</h2>
            <Link href="/community" className="view-all">View all →</Link>
          </div>
          <div className="trending-grid">
            {trendingDiscussions.map((item) => (
              <article key={item.title} className="trending-card">
                <div className="trending-image" style={{ backgroundImage: `url(${item.image})` }}>
                  <span className="trending-label">{item.label}</span>
                </div>
                <div className="trending-copy">
                  <h3>{item.title}</h3>
                  <div className="trending-meta">
                    <span>{item.replies}</span>
                    <span>{item.time}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="latest-posts-card">
            <div className="section-heading">
              <h2>Latest community posts</h2>
            </div>

            {loading ? (
              <div className="lab-list-loading">Loading posts…</div>
            ) : error ? (
              <div className="lab-list-error">{error}</div>
            ) : posts.length === 0 ? (
              <div className="lab-list-empty">No posts found right now.</div>
            ) : (
              <div className="latest-posts-list">
                {posts.map((post) => (
                  <article key={post.id} className="latest-post-item">
                    <div className="post-author-row">
                      <div>
                        <strong>{post.author?.name || 'Anonymous'}</strong>
                        <span>@{post.author?.name?.toLowerCase().replace(/\s+/g, '') || 'user'}</span>
                      </div>
                      <span className="pill small">{post.visibility === 'public' ? 'Public' : 'Private'}</span>
                    </div>
                    <Link href={`/community/${post.id}`}><h3>{post.title}</h3></Link>
                    <p>{post.body.slice(0, 140)}{post.body.length > 140 ? '...' : ''}</p>
                    {post.imageUrls?.length > 0 && (
                      <div className="post-image-row">
                        {post.imageUrls.map((imageUrl) => (
                          <img key={imageUrl} src={`${API_BASE}${imageUrl}`} alt={`Ảnh trong bài viết: ${post.title}`} />
                        ))}
                      </div>
                    )}
                    <div className="post-meta-row">
                      <span>{post.tags?.join(', ') || 'Community'}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="community-sidebar">
          <div className="sidebar-card">
            <div className="form-control">
              <label htmlFor="search">Search community</label>
              <input
                id="search"
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics, posts, users..."
              />
            </div>
          </div>

          <div className="sidebar-card">
            <div className="card-header">
              <h3>Popular Tags</h3>
              <Link href="/community">View all</Link>
            </div>
            <div className="tag-grid">
              {tags.map((tag) => (
                <span key={tag} className="tag-pill">{tag}</span>
              ))}
            </div>
          </div>

          <div className="sidebar-card stats-card">
            <h3>Community Stats</h3>
            <div className="stats-grid">
              {communityStats.map((item) => (
                <div key={item.label} className="stat-item">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                  <small>{item.change}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-card">
            <div className="card-header">
              <h3>Top Contributors</h3>
              <Link href="/community">View leaderboard</Link>
            </div>
            <div className="contributors-list">
              {topContributors.map((person) => (
                <div key={person.name} className="contributor-item">
                  <div>
                    <strong>{person.name}</strong>
                    <span>{person.handle}</span>
                  </div>
                  <div>
                    <span className="pill small">{person.role}</span>
                    <strong>{person.points}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
      {composerMode && (
        <div className="community-composer-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submitting) closeComposer();
        }}>
          <section className="community-composer" role="dialog" aria-modal="true" aria-labelledby="community-composer-title">
            <div className="section-heading">
              <h2 id="community-composer-title">{composerMode === 'photo' ? 'Chia sẻ ảnh với cộng đồng' : 'Tạo bài viết mới'}</h2>
              <button type="button" className="button secondary" onClick={closeComposer} disabled={submitting}>Đóng</button>
            </div>
            <form className="form-grid" onSubmit={submitPost}>
              <label className="form-control">
                <span>Tiêu đề</span>
                <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} required placeholder="Tiêu đề bài viết" />
              </label>
              <label className="form-control">
                <span>Nội dung</span>
                <textarea className="input textarea" rows={5} value={body} onChange={(event) => setBody(event.target.value)} required placeholder="Chia sẻ câu chuyện, mẹo chụp hoặc thông tin về ảnh..." />
              </label>
              <label className="form-control">
                <span>Thẻ (phân cách bằng dấu phẩy)</span>
                <input className="input" value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="film, street photography" />
              </label>
              <label className="form-control">
                <span>Ảnh (tối đa 5 ảnh, mỗi ảnh tối đa 15 MB)</span>
                <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/tiff,image/avif" multiple onChange={handleImageSelection} />
              </label>
              {imagePreviews.length > 0 && (
                <div className="community-image-previews">
                  {imagePreviews.map((url) => <img key={url} src={url} alt="Xem trước ảnh bài đăng" />)}
                </div>
              )}
              {submitError && <p className="callout" role="alert">{submitError}</p>}
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? 'Đang đăng bài…' : 'Đăng công khai'}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
