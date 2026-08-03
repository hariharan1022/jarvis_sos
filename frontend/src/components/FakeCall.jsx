import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, User, MessageCircle } from 'lucide-react';

export const FakeCall = ({ active, onClose, callerName = 'Dad', callerPhoto }) => {
  const [callState, setCallState] = useState('ringing'); // ringing, active, ended
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval;
    if (callState === 'active') {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  if (!active) return null;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleDecline = () => {
    setCallState('ended');
    setTimeout(() => {
      onClose();
      setCallState('ringing');
      setTimer(0);
    }, 1000);
  };

  const handleAccept = () => {
    setCallState('active');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-neutral-900 text-white font-sans p-8 pb-16">
      {/* Top Section */}
      <div className="flex flex-col items-center mt-20 gap-4">
        <div className="w-28 h-28 rounded-full bg-neutral-800 flex items-center justify-center border-2 border-neutral-700 shadow-xl">
          <User className="w-16 h-16 text-neutral-400" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-3xl font-semibold tracking-wide">{callerName}</h2>
          <p className="text-neutral-400 text-lg uppercase tracking-widest font-light">
            {callState === 'ringing' ? 'Incoming Call' : callState === 'active' ? formatTime(timer) : 'Call Ended'}
          </p>
        </div>
      </div>

      {/* Action Section */}
      <div className="w-full flex flex-col items-center gap-12">
        {callState === 'ringing' ? (
          <div className="w-full flex justify-around items-center max-w-sm">
            {/* Decline */}
            <button 
              onClick={handleDecline} 
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
                <PhoneOff className="w-8 h-8 text-white" />
              </div>
              <span className="text-xs text-neutral-400 font-medium">Decline</span>
            </button>

            {/* Accept */}
            <button 
              onClick={handleAccept} 
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform animate-bounce">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <span className="text-xs text-neutral-400 font-medium">Accept</span>
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-8 max-w-sm">
            {callState === 'active' && (
              <div className="grid grid-cols-3 gap-y-6 w-full text-center text-neutral-300">
                <div className="flex flex-col items-center gap-1 opacity-70">
                  <div className="w-12 h-12 rounded-full border border-neutral-700 flex items-center justify-center"><MicOff className="w-5 h-5" /></div>
                  <span className="text-xs">Mute</span>
                </div>
                <div className="flex flex-col items-center gap-1 opacity-70">
                  <div className="w-12 h-12 rounded-full border border-neutral-700 flex items-center justify-center"><Keyboard className="w-5 h-5" /></div>
                  <span className="text-xs">Keypad</span>
                </div>
                <div className="flex flex-col items-center gap-1 opacity-70">
                  <div className="w-12 h-12 rounded-full border border-neutral-700 flex items-center justify-center"><Volume2 className="w-5 h-5" /></div>
                  <span className="text-xs">Speaker</span>
                </div>
              </div>
            )}
            
            {/* Hangup */}
            <button 
              onClick={handleDecline} 
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                <PhoneOff className="w-8 h-8 text-white" />
              </div>
              <span className="text-xs text-neutral-400 font-medium">End Call</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Help helper icon imports locally
import { MicOff, Volume2, LayoutGrid as Keyboard } from 'lucide-react';
