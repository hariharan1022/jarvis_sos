import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

const EmergencyContext = createContext(null);

export const EmergencyProvider = ({ children }) => {
  const { user, token, API_URL } = useAuth();
  const [isEmergency, setIsEmergency] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [speechStatus, setSpeechStatus] = useState('offline');
  const [wakePhraseMatch, setWakePhraseMatch] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastWakePhrase, setLastWakePhrase] = useState('');
  const [recognitionConfidence, setRecognitionConfidence] = useState(0);
  const [micPermissionGranted, setMicPermissionGranted] = useState(null);
  const [micPermissionError, setMicPermissionError] = useState(null);
  const [voiceGuardianEnabled, setVoiceGuardianEnabled] = useState(true);

  // ─── SOS Workflow State ───────────────────────────────────────────────────
  const [sosState, setSosState] = useState({
    locationAcquired: false,
    backendTriggered: false,
    errorMsg: null,
    gpsError: null,
    emailSent: null,
    whatsappSent: null,
    callSent: null,
    smsError: null,
    smsError: null,
    emailError: null,
    whatsappError: null
  });

  const [sosTimers, setSosTimers] = useState({
    gpsStart: null,
    gpsEnd: null,
    apiStart: null,
    apiEnd: null,
    emailEnd: null
  });

  const [currentAddress, setCurrentAddress] = useState('Unknown Location');

  const locationIntervalRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastTriggerTimeRef = useRef(0);
  const wsRef = useRef(null);

  // ─── Diagnostic / Debug State ──────────────────────────────────────────────
  const [debugLog, setDebugLog] = useState([]);
  const [browserSupport, setBrowserSupport] = useState('Unknown');
  const [browserInfo, setBrowserInfo] = useState('');
  const [speechLanguage, setSpeechLanguage] = useState('en-US');
  const [finalTranscript, setFinalTranscript] = useState('');

  const addDebugLog = (msg) => {
    console.log(`[Voice Guardian Debug] ${msg}`);
    setDebugLog(prev => [msg, ...prev].slice(0, 50));
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setBrowserSupport('Supported');
    } else {
      setBrowserSupport('Unsupported');
    }

    const ua = navigator.userAgent;
    if (ua.includes('Edg/')) {
      setBrowserInfo('Edge');
    } else if (ua.includes('Chrome/')) {
      setBrowserInfo('Chrome');
    } else if (ua.includes('Firefox/')) {
      setBrowserInfo('Firefox');
    } else if (ua.includes('Safari/')) {
      setBrowserInfo('Safari');
    } else {
      setBrowserInfo('Other');
    }
  }, []);

  // ─── CRITICAL: Use refs for values accessed inside recognition callbacks ───
  const recognitionRef = useRef(null);
  const enabledRef = useRef(true);
  const isEmergencyRef = useRef(false);
  const userRef = useRef(null);
  const restartTimerRef = useRef(null);
  const isRestartingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { enabledRef.current = voiceGuardianEnabled; }, [voiceGuardianEnabled]);
  useEffect(() => { isEmergencyRef.current = isEmergency; }, [isEmergency]);
  useEffect(() => { userRef.current = user; }, [user]);

  // ─── Start / stop guardian on auth + toggle ───────────────────────────────
  useEffect(() => {
    if (user && voiceGuardianEnabled) {
      requestMicPermissionAndStart();
    } else {
      stopSpeechRecognition();
    }
    return () => {
      stopSpeechRecognition();
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, voiceGuardianEnabled]);

  // ─── TTS Helper ─────────────────────────────────────────────────────────
  const speakFeedback = useCallback((text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // ─── Location streaming during emergency ─────────────────────────────────
  useEffect(() => {
    if (isEmergency && activeSession) {
      locationIntervalRef.current = setInterval(streamCurrentLocation, 5000);
      startEvidenceRecording();
      captureCameraSnapshot('image_front');
      setTimeout(() => captureCameraSnapshot('image_rear'), 2000);

      // Connect WebSocket to track notification delivery status
      const wsUrl = API_URL.replace('http', 'ws');
      const ws = new WebSocket(`${wsUrl}/ws/track/${activeSession.tracking_code}`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification_status') {
            const statusVal = data.status === 'success' ? true : data.status === 'retrying' ? 'retrying' : false;

            if (data.status === 'success') {
              setSosTimers(prev => ({ ...prev, [`${data.channel}End`]: performance.now() }));
            }

            setSosState(prev => {
              const next = {
                ...prev,
                [`${data.channel}Sent`]: statusVal,
                [`${data.channel}Error`]: data.status === 'failed' ? data.error : null
              };

              // Trigger TTS for failures
              if (data.status === 'failed') {
                const errStr = data.error ? data.error : 'Unknown error';
                speakFeedback(`${data.channel} delivery failed. Reason: ${errStr}`);
              } else if (data.status === 'retrying') {
                speakFeedback(`${data.channel} delivery failed. Retrying.`);
              }

              // Check if all requested channels have successfully sent
              const allSuccess = ['smsSent', 'emailSent', 'whatsappSent', 'callSent'].every(
                key => next[key] === null || next[key] === true
              );
              
              const hasTrue = ['smsSent', 'emailSent', 'whatsappSent', 'callSent'].some(key => next[key] === true);
              const hasPending = ['smsSent', 'emailSent', 'whatsappSent', 'callSent'].some(key => next[key] === 'retrying' || next[key] === false);
              
              if (hasTrue && !hasPending && allSuccess) {
                const prevAllSuccess = ['smsSent', 'emailSent', 'whatsappSent', 'callSent'].every(
                  key => prev[key] === null || prev[key] === true
                );
                const prevHasTrue = ['smsSent', 'emailSent', 'whatsappSent', 'callSent'].some(key => prev[key] === true);
                const prevHasPending = ['smsSent', 'emailSent', 'whatsappSent', 'callSent'].some(key => prev[key] === 'retrying' || prev[key] === false);

                if (!(prevHasTrue && !prevHasPending && prevAllSuccess)) {
                  speakFeedback("Emergency alert has been sent successfully. Your trusted contacts have been notified by email. Your live location is now being shared. Stay calm, help is on the way.");
                }
              }

              return next;
            });
          }
        } catch (e) { console.error('WS parsing error:', e); }
      };
      wsRef.current = ws;

    } else {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      stopEvidenceRecording();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmergency, activeSession, API_URL, speakFeedback]);

  // ─── Text normalization ───────────────────────────────────────────────────
  const normalizeText = (text) =>
    text
      .toLowerCase()
      .replace(/[.,!?;:'"()\[\]{}\-_\/\\@#$%^&*+=|<>`~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // ─── Fuzzy phrase matcher ─────────────────────────────────────────────────
  const checkFuzzyMatch = (transcript, customWakeWord = '') => {
    const n = normalizeText(transcript);
    console.log(`[Voice Guardian] Checking transcript: "${n}"`);

    const targets = [
      'nova help me',
      'hey nova',
      'nova',
      'i am in danger',
      'save me',
      'emergency',
      'help me',
      'help',
      'sos',
    ];
    if (customWakeWord) targets.unshift(normalizeText(customWakeWord));

    for (const target of targets) {
      if (n.includes(target)) {
        console.log(`[Voice Guardian] Direct match: "${target}"`);
        return target;
      }
    }

    const phonetics = [
      { target: 'nova help me', pattern: /no[vb][ao]\s+help\s+me/i },
      { target: 'nova help me', pattern: /no[vb]a\s+help/i },
      { target: 'hey nova', pattern: /hey\s+no[vb][ao]/i },
      { target: 'nova', pattern: /no[vb][ao]/i },
      { target: 'emergency', pattern: /emergen/i },
      { target: 'sos', pattern: /\bs\s*[.\-]?\s*o\s*[.\-]?\s*s\b/i },
      { target: 'save me', pattern: /saf[e]?\s+me/i },
      { target: 'i am in danger', pattern: /danger/i },
      { target: 'help me', pattern: /\bhelp\s+m[ea]\b/i },
      { target: 'help', pattern: /\bhelp\b/i },
    ];

    for (const { target, pattern } of phonetics) {
      if (pattern.test(n)) {
        console.log(`[Voice Guardian] Phonetic match: "${target}" via pattern ${pattern}`);
        return target;
      }
    }

    return null;
  };

  // ─── Confirmation chirp ───────────────────────────────────────────────────
  const playConfirmationChirp = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      [[587.33, 987.77, 0, 0.12], [783.99, 1174.66, 0.07, 0.18]].forEach(([f1, f2, delay, dur]) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f1, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + dur);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + dur);
        }, delay * 1000);
      });
    } catch (e) {
      console.warn('Chirp audio failed:', e);
    }
  };

  // ─── Mic permission + start ───────────────────────────────────────────────
  const requestMicPermissionAndStart = async () => {
    try {
      addDebugLog('Requesting microphone permission...');
      console.log('[Voice Guardian] Requesting microphone permission...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      addDebugLog('Microphone permission GRANTED');
      console.log('[Voice Guardian] Microphone permission GRANTED.');
      setMicPermissionGranted(true);
      setMicPermissionError(null);
      startSpeechRecognition();
    } catch (err) {
      addDebugLog(`Microphone permission DENIED: ${err.name} - ${err.message}`);
      console.error('[Voice Guardian] Microphone permission DENIED:', err.name, err.message);
      setMicPermissionGranted(false);
      const msg =
        err.name === 'NotAllowedError'
          ? 'Microphone blocked by browser. Click the lock icon in the address bar → Allow microphone.'
          : err.name === 'NotFoundError'
            ? 'No microphone detected on this device.'
            : `Microphone error: ${err.message}`;
      setMicPermissionError(msg);
      setSpeechStatus('permission_denied');
    }
  };

  // ─── Debounced restart helper ────────────────────────────────────────────
  const scheduleRestart = () => {
    if (isRestartingRef.current) return;
    if (!enabledRef.current || isEmergencyRef.current) return;
    isRestartingRef.current = true;
    console.log('[Voice Guardian] ⏱ Scheduling restart in 1s...');
    restartTimerRef.current = setTimeout(() => {
      if (enabledRef.current && !isEmergencyRef.current) {
        console.log('[Voice Guardian] 🔁 Restarting recognition now.');
        startSpeechRecognition();
      } else {
        isRestartingRef.current = false;
      }
    }, 1000);
  };

  // ─── Core recognition start ──────────────────────────────────────────────
  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addDebugLog('SpeechRecognition API not supported in this browser.');
      console.warn('[Voice Guardian] SpeechRecognition API not supported in this browser.');
      setSpeechStatus('unsupported');
      return;
    }

    // Cancel any pending restart
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // Tear down old session cleanly
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) { }
      recognitionRef.current = null;
    }

    try {
      addDebugLog('Initializing SpeechRecognition instance...');
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognition.lang = speechLanguage;

      // ── onstart ────────────────────────────────────────────────────────
      recognition.onstart = () => {
        addDebugLog('✅ Recognition engine STARTED — listening for wake phrases');
        console.log('[Voice Guardian] ✅ Recognition engine STARTED — listening for wake phrases.');
        setSpeechStatus('listening');
        isRestartingRef.current = false;
      };

      // ── onerror ────────────────────────────────────────────────────────
      recognition.onerror = (event) => {
        addDebugLog(`❌ Recognition error: "${event.error}" - ${event.message || ''}`);
        console.error(`[Voice Guardian] ❌ Recognition error: "${event.error}"`, event.message || '');
        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            setMicPermissionGranted(false);
            setMicPermissionError('Microphone access blocked. Allow it in the browser address bar (🔒 icon).');
            setSpeechStatus('permission_denied');
            return;
          case 'no-speech':
            addDebugLog('No speech detected — will auto-restart');
            console.log('[Voice Guardian] No speech detected — will auto-restart.');
            break;
          case 'network':
            addDebugLog('Network error — will auto-restart');
            console.warn('[Voice Guardian] Network error — will auto-restart.');
            setSpeechStatus('error');
            break;
          case 'audio-capture':
            addDebugLog('Mic capture error — will auto-restart');
            console.warn('[Voice Guardian] Mic capture error — will auto-restart.');
            setSpeechStatus('error');
            break;
          case 'aborted':
            addDebugLog('Recognition aborted');
            console.log('[Voice Guardian] Recognition aborted.');
            break;
          default:
            addDebugLog(`Unknown error: ${event.error}`);
            console.warn(`[Voice Guardian] Unknown error: ${event.error}`);
            setSpeechStatus('error');
        }
        scheduleRestart();
      };

      // ── onend ─────────────────────────────────────────────────────────
      recognition.onend = () => {
        addDebugLog('🔄 Recognition stream ended');
        console.log('[Voice Guardian] 🔄 Recognition stream ended.');
        if (enabledRef.current && userRef.current && !isEmergencyRef.current) {
          scheduleRestart();
        } else {
          addDebugLog('Not restarting — guardian disabled or emergency active');
          console.log('[Voice Guardian] Not restarting — guardian disabled or emergency active.');
        }
      };

      // ── onresult ───────────────────────────────────────────────────────
      // Short/generic words require higher confidence to avoid false positives
      const HIGH_CONFIDENCE_REQUIRED = ['help', 'sos', 'nova'];
      const CONFIDENCE_THRESHOLD = 0.60;

      recognition.onresult = (event) => {
        let bestConfidence = 0;
        let hasMatch = false;
        let finalChunk = '';
        let fullTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          fullTranscript += result[0].transcript + ' ';

          if (result.isFinal && i >= event.resultIndex) {
            finalChunk += result[0].transcript;
          }

          if (i === event.results.length - 1) {
            bestConfidence = result[0].confidence || 0;
          }
        }

        fullTranscript = fullTranscript.trim();

        if (finalChunk) {
          setFinalTranscript(prev => (prev + ' ' + finalChunk.trim()).trim().slice(-100));
        }

        if (fullTranscript) {
          setLiveTranscript(fullTranscript.slice(-100));
          setRecognitionConfidence(bestConfidence);
        }

        if (!hasMatch && fullTranscript) {
          const customWakeWord = userRef.current?.custom_wake_word || '';
          const matched = checkFuzzyMatch(fullTranscript, customWakeWord);
          if (matched) {
            const needsHighConf = HIGH_CONFIDENCE_REQUIRED.includes(matched);
            const confOk = !needsHighConf || bestConfidence === 0 || bestConfidence >= CONFIDENCE_THRESHOLD;
            if (!confOk) {
              addDebugLog(`⚠️ Low-confidence match "${matched}" (${(bestConfidence * 100).toFixed(0)}%) — skipped.`);
              console.log(`[Voice Guardian] ⚠️ Low-conf match "${matched}" (${bestConfidence.toFixed(2)}) < ${CONFIDENCE_THRESHOLD} — skipped.`);
            } else {
              hasMatch = true;
              addDebugLog(`🚨 WAKE PHRASE DETECTED: "${matched}" conf:${(bestConfidence * 100).toFixed(0)}% — triggering SOS!`);
              console.log(`[Voice Guardian] 🚨 WAKE PHRASE DETECTED: "${matched}" — triggering SOS!`);
              setWakePhraseMatch(matched);
              setLastWakePhrase(matched);
              setSpeechStatus('matched');
              playConfirmationChirp();
              speakFeedback(`${matched} detected. Activating emergency protocol now.`);
              triggerEmergency('voice_activation', matched);
            }
          }
        }
      };

      recognitionRef.current = recognition;

      // Small delay to avoid "already started" race condition
      setTimeout(() => {
        try {
          recognition.start();
          addDebugLog('📡 recognition.start() called.');
          console.log('[Voice Guardian] 📡 recognition.start() called.');
        } catch (e) {
          addDebugLog(`start() threw: ${e.message}`);
          console.error('[Voice Guardian] start() threw:', e.message);
          scheduleRestart();
        }
      }, 100);

    } catch (e) {
      addDebugLog(`Initialization error: ${e.message}`);
      console.error('[Voice Guardian] Initialization error:', e);
      setSpeechStatus('error');
    }
  };

  // ─── Stop ────────────────────────────────────────────────────────────────
  const stopSpeechRecognition = () => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    isRestartingRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) { }
      recognitionRef.current = null;
    }
    setSpeechStatus('offline');
    addDebugLog('🛑 Recognition stopped.');
    console.log('[Voice Guardian] 🛑 Recognition stopped.');
  };

  // ─── Emergency trigger ────────────────────────────────────────────────────
  const triggerEmergency = async (type = 'manual', wakeWord = '') => {
    if (isEmergencyRef.current) {
      console.log('[Emergency] Already active — ignoring duplicate trigger.');
      return;
    }
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 30000) {
      console.log('[Emergency] Duplicate trigger within 30s lock — ignored.');
      return;
    }
    lastTriggerTimeRef.current = now;
    console.log(`[Emergency] 🚨 Triggering emergency — type: "${type}", phrase: "${wakeWord}"`);

    setSosState({
      locationAcquired: false,
      backendTriggered: false,
      errorMsg: null,
      gpsError: null,
      emailSent: null,
      whatsappSent: null,
      callSent: null
    });

    setSosTimers({
      gpsStart: performance.now(),
      gpsEnd: null,
      apiStart: null,
      apiEnd: null,
      emailEnd: null
    });

    let batteryLevel = 100;
    try {
      const bat = await navigator.getBattery();
      batteryLevel = Math.round(bat.level * 100);
    } catch (_) { }

    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        console.log(`[Emergency] GPS acquired: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);

        const t = performance.now();
        setSosTimers(prev => ({ ...prev, gpsEnd: t, apiStart: t }));
        setSosState(prev => ({ ...prev, locationAcquired: true, gpsError: null }));

        let geocodedAddress = `Lat ${latitude.toFixed(4)}, Lng ${longitude.toFixed(4)}`;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (response.ok) {
            const data = await response.json();
            if (data && data.display_name) {
              geocodedAddress = data.display_name;
              setCurrentAddress(geocodedAddress);
            }
          }
        } catch (e) {
          console.warn('Reverse geocoding failed:', e);
        }

        await _sendTriggerRequest(latitude, longitude, batteryLevel, type, wakeWord, geocodedAddress);
      },
      (err) => {
        let errorText = 'Unable to obtain GPS';
        if (err.code === 1) errorText = 'Location permission denied';
        if (err.code === 2) errorText = 'Location position unavailable';
        if (err.code === 3) errorText = 'Location request timeout';

        console.warn(`[Emergency] GPS unavailable (${errorText}), using fallback coords:`, err.message);
        setSosState(prev => ({ ...prev, locationAcquired: false, gpsError: errorText }));
        speakFeedback(`I couldn't get your exact location due to ${errorText}. Retrying with approximate coordinates.`);

        _sendTriggerRequest(12.9716, 77.5946, batteryLevel, type, wakeWord, 'Unknown Location (Fallback)');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const _sendTriggerRequest = async (lat, lng, battery, type, wakeWord, addressOverride) => {
    const formData = new FormData();
    formData.append('emergency_type', type === 'voice_activation' ? `Voice Activation (${wakeWord})` : type);
    formData.append('latitude', lat);
    formData.append('longitude', lng);
    formData.append('battery', battery);
    formData.append('signal_status', navigator.onLine ? 'Good' : 'Offline');
    formData.append('address', addressOverride || `Approx. near lat ${lat.toFixed(4)}, lng ${lng.toFixed(4)}`);

    addDebugLog(`📡 Sending Backend SOS Request (${type})`);

    try {
      const res = await fetch(`${API_URL}/emergency/trigger`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const session = await res.json();
        setSosTimers(prev => ({ ...prev, apiEnd: performance.now() }));
        addDebugLog(`✅ Backend SOS Acknowledged. ID: ${session.tracking_code}`);
        console.log('[Emergency] ✅ Backend acknowledged SOS. Session:', session.tracking_code);
        setActiveSession(session);
        setIsEmergency(true);
        setSosState(prev => ({ ...prev, backendTriggered: true }));
      } else {
        addDebugLog(`❌ Backend SOS Error: ${res.status}`);
        console.error('[Emergency] Backend returned error:', res.status);
        setIsEmergency(true); // offline fallback
        setSosState(prev => ({ ...prev, backendTriggered: false, errorMsg: `API Error: ${res.status}` }));
      }
    } catch (err) {
      addDebugLog(`❌ Backend SOS Fetch Failed: ${err.message}`);
      console.error('[Emergency] Fetch failed:', err.message);
      setIsEmergency(true); // offline fallback
      setSosState(prev => ({ ...prev, backendTriggered: false, errorMsg: `Network Error: ${err.message}` }));
    }
  };

  // ─── Location streaming ───────────────────────────────────────────────────
  const streamCurrentLocation = () => {
    if (!token) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude, speed, heading, accuracy } }) => {
        let battery = 100;
        try { const b = await navigator.getBattery(); battery = Math.round(b.level * 100); } catch (_) { }
        const fd = new FormData();
        fd.append('latitude', latitude);
        fd.append('longitude', longitude);
        fd.append('speed', speed || 0.0);
        fd.append('direction', heading || 0.0);
        fd.append('battery', battery);
        fd.append('accuracy', accuracy || 10.0);
        try {
          await fetch(`${API_URL}/emergency/log-location`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
        } catch (e) { console.error('[Location] Log error:', e); }
      },
      (e) => console.error('[Location] Position error:', e),
      { enableHighAccuracy: true }
    );
  };

  // ─── Resolve emergency ────────────────────────────────────────────────────
  const resolveEmergency = async () => {
    try {
      const res = await fetch(`${API_URL}/emergency/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setIsEmergency(false);
        setActiveSession(null);
        setTimeout(() => {
          if (enabledRef.current) startSpeechRecognition();
        }, 500);
      }
    } catch (err) {
      console.error('[Emergency] Resolve error:', err);
      setIsEmergency(false);
      setActiveSession(null);
    }
  };

  // ─── Evidence recording ───────────────────────────────────────────────────
  const startEvidenceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        uploadEvidenceBlob(new Blob(audioChunksRef.current, { type: 'audio/webm' }), 'audio', 'audio.webm');
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 5000);
    } catch (e) { console.warn('[Evidence] Audio capture failed:', e); }
  };

  const stopEvidenceRecording = () => {
    if (audioRecorderRef.current?.state === 'recording') {
      try { audioRecorderRef.current.stop(); } catch (_) { }
    }
  };

  // ─── Real camera snapshot (with canvas fallback) ──────────────────────────
  const captureCameraSnapshot = async (type = 'image_front') => {
    const facingMode = type === 'image_rear' ? 'environment' : 'user';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      const track = stream.getVideoTracks()[0];
      let blob;

      if (typeof ImageCapture !== 'undefined') {
        const imageCapture = new ImageCapture(track);
        const rawBlob = await imageCapture.takePhoto();
        blob = rawBlob instanceof Blob ? rawBlob : null;
        if (!blob) {
          // Rare case: takePhoto returned ImageBitmap; render it to canvas
          const bitmap = await createImageBitmap(rawBlob);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext('2d').drawImage(bitmap, 0, 0);
          blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
        }
      } else {
        // Safari / Firefox: draw first available video frame onto canvas
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await new Promise(res => { video.onloadedmetadata = res; });
        await video.play();
        // Wait one frame for data
        await new Promise(res => requestAnimationFrame(res));
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d').drawImage(video, 0, 0);
        blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
        video.pause();
      }

      stream.getTracks().forEach(t => t.stop());

      if (blob) {
        console.log(`[Evidence] 📸 Real snapshot captured (${type}), size: ${blob.size} bytes`);
        uploadEvidenceBlob(blob, type, `${type}.jpg`);
      }
    } catch (e) {
      console.warn(`[Evidence] Camera capture failed for ${type}:`, e.message, '— using stub');
      const stub = new Blob([`[CAMERA_UNAVAILABLE] ${type} @ ${new Date().toISOString()}`], { type: 'text/plain' });
      uploadEvidenceBlob(stub, type, `${type}_stub.txt`);
    }
  };

  const uploadEvidenceBlob = async (blob, type, filename) => {
    if (!token) return;
    const fd = new FormData();
    fd.append('type', type);
    fd.append('file', blob, filename || `${type}.bin`);
    try {
      await fetch(`${API_URL}/emergency/upload-evidence`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
    } catch (e) { console.error('[Evidence] Upload error:', e); }
  };

  return (
    <EmergencyContext.Provider value={{
      debugLog,
      browserSupport,
      browserInfo,
      speechLanguage,
      finalTranscript,
      isEmergency,
      activeSession,
      speechStatus,
      wakePhraseMatch,
      liveTranscript,
      lastWakePhrase,
      recognitionConfidence,
      micPermissionGranted,
      micPermissionError,
      voiceGuardianEnabled,
      sosState,
      sosTimers,
      setVoiceGuardianEnabled,
      requestMicPermissionAndStart,
      triggerEmergency,
      resolveEmergency,
      startSpeechRecognition,
      stopSpeechRecognition,
      currentAddress
    }}>
      {children}
    </EmergencyContext.Provider>
  );
};

export const useEmergency = () => useContext(EmergencyContext);
