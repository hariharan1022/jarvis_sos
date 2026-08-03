import React from 'react';
import { useEmergency } from '../contexts/EmergencyContext';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';

export const VoiceAssistant = () => {
  const { 
    speechStatus, 
    wakePhraseMatch, 
    startSpeechRecognition, 
    stopSpeechRecognition 
  } = useEmergency();

  const toggleSpeech = () => {
    if (speechStatus === 'listening') {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  const getStatusDetails = () => {
    switch (speechStatus) {
      case 'listening':
        return {
          text: 'Nova is listening. Say "Nova Help Me" or "Hey Nova"',
          color: 'text-cyan-400',
          indicator: 'bg-cyan-500',
          showEq: true
        };
      case 'matched':
        return {
          text: `Trigger matched: "${wakePhraseMatch}". Initializing SOS!`,
          color: 'text-rose-500 font-bold animate-pulse',
          indicator: 'bg-rose-500',
          showEq: false
        };
      case 'permission_denied':
        return {
          text: 'Microphone permission blocked. Please enable in browser settings.',
          color: 'text-amber-400',
          indicator: 'bg-amber-500',
          showEq: false
        };
      case 'unsupported':
        return {
          text: 'Voice recognition not supported in this browser. Use Chrome/Safari/Edge.',
          color: 'text-slate-400',
          indicator: 'bg-slate-500',
          showEq: false
        };
      default:
        return {
          text: 'Nova voice activation is offline. Click the mic button to start.',
          color: 'text-slate-500',
          indicator: 'bg-slate-600',
          showEq: false
        };
    }
  };

  const details = getStatusDetails();

  return (
    <div className="glass-panel p-6 flex flex-col gap-4 relative overflow-hidden" style={{ minHeight: '140px' }}>
      <div className="flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${details.indicator} ${speechStatus === 'listening' ? 'animate-ping' : ''}`} />
          <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">Nova AI Voice Guardian</span>
        </div>
        <button 
          onClick={toggleSpeech} 
          className="p-2 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 active:bg-slate-900 transition-colors cursor-pointer"
          title={speechStatus === 'listening' ? 'Stop Voice Listening' : 'Start Voice Listening'}
        >
          {speechStatus === 'listening' ? (
            <Mic className="text-cyan-400 w-5 h-5 animate-pulse" />
          ) : (
            <MicOff className="text-slate-500 w-5 h-5" />
          )}
        </button>
      </div>

      <div className="flex flex-col gap-2 z-10">
        <p className={`text-sm ${details.color} transition-all duration-300`}>
          {details.text}
        </p>
        
        {details.showEq && (
          <div className="eq-container mt-2">
            <div className="eq-bar" />
            <div className="eq-bar" />
            <div className="eq-bar" />
            <div className="eq-bar" />
            <div className="eq-bar" />
            <div className="eq-bar" />
          </div>
        )}
      </div>

      <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
        <Mic className="w-32 h-32 text-slate-100" />
      </div>
    </div>
  );
};
