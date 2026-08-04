import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { LayoutDashboard, Users, AlertOctagon, Settings, FileText, Activity, LogOut, Server } from 'lucide-react';

export const AdminLayout = () => {
  const { admin, adminLogout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Incidents', path: '/admin/incidents', icon: AlertOctagon },
    { name: 'Reports', path: '/admin/reports', icon: FileText },
    { name: 'Analytics', path: '/admin/analytics', icon: Activity },
    { name: 'System', path: '/admin/system', icon: Server },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
            <span className="text-cyan-400 font-bold">A</span>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">SafeNova Admin</h1>
            <p className="text-xs text-slate-500 font-mono">{admin?.role}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold">
              {admin?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{admin?.name}</p>
              <p className="text-xs text-slate-500 truncate">{admin?.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg text-sm font-bold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0a0c16]">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-8 shrink-0">
          <h2 className="text-lg font-semibold text-slate-100">Command Center</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-mono text-emerald-400">SYSTEM ONLINE</span>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
