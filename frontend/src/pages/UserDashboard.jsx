import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEmergency } from '../contexts/EmergencyContext';
import { VoiceAssistant } from '../components/VoiceAssistant';
import { FakeCall } from '../components/FakeCall';
import { FakeRecording } from '../components/FakeRecording';
import {
  Shield, User, Phone, Users, FileText, Settings, LogOut,
  MapPin, Heart, AlertTriangle, PhoneCall, Radio, Video, Plus, Trash2, ShieldCheck, Map, Mail,
  CheckCircle2, Loader2, AlertCircle, MessageSquare
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const UserDashboard = () => {
  const { user, token, logout, updateProfile, API_URL } = useAuth();
  const { isEmergency, activeSession, triggerEmergency, resolveEmergency, speechStatus, sosState, sosTimers } = useEmergency();

  const getElapsed = (endTime) => {
    if (!endTime || !sosTimers?.gpsStart) return '';
    return `${Math.round(endTime - sosTimers.gpsStart)}ms`;
  };

  // Dashboard navigation tabs: dashboard, contacts, medical, routing, settings, inbox
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState(null);

  const [mockEmails, setMockEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);

  const fetchMockEmails = async () => {
    try {
      const res = await fetch(`${API_URL}/emergency/mock-emails`);
      if (res.ok) {
        const data = await res.json();
        setMockEmails(data);
        if (data.length > 0 && !selectedEmail) {
          setSelectedEmail(data[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching mock emails:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'inbox') {
      fetchMockEmails();
    }
  }, [activeTab]);

  // Cinematic HUD interactive controls
  const [sirenActive, setSirenActive] = useState(false);
  const [strobeActive, setStrobeActive] = useState(false);
  const [audioRecActive, setAudioRecActive] = useState(false);
  const [videoRecActive, setVideoRecActive] = useState(false);
  const sirenOscRef = useRef(null);
  const sirenCtxRef = useRef(null);

  const toggleSirenAlarm = () => {
    if (sirenActive) {
      if (sirenOscRef.current) {
        try {
          sirenOscRef.current.stop();
        } catch (e) { }
        sirenOscRef.current = null;
      }
      setSirenActive(false);
      setToast({ message: 'Emergency siren silenced' });
    } else {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        sirenCtxRef.current = ctx;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start();

        // Siren sweep modulation
        const sweep = () => {
          if (!osc) return;
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(1300, ctx.currentTime + 0.45);
          osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.9);
        };
        sweep();
        const sirenInterval = setInterval(() => {
          if (!sirenOscRef.current) {
            clearInterval(sirenInterval);
            return;
          }
          sweep();
        }, 900);

        sirenOscRef.current = osc;
        setSirenActive(true);
        setToast({ message: 'Loud Emergency Siren activated!' });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const triggerFlashStrobe = () => {
    if (strobeActive) {
      setStrobeActive(false);
      setToast({ message: 'Flash strobe deactivated' });
    } else {
      setStrobeActive(true);
      setToast({ message: 'Disorientation Strobe active!' });
    }
  };

  const toggleLiveAudioRec = () => {
    setAudioRecActive(!audioRecActive);
    setToast({ message: !audioRecActive ? 'Quiet ambient audio capture active' : 'Audio recording saved' });
  };

  const toggleLiveVideoRec = () => {
    setVideoRecActive(!videoRecActive);
    setToast({ message: !videoRecActive ? 'Front video stream live-streamed to cloud' : 'Video stream paused' });
  };

  // HUD Top bar state
  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(87);
  const [locationAddress, setLocationAddress] = useState('Anna Nagar, Chennai, Tamil Nadu, India');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeString(d.toLocaleTimeString('en-US', { hour12: false }));
      setDateString(d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateBattery = async () => {
      try {
        const bat = await navigator.getBattery();
        setBatteryLevel(Math.round(bat.level * 100));
      } catch (e) { }
    };
    updateBattery();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationAddress(`Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)}`);
      },
      (err) => { },
      { enableHighAccuracy: true }
    );
  }, []);


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
    // Basic phone validation — must include country code digits
    const cleanPhone = newContact.phone.replace(/\s/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
      setToast({ message: '\u274c Invalid phone number. Include country code (e.g. +91XXXXXXXXXX)', type: 'error' });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/users/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...newContact, phone: cleanPhone })
      });
      if (res.ok) {
        fetchContacts();
        setNewContact({
          name: '', phone: '', email: '', whatsapp: '',
          notify_sms: true, notify_whatsapp: false, notify_email: true, notify_call: false, priority: 1
        });
        setToast({ message: '\u2705 Emergency contact added successfully.', type: 'success' });
        setTimeout(() => setToast(null), 4000);
      } else {
        const err = await res.json();
        setToast({ message: `\u274c ${err.detail || 'Failed to add contact.'}`, type: 'error' });
        setTimeout(() => setToast(null), 5000);
      }
    } catch (e) {
      console.error(e);
      setToast({ message: '\u274c Network error adding contact.', type: 'error' });
      setTimeout(() => setToast(null), 5000);
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
        setToast({ message: 'Contact removed.', type: 'info' });
        setTimeout(() => setToast(null), 3000);
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
      setToast({ message: '✅ Guardian settings synced successfully.', type: 'success' });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setToast({ message: `❌ Failed to save: ${err.message}`, type: 'error' });
      setTimeout(() => setToast(null), 6000);
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

  const [sosSuccessShown, setSosSuccessShown] = useState(false);

  useEffect(() => {
    if (isEmergency && sosState && !sosSuccessShown) {
      const allSuccess = ['emailSent', 'smsSent', 'whatsappSent', 'callSent'].every(
        key => sosState[key] === null || sosState[key] === true
      );
      const hasTrue = ['emailSent', 'smsSent', 'whatsappSent', 'callSent'].some(key => sosState[key] === true);
      const hasPending = ['emailSent', 'smsSent', 'whatsappSent', 'callSent'].some(key => sosState[key] === 'retrying' || sosState[key] === false);

      if (hasTrue && !hasPending && allSuccess) {
        setSosSuccessShown(true);
      }
    }
  }, [isEmergency, sosState, sosSuccessShown]);

  const triggerManualPanic = () => {
    if (isEmergency) {
      resolveEmergency();
      setToast({ message: 'Emergency resolved successfully.', type: 'info' });
      setSosSuccessShown(false);
      setTimeout(() => setToast(null), 4000);
    } else {
      if (contacts.length === 0) {
        setToast({ message: 'No emergency contacts configured. Please add contacts first.', type: 'error' });
        setTimeout(() => setToast(null), 6000);
        return;
      }
      if (!navigator.onLine) {
        setToast({ message: 'Network unavailable. Please check your internet connection.', type: 'error' });
        setTimeout(() => setToast(null), 6000);
        return;
      }
      triggerEmergency('manual');
      setSosSuccessShown(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050816] text-slate-100 flex-col md:flex-row relative overflow-hidden">
      {/* Cinematic HUD Background Layers */}
      <div className="volumetric-glow animate-pulse" />
      <div className="neon-grid" />
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 p-4 bg-[#0f111a] border rounded-xl shadow-2xl flex items-center gap-3 animate-bounce ${toast.type === 'error' ? 'border-red-500/50' : 'border-cyan-500/30'}`}>
          <div className={`w-2 h-2 rounded-full animate-ping ${toast.type === 'error' ? 'bg-red-500' : 'bg-cyan-400'}`} />
          <span className="text-xs font-bold text-slate-100">{toast.message}</span>
        </div>
      )}

      {/* Success Dialog Overlay */}
      {sosSuccessShown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-emerald-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(16,185,129,0.15)] animate-in zoom-in-95 fade-in duration-300">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Alerts Sent Successfully</h2>
            <p className="text-slate-400 mb-6 text-sm">
              Your trusted contacts have been notified. Live location sharing has started.
            </p>
            <button
              onClick={() => setSosSuccessShown(false)}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold py-3 px-8 rounded-full transition-colors cursor-pointer"
            >
              Continue Monitoring
            </button>
          </div>
        </div>
      )}
      {/* Side Navigation Bar */}
      <aside className="w-full md:w-52 bg-[#05070e] border-b md:border-r border-slate-900 p-3 md:p-4 flex flex-row md:flex-col justify-between items-center md:items-stretch gap-3 md:gap-5 shrink-0 h-auto md:h-full z-20">
        <div className="flex flex-row md:flex-col items-center md:items-stretch justify-between w-full md:w-auto gap-3 md:gap-5">
          {/* Logo */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <Shield className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
            <div>
              <h1 className="text-xs md:text-sm font-black text-white leading-none tracking-wide">SafeNova AI</h1>
              <span className="text-[7px] md:text-[8px] text-cyan-400 font-bold uppercase tracking-widest block">Active Guardian</span>
            </div>
          </div>

          {/* Links */}
          <nav className="flex flex-row md:flex-col gap-1.5 overflow-x-auto w-full">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 shrink-0" />
                <div className="flex flex-col text-left hidden md:flex">
                  <span className="text-sm font-bold text-slate-100 leading-none">Dashboard</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Command Center</span>
                </div>
                <span className="md:hidden text-xs font-bold text-white">Dashboard</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('tracking')}
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'tracking' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Radio className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 shrink-0" />
                <div className="flex flex-col text-left hidden md:flex">
                  <span className="text-sm font-bold text-slate-100 leading-none">Live Tracking</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Real-time Monitor</span>
                </div>
                <span className="md:hidden text-xs font-bold text-white">Live Tracking</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('routing')}
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'routing' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Map className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 shrink-0" />
                <div className="flex flex-col text-left hidden md:flex">
                  <span className="text-sm font-bold text-slate-100 leading-none">Safe Routing</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Smart Route Planner</span>
                </div>
                <span className="md:hidden text-xs font-bold text-white">Safe Routing</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('contacts')}
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'contacts' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 shrink-0" />
                <div className="flex flex-col text-left hidden md:flex">
                  <span className="text-sm font-bold text-slate-100 leading-none">SOS Contacts</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Trusted Guardians</span>
                </div>
                <span className="md:hidden text-xs font-bold text-white">SOS Contacts</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('medical')}
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'medical' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Heart className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 shrink-0" />
                <div className="flex flex-col text-left hidden md:flex">
                  <span className="text-sm font-bold text-slate-100 leading-none">Medical Profile</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Health Information</span>
                </div>
                <span className="md:hidden text-xs font-bold text-white">Medical Profile</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'ai' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 shrink-0" />
                <div className="flex flex-col text-left hidden md:flex">
                  <span className="text-sm font-bold text-slate-100 leading-none">AI Guardian</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Voice & Chat AI</span>
                </div>
                <span className="md:hidden text-xs font-bold text-white">AI Guardian</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'history' ? 'active' : ''}`}
            >
              <FileText className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 shrink-0" />
              <div className="flex flex-col text-left hidden md:flex">
                <span className="text-sm font-bold text-slate-100 leading-none">Alert History</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Past Activities</span>
              </div>
              <span className="md:hidden text-xs font-bold text-white">Alert History</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'settings' ? 'active' : ''}`}
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 shrink-0" />
              <div className="flex flex-col text-left hidden md:flex">
                <span className="text-sm font-bold text-slate-100 leading-none">Settings</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Preferences</span>
              </div>
              <span className="md:hidden text-xs font-bold text-white">Settings</span>
            </button>

            <button
              onClick={() => setActiveTab('inbox')}
              className={`sidebar-link w-full text-left font-semibold cursor-pointer ${activeTab === 'inbox' ? 'active' : ''}`}
            >
              <Mail className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 shrink-0" />
              <div className="flex flex-col text-left hidden md:flex">
                <span className="text-sm font-bold text-slate-100 leading-none">Sandbox Inbox</span>
                <span className="text-[9px] text-slate-[450] font-bold uppercase mt-0.5">Test Mailbox</span>
              </div>
              <span className="md:hidden text-xs font-bold text-white">Sandbox Inbox</span>
            </button>
          </nav>
        </div>

        {/* User Card (Desktop only) */}
        <div className="hidden md:flex flex-col gap-2.5 border-t border-slate-800 pt-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 text-base shadow-[0_0_8px_rgba(0,242,254,0.1)]">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <h3 className="text-xs font-bold text-white truncate">{user?.name}</h3>
              <p className="text-[8px] text-slate-450 truncate">Guardian ID: {user?.tracking_code}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">Online</span>
              </div>
            </div>
          </div>
          <button onClick={logout} className="w-full py-1.5 text-[10px] text-slate-300 hover:text-white border border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/10 hover:bg-cyan-950/30 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-300 shadow-[0_0_8px_rgba(0,242,254,0.05)]">
            <LogOut className="w-3 h-3" /> SIGN OUT
          </button>
        </div>

        {/* Mobile Logout Button (Mobile only) */}
        <button
          onClick={logout}
          className="flex md:hidden p-2 bg-slate-850 border border-slate-755 hover:bg-rose-950/20 rounded-lg text-rose-400 cursor-pointer shrink-0"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-3 md:p-4 flex flex-col gap-3 md:gap-4 max-w-[1400px] w-full h-full md:h-screen md:overflow-hidden relative mx-auto">
        {isEmergency && (
          <div className="p-3 bg-red-950/30 border border-red-800/60 rounded-xl flex items-center justify-between text-red-400 animate-pulse shrink-0">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <h4 className="font-bold text-xs text-white">EMERGENCY SYSTEM IS ACTIVE</h4>
                <p className="text-[10px]">Outbound alerts generated. Streaming live location logs via: {user?.tracking_code}</p>
              </div>
            </div>
            <button onClick={resolveEmergency} className="px-3.5 py-1.5 bg-red-800 hover:bg-red-700 active:bg-red-900 text-white font-bold rounded-lg text-[10px] cursor-pointer">
              Resolve Emergency
            </button>
          </div>
        )}

        {/* TAB 1: MAIN DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="flex-1 flex flex-col gap-3 md:gap-4 h-full min-h-0 overflow-hidden">
            {/* TOP HEADER */}
            <header className="flex justify-between items-center bg-[#0a0c16]/90 border border-slate-900 rounded-xl p-2 px-4 gap-2 w-full shrink-0 h-11 shadow-[0_0_15px_rgba(0,242,254,0.02)]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-950/40 rounded-lg border border-slate-800">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div>
                  <span className="text-[8px] text-slate-450 font-bold uppercase tracking-wider block">Jarvis Mode</span>
                  <span className="text-[10px] text-emerald-450 font-extrabold flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> All Systems Online
                  </span>
                </div>
              </div>

              {/* Central Clock Widget */}
              <div className="px-4 py-1 bg-slate-950/80 border border-cyan-500/15 rounded-full flex items-center justify-center text-cyan-400 font-mono font-bold text-xs tracking-widest shadow-[0_0_10px_rgba(0,242,254,0.03)] gap-2">
                <span>{timeString}</span>
                <span className="text-slate-650">|</span>
                <span className="text-[10px] text-slate-400 font-sans font-bold">{dateString}</span>
              </div>

              {/* Top Bar Badges & Icons */}
              <div className="flex items-center gap-2">
                <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-slate-950/40 border border-slate-850 rounded-full">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-slate-350 uppercase tracking-wider text-[8px] font-black">GPS Locked</span>
                </div>
                <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-slate-950/40 border border-slate-850 rounded-full">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  <span className="text-slate-350 uppercase tracking-wider text-[8px] font-black">Network Strong</span>
                </div>

                {/* Bell notification */}
                <button className="p-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-850 rounded-full relative cursor-pointer text-slate-350">
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white font-extrabold text-[7px] w-3 h-3 rounded-full flex items-center justify-center border border-slate-950 shadow-[0_0_3px_rgba(239,68,68,0.5)]">3</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="p-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-850 rounded-full cursor-pointer text-slate-450 hover:text-slate-200"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </header>

            {/* FIRST ROW WIDGETS: SOS (col-span-4), Voice Assistant (col-span-3), Live Location (col-span-3) */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 min-h-0 items-stretch flex-[1.1]">

              {/* SOS Column */}
              <div className={`lg:col-span-4 glass-panel p-4 flex flex-col items-center justify-center text-center relative overflow-hidden ${isEmergency ? 'bg-red-950/20 border-red-500/30' : 'bg-[#0c0508]/85 border-red-950/40 shadow-[0_0_25px_rgba(255,30,60,0.05)]'}`}>
                {isEmergency ? (
                  <div className="w-full flex flex-col h-full justify-between items-center z-10 p-2">
                    <div className="text-sm font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      Emergency Activated
                    </div>

                    <div className="flex flex-col gap-3 w-full max-w-[280px] text-left">
                      <div className="flex items-center gap-3 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-100 flex-1">Contacts Loaded</span>
                        <span className="text-[10px] text-slate-500">0ms</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm font-medium">
                        {sosState?.locationAcquired ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : sosState?.gpsError ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                        )}
                        <span className={`flex-1 ${sosState?.locationAcquired ? "text-emerald-100" : sosState?.gpsError ? "text-red-400" : "text-slate-300"}`}>
                          {sosState?.gpsError ? sosState.gpsError : 'Location Acquired'}
                        </span>
                        <span className="text-[10px] text-cyan-500 font-mono">{getElapsed(sosTimers?.gpsEnd)}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm font-medium">
                        {sosState?.backendTriggered ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : sosState?.errorMsg ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                        )}
                        <span className={`flex-1 ${sosState?.backendTriggered ? "text-emerald-100" : sosState?.errorMsg ? "text-red-400" : "text-slate-300"}`}>
                          {sosState?.errorMsg ? sosState.errorMsg : 'Emergency API Activated'}
                        </span>
                        <span className="text-[10px] text-cyan-500 font-mono">{getElapsed(sosTimers?.apiEnd)}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm font-medium">
                        {sosState?.emailSent === true ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : sosState?.emailSent === false ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : sosState?.emailSent === 'retrying' ? (
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                        )}
                        <span className={`flex-1 ${sosState?.emailSent === true ? "text-emerald-100" : sosState?.emailSent === false ? "text-red-400" : "text-slate-300"}`}>
                          {sosState?.emailSent === false ? 'Email Service Failed' : 'Email Sent'}
                        </span>
                        <span className="text-[10px] text-cyan-500 font-mono">{getElapsed(sosTimers?.emailEnd)}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm font-medium">
                        {sosState?.smsSent === true ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : sosState?.smsSent === false ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : sosState?.smsSent === 'retrying' ? (
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                        )}
                        <span className={`flex-1 ${sosState?.smsSent === true ? "text-emerald-100" : sosState?.smsSent === false ? "text-red-400" : "text-slate-300"}`}>
                          {sosState?.smsSent === false ? 'SMS Service Failed' : 'SMS Sent'}
                        </span>
                        <span className="text-[10px] text-cyan-500 font-mono">{getElapsed(sosTimers?.smsEnd)}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm font-medium">
                        {sosState?.whatsappSent === true ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : sosState?.whatsappSent === false ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : sosState?.whatsappSent === 'retrying' ? (
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                        )}
                        <span className={`flex-1 ${sosState?.whatsappSent === true ? "text-emerald-100" : sosState?.whatsappSent === false ? "text-red-400" : "text-slate-300"}`}>
                          {sosState?.whatsappSent === false ? 'WhatsApp Failed' : 'WhatsApp Sent'}
                        </span>
                        <span className="text-[10px] text-cyan-500 font-mono">{getElapsed(sosTimers?.whatsappEnd)}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm font-medium border-t border-red-500/20 pt-2 mt-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-100 flex-1">Live Tracking Started</span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">ACTIVE</span>
                      </div>
                    </div>

                    <button
                      onClick={triggerManualPanic}
                      className="mt-6 w-full max-w-[240px] bg-red-900/40 hover:bg-red-800/60 border border-red-500/50 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-[0_0_15px_rgba(255,30,60,0.2)]"
                    >
                      Resolve Emergency
                    </button>
                  </div>
                ) : (
                  <>
                    {/* HUD Coordinates Background Crosshairs & Radar Ticks */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,30,60,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,30,60,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-45" />

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15">
                      <svg className="w-full h-full text-red-500 max-w-[260px] max-h-[260px]" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                        <circle cx="50" cy="50" r="45" strokeWidth="0.1" strokeDasharray="1 1.5" />
                        <circle cx="50" cy="50" r="36" strokeWidth="0.15" />
                        <circle cx="50" cy="50" r="26" strokeWidth="0.1" strokeDasharray="3 1" />
                        <circle cx="50" cy="50" r="14" strokeWidth="0.08" />
                        <line x1="50" y1="0" x2="50" y2="100" strokeWidth="0.08" strokeDasharray="1 2" />
                        <line x1="0" y1="50" x2="100" y2="50" strokeWidth="0.08" strokeDasharray="1 2" />
                        {/* Compass Angle Ticks */}
                        <text x="47.5" y="8" className="text-[3px] font-mono fill-red-500 font-bold">000°</text>
                        <text x="91" y="51" className="text-[3px] font-mono fill-red-500 font-bold">090°</text>
                        <text x="47.5" y="94" className="text-[3px] font-mono fill-red-500 font-bold">180°</text>
                        <text x="3" y="51" className="text-[3px] font-mono fill-red-500 font-bold">270°</text>
                      </svg>
                    </div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 border border-red-500/5 rounded-full pointer-events-none animate-pulse" />

                    <div className="flex flex-col gap-0.5 items-center z-10 mt-2">
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                        Quick Emergency SOS <span className="text-red-500 font-sans tracking-tight">///</span>
                      </h2>
                      <p className="text-[9px] text-slate-450 leading-tight max-w-[220px]">
                        Press the SOS button to instantly alert your contacts and share live location.
                      </p>
                    </div>

                    <div className="relative my-4 flex items-center justify-center z-10 scale-90">
                      {/* Outer Tech Ring 1 (Dotted / Dashed Spinner) */}
                      <div className="absolute w-40 h-40 rounded-full border border-dashed border-red-500/25 animate-[spin_60s_linear_infinite]" />
                      {/* Outer Tech Ring 2 (Ticker Counter-Spinner) */}
                      <div className="absolute w-34 h-34 rounded-full border border-red-500/15 animate-[spin_30s_linear_infinite_reverse]" />
                      {/* Outer Tech Ring 3 (Cardinals indicators) */}
                      <div className="absolute w-37 h-37 rounded-full border border-red-500/5">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ff1e3c]" />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ff1e3c]" />
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ff1e3c]" />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ff1e3c]" />
                      </div>

                      {/* Actual Button - Slimmed */}
                      <button
                        onClick={triggerManualPanic}
                        className="sos-btn cursor-pointer flex flex-col items-center justify-center z-10"
                        style={{ width: '104px', height: '104px' }}
                      >
                        <span className="text-2xl font-extrabold text-white tracking-widest leading-none">SOS</span>
                        <span className="text-[7.5px] text-white/80 font-black tracking-widest uppercase mt-1.5">Tap to Trigger</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 mb-2 bg-[#090406]/85 border border-red-500/35 rounded-full z-10 shadow-[0_0_10px_rgba(255,30,60,0.08)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] text-emerald-450 font-black uppercase tracking-wider">GPS Signal: Strong</span>
                    </div>
                  </>
                )}
              </div>

              {/* Voice Guardian Column */}
              <div className="lg:col-span-3 flex flex-col min-h-0">
                <VoiceAssistant />
              </div>

              {/* Live Location Column */}
              <div className="lg:col-span-3 glass-panel p-4 flex flex-col justify-between bg-[#0a0c16]/90 border border-slate-900 relative min-h-0">
                <div className="flex justify-between items-center z-10">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Location</span>
                  <span className="text-[8px] text-cyan-400 font-bold bg-cyan-950/50 px-2 py-0.5 border border-cyan-500/25 rounded-md">Accuracy: 5m</span>
                </div>

                {/* Map mockup - Height-constrained */}
                <div
                  onClick={() => setActiveTab('routing')}
                  className="flex-1 min-h-[90px] w-full rounded-xl bg-slate-950/60 border border-slate-900 overflow-hidden relative flex items-center justify-center cursor-pointer hover:border-cyan-500/40 transition-colors my-2"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.6)_80%)] z-10" />
                  <div className="absolute inset-0 bg-[linear-gradient(30deg,rgba(0,242,254,0.01)_1px,transparent_1px),linear-gradient(150deg,rgba(0,242,254,0.01)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none opacity-30" />

                  <div className="absolute w-10 h-10 rounded-full border border-cyan-500/20 animate-ping" />
                  <div className="absolute w-16 h-16 rounded-full border border-cyan-500/5 animate-pulse" />

                  <div className="z-10 flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-full bg-cyan-950/90 border border-cyan-500/60 flex items-center justify-center shadow-[0_0_12px_rgba(0,242,254,0.25)] animate-bounce">
                      <Map className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center gap-1.5 z-10">
                  <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                    <div className="p-1 bg-cyan-950/40 border border-cyan-500/30 rounded-lg text-cyan-400 shrink-0">
                      <Map className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] text-slate-350 truncate font-semibold">{locationAddress}</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('routing')}
                    className="px-2.5 py-1 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/35 rounded-lg text-[8px] font-black uppercase text-cyan-400 tracking-wider shrink-0 cursor-pointer transition-colors"
                  >
                    View Map
                  </button>
                </div>
              </div>

            </div>

            {/* SECOND ROW: DETERRENTS & CONTACTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 flex-[0.9]">
              {/* Deterrent toolkit */}
              <div className="glass-panel p-4 flex flex-col justify-between bg-[#0a0c16]/90 border border-slate-900 h-full">
                <div className="flex items-center gap-2 z-10">
                  <ShieldCheck className="w-4.5 h-4.5 text-cyan-400" />
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">AI Deterrent Toolkit</h3>
                    <p className="text-[9px] text-slate-500 mt-0.5">Smart tools to discourage threats and protect you.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5 z-10">
                  {/* Card 1: Fake Call */}
                  <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-900 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.15)] shrink-0">
                        <PhoneCall className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] font-black uppercase text-slate-105 tracking-wider truncate">Fake Phone Call</span>
                        <span className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">Voice Override</span>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-450 leading-tight">Simulate an incoming voice call to create a safe escape.</p>
                    <button
                      onClick={() => setFakeCallActive(true)}
                      className="w-full py-1.5 bg-transparent hover:bg-red-950/10 border border-red-500/30 hover:border-red-500/60 rounded-lg text-[9px] font-black uppercase tracking-wider text-red-500 cursor-pointer transition-colors"
                    >
                      Start Call
                    </button>
                  </div>

                  {/* Card 2: Deterrence Screen */}
                  <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-900 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-950/40 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.15)] shrink-0">
                        <Video className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] font-black uppercase text-slate-105 tracking-wider truncate">Deterrence Screen</span>
                        <span className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">Visual Shield</span>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-450 leading-tight">Show a deterrence recording screen to scare off targets.</p>
                    <button
                      onClick={() => setFakeRecActive(true)}
                      className="w-full py-1.5 bg-transparent hover:bg-amber-950/10 border border-amber-500/30 hover:border-amber-500/60 rounded-lg text-[9px] font-black uppercase tracking-wider text-amber-500 cursor-pointer transition-colors"
                    >
                      Start Screen
                    </button>
                  </div>
                </div>
              </div>

              {/* Contacts preview */}
              <div className="glass-panel p-4 flex flex-col justify-between bg-[#0a0c16]/90 border border-slate-900 h-full">
                <div className="flex justify-between items-center z-10">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">Trusted Contacts</h3>
                      <p className="text-[9px] text-slate-500 mt-0.5">Primary emergency notification circle.</p>
                    </div>
                  </div>
                  <span className="text-[8px] text-slate-400 font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                    {contacts.length} Contacts
                  </span>
                </div>

                <div className="flex flex-col gap-2 mt-1.5 z-10">
                  {contacts.slice(0, 2).map((contact) => (
                    <div key={contact.id} className="p-2 bg-slate-950/45 border border-slate-900/50 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-7 h-7 rounded-full bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center font-bold text-xs text-cyan-400 shrink-0">
                          {contact.name.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="text-[11px] font-bold text-white flex items-center gap-1.5 truncate">
                            {contact.name}
                          </h4>
                          <p className="text-[8px] text-slate-450 truncate">{contact.phone}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <a
                          href={`tel:${contact.phone}`}
                          className="p-1 bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
                        >
                          <PhoneCall className="w-3 h-3" />
                        </a>
                        <button
                          onClick={() => setToast({ message: `Message broadcast simulated to ${contact.name}` })}
                          className="p-1 bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                        >
                          <Radio className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {contacts.length === 0 && (
                    <div className="py-4 text-center text-[10px] text-slate-500 font-semibold italic">
                      No contacts configured. Click below to add guardians.
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setActiveTab('contacts')}
                  className="w-full mt-1.5 py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-cyan-500/20 hover:border-cyan-500/40 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-[0_0_8px_rgba(0,242,254,0.03)] z-10"
                >
                  <Users className="w-3.5 h-3.5 text-cyan-400" /> Manage Contacts
                </button>
              </div>
            </div>

            {/* BOTTOM HUD COLUMN FOOTERS */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
              {/* Card 1: Tracking Code */}
              <div className="glass-panel p-2 px-3 flex flex-col justify-between bg-[#0a0c16]/90 border border-slate-900 shadow-[0_0_10px_rgba(0,242,254,0.01)] h-14">
                <div className="flex items-center justify-between text-cyan-400">
                  <span className="text-[7.5px] uppercase font-bold text-slate-450 tracking-wider">Tracking Code</span>
                  <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5.01 20h2a1 1 0 001-1v-2a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                </div>
                <span className="text-xs font-black text-cyan-400 font-mono tracking-wide">{user?.tracking_code}</span>
                <p className="text-[7.5px] text-slate-500 uppercase font-medium truncate">Share this code with guardians for live tracking.</p>
              </div>

              {/* Card 2: Safe Route */}
              <div className="glass-panel p-2 px-3 flex flex-col justify-between bg-[#0a0c16]/90 border border-slate-900 shadow-[0_0_10px_rgba(0,242,254,0.01)] h-14">
                <div className="flex items-center justify-between text-cyan-400">
                  <span className="text-[7.5px] uppercase font-bold text-slate-450 tracking-wider">Safe Route</span>
                  <Map className="w-3 h-3 opacity-70" />
                </div>
                <span className="text-[10px] font-black text-slate-100">Recommended</span>
                <p className="text-[7.5px] text-slate-500 uppercase font-medium truncate">2.4 km away - Use safe route for travel</p>
              </div>

              {/* Card 3: Alerts Sent */}
              <div className="glass-panel p-2 px-3 flex flex-col justify-between bg-[#0a0c16]/90 border border-slate-900 shadow-[0_0_10px_rgba(0,242,254,0.01)] h-14">
                <div className="flex items-center justify-between text-cyan-400">
                  <span className="text-[7.5px] uppercase font-bold text-slate-455 tracking-wider">Alerts Sent</span>
                  <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </div>
                <span className="text-xs font-black text-slate-100">7</span>
                <p className="text-[7.5px] text-slate-500 uppercase font-medium truncate">Total alerts sent this month</p>
              </div>

              {/* Card 4: Response Time */}
              <div className="glass-panel p-2 px-3 flex flex-col justify-between bg-[#0a0c16]/90 border border-slate-900 shadow-[0_0_10px_rgba(0,242,254,0.01)] h-14">
                <div className="flex items-center justify-between text-emerald-450">
                  <span className="text-[7.5px] uppercase font-bold text-slate-455 tracking-wider">Response Time</span>
                  <svg className="w-3 h-3 opacity-70 text-emerald-455" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-xs font-black text-emerald-400">1.2 min</span>
                <p className="text-[7.5px] text-slate-500 uppercase font-medium truncate">Average response time</p>
              </div>

              {/* Card 5: Battery Status */}
              <div className="glass-panel p-2 px-3 flex flex-col justify-between bg-[#0a0c16]/90 border border-slate-900 shadow-[0_0_10px_rgba(0,242,254,0.01)] h-14">
                <div className="flex items-center justify-between text-emerald-455">
                  <span className="text-[7.5px] uppercase font-bold text-slate-455 tracking-wider">Battery Status</span>
                  <svg className="w-3 h-3 opacity-70 text-emerald-455" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
                <span className="text-xs font-black text-emerald-400">{batteryLevel}%</span>
                <p className="text-[7.5px] text-slate-500 uppercase font-medium truncate">Battery level optimised</p>
              </div>
            </div>

            {/* Bottom branding footer */}
            <div className="flex justify-between items-center border-t border-slate-900 pt-2 shrink-0 h-5 text-[7px] font-bold text-slate-500 uppercase tracking-widest">
              <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5 text-cyan-500" /> Safe is power. We're always watching over you.</span>
              <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-500" /> Stay Alert. Stay Safe.</span>
            </div>
          </div>
        )}

        {/* SECONDARY SCROLLABLE TABS */}
        {activeTab !== 'dashboard' && (
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 min-h-0">
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

            {/* TAB 4: MEDICAL PROFILE */}
            {activeTab === 'medical' && (
              <div className="glass-panel p-8 flex flex-col gap-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Guardian Setup & Medical Card</h2>
                  <p className="text-xs text-slate-400">These details are attached securely to the outbound SOS notification emails and dispatch alerts for rescuers.</p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-350">Blood Group</label>
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
                    <label className="text-xs font-bold text-slate-350">Medical Notes, Allergies, or Emergency Remarks</label>
                    <textarea
                      rows={4}
                      className="input-field text-sm"
                      placeholder="Include any critical health complications, allergies, or emergency contact directions here..."
                      value={medicalNotes}
                      onChange={(e) => setMedicalNotes(e.target.value)}
                    />
                  </div>

                  <button onClick={handleSaveProfile} className="btn-glow-primary self-start font-bold text-xs py-2.5 px-6 cursor-pointer">
                    Sync Medical Card Info
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: LIVE TRACKING */}
            {activeTab === 'tracking' && (
              <div className="glass-panel p-8 flex flex-col gap-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-cyan-400 animate-pulse" /> Live Tracking Monitor
                </h2>
                <p className="text-xs text-slate-400">Stream coordinates real-time to guardians. Your active tracking session link:</p>
                <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase">Tracking Code</span>
                    <span className="font-mono text-cyan-400 font-bold text-sm">{user?.tracking_code}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase">Public Link</span>
                    <a href={`/guardian?code=${user?.tracking_code}`} target="_blank" rel="noreferrer" className="text-cyan-400 font-bold hover:underline">
                      Open Guardian Live Viewer
                    </a>
                  </div>
                </div>
                <div className="h-96 w-full rounded-xl bg-slate-950/80 border border-slate-900 flex items-center justify-center text-slate-500 font-semibold italic">
                  <div className="text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full border border-cyan-500/25 animate-ping flex items-center justify-center text-cyan-400 bg-cyan-950/20">
                      <Map className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Active Geolocation Stream Online</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: AI GUARDIAN */}
            {activeTab === 'ai' && (
              <div className="glass-panel p-8 flex flex-col gap-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" /> AI Guardian Assist
                </h2>
                <p className="text-xs text-slate-400">Chat with Nova to analyze safe paths, check medical notes, or ask for guidance.</p>

                <div className="flex flex-col gap-4 h-80 bg-slate-950/60 border border-slate-900 rounded-xl p-4 overflow-y-auto">
                  <div className="p-3 bg-[#0d0f1c]/80 border border-cyan-500/10 rounded-xl self-start max-w-xs text-xs text-slate-200">
                    <strong>Nova:</strong> Hello! I am your SafeNova Guardian Assistant. I monitor your status and will trigger alerts if emergency phrases are heard. How can I help you?
                  </div>
                </div>

                <div className="flex gap-2">
                  <input type="text" placeholder="Ask Nova anything..." className="input-field text-sm flex-1 animate-pulse" disabled />
                  <button className="btn-glow-primary text-xs px-4 py-2 cursor-pointer font-bold opacity-50" disabled>Send</button>
                </div>
              </div>
            )}

            {/* TAB 7: ALERT HISTORY */}
            {activeTab === 'history' && (
              <div className="glass-panel p-8 flex flex-col gap-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" /> Alert History Log
                </h2>
                <p className="text-xs text-slate-400">Review past emergency triggers and resolved incident codes.</p>

                <div className="flex flex-col gap-3">
                  <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex justify-between items-center">
                    <div className="flex flex-col gap-1 text-xs">
                      <span className="font-bold text-slate-200">Incident Code: {user?.tracking_code}</span>
                      <span className="text-slate-500">August 03, 2026 at 17:40:25</span>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 text-[9px] font-black uppercase">
                      Resolved Cleanly
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: SETTINGS */}
            {activeTab === 'settings' && (
              <div className="glass-panel p-8 flex flex-col gap-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-cyan-400" /> System Preferences
                </h2>
                <p className="text-xs text-slate-400">Configure secret phrases, speech backoff, and notifier delivery limits.</p>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-350">Custom Emergency Wake Word</label>
                    <input
                      type="text"
                      className="input-field text-sm"
                      placeholder="e.g. Jarvis save me"
                      value={wakeWord}
                      onChange={(e) => setWakeWord(e.target.value)}
                    />
                    <span className="text-[10px] text-slate-500">In addition to the standard trigger phrases: "SOS", "Help me", "Emergency", "I am in danger", "Save me".</span>
                  </div>

                  <button onClick={handleSaveProfile} className="btn-glow-primary text-xs py-2 px-6 font-bold self-start cursor-pointer">
                    Save System Preferences
                  </button>
                </div>
              </div>
            )}

            {/* TAB 9: SANDBOX INBOX */}
            {activeTab === 'inbox' && (
              <div className="glass-panel p-6 flex flex-col gap-6 h-full min-h-0">
                <div className="flex justify-between items-center shrink-0">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Mail className="w-5 h-5 text-cyan-400" /> Sandbox Inbox
                    </h2>
                    <p className="text-xs text-slate-400">
                      Simulated emergency emails received by contacts during development and demo.
                    </p>
                  </div>
                  <button
                    onClick={fetchMockEmails}
                    className="btn-glow-primary text-[10px] font-bold py-2 px-4 cursor-pointer"
                  >
                    Refresh Mailbox
                  </button>
                </div>

                <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
                  {/* Left Column: Email list */}
                  <div className="w-80 border-r border-slate-900 pr-6 flex flex-col gap-3 min-h-0 overflow-y-auto">
                    {mockEmails.length === 0 ? (
                      <div className="py-12 bg-slate-950/20 border border-slate-900 rounded-xl text-center text-xs text-slate-500 font-semibold italic">
                        No sandbox emails sent yet.<br />
                        <button
                          onClick={triggerManualPanic}
                          className="mt-3 text-red-500 font-extrabold hover:underline"
                        >
                          Trigger SOS Alert Now
                        </button>
                      </div>
                    ) : (
                      mockEmails.map((email) => (
                        <div
                          key={email.filename}
                          onClick={() => setSelectedEmail(email)}
                          className={`p-4 border rounded-xl flex flex-col gap-2 cursor-pointer transition-all hover:bg-slate-900/60 ${selectedEmail?.filename === email.filename ? 'bg-[#0f1122]/70 border-cyan-500/50 shadow-[0_0_10px_rgba(0,242,254,0.05)]' : 'bg-slate-950/40 border-slate-900'}`}
                        >
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-black text-cyan-400 uppercase font-mono">ALERT MAIL</span>
                            <span className="text-slate-500 font-bold">
                              {new Date(email.last_modified * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-white truncate">To: {email.recipient}</span>
                          <span className="text-[10px] text-slate-450 leading-snug line-clamp-2">
                            🚨 Emergency SOS Alert from {user?.name || 'vis'} - Live Coordinates Attached.
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Right Column: Preview pane */}
                  <div className="flex-1 bg-slate-950/40 border border-slate-950 rounded-xl relative overflow-hidden flex flex-col min-h-0">
                    {selectedEmail ? (
                      <React.Fragment>
                        <div className="p-3.5 bg-[#080a13] border-b border-slate-900 flex justify-between items-center shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
                            <span className="text-xs font-bold text-slate-200">Email Display Render (Live)</span>
                          </div>
                          <a
                            href={`${API_URL.replace('/api', '')}${selectedEmail.url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-cyan-400 font-bold hover:underline"
                          >
                            Open in New Tab
                          </a>
                        </div>
                        <div className="flex-1 bg-[#ffffff] min-h-0 h-full w-full">
                          <iframe
                            src={`${API_URL.replace('/api', '')}${selectedEmail.url}`}
                            title="Mock Email Preview"
                            className="w-full h-full border-none"
                          />
                        </div>
                      </React.Fragment>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-slate-500 font-semibold italic text-xs">
                        Select an email from the left to preview content
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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

      {/* Strobe Flash Overlay */}
      {strobeActive && (
        <div
          onClick={() => setStrobeActive(false)}
          className="fixed inset-0 z-[9999] bg-white pointer-events-auto animate-[strobe-flash_0.08s_infinite]"
        />
      )}
    </div>
  );
};
