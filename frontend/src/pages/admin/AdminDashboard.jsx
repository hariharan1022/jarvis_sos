import React, { useEffect, useState } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Users, AlertTriangle, CheckCircle, Activity, Server, Database, Globe, Mail, MessageSquare, Phone } from 'lucide-react';

export const AdminDashboard = () => {
  const { adminToken, API_URL } = useAdminAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!stats) return <div className="text-slate-400 p-8">Loading dashboard...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">System Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} color="text-cyan-400" bg="bg-cyan-500/10" />
        <StatCard title="Online Users" value={stats.onlineUsers} icon={Globe} color="text-emerald-400" bg="bg-emerald-500/10" />
        <StatCard title="Active Emergencies" value={stats.activeEmergencies} icon={AlertTriangle} color="text-rose-500" bg="bg-rose-500/10" />
        <StatCard title="Resolved Emergencies" value={stats.resolvedEmergencies} icon={CheckCircle} color="text-slate-400" bg="bg-slate-800" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        
        {/* System Health */}
        <div className="glass-panel p-6 rounded-xl bg-slate-900 border border-slate-800 col-span-1 lg:col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Infrastructure Health
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <HealthIndicator name="Server Engine" status={stats.serverHealth} icon={Server} />
            <HealthIndicator name="Database" status={stats.databaseStatus} icon={Database} />
            <HealthIndicator name="API Gateway" status={stats.apiStatus} icon={Activity} />
            <HealthIndicator name="SMTP Relay" status="Online" icon={Mail} />
            <HealthIndicator name="SMS Gateway" status="Online" icon={MessageSquare} />
            <HealthIndicator name="WhatsApp API" status="Online" icon={Phone} />
          </div>
        </div>

        {/* Live Activity Feed Placeholder */}
        <div className="glass-panel p-6 rounded-xl bg-slate-900 border border-slate-800">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Alerts</h2>
          <div className="space-y-3">
             <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-1">
               <span className="text-xs text-slate-500">Just now</span>
               <span className="text-sm text-slate-300">System boot sequence completed.</span>
             </div>
             <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-1">
               <span className="text-xs text-slate-500">2 mins ago</span>
               <span className="text-sm text-slate-300">Admin session authorized.</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, bg }) => (
  <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center`}>
      <Icon className={`w-6 h-6 ${color}`} />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <h3 className="text-2xl font-bold text-white">{value}</h3>
    </div>
  </div>
);

const HealthIndicator = ({ name, status, icon: Icon }) => {
  const isGood = status === 'Good' || status === 'Online' || status === 'Connected';
  return (
    <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-400 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isGood ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
        <span className={`text-sm font-bold ${isGood ? 'text-emerald-400' : 'text-rose-400'}`}>{status}</span>
      </div>
    </div>
  );
};
