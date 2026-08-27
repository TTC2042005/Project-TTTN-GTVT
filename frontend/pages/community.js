import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJson } from '../lib/api';

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
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetchJson(`/api/community/posts?q=${encodeURIComponent(query)}`);
        setPosts(response);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [query]);

  return (
    <main className="community-page">
      <section className="community-hero container">
        <div className="community-hero-copy">
          <p className="hero-tag">Join the film photography community.</p>
          <h1>Share stories, get inspired, ask questions, and connect with film lovers around the world.</h1>
          <p>Discover trending discussions, showcase your work, and learn from an active analog photography community.</p>
          <div className="community-actions">
            <button className="button">Create Post</button>
            <button className="button secondary">Share a Photo</button>
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
              <span>Newest updates from the forum.</span>
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
    </main>
  );
}
