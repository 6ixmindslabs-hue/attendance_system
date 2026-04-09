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
    <div className="flex min-h-screen bg-gray-50/50 text-gray-900 font-sans">
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="fixed right-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 shadow-sm lg:hidden"
        aria-label="Toggle navigation"
      >
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gray-900 text-white transition-transform duration-300 lg:static lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-gray-800 px-8 py-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
               <ShieldCheck size={20} className="text-white" />
            </div>
            <span className="text-base font-bold uppercase tracking-widest text-white">Registry UI</span>
          </div>
        </div>

        <div className="px-8 py-6 border-b border-gray-800 bg-black/20">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Operator Console</span>
            <span className="text-sm font-bold text-white truncate">{session?.user?.name || 'Institutional Admin'}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-1 custom-scrollbar">
          {navigationItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeMenu}
              className={({ isActive }) => `flex items-center gap-4 rounded px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-800 p-6 bg-black/10">
          <button
            onClick={logout}
            className="flex w-full items-center justify-between gap-3 rounded border border-gray-800 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-gray-800 hover:text-white transition-all group"
          >
            <div className="flex items-center gap-3">
               <LogOut size={14} />
               <span>Terminate Session</span>
            </div>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md px-8 py-4 sm:px-12">
          <div className="flex max-w-7xl mx-auto items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="w-1 h-6 bg-indigo-600 rounded-full hidden sm:block" />
               <h1 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">{currentNavLabel}</h1>
            </div>
            <div className="flex items-center gap-4">
               <div className="hidden md:flex items-center gap-2 border border-gray-200 px-3 py-1.5 rounded bg-gray-50">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">System Nominal</span>
               </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 sm:p-12 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-gray-900/40 backdrop-blur-sm lg:hidden"
          onClick={closeMenu}
        />
      )}
    </div>
  );
}
