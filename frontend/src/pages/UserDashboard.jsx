import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEmergency } from '../contexts/EmergencyContext';
import { VoiceAssistant } from '../components/VoiceAssistant';
import { FakeCall } from '../components/FakeCall';
import { FakeRecording } from '../components/FakeRecording';
import { 
  Shield, User, Phone, Users, FileText, Settings, LogOut, 
  MapPin, Heart, AlertTriangle, PhoneCall, Radio, Video, Plus, Trash2, ShieldCheck, Map
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const UserDashboard = () => {
  const { user, token, logout, updateProfile, API_URL } = useAuth();
  const { isEmergency, activeSession, triggerEmergency, resolveEmergency } = useEmergency();
  
  // Dashboard navigation tabs: dashboard, contacts, medical, routing, settings
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Contacts state
  const [contacts, setContacts] = useState([]);
  const [newContact, setNewContact] = useState({
    name: '', phone: '', email: '', whatsapp: '',
    notify_sms: true, notify_whatsapp: false, notify_email: true, notify_call: false, priority: 1
  });
  
  // Profile settings state
  const [wakeWord, setWakeWord] = useState(user?.custom_wake_word || '');
  const [bloodGroup, setBloodGroup] = useState(user?.blood_group || '');
  const [medicalNotes, setMedicalNotes] = useState(user?.medical_notes || '');
  
  // Route planning state
  const [startPoint, setStartPoint] = useState({ lat: 12.9716, lng: 77.5946 }); // Default Bangalore
  const [endPoint, setEndPoint] = useState({ lat: 12.9850, lng: 77.6050 });
  const [routeInfo, setRouteInfo] = useState(null);
  const [safetyScore, setSafetyScore] = useState(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const pathLayersRef = useRef([]);

  // Mock Deterrents
  const [fakeCallActive, setFakeCallActive] = useState(false);
  const [fakeRecActive, setFakeRecActive] = useState(false);

  // Sync profile options
  useEffect(() => {
    if (user) {
      setWakeWord(user.custom_wake_word || '');
      setBloodGroup(user.blood_group || '');
      setMedicalNotes(user.medical_notes || '');
    }
  }, [user]);

  // Load Contacts
  useEffect(() => {
    if (token) {
      fetchContacts();
    }
  }, [token]);

  const fetchContacts = async () => {
    try {
      const res = await fetch(`${API_URL}/users/contacts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/users/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newContact)
      });
      if (res.ok) {
        fetchContacts();
        setNewContact({
          name: '', phone: '', email: '', whatsapp: '',
          notify_sms: true, notify_whatsapp: false, notify_email: true, notify_call: false, priority: 1
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteContact = async (id) => {
    try {
      const res = await fetch(`${API_URL}/users/contacts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchContacts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        custom_wake_word: wakeWord,
        blood_group: bloodGroup,
        medical_notes: medicalNotes
      });
      alert('Guardian settings synced successfully.');
    } catch (err) {
      alert(err.message);
    }
  };

  // Map Routing logic
  useEffect(() => {
    if (activeTab === 'routing' && mapContainerRef.current) {
      // Initialize map once
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapContainerRef.current).setView([startPoint.lat, startPoint.lng], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap &copy; CARTO'
        }).addTo(mapInstanceRef.current);
      }
      
      // Calculate safety score and safe routes
      fetchSafeRoute();
      fetchSafetyScore();
    }

    return () => {
      // Don't destroy map on every rerender to preserve instance, just clear layers
    };
  }, [activeTab]);

  const fetchSafetyScore = async () => {
    try {
      const res = await fetch(`${API_URL}/ai/safety-score?latitude=${startPoint.lat}&longitude=${startPoint.lng}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSafetyScore(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSafeRoute = async () => {
    try {
      const res = await fetch(`${API_URL}/ai/safe-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          start_lat: startPoint.lat,
          start_lng: startPoint.lng,
          end_lat: endPoint.lat,
          end_lng: endPoint.lng
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRouteInfo(data);
        drawPaths(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const drawPaths = (paths) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing routes
    pathLayersRef.current.forEach(layer => map.removeLayer(layer));
    pathLayersRef.current = [];

    const shortestWP = paths.shortest_route.waypoints.map(w => [w.lat, w.lng]);
    const safestWP = paths.safest_route.waypoints.map(w => [w.lat, w.lng]);

    // Draw direct route (Red dashed line)
    const shortestPolyline = L.polyline(shortestWP, {
      color: '#ff0844',
      dashArray: '8, 8',
      weight: 4,
      opacity: 0.8
    }).addTo(map);
    pathLayersRef.current.push(shortestPolyline);

    // Draw safest route (Solid Cyan line)
    const safestPolyline = L.polyline(safestWP, {
      color: '#00f2fe',
      weight: 6,
      opacity: 0.95
    }).addTo(map);
    pathLayersRef.current.push(safestPolyline);

    // Fit bounds
    const bounds = L.latLngBounds([...shortestWP, ...safestWP]);
    map.fitBounds(bounds, { padding: [50, 50] });

    // Mark start/end
    const startMarker = L.circleMarker([startPoint.lat, startPoint.lng], {
      color: '#00f2fe', fillOpacity: 1, radius: 8
    }).addTo(map).bindPopup('Your Location');
    
    const endMarker = L.circleMarker([endPoint.lat, endPoint.lng], {
      color: '#00ff87', fillOpacity: 1, radius: 8
    }).addTo(map).bindPopup('Destination');

    pathLayersRef.current.push(startMarker, endMarker);
  };

  const triggerManualPanic = () => {
    if (isEmergency) {
      resolveEmergency();
    } else {
      triggerEmergency('manual');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#07080d] text-slate-100 flex-col md:flex-row">
      {/* Side Navigation Bar */}
      <aside className="w-full md:w-64 bg-[#0f111a] border-b md:border-r border-slate-800 p-6 flex flex-col justify-between gap-8">
        <div className="flex flex-col gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-cyan-400" />
            <div>
              <h1 className="text-xl font-extrabold text-white leading-none">SafeNova AI</h1>
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Active Guardian</span>
            </div>
          </div>

          {/* Links */}
          <nav className="flex flex-col gap-1">
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <Shield className="w-5 h-5" /> Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('routing')} 
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'routing' ? 'active' : ''}`}
            >
              <Map className="w-5 h-5" /> Safe Routing
            </button>
            <button 
              onClick={() => setActiveTab('contacts')} 
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'contacts' ? 'active' : ''}`}
            >
              <Users className="w-5 h-5" /> SOS Contacts
            </button>
            <button 
              onClick={() => setActiveTab('medical')} 
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'medical' ? 'active' : ''}`}
            >
              <Heart className="w-5 h-5" /> Medical Profile
            </button>
          </nav>
        </div>

        {/* User Card */}
        <div className="flex flex-col gap-4 border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <User className="text-cyan-400 w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-sm font-bold text-white truncate">{user?.name}</h3>
              <p className="text-[10px] text-cyan-400 tracking-wider font-bold">CODE: {user?.tracking_code}</p>
            </div>
          </div>
          <button onClick={logout} className="btn-glass w-full py-2.5 text-xs text-rose-400 border-rose-950/20 hover:bg-rose-950/20 hover:text-rose-300 flex items-center justify-center gap-2 cursor-pointer">
            <LogOut className="w-3.5 h-3.5" /> Sign Out Session
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-10 flex flex-col gap-8 max-w-5xl mx-auto w-full">
        {isEmergency && (
          <div className="p-4 bg-red-950/30 border border-red-800/60 rounded-xl flex items-center justify-between text-red-400 animate-pulse">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <div>
                <h4 className="font-bold text-sm text-white">EMERGENCY SYSTEM IS ACTIVE</h4>
                <p className="text-xs">Outbound alerts generated. Streaming live location logs via: {user?.tracking_code}</p>
              </div>
            </div>
            <button onClick={resolveEmergency} className="px-4 py-2 bg-red-800 hover:bg-red-700 active:bg-red-900 text-white font-bold rounded-lg text-xs cursor-pointer">
              Resolve Emergency
            </button>
          </div>
        )}

        {/* TAB 1: MAIN DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Trigger panic column */}
              <div className="glass-panel p-8 flex flex-col items-center gap-6 text-center">
                <h2 className="text-xl font-extrabold text-white">Quick Emergency SOS</h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                  Pressing this button triggers live notification alerts, starts background recording, snaps images, and broadcasts coordinates.
                </p>
                <button 
                  onClick={triggerManualPanic} 
                  className={`sos-btn ${isEmergency ? 'bg-red-800' : ''} cursor-pointer`}
                >
                  {isEmergency ? 'RESOLVE' : 'SOS'}
                </button>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Hold for 2 seconds to trigger</span>
              </div>

              {/* Voice recognition status */}
              <VoiceAssistant />
            </div>

            {/* Deterrent Shield Controls */}
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" /> AI Deterrent Toolkit
              </h3>
              <p className="text-xs text-slate-400">
                Instantly trigger defensive simulated overlays to discourage attackers or buy time.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => setFakeCallActive(true)}
                  className="btn-glass border-slate-700/50 hover:border-cyan-500/30 flex items-center justify-center gap-2.5 py-4 cursor-pointer"
                >
                  <PhoneCall className="w-5 h-5 text-cyan-400" /> Receive Fake Phone Call
                </button>
                <button 
                  onClick={() => setFakeRecActive(true)}
                  className="btn-glass border-slate-700/50 hover:border-red-500/30 flex items-center justify-center gap-2.5 py-4 cursor-pointer"
                >
                  <Video className="w-5 h-5 text-red-500" /> Start Deterrence Recording Screen
                </button>
              </div>
            </div>

            {/* Quick Details widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="glass-panel p-5 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tracking Code</span>
                <span className="text-lg font-extrabold text-cyan-400">{user?.tracking_code}</span>
                <p className="text-[10px] text-slate-500 mt-1">Share this with guardians for live safety checks.</p>
              </div>
              <div className="glass-panel p-5 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Configured Contacts</span>
                <span className="text-lg font-extrabold text-slate-100">{contacts.length} Trusted</span>
                <p className="text-[10px] text-slate-500 mt-1">Alerts will trigger across all prioritized numbers.</p>
              </div>
              <div className="glass-panel p-5 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Medical Status</span>
                <span className="text-lg font-extrabold text-slate-100">{user?.blood_group || 'Blood Group N/A'}</span>
                <p className="text-[10px] text-slate-500 mt-1">Medical card info displays dynamically inside notifications.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SAFE ROUTING MAPS */}
        {activeTab === 'routing' && (
          <div className="flex flex-col gap-6">
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-lg font-bold text-white">Nova AI Safe Route Advisor</h3>
              <p className="text-xs text-slate-400">
                Instead of shortest path, search destination below to analyze light, crowd, and crime indexes to choose a safe route.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400">Current Geolocation (Start)</label>
                  <input 
                    type="text" 
                    className="input-field text-sm"
                    value={`${startPoint.lat}, ${startPoint.lng}`}
                    disabled
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400">Search Destination Latitude / Longitude</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      step="any"
                      placeholder="Lat: e.g. 12.985"
                      className="input-field text-sm w-1/2"
                      value={endPoint.lat}
                      onChange={(e) => setEndPoint(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
                    />
                    <input 
                      type="number" 
                      step="any"
                      placeholder="Lng: e.g. 77.605"
                      className="input-field text-sm w-1/2"
                      value={endPoint.lng}
                      onChange={(e) => setEndPoint(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>
              
              <button onClick={fetchSafeRoute} className="btn-glow-primary self-start text-xs font-bold py-2 px-6 cursor-pointer">
                Evaluate Safest Rerouting
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map Panel */}
              <div className="lg:col-span-2 glass-panel p-4" style={{ height: '400px' }}>
                <div ref={mapContainerRef} className="w-full h-full" />
              </div>
              
              {/* Score Analysis Card */}
              <div className="flex flex-col gap-4">
                {safetyScore && (
                  <div className="glass-panel p-6 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-slate-400">Area Safety Score</span>
                      <span className={`badge ${safetyScore.rating === 'Safe' ? 'badge-safe' : safetyScore.rating === 'Medium Risk' ? 'badge-medium' : 'badge-high'}`}>
                        {safetyScore.rating}
                      </span>
                    </div>
                    
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold text-white">{safetyScore.overall_score}</span>
                      <span className="text-slate-400 text-sm">/ 100</span>
                    </div>
                    
                    <div className="flex flex-col gap-2.5 mt-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Crime Index Score:</span>
                        <span className="font-bold">{safetyScore.crime_score}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Lighting (Illumination):</span>
                        <span className="font-bold">{safetyScore.lighting_score}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Crowd Density index:</span>
                        <span className="font-bold">{safetyScore.density_score}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Police Stations (3km):</span>
                        <span className="font-bold text-cyan-400">{safetyScore.nearby_police}</span>
                      </div>
                    </div>
                  </div>
                )}

                {routeInfo && (
                  <div className="glass-panel p-6 flex flex-col gap-3 text-xs">
                    <h4 className="font-bold text-white text-sm">Path Comparison</h4>
                    <div className="border-l-2 border-cyan-400 pl-3 py-1 flex flex-col gap-0.5">
                      <span className="font-bold text-cyan-400">Nova Guarded Route (Cyan)</span>
                      <span className="text-slate-300">Distance: {routeInfo.safest_route.distance_km} km | ETA: {routeInfo.safest_route.eta_minutes} mins</span>
                      <span className="text-emerald-400 font-semibold">{routeInfo.safest_route.benefit}</span>
                    </div>
                    <div className="border-l-2 border-red-500 pl-3 py-1 flex flex-col gap-0.5 mt-2">
                      <span className="font-bold text-red-500">Shortest Route (Dashed Red)</span>
                      <span className="text-slate-300">Distance: {routeInfo.shortest_route.distance_km} km | ETA: {routeInfo.shortest_route.eta_minutes} mins</span>
                      <span className="text-rose-400 font-semibold">{routeInfo.shortest_route.warning}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SOS CONTACTS */}
        {activeTab === 'contacts' && (
          <div className="glass-panel p-8 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-white">Emergency Contacts</h2>
              <p className="text-xs text-slate-400">Add trusted family, friends, or agencies. SafeNova will instantly dispatch prioritized notifications to these recipients.</p>
            </div>

            <form onSubmit={handleAddContact} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-800 pb-6">
              <input 
                type="text" 
                required
                className="input-field text-sm" 
                placeholder="Name" 
                value={newContact.name}
                onChange={(e) => setNewContact(c => ({ ...c, name: e.target.value }))}
              />
              <input 
                type="text" 
                required
                className="input-field text-sm" 
                placeholder="Phone (e.g. +1...)" 
                value={newContact.phone}
                onChange={(e) => setNewContact(c => ({ ...c, phone: e.target.value }))}
              />
              <input 
                type="email" 
                required
                className="input-field text-sm" 
                placeholder="Email Address" 
                value={newContact.email}
                onChange={(e) => setNewContact(c => ({ ...c, email: e.target.value }))}
              />
              
              <div className="md:col-span-3 flex flex-wrap gap-6 mt-2 text-xs font-semibold text-slate-300">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={newContact.notify_sms} onChange={(e) => setNewContact(c => ({ ...c, notify_sms: e.target.checked }))} />
                  Send SMS
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={newContact.notify_whatsapp} onChange={(e) => setNewContact(c => ({ ...c, notify_whatsapp: e.target.checked }))} />
                  Send WhatsApp
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={newContact.notify_email} onChange={(e) => setNewContact(c => ({ ...c, notify_email: e.target.checked }))} />
                  Send Email
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={newContact.notify_call} onChange={(e) => setNewContact(c => ({ ...c, notify_call: e.target.checked }))} />
                  Voice Call Alert
                </label>
              </div>

              <button type="submit" className="btn-glow-primary text-xs py-2 px-4 mt-2 self-start flex items-center gap-1 cursor-pointer">
                <Plus className="w-4 h-4" /> Add SOS Contact
              </button>
            </form>

            <div className="flex flex-col gap-3">
              <h4 className="font-bold text-sm text-white">Your Safety Contacts</h4>
              {contacts.length === 0 ? (
                <p className="text-xs text-slate-500">No contacts set up. Please add at least one contact to receive alert notifications.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {contacts.map(c => (
                    <div key={c.id} className="flex justify-between items-center bg-slate-900/60 p-4 border border-slate-800 rounded-lg">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-sm text-white">{c.name}</span>
                        <div className="flex flex-wrap gap-x-4 text-[10px] text-slate-400">
                          <span>Phone: {c.phone}</span>
                          <span>Email: {c.email}</span>
                        </div>
                        <div className="flex gap-2 mt-1">
                          {c.notify_sms && <span className="text-[9px] bg-cyan-950/40 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800/40">SMS</span>}
                          {c.notify_whatsapp && <span className="text-[9px] bg-emerald-950/40 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/40">WhatsApp</span>}
                          {c.notify_email && <span className="text-[9px] bg-blue-950/40 text-blue-400 px-2 py-0.5 rounded border border-blue-800/40">Email</span>}
                          {c.notify_call && <span className="text-[9px] bg-purple-950/40 text-purple-400 px-2 py-0.5 rounded border border-purple-800/40">Voice Call</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteContact(c.id)} className="p-2 text-rose-400 hover:bg-rose-950/30 rounded cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MEDICAL AND SETTINGS */}
        {activeTab === 'medical' && (
          <div className="glass-panel p-8 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-white">Guardian Setup & Medical Card</h2>
              <p className="text-xs text-slate-400">These details are attached securely to the outbound SOS notification emails and dispatch alerts for rescuers.</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">Nova Custom Wake-Word (Optional)</label>
                <input 
                  type="text" 
                  className="input-field text-sm" 
                  placeholder="e.g. Jarvis Save Me" 
                  value={wakeWord}
                  onChange={(e) => setWakeWord(e.target.value)}
                />
                <span className="text-[10px] text-slate-500">Nova always listens for "Nova", "Help Me", "Emergency", but you can define a secret/custom phrase.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300">Blood Group</label>
                  <select 
                    className="input-field text-sm"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                  >
                    <option value="">Select blood group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">Medical Notes, Allergies, or Emergency Remarks</label>
                <textarea 
                  rows={4}
                  className="input-field text-sm" 
                  placeholder="Include any critical health complications, allergies, or emergency contact directions here..."
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                />
              </div>

              <button onClick={handleSaveProfile} className="btn-glow-primary self-start font-bold text-xs py-2.5 px-6 cursor-pointer">
                Sync Guardian Parameters
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Defensive Tool Overlay Components */}
      <FakeCall 
        active={fakeCallActive} 
        onClose={() => setFakeCallActive(false)} 
        callerName="Father"
      />
      <FakeRecording 
        active={fakeRecActive} 
        onClose={() => setFakeRecActive(false)} 
      />
    </div>
  );
};
