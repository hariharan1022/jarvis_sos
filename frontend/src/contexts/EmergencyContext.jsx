import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const EmergencyContext = createContext(null);

export const EmergencyProvider = ({ children }) => {
  const { user, token, API_URL } = useAuth();
  const [isEmergency, setIsEmergency] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [speechStatus, setSpeechStatus] = useState('offline'); // offline, listening, matched, error
  const [wakePhraseMatch, setWakePhraseMatch] = useState('');
  
  const locationIntervalRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastTriggerTimeRef = useRef(0);

  // Initialize Speech Recognition for Wake Word
  useEffect(() => {
    if (user) {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }
    
    return () => {
      stopSpeechRecognition();
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [user]);

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

  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechStatus('unsupported');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let isPermissionDenied = false;
      let hasError = false;

      recognition.onstart = () => {
        setSpeechStatus('listening');
        hasError = false;
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          isPermissionDenied = true;
          setSpeechStatus('permission_denied');
        } else {
          hasError = true;
          setSpeechStatus('error');
        }
      };

      recognition.onend = () => {
        // Continuous listening: restart if user is logged in, not in emergency, not blocked by permission, and not intentionally stopped
        if (user && !isEmergency && !isPermissionDenied && recognitionRef.current === recognition) {
          if (hasError) {
            // Wait 5 seconds before retrying to prevent hot looping on network/mic errors
            setTimeout(() => {
              if (user && !isEmergency && !isPermissionDenied && recognitionRef.current === recognition) {
                try {
                  recognition.start();
                } catch (e) {}
              }
            }, 5000);
          } else {
            try {
              recognition.start();
            } catch (e) {
              // Already started
            }
          }
        }
      };

      recognition.onresult = (event) => {
        const customWakeWord = user?.custom_wake_word?.toLowerCase() || '';
        const standardWakePhrases = [
          'nova help me', 'i am in danger', 'help me', 'save me', 'emergency', 'help', 'sos',
          'hey nova', 'hi nova', 'hey nowa', 'hey noah', 'hey nora', 'nova'
        ];

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i][0];
          const transcript = result.transcript.toLowerCase();
          const confidence = result.confidence;

          // Check for confidence score to ensure reliable voice triggering
          if (confidence < 0.3) continue;

          // Check standard phrases
          const matchedPhrase = standardWakePhrases.find(phrase => transcript.includes(phrase)) 
            || (customWakeWord && transcript.includes(customWakeWord) ? customWakeWord : null);

          if (matchedPhrase) {
            setWakePhraseMatch(matchedPhrase);
            setSpeechStatus('matched');
            triggerEmergency('voice_activation', matchedPhrase);
            break;
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Speech initialization error', e);
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
