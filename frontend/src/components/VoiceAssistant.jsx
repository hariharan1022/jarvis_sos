import React from 'react';
import { useEmergency } from '../contexts/EmergencyContext';
import { Mic, MicOff } from 'lucide-react';

export const VoiceAssistant = () => {
  const { 
    debugLog,
    browserSupport,
    browserInfo,
    speechLanguage,
    finalTranscript,
    isEmergency,
    speechStatus, 
    wakePhraseMatch, 
    liveTranscript,
    lastWakePhrase,
    recognitionConfidence,
    micPermissionGranted,
    micPermissionError,
    voiceGuardianEnabled,
    setVoiceGuardianEnabled,
    requestMicPermissionAndStart,
    startSpeechRecognition, 
    stopSpeechRecognition 
  } = useEmergency();
  
  const [showDebug, setShowDebug] = React.useState(false);

  const toggleSpeech = () => {
    if (voiceGuardianEnabled) {
      setVoiceGuardianEnabled(false);
    } else {
      setVoiceGuardianEnabled(true);
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
          color: 'text-amber-455',
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
      case 'offline':
        return {
          text: 'Voice Guardian Offline. Click the mic button to enable.',
          color: 'text-slate-500',
          indicator: 'bg-slate-600',
          showEq: false
        };
      default:
        return {
          text: 'Voice activation is offline. Click the mic button to start.',
          color: 'text-slate-500',
          indicator: 'bg-slate-600',
          showEq: false
        };
    }
  };

  const details = getStatusDetails();

  return (
    <div className="glass-panel p-4 flex flex-col justify-between bg-[#0a0c16]/90 border border-slate-900 relative overflow-hidden h-full">
      {/* Header Row */}
      <div className="flex justify-between items-center z-10 w-full">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-cyan-950/40 border border-cyan-500/30 rounded-md flex items-center justify-center text-cyan-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <span 
            className="text-xs font-bold uppercase tracking-wider text-slate-350 cursor-pointer hover:text-cyan-400"
            onClick={() => setShowDebug(!showDebug)}
          >
            Nova AI Voice Guardian {showDebug && ' [DEBUG]'}
          </span>
        </div>
        
        {speechStatus === 'listening' && (
          <div className="flex items-center gap-1.5 bg-emerald-955/20 px-2.5 py-0.5 border border-emerald-500/20 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-widest">Listening...</span>
          </div>
        )}
      </div>

      {/* Main Body Columns */}
      <div className="flex justify-between items-center gap-4 z-10 mt-2 flex-1">
        {/* Left Column: Wave & Text */}
        <div className="flex-1 flex flex-col justify-center gap-3">
          {/* Animated Wave */}
          {details.showEq ? (
            <div className="eq-container self-start w-full max-w-[280px]">
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
            </div>
          ) : (
            <div className="h-10 w-full max-w-[280px] border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500 font-semibold italic text-[10px]">
              Voice Shield Offline
            </div>
          )}

          {/* Trigger Instruction Text */}
          <div className="flex flex-col gap-0.5 text-[11px] text-slate-450 leading-tight">
            <span>Nova is listening. Say</span>
            <span className="text-cyan-400 font-black tracking-wide text-xs">
              “Nova Help Me” <span className="text-slate-400 font-medium text-[10px]">or</span> “Hey Nova”
            </span>
          </div>
        </div>

        {/* Right Column: Dynamic Glowing Microphone Button */}
        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
          <div className="absolute w-16 h-16 rounded-full border border-cyan-500/10 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute w-13 h-13 rounded-full border border-cyan-500/20" />
          <div className="absolute w-18 h-18 rounded-full border border-dashed border-cyan-500/5 animate-[spin_40s_linear_infinite]" />
          
          <button 
            onClick={toggleSpeech} 
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 z-10 hover:scale-105 active:scale-95 ${voiceGuardianEnabled ? 'bg-cyan-950/60 border border-cyan-500/65 text-cyan-400 shadow-[0_0_15px_rgba(0,242,254,0.3)]' : 'bg-slate-900 border border-slate-800 text-slate-550'}`}
            title={voiceGuardianEnabled ? 'Stop Listening' : 'Start Listening'}
          >
            {voiceGuardianEnabled ? (
              <Mic className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
            ) : (
              <MicOff className="w-4.5 h-4.5 text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {/* Live Transcript Stream HUD */}
      {liveTranscript && (
        <div className="mt-2 text-[9px] italic text-slate-350 bg-slate-950/40 p-1 px-2 rounded-lg border border-slate-900/60 z-10 shrink-0 truncate max-w-full">
          Live: "{liveTranscript}"
        </div>
      )}

      {/* HUD Debug Mode Telemetry */}
      {showDebug ? (
        <div className="mt-2 pt-2 border-t border-slate-700 grid grid-cols-1 gap-2 text-[9px] font-mono text-slate-300 z-10 shrink-0 max-h-48 overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-500">Browser API:</span>
              <span className={browserSupport === 'Supported' ? 'text-emerald-400' : 'text-rose-400'}>{browserSupport} ({browserInfo})</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-500">Mic Perm:</span>
              <span className={micPermissionGranted ? 'text-emerald-400' : 'text-rose-400'}>{micPermissionGranted ? 'GRANTED' : 'DENIED'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-500">Rec Status:</span>
              <span className={speechStatus === 'listening' ? 'text-emerald-400' : 'text-amber-400'}>{speechStatus.toUpperCase()}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-500">Language:</span>
              <span className="text-cyan-400">{speechLanguage}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-500">Confidence:</span>
              <span className="text-cyan-400">{(recognitionConfidence * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-500">Last Trigger:</span>
              <span className="text-rose-400">{lastWakePhrase || 'NONE'}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-1 mt-1 border-t border-slate-800 pt-1">
            <span className="text-slate-500 uppercase font-bold text-[8px]">Live Transcript:</span>
            <div className="bg-slate-950 p-1 rounded min-h-[1.5rem] break-words">{liveTranscript || '...'}</div>
            <span className="text-slate-500 uppercase font-bold text-[8px]">Final Transcript:</span>
            <div className="bg-slate-950 p-1 rounded min-h-[1.5rem] break-words text-emerald-400/80">{finalTranscript || '...'}</div>
          </div>

          <div className="flex flex-col gap-1 mt-1 border-t border-slate-800 pt-1">
            <span className="text-slate-500 uppercase font-bold text-[8px]">Event Log (last 5):</span>
            <div className="bg-slate-950 p-1 rounded flex flex-col gap-0.5">
              {debugLog.slice(0, 5).map((log, i) => (
                <div key={i} className="text-[8px] opacity-80">{log}</div>
              ))}
              {debugLog.length === 0 && <div className="text-[8px] opacity-40">No events yet...</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 pt-1.5 border-t border-slate-900/70 grid grid-cols-2 gap-1 text-[8px] font-bold text-slate-500 uppercase tracking-widest z-10 shrink-0">
          <div className="flex flex-col gap-0.5">
            <span>Mic State: <span className={micPermissionGranted ? 'text-emerald-450' : 'text-slate-500'}>{micPermissionGranted ? 'ONLINE' : 'OFFLINE'}</span></span>
            <span className="truncate">Trigger Phrase: <span className="text-rose-450">{lastWakePhrase || 'NONE'}</span></span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-right">Confidence: <span className="text-cyan-400 font-mono">{(recognitionConfidence * 100).toFixed(0)}%</span></span>
            <span className="truncate text-right">Mode: <span className="text-cyan-400">{speechStatus}</span></span>
          </div>
        </div>
      )}

      {/* Decorative shadow in background */}
      <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none translate-x-4 translate-y-4">
        <Mic className="w-24 h-24 text-slate-100" />
      </div>
    </div>
  );
};
