import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJson } from '../../lib/api';

export default function CommunityDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    async function loadPost() {
      setLoading(true);
      try {
        const data = await fetchJson(`/api/community/posts/${id}`);
        setPost(data);
      } catch (err) {
        setError(err.message || 'Could not load post');
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [id]);

  return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Community</p>
        <h1>{post ? post.title : 'Post details'}</h1>
        <p>Read the full discussion, author notes, and community updates from the film photography network.</p>
      </section>

      <section className="card" style={{ maxWidth: 980 }}>
        {loading ? (
          <p>Loading post...</p>
        ) : error ? (
          <div className="callout">{error}</div>
        ) : post ? (
          <div className="detail-grid">
            <div className="detail-panel">
              <div className="detail-meta">
                <span>Author</span>
                <span>{post.author?.name || 'Anonymous'}</span>
              </div>
              <div className="detail-meta">
                <span>Tags</span>
                <span>{post.tags?.join(', ') || 'None'}</span>
              </div>
              <p>{post.body}</p>
            </div>

            <aside className="detail-panel">
              <div className="card-meta">
                <span>Published</span>
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="card-meta">
                <span>Comments</span>
                <span>{post.comments?.length ?? 0}</span>
              </div>
              <div className="card-meta">
                <span>Reactions</span>
                <span>{post.reactions || 0}</span>
              </div>
              <div className="card-footer" style={{ marginTop: '1.5rem' }}>
                <Link href="/community" className="button secondary">Back to community</Link>
                <button type="button" className="button">Join discussion</button>
              </div>
            </aside>
          </div>
        ) : (
          <p>Post not found.</p>
        )}
      </section>
    </main>
  );
}
