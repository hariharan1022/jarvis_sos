import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useEmergency } from '../contexts/EmergencyContext';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, glassCard, row, rowBetween } from '../styles/theme';

export const VoiceAssistant = () => {
  const {
    speechStatus,
    wakePhraseMatch,
    liveTranscript,
    lastWakePhrase,
    recognitionConfidence,
    micPermissionGranted,
    voiceGuardianEnabled,
    setVoiceGuardianEnabled,
  } = useEmergency();

  const toggleSpeech = () => setVoiceGuardianEnabled(!voiceGuardianEnabled);

  const getStatusDetails = () => {
    switch (speechStatus) {
      case 'listening': return { text: 'Say "Nova Help Me" or "Help"', color: COLORS.cyan, showActive: true };
      case 'matched':   return { text: `Trigger: "${wakePhraseMatch}" — SOS Active!`, color: COLORS.red, showActive: false };
      case 'permission_denied': return { text: 'Microphone blocked. Enable in Settings.', color: COLORS.amber, showActive: false };
      case 'unsupported': return { text: 'Voice not supported on this device.', color: COLORS.slate400, showActive: false };
      default: return { text: 'Voice Guardian offline. Tap mic to enable.', color: COLORS.slate500, showActive: false };
    }
  };

  const details = getStatusDetails();

  return (
    <View style={[glassCard, styles.card]}>
      {/* Header */}
      <View style={rowBetween}>
        <View style={row}>
          <View style={styles.iconBadge}>
            <Ionicons name="shield-checkmark" size={14} color={COLORS.cyan} />
          </View>
          <Text style={styles.title}>Nova AI Voice Guardian</Text>
        </View>
        {details.showActive && (
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Listening</Text>
          </View>
        )}
      </View>

      {/* Equalizer bars (active state) */}
      <View style={styles.eqRow}>
        {details.showActive
          ? Array.from({ length: 16 }).map((_, i) => (
              <Animated.View key={i} style={[styles.eqBar, { height: 8 + Math.random() * 28 }]} />
            ))
          : (
            <View style={styles.eqOffline}>
              <Text style={styles.eqOfflineText}>Voice Shield Offline</Text>
            </View>
          )
        }
      </View>

      {/* Status text */}
      <Text style={[styles.statusText, { color: details.color }]}>{details.text}</Text>

      {/* Live transcript */}
      {!!liveTranscript && (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptText}>"{liveTranscript}"</Text>
        </View>
      )}

      {/* Debug telemetry */}
      <View style={styles.debugRow}>
        <Text style={styles.debugText}>Mic: <Text style={{ color: micPermissionGranted ? COLORS.emerald : COLORS.slate500 }}>{micPermissionGranted ? 'ONLINE' : 'OFFLINE'}</Text></Text>
        <Text style={styles.debugText}>Confidence: <Text style={{ color: COLORS.cyan }}>{(recognitionConfidence * 100).toFixed(0)}%</Text></Text>
        <Text style={styles.debugText}>Mode: <Text style={{ color: COLORS.cyan }}>{speechStatus}</Text></Text>
        {lastWakePhrase ? <Text style={styles.debugText}>Last: <Text style={{ color: COLORS.red }}>{lastWakePhrase}</Text></Text> : null}
      </View>

      {/* Toggle button */}
      <View style={[rowBetween, { marginTop: 8 }]}>
        <Text style={styles.wakePhrases}>"Nova Help Me" · "Help" · "SOS"</Text>
        <TouchableOpacity onPress={toggleSpeech} style={[styles.micBtn, voiceGuardianEnabled && styles.micBtnActive]}>
          <Ionicons name={voiceGuardianEnabled ? 'mic' : 'mic-off'} size={18} color={voiceGuardianEnabled ? COLORS.cyan : COLORS.slate500} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { gap: 12 },
  iconBadge: { width: 22, height: 22, backgroundColor: 'rgba(0,229,255,0.1)', borderWidth: 1, borderColor: 'rgba(0,229,255,0.2)', borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  title: { color: COLORS.slate300, fontSize: FONTS.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  activeBadge: { ...row, gap: 5, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.emerald },
  activeText: { color: COLORS.emerald, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  eqRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40 },
  eqBar: { flex: 1, backgroundColor: COLORS.cyan, borderRadius: 2, opacity: 0.7 },
  eqOffline: { flex: 1, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', height: 40 },
  eqOfflineText: { color: COLORS.slate600, fontSize: 10, fontStyle: 'italic' },
  statusText: { fontSize: FONTS.xs, fontWeight: '600', lineHeight: 18 },
  transcriptBox: { backgroundColor: 'rgba(15,23,42,0.6)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  transcriptText: { color: COLORS.slate300, fontSize: 10, fontStyle: 'italic' },
  debugRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  debugText: { color: COLORS.slate600, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  wakePhrases: { color: COLORS.slate600, fontSize: 9, flex: 1, flexShrink: 1 },
  micBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { borderColor: 'rgba(0,229,255,0.5)', backgroundColor: 'rgba(0,229,255,0.08)', shadowColor: COLORS.cyan, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
});
