import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, glassCard, inputField, btnPrimary, btnPrimaryText, labelText } from '../styles/theme';

export const LoginScreen = () => {
  const { login } = useAuth();
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(email, password);
      if (loggedUser.role === 'admin') {
        navigation.replace('Admin');
      } else {
        navigation.replace('Dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Ionicons name="shield-checkmark" size={32} color="#07080d" />
          </View>
          <View>
            <Text style={styles.logoTitle}>SafeNova AI</Text>
            <Text style={styles.logoSub}>Jarvis Safety Guard</Text>
          </View>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Secure authorization required to sync emergency contacts and voice controls.</Text>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={labelText}>Email Address</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={16} color={COLORS.slate500} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@domain.com"
                placeholderTextColor={COLORS.slate600}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={labelText}>Access Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.slate500} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.slate600}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.slate500} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity style={[btnPrimary, styles.submitBtn]} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator color={COLORS.cyan} />
              : <Text style={btnPrimaryText}>Access Dashboard</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkRow}>
            <Text style={styles.linkText}>First time? <Text style={styles.link}>Register Guardian Card</Text></Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Guardian')} style={styles.bottomLink}>
          <Text style={styles.bottomLinkText}>Track Active SOS Incident via Code</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 32 },
  logoIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: COLORS.cyan, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.cyan, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 6
  },
  logoTitle: { color: COLORS.white, fontSize: FONTS['2xl'], fontWeight: '800' },
  logoSub: { color: COLORS.cyan, fontSize: FONTS.xs, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  card: { ...glassCard, width: '100%', gap: 16, marginBottom: 24 },
  heading: { color: COLORS.white, fontSize: FONTS.xl, fontWeight: '800' },
  subheading: { color: COLORS.slate400, fontSize: FONTS.xs, lineHeight: 18 },
  errorBox: { backgroundColor: 'rgba(127,29,29,0.3)', borderWidth: 1, borderColor: '#991b1b', borderRadius: 10, padding: 12 },
  errorText: { color: '#f87171', fontSize: FONTS.xs, fontWeight: '600' },
  fieldWrap: { gap: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 12
  },
  inputIcon: { marginRight: 8 },
  input: { ...inputField, flex: 1, borderWidth: 0, paddingHorizontal: 0 },
  eyeBtn: { padding: 8 },
  submitBtn: { marginTop: 8 },
  linkRow: { alignItems: 'center', marginTop: 4 },
  linkText: { color: COLORS.slate400, fontSize: FONTS.xs },
  link: { color: COLORS.cyan, fontWeight: '700' },
  bottomLink: { marginTop: 16 },
  bottomLinkText: { color: COLORS.slate500, fontSize: FONTS.xs },
});
