import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../styles/theme';

export const FakeRecording = ({ active, onClose }) => {
  const [elapsed, setElapsed] = useState(0);
  const blinkAnim = new Animated.Value(1);

  useEffect(() => {
    if (active) {
      setElapsed(0);
      const interval = setInterval(() => setElapsed(e => e + 1), 1000);
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 0.2, duration: 500, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
      return () => clearInterval(interval);
    }
  }, [active]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Modal visible={active} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Recording indicator */}
          <View style={styles.topRow}>
            <Animated.View style={[styles.recDot, { opacity: blinkAnim }]} />
            <Text style={styles.recText}>REC</Text>
            <Text style={styles.timer}>{formatTime(elapsed)}</Text>
          </View>

          {/* CCTV-style header */}
          <View style={styles.cctv}>
            <Ionicons name="videocam" size={40} color={COLORS.red} />
            <Text style={styles.cctvText}>LIVE RECORDING</Text>
            <Text style={styles.cctvSub}>⚠ Evidence capture in progress</Text>
            <Text style={styles.cctvSub}>All footage is being securely uploaded.</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoText}>Camera Active</Text>
            <Text style={styles.infoText}>Microphone Active</Text>
            <Text style={styles.infoText}>Cloud Backup: Uploading</Text>
          </View>

          <TouchableOpacity style={styles.stopBtn} onPress={onClose}>
            <Ionicons name="stop-circle" size={20} color={COLORS.red} />
            <Text style={styles.stopText}>Stop Recording</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', backgroundColor: '#0a0102', borderRadius: 20, padding: 28, alignItems: 'center', gap: 20, borderWidth: 1, borderColor: 'rgba(255,30,60,0.3)' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.red },
  recText: { color: COLORS.red, fontSize: FONTS.xs, fontWeight: '900', letterSpacing: 2 },
  timer: { marginLeft: 'auto', color: COLORS.white, fontSize: FONTS.sm, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cctv: { alignItems: 'center', gap: 8, paddingVertical: 24, borderWidth: 1, borderColor: 'rgba(255,30,60,0.2)', borderRadius: 12, paddingHorizontal: 28, width: '100%' },
  cctvText: { color: COLORS.red, fontSize: FONTS.xl, fontWeight: '900', letterSpacing: 3 },
  cctvSub: { color: COLORS.slate400, fontSize: FONTS.xs, textAlign: 'center' },
  infoRow: { width: '100%', gap: 6 },
  infoText: { color: COLORS.slate500, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.red, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  stopText: { color: COLORS.red, fontSize: FONTS.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
});
