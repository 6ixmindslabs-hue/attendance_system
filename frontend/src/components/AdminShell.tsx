import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ChartColumnBig,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorSmartphone,
  Settings2,
  ShieldCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';

const navigationItems = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/register-student', label: 'Onboard Student', icon: UserPlus },
  { to: '/admin/students', label: 'Student Directory', icon: Users },
  { to: '/admin/reports', label: 'Reports', icon: ChartColumnBig },
  { to: '/admin/settings', label: 'Settings', icon: Settings2 },
  { to: '/kiosk', label: 'Kiosk Mode', icon: MonitorSmartphone }
] as const;

export default function AdminShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { session, logout } = useAuth();
  const location = useLocation();

  const closeMenu = () => setMenuOpen(false);

  const currentNavLabel = useMemo(() => (
    navigationItems.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))?.label || 'Campus Operations'
  ), [location.pathname]);

  return (
    <div className="flex min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef6fb_46%,#edf2f9_100%)] text-slate-900">
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="fixed right-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
        aria-label="Toggle navigation"
      >
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[290px] flex-col border-r border-slate-200 bg-slate-950 text-white transition-transform duration-300 lg:static lg:translate-x-0 ${menuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 shadow-[0_20px_40px_rgba(34,211,238,0.24)]">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/75">Attendance OS</div>
              <div className="mt-1 text-lg font-semibold text-white">Admin Workspace</div>
            </div>
          </div>
        </div>

        <div className="px-4 py-5">
          <div className="rounded-[28px] border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Signed in</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-sm font-semibold text-cyan-100">
                {session?.user?.name?.charAt(0) || 'A'}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{session?.user?.name || 'Administrator'}</p>
                <p className="truncate text-sm text-slate-400">{session?.user?.email || 'admin@institution.edu'}</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Navigation</div>
          <div className="space-y-1.5">
            {navigationItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={closeMenu}
                className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'bg-cyan-400 text-slate-950 shadow-[0_16px_30px_rgba(34,211,238,0.22)]'
                    : 'text-slate-300 hover:bg-white/6 hover:text-white'
                }`}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} className={isActive ? 'text-slate-950' : 'text-slate-500'} />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={logout}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 px-6 py-5 backdrop-blur-xl sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Campus Operations</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{currentNavLabel}</h1>
            </div>

            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
              {location.pathname}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={closeMenu}
        />
      ) : null}
    </div>
  );
}
