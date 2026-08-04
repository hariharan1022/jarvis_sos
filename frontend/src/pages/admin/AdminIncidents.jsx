import React, { useEffect, useState } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { AlertCircle, CheckCircle, MapPin, Clock } from 'lucide-react';

export const AdminIncidents = () => {
  const { adminToken, API_URL } = useAdminAuth();
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/incidents`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        setIncidents(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white mb-6">Incident Management</h1>

      <div className="grid grid-cols-1 gap-4">
        {incidents.map(inc => (
          <div key={inc.id} className={`p-5 rounded-xl border ${inc.active ? 'bg-rose-950/20 border-rose-500/30' : 'bg-slate-900 border-slate-800'} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
            <div className="flex gap-4 items-start">
              <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center ${inc.active ? 'bg-rose-500/20 text-rose-500' : 'bg-slate-800 text-slate-400'}`}>
                {inc.active ? <AlertCircle className="w-5 h-5 animate-pulse" /> : <CheckCircle className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className={`font-bold ${inc.active ? 'text-rose-400' : 'text-slate-300'}`}>
                    Incident #{inc.id}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-slate-800 text-slate-300 uppercase">
                    {inc.emergency_type}
                  </span>
                  {inc.active && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase animate-pulse">
                      ACTIVE
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate">{inc.last_address || 'Location Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(inc.start_time).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500">Tracking Code:</span>
                    <span className="font-mono text-cyan-400">{inc.tracking_code}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors">
                View Details
              </button>
            </div>
          </div>
        ))}
        {incidents.length === 0 && (
          <div className="p-8 text-center text-slate-500 italic bg-slate-900 border border-slate-800 rounded-xl">
            No incidents recorded.
          </div>
        )}
      </div>
    </div>
  );
};
