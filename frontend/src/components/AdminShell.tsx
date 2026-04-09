import { useState } from 'react';
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
  X,
  Bell
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

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {/* Mobile Menu Toggle */}
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="fixed right-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm lg:hidden"
        aria-label="Toggle navigation"
      >
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${menuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center px-6 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg"><ShieldCheck size={18}/></span>
            </div>
            <span className="font-semibold text-[17px] tracking-tight text-gray-900">Attendify OS</span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-1">
          <div className="px-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Main Menu</div>
          {navigationItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeMenu}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium text-[14px] ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-indigo-600' : 'text-gray-400'} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
           <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                {session?.user?.name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{session?.user?.name || 'Administrator'}</p>
                <p className="text-xs text-gray-500 truncate">{session?.user?.email || 'admin@institution.edu'}</p>
              </div>
           </div>
           <button
             onClick={logout}
             className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors"
           >
             <LogOut size={16} /> Sign out
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F9FAFB]">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 lg:px-8 z-10 shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-800 hidden sm:block">Campus Operations</h1>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
              Live
            </span>
          </div>
          
          <div className="flex items-center gap-5">
            <div className="hidden sm:block text-xs font-mono text-gray-400 uppercase">
              {location.pathname}
            </div>
            <button className="text-gray-400 hover:text-gray-600 transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 border-2 border-white rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      
      {/* Mobile overlay */}
      {menuOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-30 lg:hidden"
          onClick={closeMenu}
        />
      )}
    </div>
  );
}
