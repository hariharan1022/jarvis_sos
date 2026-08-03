import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  addSpeechRecognitionListener,
} from 'expo-speech-recognition';
import { API_BASE_URL, WS_BASE_URL } from '../config';

const EmergencyContext = createContext(null);

export const EmergencyProvider = ({ children }) => {
  const { user, token } = useAuth();
  const API_URL = API_BASE_URL;

  const [isEmergency, setIsEmergency] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [speechStatus, setSpeechStatus] = useState('offline');
  const [wakePhraseMatch, setWakePhraseMatch] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastWakePhrase, setLastWakePhrase] = useState('');
  const [recognitionConfidence, setRecognitionConfidence] = useState(1.0);
  const [micPermissionGranted, setMicPermissionGranted] = useState(null);
  const [micPermissionError, setMicPermissionError] = useState(null);
  const [voiceGuardianEnabled, setVoiceGuardianEnabled] = useState(true);

  const locationIntervalRef = useRef(null);
  const lastTriggerTimeRef = useRef(0);
  const recordingRef = useRef(null);
  const isListeningRef = useRef(false);

  // ─── Voice Recognition Setup via expo-speech-recognition ────────────────
  useEffect(() => {
    const startSub = addSpeechRecognitionListener('start', () => {
      console.log('[Voice Guardian]: Listening started');
      setSpeechStatus('listening');
    });
    const endSub = addSpeechRecognitionListener('end', () => {
      console.log('[Voice Guardian]: Speech ended, restarting...');
      if (voiceGuardianEnabled && !isEmergency && isListeningRef.current) {
        setTimeout(() => restartListening(), 500);
      }
    });
    const errorSub = addSpeechRecognitionListener('error', (e) => {
      console.log('[Voice Guardian Error]:', e.error, e.message);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setSpeechStatus('permission_denied');
        setMicPermissionError('Microphone access blocked. Please enable in device Settings.');
      } else {
        setSpeechStatus('error');
        if (voiceGuardianEnabled && !isEmergency && isListeningRef.current) {
          setTimeout(() => restartListening(), 2000);
        }
      }
    });
    const resultSub = addSpeechRecognitionListener('result', (e) => {
      const transcript = e.results?.[0]?.transcript || '';
      const isFinal = e.results?.[0]?.confidence !== undefined;
      console.log(`[Recognized]: "${transcript}" final=${isFinal}`);
      setLiveTranscript(transcript);
      if (e.results?.[0]?.confidence) setRecognitionConfidence(e.results[0].confidence);
      const matched = checkFuzzyMatch(transcript, user?.custom_wake_word || '');
      if (matched) {
        console.log(`[WAKE DETECTED]: "${matched}" — Triggering SOS`);
        setWakePhraseMatch(matched);
        setLastWakePhrase(matched);
        setSpeechStatus('matched');
        playConfirmationChirp();
        triggerEmergency('voice_activation', matched);
      }
    });

    return () => {
      startSub.remove();
      endSub.remove();
      errorSub.remove();
      resultSub.remove();
    };
  }, [voiceGuardianEnabled, isEmergency, user]);

  // ─── Start/stop guardian based on auth + toggle ───────────────────────────
  useEffect(() => {
    if (user && voiceGuardianEnabled) {
      requestMicAndStart();
    } else {
      stopVoiceListening();
    }
    return () => stopVoiceListening();
  }, [user, voiceGuardianEnabled]);

  // ─── Location streaming during emergency ─────────────────────────────────
  useEffect(() => {
    if (isEmergency && activeSession) {
      locationIntervalRef.current = setInterval(() => streamCurrentLocation(), 5000);
      startEvidenceRecording();
    } else {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      stopEvidenceRecording();
    }
  }, [isEmergency, activeSession]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const normalizeText = (text) =>
    text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '').replace(/\s+/g, ' ').trim();

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
      if (n.includes(target)) return target;
    }

    const phonetics = [
      { target: 'nova help me', pattern: /no[vb][ao]\s+help\s+me/i },
      { target: 'nova help me', pattern: /no[vb]a\s+help/i },
      { target: 'hey nova',     pattern: /hey\s+no[vb][ao]/i },
      { target: 'nova',         pattern: /no[vb][ao]/i },
      { target: 'emergency',    pattern: /emergen/i },
      { target: 'sos',          pattern: /\bs\s*[.\-]?\s*o\s*[.\-]?\s*s\b/i },
      { target: 'save me',      pattern: /saf[e]?\s+me/i },
      { target: 'i am in danger', pattern: /danger/i },
      { target: 'help me',      pattern: /\bhelp\s+m[ea]\b/i },
      { target: 'help',         pattern: /\bhelp\b/i },
    ];
    for (const { target, pattern } of phonetics) {
      if (pattern.test(n)) return target;
    }
    return null;
  };

  const playConfirmationChirp = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/buttons/beep-01a.mp3' },
        { shouldPlay: true, volume: 0.5 }
      );
      setTimeout(() => sound.unloadAsync(), 2000);
    } catch (e) {
      console.warn('Audio chirp failed:', e);
    }
  };

  const requestMicAndStart = async () => {
    try {
      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (status !== 'granted') {
        setMicPermissionGranted(false);
        setMicPermissionError('Microphone permission denied. Enable in device Settings > Apps > SafeNova > Permissions.');
        setSpeechStatus('permission_denied');
        return;
      }
      setMicPermissionGranted(true);
      setMicPermissionError(null);
      startVoiceListening();
    } catch (e) {
      console.error('Mic permission request failed:', e);
      setMicPermissionGranted(false);
      setSpeechStatus('permission_denied');
    }
  };

  const startVoiceListening = async () => {
    try {
      isListeningRef.current = true;
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: false,
      });
    } catch (e) {
      console.error('Voice start error:', e);
    }
  };

  const restartListening = async () => {
    if (!isListeningRef.current) return;
    try {
      ExpoSpeechRecognitionModule.stop();
      setTimeout(() => {
        ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          interimResults: true,
          continuous: true,
        });
      }, 300);
    } catch (e) {
      console.warn('Voice restart error:', e);
    }
  };

  const stopVoiceListening = async () => {
    isListeningRef.current = false;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {}
    setSpeechStatus('offline');
  };

  const startSpeechRecognition = () => {
    setVoiceGuardianEnabled(true);
  };

  const stopSpeechRecognition = () => {
    setVoiceGuardianEnabled(false);
  };

  // ─── Emergency Trigger ────────────────────────────────────────────────────
  const triggerEmergency = async (type = 'manual', wakeWord = '') => {
    if (isEmergency) return;
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 30000) {
      console.log('Duplicate trigger ignored (30s lock)');
      return;
    }
    lastTriggerTimeRef.current = now;

    let batteryLevel = 100;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, speed } = position.coords;
      const mockAddress = `Approx. near lat ${latitude.toFixed(4)}, lng ${longitude.toFixed(4)}`;

      const formData = new FormData();
      formData.append('emergency_type', type === 'voice_activation' ? `Voice Activation (${wakeWord})` : type);
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
      formData.append('battery', batteryLevel);
      formData.append('signal_status', 'Good');
      formData.append('address', mockAddress);

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
      console.error('Emergency trigger error:', e);
    }
  };

  const streamCurrentLocation = async () => {
    if (!token || !isEmergency) return;
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, speed, heading, accuracy } = position.coords;

      let batteryLevel = 100;
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
    } catch (e) {
      console.error('Location stream error:', e);
    }
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
      }
    } catch (e) {
      console.error('Resolve error:', e);
      setIsEmergency(false);
      setActiveSession(null);
    }
  };

  // ─── Evidence Recording ───────────────────────────────────────────────────
  const startEvidenceRecording = async () => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setTimeout(async () => {
        try {
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          if (uri) uploadEvidenceFile(uri, 'audio');
        } catch (e) {}
      }, 5000);
    } catch (e) {
      console.warn('Audio recording failed:', e);
    }
  };

  const stopEvidenceRecording = async () => {
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch (e) {}
      recordingRef.current = null;
    }
  };

  const uploadEvidenceFile = async (uri, type) => {
    if (!token) return;
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', { uri, name: `${type}.m4a`, type: 'audio/m4a' });
    try {
      await fetch(`${API_URL}/emergency/upload-evidence`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
    } catch (e) {
      console.error('Evidence upload error:', e);
    }
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
      triggerEmergency,
      resolveEmergency,
      startSpeechRecognition,
      stopSpeechRecognition,
    }}>
      {children}
    </EmergencyContext.Provider>
  );
};

export const useEmergency = () => useContext(EmergencyContext);
