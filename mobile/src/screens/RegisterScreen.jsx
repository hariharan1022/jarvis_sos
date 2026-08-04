import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, glassCard, inputField, btnPrimary, btnPrimaryText, labelText } from '../styles/theme';

export const RegisterScreen = () => {
  const { register } = useAuth();
  const navigation = useNavigation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email || !password) { setError('Please fill in all fields.'); return; }
    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
      setSuccess(true);
      setTimeout(() => navigation.replace('Login'), 2000);
    } catch (err) {
      setError(err.message || 'Registration failed. Try a different email.');
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

        <View style={styles.card}>
          <Text style={styles.heading}>Create Guardian Account</Text>
          <Text style={styles.subheading}>Initialize always-on voice emergency routing and setup your safety details.</Text>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {success && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>Guardian profile created! Redirecting to login...</Text>
            </View>
          )}

          {/* Name */}
          <View style={styles.fieldWrap}>
            <Text style={labelText}>Full Name</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={16} color={COLORS.slate500} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Nova Guardian" placeholderTextColor={COLORS.slate600} value={name} onChangeText={setName} />
            </View>
          </View>

          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={labelText}>Email Address</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={16} color={COLORS.slate500} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="guardian@domain.com" placeholderTextColor={COLORS.slate600} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={labelText}>Master Key Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.slate500} style={styles.inputIcon} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="••••••••" placeholderTextColor={COLORS.slate600} secureTextEntry value={password} onChangeText={setPassword} />
            </View>
          </View>

          <TouchableOpacity style={[btnPrimary, styles.submitBtn]} onPress={handleSubmit} disabled={loading || success}>
            {loading ? <ActivityIndicator color={COLORS.cyan} /> : <Text style={btnPrimaryText}>Deploy System</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkRow}>
            <Text style={styles.linkText}>Already registered? <Text style={styles.link}>Access Portal</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 32 },
  logoIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: COLORS.cyan, alignItems: 'center', justifyContent: 'center' },
  logoTitle: { color: COLORS.white, fontSize: FONTS['2xl'], fontWeight: '800' },
  logoSub: { color: COLORS.cyan, fontSize: FONTS.xs, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  card: { ...glassCard, width: '100%', gap: 16 },
  heading: { color: COLORS.white, fontSize: FONTS.xl, fontWeight: '800' },
  subheading: { color: COLORS.slate400, fontSize: FONTS.xs, lineHeight: 18 },
  errorBox: { backgroundColor: 'rgba(127,29,29,0.3)', borderWidth: 1, borderColor: '#991b1b', borderRadius: 10, padding: 12 },
  errorText: { color: '#f87171', fontSize: FONTS.xs, fontWeight: '600' },
  successBox: { backgroundColor: 'rgba(6,78,59,0.3)', borderWidth: 1, borderColor: '#065f46', borderRadius: 10, padding: 12 },
  successText: { color: '#6ee7b7', fontSize: FONTS.xs, fontWeight: '600' },
  fieldWrap: { gap: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { ...inputField, flex: 1, borderWidth: 0, paddingHorizontal: 0 },
  submitBtn: { marginTop: 8 },
  linkRow: { alignItems: 'center', marginTop: 4 },
  linkText: { color: COLORS.slate400, fontSize: FONTS.xs },
  link: { color: COLORS.cyan, fontWeight: '700' },
});
