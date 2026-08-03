import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Vibration, Animated, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, row } from '../styles/theme';

export const FakeCall = ({ active, onClose, callerName = 'Father' }) => {
  const [callState, setCallState] = useState('ringing'); // ringing, active
  const [duration, setDuration] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (active) {
      setCallState('ringing');
      setDuration(0);
      Vibration.vibrate([500, 1000, 500, 1000], true);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Vibration.cancel();
      pulseAnim.setValue(1);
    }
    return () => Vibration.cancel();
  }, [active]);

  useEffect(() => {
    if (callState === 'active') {
      const interval = setInterval(() => setDuration(d => d + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [callState]);

  const formatDuration = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleAnswer = () => {
    Vibration.cancel();
    setCallState('active');
  };

  const handleDecline = () => {
    Vibration.cancel();
    onClose();
  };

  return (
    <Modal visible={active} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.callType}>{callState === 'ringing' ? 'Incoming Call' : 'Call Active'}</Text>

          <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color={COLORS.white} />
            </View>
          </Animated.View>

          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callerSub}>
            {callState === 'ringing' ? 'SafeNova Guardian Contact' : formatDuration(duration)}
          </Text>

          <View style={styles.btnRow}>
            {callState === 'ringing' ? (
              <>
                <TouchableOpacity style={[styles.callBtn, styles.declineBtn]} onPress={handleDecline}>
                  <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.callBtn, styles.answerBtn]} onPress={handleAnswer}>
                  <Ionicons name="call" size={28} color="#fff" />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.callBtn, styles.declineBtn]} onPress={handleDecline}>
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { width: '100%', backgroundColor: '#0a0c16', borderRadius: 28, padding: 32, alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#1a1f2e' },
  callType: { color: COLORS.slate400, fontSize: FONTS.xs, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  avatarRing: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(0,229,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,229,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  callerName: { color: COLORS.white, fontSize: FONTS['2xl'], fontWeight: '800' },
  callerSub: { color: COLORS.slate400, fontSize: FONTS.xs },
  btnRow: { flexDirection: 'row', gap: 48, marginTop: 16 },
  callBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  answerBtn: { backgroundColor: COLORS.emerald },
  declineBtn: { backgroundColor: COLORS.red },
});
