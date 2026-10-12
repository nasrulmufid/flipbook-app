import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, LayoutDashboard, Library, KeyRound, LogOut, Moon, Sun, Menu, ExternalLink } from 'lucide-react';
import { useAuth } from '../../lib/auth.jsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/books', label: 'Kelola Buku', icon: Library },
  { to: '/admin/account', label: 'Akun', icon: KeyRound },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(document.documentElement.getAttribute('data-theme') === 'dark');

  useEffect(() => { setOpen(false); document.title = 'Dashboard — FlipBook'; }, [loc.pathname]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('fb_theme', next ? 'dark' : 'light'); } catch { /* abaikan */ }
  };

  const sidebar = (
    <aside className="sidebar h-full" style={{ borderInlineEnd: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="sidebar__header">
        <Link to="/admin" className="sidebar__brand"><BookOpen size={20} /> FlipBook</Link>
      </div>
      <div className="sidebar__content">
        <div className="sidebar__group">
          <div className="sidebar__group-title">Menu</div>
          <ul className="sidebar__list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to} className="sidebar__item">
                <NavLink to={to} end={end} className="sidebar__button" style={({ isActive }) => (isActive ? { background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' } : undefined)}>
                  <Icon size={18} /><span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="sidebar__footer">
        <Link to="/" className="sidebar__button" target="_blank"><ExternalLink size={18} /><span>Lihat situs</span></Link>
      </div>
    </aside>
  );

  return (
    <div className="flex h-full" style={{ background: 'var(--color-background)', color: 'var(--color-foreground)' }}>
      <div className="hidden h-full lg:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="navbar" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <button type="button" className="button button--neutral button--ghost button--icon-only lg:!hidden" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu size={18} /></button>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="button button--neutral button--ghost button--icon-only" aria-label="Ganti tema" onClick={toggleTheme}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <span className="hidden text-sm sm:inline" style={{ color: 'var(--color-muted-foreground)' }}>{user?.name || user?.username}</span>
            <button type="button" className="button button--neutral button--outline button--sm" onClick={async () => { await logout(); nav('/admin/login'); }}><LogOut size={16} /> Keluar</button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <div className="mx-auto max-w-6xl"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
