import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, Modal, FlatList, ActivityIndicator,
  Dimensions, Animated
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useEmergency } from '../contexts/EmergencyContext';
import { VoiceAssistant } from '../components/VoiceAssistant';
import { FakeCall } from '../components/FakeCall';
import { FakeRecording } from '../components/FakeRecording';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import {
  COLORS, FONTS, glassCard, btnPrimary, btnPrimaryText,
  btnDanger, btnDangerText, labelText, rowBetween, row
} from '../styles/theme';

const { width: SCREEN_W } = Dimensions.get('window');

export const UserDashboardScreen = () => {
  const { user, token, logout, updateProfile, API_URL } = useAuth();
  const { isEmergency, activeSession, triggerEmergency, resolveEmergency, speechStatus } = useEmergency();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [fakeCallActive, setFakeCallActive] = useState(false);
  const [fakeRecActive, setFakeRecActive] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(87);
  const [contacts, setContacts] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // SOS pulse animation
  useEffect(() => {
    if (isEmergency) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isEmergency]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Fetch contacts & location
  useEffect(() => {
    if (user && token) {
      fetchContacts();
      fetchLocation();
    }
  }, [user, token]);

  const fetchContacts = async () => {
    try {
      const res = await fetch(`${API_URL}/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setContacts(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setCurrentLocation(loc.coords);
      }
    } catch (e) {}
  };

  const triggerManualPanic = () => {
    if (isEmergency) {
      Alert.alert('Resolve Emergency', 'Are you safe? This will close the active SOS session.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, I am Safe', onPress: resolveEmergency, style: 'destructive' }
      ]);
    } else {
      Alert.alert('🚨 Trigger Emergency SOS?', 'This will alert all your trusted contacts and share your live location.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Activate SOS', onPress: () => triggerEmergency('manual', ''), style: 'destructive' }
      ]);
    }
  };

  const TABS = [
    { id: 'dashboard', icon: 'home', label: 'Home' },
    { id: 'contacts', icon: 'people', label: 'Contacts' },
    { id: 'medical', icon: 'heart', label: 'Medical' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={row}>
          <View style={styles.headerDot} />
          <Text style={styles.headerTitle}>SafeNova <Text style={{ color: COLORS.cyan }}>AI</Text></Text>
        </View>
        <View style={row}>
          {isEmergency && (
            <View style={styles.emergencyBadge}>
              <Ionicons name="warning" size={12} color={COLORS.red} />
              <Text style={styles.emergencyBadgeText}>SOS ACTIVE</Text>
            </View>
          )}
          <Text style={styles.headerUser}>{user?.name?.split(' ')[0]}</Text>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.slate400} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ gap: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>

        {activeTab === 'dashboard' && (
          <>
            {/* SOS Button */}
            <View style={[glassCard, styles.sosCard]}>
              <Text style={styles.sectionTitle}>Quick Emergency SOS</Text>
              <Text style={styles.sectionSub}>Press the button to instantly alert your contacts and share live location.</Text>

              <View style={styles.sosContainer}>
                {/* Outer rings */}
                <View style={[styles.sosRing, { width: 160, height: 160, opacity: 0.08 }]} />
                <View style={[styles.sosRing, { width: 130, height: 130, opacity: 0.12 }]} />
                <View style={[styles.sosRing, { width: 105, height: 105, opacity: 0.2 }]} />

                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity onPress={triggerManualPanic} style={[styles.sosBtn, isEmergency && styles.sosBtnActive]}>
                    <Text style={styles.sosBtnText}>SOS</Text>
                    <Text style={styles.sosBtnSub}>{isEmergency ? 'Resolve' : 'Tap to Trigger'}</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <View style={styles.gpsRow}>
                <View style={styles.gpsDot} />
                <Text style={styles.gpsText}>
                  {currentLocation
                    ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                    : 'GPS Signal: Acquiring...'}
                </Text>
              </View>
            </View>

            {/* Voice Guardian */}
            <VoiceAssistant />

            {/* Deterrent Toolkit */}
            <View style={glassCard}>
              <View style={[row, { gap: 8, marginBottom: 12 }]}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.cyan} />
                <Text style={styles.sectionTitle}>AI Deterrent Toolkit</Text>
              </View>
              <View style={styles.deterrentGrid}>
                <TouchableOpacity style={styles.deterrentCard} onPress={() => setFakeCallActive(true)}>
                  <View style={[styles.deterrentIcon, { backgroundColor: 'rgba(127,29,29,0.3)', borderColor: 'rgba(239,68,68,0.3)' }]}>
                    <Ionicons name="call" size={20} color={COLORS.red} />
                  </View>
                  <Text style={styles.deterrentTitle}>Fake Phone Call</Text>
                  <Text style={styles.deterrentSub}>Simulate an incoming call to create a safe escape.</Text>
                  <TouchableOpacity style={[styles.deterrentBtn, { borderColor: COLORS.red }]} onPress={() => setFakeCallActive(true)}>
                    <Text style={[styles.deterrentBtnText, { color: COLORS.red }]}>Start Call</Text>
                  </TouchableOpacity>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deterrentCard} onPress={() => setFakeRecActive(true)}>
                  <View style={[styles.deterrentIcon, { backgroundColor: 'rgba(120,53,15,0.3)', borderColor: 'rgba(245,158,11,0.3)' }]}>
                    <Ionicons name="videocam" size={20} color={COLORS.amber} />
                  </View>
                  <Text style={styles.deterrentTitle}>Deterrence Screen</Text>
                  <Text style={styles.deterrentSub}>Show a recording screen to scare off threats.</Text>
                  <TouchableOpacity style={[styles.deterrentBtn, { borderColor: COLORS.amber }]} onPress={() => setFakeRecActive(true)}>
                    <Text style={[styles.deterrentBtnText, { color: COLORS.amber }]}>Start Screen</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            </View>

            {/* Trusted Contacts Preview */}
            <View style={glassCard}>
              <View style={[rowBetween, { marginBottom: 12 }]}>
                <View style={[row, { gap: 8 }]}>
                  <Ionicons name="people" size={18} color={COLORS.cyan} />
                  <Text style={styles.sectionTitle}>Trusted Contacts</Text>
                </View>
                <Text style={styles.contactCount}>{contacts.length} Contacts</Text>
              </View>
              {contacts.slice(0, 3).map((c) => (
                <View key={c.id} style={styles.contactRow}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{c.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{c.name}</Text>
                    <Text style={styles.contactPhone}>{c.phone}</Text>
                  </View>
                  <TouchableOpacity style={styles.contactAction}>
                    <Ionicons name="call-outline" size={16} color={COLORS.cyan} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={[btnPrimary, { marginTop: 12 }]} onPress={() => setActiveTab('contacts')}>
                <Text style={btnPrimaryText}>Manage Contacts</Text>
              </TouchableOpacity>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              {[
                { label: 'Tracking Code', value: user?.tracking_code, color: COLORS.cyan },
                { label: 'Battery', value: `${batteryLevel}%`, color: COLORS.emerald },
                { label: 'Alerts Sent', value: '7', color: COLORS.white },
                { label: 'Response', value: '1.2 min', color: COLORS.emerald },
              ].map((s) => (
                <View key={s.label} style={styles.statCard}>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === 'contacts' && (
          <ContactsTab token={token} API_URL={API_URL} contacts={contacts} setContacts={setContacts} setToast={setToast} />
        )}
        {activeTab === 'medical' && (
          <MedicalTab user={user} token={token} API_URL={API_URL} updateProfile={updateProfile} setToast={setToast} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab user={user} token={token} API_URL={API_URL} updateProfile={updateProfile} logout={logout} setToast={setToast} />
        )}
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.id} style={styles.tabItem} onPress={() => setActiveTab(t.id)}>
            <Ionicons name={t.icon} size={22} color={activeTab === t.id ? COLORS.cyan : COLORS.slate600} />
            <Text style={[styles.tabLabel, activeTab === t.id && { color: COLORS.cyan }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Overlays */}
      <FakeCall active={fakeCallActive} onClose={() => setFakeCallActive(false)} callerName="Father" />
      <FakeRecording active={fakeRecActive} onClose={() => setFakeRecActive(false)} />
    </View>
  );
};

// ─── Sub-tab: Contacts ────────────────────────────────────────────────────────
const ContactsTab = ({ token, API_URL, contacts, setContacts, setToast }) => {
  const [form, setForm] = useState({ name: '', phone: '', relationship: '' });
  const [adding, setAdding] = useState(false);

  const addContact = async () => {
    if (!form.name || !form.phone) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        const c = await res.json();
        setContacts(prev => [...prev, c]);
        setForm({ name: '', phone: '', relationship: '' });
        setToast({ message: 'Contact added successfully!' });
      }
    } catch (e) { console.error(e); }
    setAdding(false);
  };

  const deleteContact = async (id) => {
    try {
      await fetch(`${API_URL}/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setContacts(prev => prev.filter(c => c.id !== id));
      setToast({ message: 'Contact removed.' });
    } catch (e) {}
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={glassCard}>
        <Text style={styles.sectionTitle}>Add Emergency Contact</Text>
        {['name', 'phone', 'relationship'].map((f) => (
          <View key={f} style={{ marginTop: 12 }}>
            <Text style={labelText}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
            <TextInput
              style={styles.inputField}
              placeholder={f === 'phone' ? '+91 98765 43210' : f}
              placeholderTextColor={COLORS.slate600}
              keyboardType={f === 'phone' ? 'phone-pad' : 'default'}
              value={form[f]}
              onChangeText={v => setForm(p => ({ ...p, [f]: v }))}
            />
          </View>
        ))}
        <TouchableOpacity style={[btnPrimary, { marginTop: 16 }]} onPress={addContact} disabled={adding}>
          {adding ? <ActivityIndicator color={COLORS.cyan} /> : <Text style={btnPrimaryText}>Add Contact</Text>}
        </TouchableOpacity>
      </View>

      <View style={glassCard}>
        <Text style={styles.sectionTitle}>Your Contacts ({contacts.length})</Text>
        {contacts.map((c) => (
          <View key={c.id} style={[styles.contactRow, { marginTop: 12 }]}>
            <View style={styles.contactAvatar}>
              <Text style={styles.contactAvatarText}>{c.name.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactName}>{c.name}</Text>
              <Text style={styles.contactPhone}>{c.phone} {c.relationship ? `· ${c.relationship}` : ''}</Text>
            </View>
            <TouchableOpacity onPress={() => deleteContact(c.id)}>
              <Ionicons name="trash-outline" size={18} color={COLORS.red} />
            </TouchableOpacity>
          </View>
        ))}
        {contacts.length === 0 && <Text style={styles.emptyText}>No contacts configured yet.</Text>}
      </View>
    </View>
  );
};

// ─── Sub-tab: Medical ─────────────────────────────────────────────────────────
const MedicalTab = ({ user, token, API_URL, updateProfile, setToast }) => {
  const [bloodGroup, setBloodGroup] = useState(user?.blood_group || '');
  const [medicalNotes, setMedicalNotes] = useState(user?.medical_notes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ blood_group: bloodGroup, medical_notes: medicalNotes });
      setToast({ message: 'Medical profile updated.' });
    } catch (e) { Alert.alert('Error', e.message); }
    setSaving(false);
  };

  return (
    <View style={glassCard}>
      <View style={[row, { gap: 8, marginBottom: 16 }]}>
        <Ionicons name="heart" size={18} color={COLORS.red} />
        <Text style={styles.sectionTitle}>Emergency Medical Card</Text>
      </View>
      <Text style={labelText}>Blood Group</Text>
      <TextInput style={styles.inputField} placeholder="A+, B-, O+, AB+" placeholderTextColor={COLORS.slate600} value={bloodGroup} onChangeText={setBloodGroup} />
      <Text style={[labelText, { marginTop: 16 }]}>Medical Notes / Conditions</Text>
      <TextInput style={[styles.inputField, { height: 100, textAlignVertical: 'top' }]} placeholder="List allergies, conditions, medications..." placeholderTextColor={COLORS.slate600} multiline value={medicalNotes} onChangeText={setMedicalNotes} />
      <TouchableOpacity style={[btnPrimary, { marginTop: 16 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={COLORS.cyan} /> : <Text style={btnPrimaryText}>Save Medical Profile</Text>}
      </TouchableOpacity>
    </View>
  );
};

// ─── Sub-tab: Settings ────────────────────────────────────────────────────────
const SettingsTab = ({ user, logout, setToast }) => {
  return (
    <View style={{ gap: 16 }}>
      <View style={glassCard}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={[styles.contactName, { marginTop: 12 }]}>{user?.name}</Text>
        <Text style={styles.contactPhone}>{user?.email}</Text>
        <Text style={styles.contactPhone}>Role: {user?.role}</Text>
        <Text style={styles.contactPhone}>Tracking Code: {user?.tracking_code}</Text>
      </View>
      <TouchableOpacity style={btnDanger} onPress={logout}>
        <Text style={btnDangerText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { ...rowBetween, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.cyan, marginRight: 8 },
  headerTitle: { color: COLORS.white, fontSize: FONTS.md, fontWeight: '800' },
  emergencyBadge: { ...row, gap: 4, backgroundColor: 'rgba(255,30,60,0.12)', borderWidth: 1, borderColor: COLORS.red, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginRight: 10 },
  emergencyBadgeText: { color: COLORS.red, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  headerUser: { color: COLORS.slate400, fontSize: FONTS.xs, fontWeight: '700', marginRight: 10 },
  logoutBtn: { padding: 4 },
  toast: { position: 'absolute', top: 100, alignSelf: 'center', backgroundColor: 'rgba(10,12,22,0.96)', borderWidth: 1, borderColor: COLORS.cyan, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, zIndex: 100 },
  toastText: { color: COLORS.cyan, fontSize: FONTS.xs, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { color: COLORS.white, fontSize: FONTS.sm, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionSub: { color: COLORS.slate400, fontSize: FONTS.xs, marginTop: 4, lineHeight: 17 },
  sosCard: { alignItems: 'center', gap: 12 },
  sosContainer: { alignItems: 'center', justifyContent: 'center', width: 160, height: 160, marginVertical: 8 },
  sosRing: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: COLORS.red },
  sosBtn: { width: 110, height: 110, borderRadius: 55, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.red, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  sosBtnActive: { backgroundColor: '#7f1d1d' },
  sosBtnText: { color: '#fff', fontSize: FONTS['2xl'], fontWeight: '900', letterSpacing: 3 },
  sosBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 },
  gpsRow: { ...row, gap: 8, backgroundColor: 'rgba(5,7,14,0.85)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  gpsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.emerald },
  gpsText: { color: COLORS.emerald, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  deterrentGrid: { flexDirection: 'row', gap: 12, marginTop: 4 },
  deterrentCard: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, gap: 8 },
  deterrentIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  deterrentTitle: { color: COLORS.white, fontSize: FONTS.xs, fontWeight: '800', textTransform: 'uppercase' },
  deterrentSub: { color: COLORS.slate400, fontSize: 10, lineHeight: 15 },
  deterrentBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 7, alignItems: 'center', marginTop: 4 },
  deterrentBtnText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,229,255,0.1)', borderWidth: 1, borderColor: 'rgba(0,229,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { color: COLORS.cyan, fontSize: FONTS.sm, fontWeight: '800' },
  contactName: { color: COLORS.white, fontSize: FONTS.xs, fontWeight: '700' },
  contactPhone: { color: COLORS.slate400, fontSize: 10 },
  contactAction: { padding: 8 },
  contactCount: { color: COLORS.slate400, fontSize: 10, fontWeight: '700', backgroundColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: 'rgba(10,12,22,0.9)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  statLabel: { color: COLORS.slate500, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },
  statValue: { fontSize: FONTS.sm, fontWeight: '900', textAlign: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(10,12,22,0.98)', borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: 20, paddingTop: 10 },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { color: COLORS.slate600, fontSize: 10, fontWeight: '700' },
  emptyText: { color: COLORS.slate500, fontSize: FONTS.xs, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
  inputField: { backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.white, fontSize: FONTS.sm },
});
