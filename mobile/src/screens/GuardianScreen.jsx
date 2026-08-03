import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { COLORS, FONTS, glassCard, btnPrimary, btnPrimaryText, row, rowBetween } from '../styles/theme';
import { WS_BASE_URL } from '../config';

const API = 'http://10.0.2.2:8000/api';

export const GuardianScreen = () => {
  const route = useRoute();
  const [code, setCode] = useState(route.params?.code || '');
  const [activeSession, setActiveSession] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [coordinates, setCoordinates] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const wsRef = useRef(null);
  const soundRef = useRef(null);

  // Auto-load if code passed as param
  useEffect(() => {
    if (route.params?.code) handleTrack(route.params.code);
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const handleTrack = async (targetCode = code) => {
    if (!targetCode) return;
    setLoading(true);
    setError('');
    setActiveSession(null);
    setTimeline([]);
    setCoordinates([]);
    if (wsRef.current) wsRef.current.close();

    try {
      const res = await fetch(`${API}/emergency/track/${targetCode}`);
      if (!res.ok) throw new Error('No active emergency session found for this code.');
      const data = await res.json();
      setActiveSession(data);

      const seeds = data.location_logs.map(l => ({ latitude: l.latitude, longitude: l.longitude }));
      setCoordinates(seeds);

      const initialTimeline = [{ type: 'info', text: 'Emergency Triggered', time: data.start_time }];
      data.evidence_items.forEach(ev => {
        initialTimeline.push({ type: 'evidence', evidence_type: ev.type, url: `http://10.0.2.2:8000${ev.filepath}`, time: ev.timestamp });
      });
      setTimeline(initialTimeline.sort((a, b) => new Date(a.time) - new Date(b.time)));
      connectWebSocket(targetCode);
    } catch (e) {
      setError(e.message || 'Tracking connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (targetCode) => {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/track/${targetCode}`);
    wsRef.current = ws;
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'location_update') {
        const newLoc = { latitude: message.latitude, longitude: message.longitude };
        setCoordinates(prev => [...prev, newLoc]);
        setActiveSession(prev => ({ ...prev, battery: message.battery, last_lat: message.latitude, last_lng: message.longitude }));
        setTimeline(prev => [...prev, { type: 'info', text: `Location Updated (Speed: ${message.speed} km/h)`, time: message.timestamp }]);
      }
      if (message.type === 'evidence_update') {
        setTimeline(prev => [...prev, { type: 'evidence', evidence_type: message.evidence_type, url: `http://10.0.2.2:8000${message.filepath}`, time: message.timestamp }]);
      }
      if (message.type === 'emergency_resolved') {
        setTimeline(prev => [...prev, { type: 'info', text: 'Emergency Resolved / Closed safely.', time: message.resolved_at }]);
        setActiveSession(prev => ({ ...prev, active: false }));
        ws.close();
      }
    };
  };

  const playAudio = async (uri) => {
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
    } catch (e) { console.warn('Audio play error:', e); }
  };

  const lastCoord = coordinates[coordinates.length - 1];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={row}>
          <Ionicons name="radio" size={20} color={COLORS.red} style={{ marginRight: 8 }} />
          <View>
            <Text style={styles.headerTitle}>SafeNova Guardian Tracker</Text>
            <Text style={styles.headerSub}>Real-time emergency stream receiver</Text>
          </View>
        </View>
        <View style={[row, { gap: 6 }]}>
          <View style={[styles.wsIndicator, { backgroundColor: wsConnected ? COLORS.emerald : COLORS.red }]} />
          <Text style={styles.wsText}>{wsConnected ? 'LIVE' : 'OFFLINE'}</Text>
        </View>
      </View>

      {/* Code Input */}
      <View style={styles.codeRow}>
        <TextInput
          style={styles.codeInput}
          placeholder="Enter Emergency Code"
          placeholderTextColor={COLORS.slate600}
          value={code}
          onChangeText={t => setCode(t.toUpperCase())}
          autoCapitalize="characters"
        />
        <TouchableOpacity style={[btnPrimary, { paddingVertical: 12, paddingHorizontal: 20 }]} onPress={() => handleTrack()}>
          {loading ? <ActivityIndicator color={COLORS.cyan} /> : <Text style={btnPrimaryText}>Trace</Text>}
        </TouchableOpacity>
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
        {activeSession ? (
          <>
            {/* Map */}
            {lastCoord ? (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{ latitude: lastCoord.latitude, longitude: lastCoord.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                  mapType="standard"
                >
                  {lastCoord && (
                    <Marker coordinate={lastCoord} pinColor={COLORS.red} title="SOS Location" />
                  )}
                  {coordinates.length > 1 && (
                    <Polyline coordinates={coordinates} strokeColor={COLORS.red} strokeWidth={3} />
                  )}
                </MapView>
              </View>
            ) : (
              <View style={[glassCard, styles.mapPlaceholder]}>
                <Text style={{ color: COLORS.slate500, textAlign: 'center' }}>Waiting for GPS coordinates...</Text>
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              {[
                { label: 'Battery', value: `${activeSession.battery}%`, color: activeSession.battery < 20 ? COLORS.red : COLORS.cyan },
                { label: 'Signal', value: activeSession.signal_status, color: COLORS.cyan },
                { label: 'Status', value: activeSession.active ? 'DANGER' : 'RESOLVED', color: activeSession.active ? COLORS.red : COLORS.emerald },
              ].map(s => (
                <View key={s.label} style={styles.statCard}>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                </View>
              ))}
            </View>

            {/* User Info */}
            {activeSession.user && (
              <View style={glassCard}>
                <Text style={styles.sectionTitle}>Target Profile</Text>
                <Text style={styles.infoText}>Name: <Text style={{ color: COLORS.white }}>{activeSession.user.name}</Text></Text>
                <Text style={styles.infoText}>Email: <Text style={{ color: COLORS.white }}>{activeSession.user.email}</Text></Text>
                <Text style={styles.infoText}>Code: <Text style={{ color: COLORS.cyan }}>{activeSession.tracking_code}</Text></Text>
                {activeSession.user.blood_group && (
                  <Text style={styles.infoText}>Blood Group: <Text style={{ color: COLORS.red }}>{activeSession.user.blood_group}</Text></Text>
                )}
                {activeSession.user.medical_notes && (
                  <View style={styles.medBox}>
                    <Text style={{ color: COLORS.slate300, fontSize: FONTS.xs }}>{activeSession.user.medical_notes}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Timeline */}
            <View style={glassCard}>
              <Text style={styles.sectionTitle}>Emergency Timeline</Text>
              <View style={{ marginTop: 12, gap: 16 }}>
                {timeline.map((item, idx) => (
                  <View key={idx} style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={{ flex: 1 }}>
                      <View style={rowBetween}>
                        <Text style={styles.timelineType}>{item.type === 'evidence' ? `Uploaded ${item.evidence_type}` : 'System Log'}</Text>
                        <Text style={styles.timelineTime}>{new Date(item.time).toLocaleTimeString()}</Text>
                      </View>
                      {item.type === 'evidence' ? (
                        item.evidence_type?.startsWith('image') ? (
                          <Image source={{ uri: item.url }} style={styles.evidenceImage} resizeMode="cover" />
                        ) : item.evidence_type === 'audio' ? (
                          <TouchableOpacity style={styles.audioBtn} onPress={() => playAudio(item.url)}>
                            <Ionicons name="play-circle" size={20} color={COLORS.cyan} />
                            <Text style={styles.audioBtnText}>Play Recording</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={{ color: COLORS.cyan, fontSize: FONTS.xs, marginTop: 4 }}>Media secured in storage.</Text>
                        )
                      ) : (
                        <Text style={styles.timelineText}>{item.text}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={[glassCard, { alignItems: 'center', paddingVertical: 48, gap: 16 }]}>
            <Ionicons name="shield-outline" size={64} color={COLORS.slate700} />
            <Text style={styles.sectionTitle}>Awaiting Connection</Text>
            <Text style={[styles.infoText, { textAlign: 'center', lineHeight: 20 }]}>
              Enter the unique 8-character tracking code shared by the SafeNova device user to view live coordinates and alerts.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { ...rowBetween, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { color: COLORS.white, fontSize: FONTS.md, fontWeight: '800' },
  headerSub: { color: COLORS.cyan, fontSize: FONTS.xs, fontWeight: '700', letterSpacing: 1 },
  wsIndicator: { width: 8, height: 8, borderRadius: 4 },
  wsText: { color: COLORS.slate400, fontSize: FONTS.xs, fontWeight: '700' },
  codeRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  codeInput: { flex: 1, backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.white, fontSize: FONTS.sm, fontWeight: '700', letterSpacing: 3, textAlign: 'center' },
  errorBox: { marginHorizontal: 16, backgroundColor: 'rgba(127,29,29,0.3)', borderWidth: 1, borderColor: '#991b1b', borderRadius: 10, padding: 12, marginBottom: 8 },
  errorText: { color: '#f87171', fontSize: FONTS.xs, fontWeight: '600', textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: 16 },
  mapContainer: { borderRadius: 16, overflow: 'hidden', height: 280, borderWidth: 1, borderColor: COLORS.border },
  map: { width: '100%', height: '100%' },
  mapPlaceholder: { height: 200, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: 'rgba(10,12,22,0.9)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  statLabel: { color: COLORS.slate500, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  statValue: { fontSize: FONTS.sm, fontWeight: '900' },
  sectionTitle: { color: COLORS.white, fontSize: FONTS.sm, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  infoText: { color: COLORS.slate400, fontSize: FONTS.xs, marginTop: 6 },
  medBox: { backgroundColor: 'rgba(15,23,42,0.6)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, marginTop: 8 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.cyan, marginTop: 4, flexShrink: 0 },
  timelineType: { color: COLORS.slate400, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  timelineTime: { color: COLORS.slate600, fontSize: 10 },
  timelineText: { color: COLORS.slate300, fontSize: FONTS.xs, marginTop: 4 },
  evidenceImage: { width: '100%', height: 150, borderRadius: 8, marginTop: 8 },
  audioBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: 'rgba(0,229,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,255,0.2)', borderRadius: 10, padding: 10 },
  audioBtnText: { color: COLORS.cyan, fontSize: FONTS.xs, fontWeight: '700' },
});
