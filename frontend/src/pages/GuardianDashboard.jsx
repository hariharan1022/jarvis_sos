import React, { useState, useEffect, useRef } from 'react';
import { Shield, MapPin, Battery, Wifi, Activity, Calendar, ShieldCheck, Heart, User, Radio } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const GuardianDashboard = () => {
  const [code, setCode] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [coordinates, setCoordinates] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState('');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const polylineRef = useRef(null);
  const wsRef = useRef(null);

  // Parse URL query parameter for automated tracking loading
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryCode = params.get('code');
    if (queryCode) {
      setCode(queryCode);
      handleTrack(queryCode);
    }
  }, []);

  const handleTrack = async (targetCode = code) => {
    if (!targetCode) return;
    setError('');
    setActiveSession(null);
    setTimeline([]);
    setCoordinates([]);

    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/emergency/track/${targetCode}`);
      if (!res.ok) {
        throw new Error('No active emergency session found for this code.');
      }
      const data = await res.json();
      setActiveSession(data);

      // Seed coordinates
      const seeds = data.location_logs.map(log => ({ lat: log.latitude, lng: log.longitude }));
      setCoordinates(seeds);

      // Build initial timeline items
      const initialTimeline = [
        { type: 'info', text: 'Emergency Triggered', time: data.start_time }
      ];
      data.evidence_items.forEach(ev => {
        initialTimeline.push({
          type: 'evidence',
          evidence_type: ev.type,
          url: `http://127.0.0.1:8000${ev.filepath}`,
          time: ev.timestamp
        });
      });
      setTimeline(initialTimeline.sort((a, b) => new Date(a.time) - new Date(b.time)));

      // Initialize map with starting position
      if (seeds.length > 0) {
        setTimeout(() => initMap(seeds[seeds.length - 1], seeds), 100);
      }

      // Connect WebSocket for real-time logs
      connectWebSocket(targetCode);

    } catch (e) {
      setError(e.message || 'Tracking connection failed.');
    }
  };

  const initMap = (center, path) => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapContainerRef.current).setView([center.lat, center.lng], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    const customIcon = L.divIcon({
      className: 'relative',
      html: '<div class="pulse-ring"></div><div class="w-3.5 h-3.5 bg-rose-500 rounded-full border border-white shadow"></div>',
      iconSize: [20, 20]
    });

    markerRef.current = L.marker([center.lat, center.lng], { icon: customIcon }).addTo(map);

    const polylineCoords = path.map(c => [c.lat, c.lng]);
    polylineRef.current = L.polyline(polylineCoords, { color: '#ff0844', weight: 4 }).addTo(map);

    mapInstanceRef.current = map;
  };

  const connectWebSocket = (targetCode) => {
    const ws = new WebSocket(`ws://127.0.0.1:8000/api/ws/track/${targetCode}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'location_update') {
        const newLoc = { lat: message.latitude, lng: message.longitude };

        // Update state
        setCoordinates(prev => {
          const updated = [...prev, newLoc];
          // Update map path
          if (polylineRef.current) {
            polylineRef.current.setLatLngs(updated.map(c => [c.lat, c.lng]));
          }
          return updated;
        });

        // Update map marker
        if (markerRef.current && mapInstanceRef.current) {
          markerRef.current.setLatLng([newLoc.lat, newLoc.lng]);
          mapInstanceRef.current.panTo([newLoc.lat, newLoc.lng]);
        }

        // Add to timeline
        setTimeline(prev => [
          ...prev,
          { type: 'info', text: `Location Updated (Speed: ${message.speed} km/h)`, time: message.timestamp }
        ]);

        // Update battery level in active session representation
        setActiveSession(prev => ({
          ...prev,
          battery: message.battery,
          last_lat: message.latitude,
          last_lng: message.longitude
        }));
      }

      if (message.type === 'evidence_update') {
        setTimeline(prev => [
          ...prev,
          {
            type: 'evidence',
            evidence_type: message.evidence_type,
            url: `http://127.0.0.1:8000${message.filepath}`,
            time: message.timestamp
          }
        ]);
      }

      if (message.type === 'emergency_resolved') {
        setTimeline(prev => [
          ...prev,
          { type: 'info', text: 'Emergency Resolved / Closed safely.', time: message.resolved_at }
        ]);
        setActiveSession(prev => ({ ...prev, active: false }));
        ws.close();
      }
    };
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100 flex flex-col items-center p-6 md:p-10 w-full">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-center justify-between w-full max-w-6xl gap-6 mb-8 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-950/40 rounded-xl border border-rose-800/40">
            <Radio className="w-6 h-6 text-rose-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">SafeNova Guardian Tracker</h1>
            <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Real-time emergency stream receiver</p>
          </div>
        </div>

        {/* Enter Code form */}
        <div className="flex gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Enter Emergency Code"
            className="input-field text-sm w-full md:w-48 text-center tracking-widest font-mono font-bold"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            onClick={() => handleTrack()}
            className="btn-glow-primary text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            Trace Device
          </button>
        </div>
      </div>

      {error && (
        <div className="w-full max-w-6xl p-4 bg-red-950/20 border border-red-800 text-red-400 rounded-xl text-center text-sm font-semibold mb-6">
          {error}
        </div>
      )}

      {activeSession ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-6xl items-start">
          {/* Geolocation Map */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="glass-panel p-4 h-[420px] relative overflow-hidden">
              {/* WebSocket Status Indicator */}
              <div className="absolute top-8 right-8 z-10 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] font-bold tracking-wider flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-ping' : 'bg-red-500'}`} />
                {wsConnected ? 'LIVE FEED ACTIVE' : 'CONNECTION OFFLINE'}
              </div>
              <div ref={mapContainerRef} className="w-full h-full" />
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="glass-panel p-4 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Device Battery</span>
                  <div className="text-lg font-extrabold text-white mt-1">{activeSession.battery}%</div>
                </div>
                <Battery className={`w-6 h-6 ${activeSession.battery < 20 ? 'text-rose-500' : 'text-cyan-400'}`} />
              </div>
              <div className="glass-panel p-4 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Signal strength</span>
                  <div className="text-lg font-extrabold text-white mt-1">{activeSession.signal_status}</div>
                </div>
                <Wifi className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="glass-panel p-4 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">SOS Status</span>
                  <div className={`text-sm font-black mt-1.5 uppercase ${activeSession.active ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
                    {activeSession.active ? 'Danger' : 'Resolved'}
                  </div>
                </div>
                <Activity className="w-6 h-6 text-cyan-400" />
              </div>
            </div>

            {/* User Details */}
            {activeSession.user && (
              <div className="glass-panel p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-400" /> Target Profile
                  </h4>
                  <div className="flex flex-col gap-1.5 text-xs text-slate-300">
                    <div>User Name: <span className="font-semibold text-white">{activeSession.user.name}</span></div>
                    <div>Email Address: <span className="font-semibold text-white">{activeSession.user.email}</span></div>
                    <div>Emergency Code: <span className="font-semibold text-cyan-400">{activeSession.tracking_code}</span></div>
                  </div>
                </div>
                {activeSession.user.medical_notes && (
                  <div>
                    <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-rose-500" /> Emergency Medical Card
                    </h4>
                    <div className="flex flex-col gap-1.5 text-xs text-slate-300">
                      <div>Blood Group: <span className="font-semibold text-white">{activeSession.user.blood_group || 'N/A'}</span></div>
                      <div className="mt-1 leading-relaxed bg-slate-950/40 p-2.5 rounded border border-slate-800">
                        {activeSession.user.medical_notes}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Incident Timeline & Uploaded Evidence */}
          <div className="glass-panel p-6 flex flex-col gap-6 max-h-[560px] overflow-y-auto">
            <div>
              <h3 className="font-extrabold text-sm text-white">Emergency Timeline</h3>
              <p className="text-[10px] text-slate-500">Chronological incident feed containing sensor logs and captured media evidence.</p>
            </div>

            <div className="flex flex-col gap-5 border-l border-slate-800 pl-4 relative">
              {timeline.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-2 relative">
                  {/* Timeline point */}
                  <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-cyan-400 border border-slate-950" />

                  <div className="flex justify-between items-baseline text-[10px] text-slate-500">
                    <span className="font-bold uppercase text-slate-400">
                      {item.type === 'evidence' ? `Uploaded ${item.evidence_type}` : 'System Log'}
                    </span>
                    <span>{new Date(item.time).toLocaleTimeString()}</span>
                  </div>

                  {item.type === 'evidence' ? (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                      {item.evidence_type.startsWith('image') ? (
                        <img
                          src={item.url}
                          alt="Evidence Capture"
                          className="w-full h-auto rounded border border-slate-800 mt-1 max-h-36 object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none'; // hide if file not yet uploaded / mock file
                          }}
                        />
                      ) : item.evidence_type === 'audio' ? (
                        <audio controls src={item.url} className="w-full mt-1 h-9" />
                      ) : (
                        <div className="text-xs font-semibold text-cyan-400 mt-1">
                          Media File Secured in Secure Storage.
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 font-semibold">{item.text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-10 flex flex-col items-center justify-center text-center max-w-lg mt-12 gap-4">
          <Shield className="w-16 h-16 text-slate-600" />
          <h3 className="text-lg font-bold text-white">Awaiting Connection</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Enter the unique 8-character tracking code shared by the SafeNova device user to view live coordinates, microphone recordings, and timeline alerts.
          </p>
        </div>
      )}
    </div>
  );
};
