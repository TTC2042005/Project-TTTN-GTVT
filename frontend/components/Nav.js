import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getUser, removeUser, removeToken } from '../lib/auth';

const navLinks = [
  { href: '/labs', label: 'Film Labs' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/community', label: 'Community' },
  { href: '/events', label: 'Events' },
  { href: '/recommendations', label: 'AI' },
  { href: '/chatbot', label: 'Chatbot' },
];

export default function Nav() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('film-lab-theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const nextTheme = storedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(nextTheme);
    document.body.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    if (theme) {
      document.body.dataset.theme = theme;
      window.localStorage.setItem('film-lab-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    try {
      const u = getUser();
      if (u) setUser(u);
    } catch (e) {
      // ignore
    }
  }, []);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return (
    <header className="topbar">
      <div className="brand-group">
        <Link href="/" className="brand">Film Lab</Link>
        <button
          type="button"
          className={`nav-toggle ${menuOpen ? 'open' : ''}`}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <nav className={menuOpen ? 'nav-open' : ''}>
        {navLinks.map((item) => {
          const isActive = router.asPath === item.href || router.asPath.startsWith(item.href + '/') || (item.href === '/events' && router.asPath.startsWith('/events'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          );
        })}
        {!user && (
          <>
            <Link href="/login" className={`nav-link ${router.pathname === '/login' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Login</Link>
            <Link href="/register" className={`nav-link ${router.pathname === '/register' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Register</Link>
          </>
        )}
        {user && (
          <div className="nav-user">
            <span className="nav-username">{user.name || user.email}</span>
            <button type="button" className="nav-link logout-btn" onClick={() => {
              removeToken();
              removeUser();
              setUser(null);
              router.push('/');
            }}>Logout</button>
          </div>
        )}
        <button type="button" className="theme-switcher" onClick={toggleTheme}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </nav>
    </header>
  );
}
