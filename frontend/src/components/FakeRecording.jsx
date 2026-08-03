import React, { useEffect, useState } from 'react';
import { Shield, Radio, Video, AlertTriangle } from 'lucide-react';

export const FakeRecording = ({ active, onClose }) => {
  const [coords, setCoords] = useState({ lat: 12.9716, lng: 77.5946 });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.log('Location bypass inside mock recording screen')
    );
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-black text-white p-6 font-mono">
      {/* Top Banner */}
      <div className="flex flex-col gap-2 border-b border-red-900 pb-4">
        <div className="flex items-center justify-between text-red-500">
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 animate-pulse" />
            <span className="font-bold tracking-wider uppercase text-lg">LIVE UPLOADING TO SECURITY CLOUD</span>
          </div>
          <div className="w-3.5 h-3.5 rounded-full bg-red-600 animate-ping" />
        </div>
        <p className="text-neutral-400 text-xs">
          ENCRYPTED STREAM FEED ID: SN-{Math.floor(100000 + Math.random() * 900000)}
        </p>
      </div>

      {/* Main Deterrence Banner */}
      <div className="flex flex-col items-center justify-center my-auto gap-6 text-center">
        <div className="w-24 h-24 rounded-full border-4 border-red-600 flex items-center justify-center animate-pulse">
          <Shield className="w-12 h-12 text-red-500" />
        </div>
        
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-black text-red-600 tracking-tight">ATTENTION WARNING</h1>
          <p className="text-neutral-200 text-md leading-relaxed max-w-md mx-auto">
            ALL CAMERAS, MICROPHONES, AND SENSORS ARE STREAMING SECURELY TO OFF-SITE POLICE-LINKED DISPATCH SERVICES.
          </p>
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg flex flex-col gap-1 text-left text-xs font-semibold text-cyan-400 mx-auto w-full max-w-sm">
            <div>GPS POSITION LOGGED:</div>
            <div className="text-white text-sm">LAT: {coords.lat.toFixed(6)}</div>
            <div className="text-white text-sm">LNG: {coords.lng.toFixed(6)}</div>
            <div className="text-neutral-400 mt-2">POLICE DISPATCH ROOM STATUS: ACTIVE</div>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex flex-col gap-4 border-t border-neutral-900 pt-4">
        <div className="flex justify-between items-center text-xs text-neutral-500">
          <span>TIME: {new Date().toLocaleTimeString()}</span>
          <span>BATTERY: 98%</span>
        </div>
        <button 
          onClick={onClose} 
          className="w-full py-4 rounded bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-bold tracking-widest text-sm transition-colors cursor-pointer"
        >
          SHUTDOWN SECURE SYSTEM (PIN REQUIRED)
        </button>
      </div>
    </div>
  );
};
