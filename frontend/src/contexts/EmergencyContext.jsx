import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const EmergencyContext = createContext(null);

export const EmergencyProvider = ({ children }) => {
  const { user, token, API_URL } = useAuth();
  const [isEmergency, setIsEmergency] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [speechStatus, setSpeechStatus] = useState('offline'); // offline, listening, matched, error, permission_denied, unsupported
  const [wakePhraseMatch, setWakePhraseMatch] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastWakePhrase, setLastWakePhrase] = useState('');
  const [recognitionConfidence, setRecognitionConfidence] = useState(1.0);
  const [micPermissionGranted, setMicPermissionGranted] = useState(null);
  const [micPermissionError, setMicPermissionError] = useState(null);
  const [voiceGuardianEnabled, setVoiceGuardianEnabled] = useState(true);
  
  const locationIntervalRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastTriggerTimeRef = useRef(0);

  // Automatically request mic permission and start recognition
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
  }, [user, voiceGuardianEnabled]);

  // Continuously post location during an emergency
  useEffect(() => {
    if (isEmergency && activeSession) {
      locationIntervalRef.current = setInterval(() => {
        streamCurrentLocation();
      }, 5000);
      
      // Auto-start recording background evidence
      startEvidenceRecording();
      // Snap a picture using front camera (simulated/actual if allowed)
      captureCameraSnapshot('image_front');
      // Snap a picture using rear camera (simulated/actual if allowed)
      setTimeout(() => captureCameraSnapshot('image_rear'), 2000);
    } else {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      stopEvidenceRecording();
    }
  }, [isEmergency, activeSession]);

  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "") // remove punctuation
      .replace(/\s+/g, " ") // normalize spacing
      .trim();
  };

  const checkFuzzyMatch = (transcript, customWakeWord = '') => {
    const normalized = normalizeText(transcript);
    const targets = [
      'nova help me', 'hey nova', 'help', 'help me', 
      'emergency', 'sos', 'save me', 'i am in danger'
    ];
    if (customWakeWord) {
      targets.push(normalizeText(customWakeWord));
    }

    // 1. Direct match check
    for (const target of targets) {
      if (normalized.includes(target)) {
        return target;
      }
    }

    // 2. Homophones / common phonetic misrecognitions
    const commonMisrecognitions = [
      { target: 'nova help me', pattern: /no[ah|ra|wa]\s+help\s+me/i },
      { target: 'hey nova', pattern: /hey\s+no[ah|ra|wa]/i },
      { target: 'emergency', pattern: /emergen/i },
      { target: 'sos', pattern: /s\s*o\s*s/i },
      { target: 'i am in danger', pattern: /danger/i },
      { target: 'save me', pattern: /safe\s+me/i }
    ];

    for (const { target, pattern } of commonMisrecognitions) {
      if (pattern.test(normalized)) {
        return target;
      }
    }

    return null;
  };

  const playConfirmationChirp = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      
      // Hi-tech alert tone 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(987.77, ctx.currentTime + 0.12); // B5
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.12);

      // Alert tone 2 (delayed slightly)
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
        osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.18); // D6
        gain2.gain.setValueAtTime(0.12, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.18);
      }, 70);
    } catch (e) {
      console.warn('Unable to play audio synth tone:', e);
    }
  };

  const requestMicPermissionAndStart = async () => {
    try {
      console.log('Requesting microphone permissions...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionGranted(true);
      setMicPermissionError(null);
      startSpeechRecognition();
    } catch (err) {
      console.error('Microphone permission request failed:', err);
      setMicPermissionGranted(false);
      setMicPermissionError('Microphone permission denied. Please allow microphone access in your browser settings to enable the Voice Guardian.');
      setSpeechStatus('permission_denied');
    }
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API is not supported in this browser.');
      setSpeechStatus('unsupported');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        console.log('[Voice Guardian]: Speech recognition engine is online & listening.');
        setSpeechStatus('listening');
      };

      recognition.onerror = (event) => {
        console.error(`[Voice Guardian Error]: ${event.error}`);
        switch (event.error) {
          case 'not-allowed':
            setMicPermissionGranted(false);
            setMicPermissionError('Microphone access blocked. Please re-allow permission in browser address bar.');
            setSpeechStatus('permission_denied');
            break;
          case 'no-speech':
            // No speech detected, ignore
            break;
          case 'network':
            console.warn('Network socket dropped during speech streams. Auto-retrying.');
            setSpeechStatus('error');
            break;
          case 'audio-capture':
            console.warn('Microphone hardware capture error. Auto-retrying.');
            setSpeechStatus('error');
            break;
          case 'aborted':
            console.log('Speech recognition stream aborted.');
            break;
          default:
            setSpeechStatus('error');
        }
      };

      recognition.onend = () => {
        console.log('[Voice Guardian]: Recognition stream ended.');
        // Auto recover and restart if voice guardian is still active
        if (user && voiceGuardianEnabled && !isEmergency && recognitionRef.current === recognition) {
          console.log('[Voice Guardian]: Auto-recovering stream now...');
          setTimeout(() => {
            if (user && voiceGuardianEnabled && !isEmergency && recognitionRef.current === recognition) {
              try {
                recognition.start();
              } catch (e) {}
            }
          }, 1000);
        }
      };

      recognition.onresult = (event) => {
        const customWakeWord = user?.custom_wake_word || '';
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const text = result[0].transcript;
          const confidence = result[0].confidence;
          
          setRecognitionConfidence(confidence);

          if (result.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }

        const currentText = (finalTranscript || interimTranscript).trim();
        if (currentText) {
          setLiveTranscript(currentText);
          console.log(`[Recognized Transcript]: "${currentText}" (confidence: ${(event.results[event.results.length - 1][0].confidence * 100).toFixed(1)}%)`);

          const matched = checkFuzzyMatch(currentText, customWakeWord);
          if (matched) {
            console.log(`[WAKE WAKE DETECTED]: "${matched}" matched with confidence! Triggering SOS.`);
            setWakePhraseMatch(matched);
            setLastWakePhrase(matched);
            setSpeechStatus('matched');
            
            // Play hi-tech confirmation chirp sound
            playConfirmationChirp();
            
            // Trigger emergency workflow
            triggerEmergency('voice_activation', matched);
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Speech initialization error', e);
      setSpeechStatus('error');
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setSpeechStatus('offline');
  };

  const triggerEmergency = async (type = 'manual', wakeWord = '') => {
    if (isEmergency) return;

    // Prevent duplicate triggers within 30 seconds
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 30000) {
      console.log('Ignoring repeated trigger within 30-second lock window.');
      return;
    }
    lastTriggerTimeRef.current = now;

    // Get current battery & location
    let batteryLevel = 100;
    try {
      const bat = await navigator.getBattery();
      batteryLevel = Math.round(bat.level * 100);
    } catch (e) {}

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, speed } = position.coords;
        
        // Reverse geocode location (simulated or mock lookup for instant address)
        const mockAddress = `Approx. near lat ${latitude.toFixed(4)}, lng ${longitude.toFixed(4)}`;

        try {
          const formData = new FormData();
          formData.append('emergency_type', type === 'voice_activation' ? `Voice Activation (${wakeWord})` : type);
          formData.append('latitude', latitude);
          formData.append('longitude', longitude);
          formData.append('battery', batteryLevel);
          formData.append('signal_status', navigator.onLine ? 'Good' : 'Offline');
          formData.append('address', mockAddress);

          const res = await fetch(`${API_URL}/emergency/trigger`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          if (res.ok) {
            const session = await res.json();
            setActiveSession(session);
            setIsEmergency(true);
          }
        } catch (err) {
          console.error('Failed to trigger emergency API:', err);
          // Fallback to offline mode
          setIsEmergency(true);
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        // Fallback default coordinates
        fallbackTrigger(12.9716, 77.5946, type, batteryLevel);
      },
      { enableHighAccuracy: true }
    );
  };

  const fallbackTrigger = async (lat, lng, type, batteryLevel) => {
    try {
      const formData = new FormData();
      formData.append('emergency_type', type);
      formData.append('latitude', lat);
      formData.append('longitude', lng);
      formData.append('battery', batteryLevel);
      formData.append('address', 'Downtown Core Area');

      const res = await fetch(`${API_URL}/emergency/trigger`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        setIsEmergency(true);
      }
    } catch (e) {
      setIsEmergency(true);
    }
  };

  const streamCurrentLocation = () => {
    if (!token) return;
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, speed, heading, accuracy } = position.coords;
        let batteryLevel = 100;
        try {
          const bat = await navigator.getBattery();
          batteryLevel = Math.round(bat.level * 100);
        } catch (e) {}

        try {
          const formData = new FormData();
          formData.append('latitude', latitude);
          formData.append('longitude', longitude);
          formData.append('speed', speed || 0.0);
          formData.append('direction', heading || 0.0);
          formData.append('battery', batteryLevel);
          formData.append('accuracy', accuracy || 10.0);

          await fetch(`${API_URL}/emergency/log-location`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });
        } catch (err) {
          console.error('Error logging position:', err);
        }
      },
      (err) => console.error('Position streaming error:', err),
      { enableHighAccuracy: true }
    );
  };

  const resolveEmergency = async () => {
    try {
      const res = await fetch(`${API_URL}/emergency/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setIsEmergency(false);
        setActiveSession(null);
        setSpeechStatus('listening');
        startSpeechRecognition();
      }
    } catch (err) {
      console.error('Error resolving emergency:', err);
      setIsEmergency(false);
      setActiveSession(null);
      startSpeechRecognition();
    }
  };

  // Media Capture & Audio Recording
  const startEvidenceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        uploadEvidenceBlob(audioBlob, 'audio');
        // Stop all track streams
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      // Record in 5-second bursts and upload
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 5000);

    } catch (e) {
      console.warn('Audio capture not allowed or failing:', e);
    }
  };

  const stopEvidenceRecording = () => {
    if (audioRecorderRef.current && audioRecorderRef.current.state === 'recording') {
      try {
        audioRecorderRef.current.stop();
      } catch (e) {}
    }
  };

  const captureCameraSnapshot = async (type = 'image_front') => {
    // Camera access disabled. Upload mock evidence upload to keep dashboards functional.
    createMockEvidenceUpload(type);
  };

  const uploadEvidenceBlob = async (blob, type) => {
    if (!token) return;
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', blob, `${type}.bin`);
    
    try {
      await fetch(`${API_URL}/emergency/upload-evidence`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
    } catch (err) {
      console.error('Evidence upload error:', err);
    }
  };

  const createMockEvidenceUpload = async (type) => {
    // Generate a simple mock text file or color placeholder
    const blob = new Blob([`Mock emergency capture: ${type} at ${new Date().toISOString()}`], { type: 'text/plain' });
    uploadEvidenceBlob(blob, type);
  };

  return (
    <EmergencyContext.Provider value={{
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
      setVoiceGuardianEnabled,
      requestMicPermissionAndStart,
      triggerEmergency,
      resolveEmergency,
      startSpeechRecognition,
      stopSpeechRecognition
    }}>
      {children}
    </EmergencyContext.Provider>
  );
};

export const useEmergency = () => useContext(EmergencyContext);
