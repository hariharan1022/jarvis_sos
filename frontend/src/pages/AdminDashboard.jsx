import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, AlertTriangle, Users, Heart, Power, ShieldAlert, CheckCircle2, Radio, Server, MessageSquare } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const AdminDashboard = () => {
  const { token, logout, API_URL } = useAuth();
  const [activeCases, setActiveCases] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    activeCount: 0,
    totalUsers: 24,
    resolvedCount: 18,
    systemLoad: '0.04 ms'
  });
  
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchActiveCases();
    fetchSystemLogs();
    
    // Auto-update statistics
    const timer = setInterval(() => {
      fetchActiveCases();
      fetchSystemLogs();
    }, 8000);

    return () => {
      clearInterval(timer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Connect WebSocket to get live dispatch prompts
  useEffect(() => {
    connectAdminWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connectAdminWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8000/api/ws/admin');
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'new_emergency' || message.type === 'location_update' || message.type === 'emergency_resolved') {
        fetchActiveCases();
        fetchSystemLogs();
      }
    };
  };

  const fetchActiveCases = async () => {
    try {
      const res = await fetch(`${API_URL}/emergency/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCases(data);
        setStats(prev => ({
          ...prev,
          activeCount: data.length
        }));
        
        // Redraw map points
        setTimeout(() => updateMapMarkers(data), 100);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSystemLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/emergency/notification-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.reverse());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolve = async (userId) => {
    // Dismiss/Resolve user emergency session
    // Normally admin resolves or calls the user to check
    // We will bypass and call the resolve API on behalf of user email
    try {
      // Find session to resolve
      const session = activeCases.find(c => c.user_id === userId);
      if (!session) return;
      
      const res = await fetch(`${API_URL}/emergency/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchActiveCases();
        setStats(prev => ({
          ...prev,
          resolvedCount: prev.resolvedCount + 1
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Map Setup
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([12.9716, 77.5946], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);
      
      mapInstanceRef.current = map;
      
      // Load Heatmap overlays (crime zones)
      loadCrimeZones(map);
    }
  }, []);

  const loadCrimeZones = async (map) => {
    try {
      const res = await fetch(`${API_URL}/ai/incidents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        data.forEach(zone => {
          L.circle([zone.lat, zone.lng], {
            color: '#ff0844',
            fillColor: '#ff0844',
            fillOpacity: 0.15,
            radius: 800
          }).addTo(map).bindPopup(`High Risk Crime Zone: ${zone.name}`);
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateMapMarkers = (cases) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing incident markers
    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];

    cases.forEach(c => {
      if (c.last_lat && c.last_lng) {
        const markerIcon = L.divIcon({
          className: 'relative',
          html: '<div class="pulse-ring"></div><div class="w-3.5 h-3.5 bg-rose-500 rounded-full border border-white"></div>',
          iconSize: [24, 24]
        });

        const m = L.marker([c.last_lat, c.last_lng], { icon: markerIcon })
          .addTo(map)
          .bindPopup(`Active SOS: User ID ${c.user_id} (${c.emergency_type})`);
        
        layersRef.current.push(m);
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100 flex flex-col w-full">
      {/* Admin header */}
      <header className="bg-[#0f111a] border-b border-slate-800 p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-cyan-400" />
          <div>
            <h1 className="text-xl font-extrabold text-white">SafeNova AI Admin Command</h1>
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">HQ Operations Desk</span>
          </div>
        </div>
        <button onClick={logout} className="btn-glass py-2 px-5 text-xs text-rose-400 cursor-pointer">
          Logout Shell
        </button>
      </header>

      {/* Grid statistics */}
      <main className="p-6 md:p-10 flex-1 flex flex-col gap-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="glass-panel p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Active Emergencies</span>
              <div className="text-2xl font-black text-rose-500 mt-1 animate-pulse">{stats.activeCount} Critical</div>
            </div>
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <div className="glass-panel p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Total User Cards</span>
              <div className="text-2xl font-black text-white mt-1">{stats.totalUsers} Profiles</div>
            </div>
            <Users className="w-8 h-8 text-cyan-400" />
          </div>
          <div className="glass-panel p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Resolved Cases</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">{stats.resolvedCount} Closed</div>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="glass-panel p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Gateway Latency</span>
              <div className="text-2xl font-black text-cyan-400 mt-1">{stats.systemLoad}</div>
            </div>
            <Server className="w-8 h-8 text-cyan-400" />
          </div>
        </div>

        {/* Live Tracking map and Active list */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Map panel */}
          <div className="lg:col-span-2 glass-panel p-4 h-[440px]">
            <div ref={mapContainerRef} className="w-full h-full" />
          </div>

          {/* Active Cases list */}
          <div className="glass-panel p-6 flex flex-col gap-4 max-h-[440px] overflow-y-auto">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-rose-500 animate-pulse" /> Active Dispatches
            </h3>
            {activeCases.length === 0 ? (
              <p className="text-xs text-slate-500">No active emergencies detected. System status nominal.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {activeCases.map(c => (
                  <div key={c.id} className="bg-red-950/20 border border-red-900/50 p-4 rounded-lg flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold text-xs text-white">Device ID: {c.user_id}</span>
                        <p className="text-[10px] text-rose-400 font-bold uppercase mt-0.5">Trigger: {c.emergency_type}</p>
                      </div>
                      <span className="text-[9px] bg-red-900/40 text-red-400 px-2 py-0.5 rounded border border-red-800">BAT: {c.battery}%</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-snug truncate">Last Loc: {c.last_address}</p>
                    <div className="flex gap-2 mt-1">
                      <button 
                        onClick={() => handleResolve(c.user_id)}
                        className="w-full py-1.5 bg-red-800 hover:bg-red-700 active:bg-red-900 text-white font-bold rounded text-[10px] cursor-pointer"
                      >
                        Resolve SOS
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dispatch notification logs */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" /> Outbound Dispatch Alerts
          </h3>
          <p className="text-xs text-slate-400">Chronological feed of mock SMS, WhatsApp, Email messages dispatched to user trusted contacts.</p>
          
          <div className="flex flex-col gap-3 max-h-60 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500">No outbound notifications logged.</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex justify-between items-start bg-slate-900/50 p-3.5 border border-slate-800 rounded-lg text-xs leading-relaxed">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-medium text-[8px]">{log.channel}</span>
                      <span className="font-bold text-white">{log.recipient}</span>
                    </div>
                    <p className="text-slate-300 font-mono text-[11px] whitespace-pre-wrap">{log.message}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
