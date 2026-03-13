import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { GlassCard } from '@/components/GlassCard';
import { api, setAuthToken } from '@/lib/api';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !password) {
      setError('Podaj adres e-mail i hasło.');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Podaj imię i nazwisko.');
      return;
    }
    if (mode === 'register' && password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.');
      return;
    }

    setLoading(true);
    try {
      let result: any;
      if (mode === 'login') {
        result = await api.auth.login(email.trim(), password);
      } else {
        result = await api.auth.register({ email: email.trim(), password, name: name.trim() });
      }
      if (result?.token) {
        setAuthToken(result.token);
      }
      // After login/register go back to the home tab
      // (expo-router: use router.replace if router is available)
      // For now we just clear the form and show success state
      setEmail('');
      setPassword('');
      setName('');
      setError(null);
    } catch (err: any) {
      setError(
        err?.message || (mode === 'login' ? 'Błąd logowania.' : 'Błąd rejestracji.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoRow}>
            <Text style={styles.logo}>
              <Text style={styles.logoCyan}>Qualitet</Text>
              <Text style={styles.logoSub}> Market</Text>
            </Text>
            <Text style={styles.logoTagline}>Platforma B2B/B2C</Text>
          </View>

          {/* Card */}
          <GlassCard style={styles.card} padding={24}>
            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, mode === 'login' && styles.tabActive]}
                onPress={() => { setMode('login'); setError(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                  Logowanie
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'register' && styles.tabActive]}
                onPress={() => { setMode('register'); setError(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
                  Rejestracja
                </Text>
              </TouchableOpacity>
            </View>

            {/* Name field (registration only) */}
            {mode === 'register' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Imię i nazwisko</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Jan Kowalski"
                    placeholderTextColor={Colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoComplete="name"
                  />
                </View>
              </View>
            )}

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Adres e-mail</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="jan@przyklad.pl"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Hasło{mode === 'register' ? ' (min. 8 znaków)' : ''}</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#f87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
                </Text>
              )}
            </TouchableOpacity>
          </GlassCard>

          {/* Features */}
          <View style={styles.featureRow}>
            {['🔒 Bezpieczne', '⚡ Szybkie', '🛒 50K+ produktów'].map(f => (
              <View key={f} style={styles.featureChip}>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { padding: 24, gap: 24, justifyContent: 'center', flexGrow: 1 },
  logoRow: { alignItems: 'center', gap: 6 },
  logo: { fontSize: 32, fontWeight: '900' },
  logoCyan: { color: Colors.neonCyan },
  logoSub: { color: Colors.textMuted, fontSize: 22, fontWeight: '300' },
  logoTagline: { color: Colors.textSecondary, fontSize: 13 },
  card: { gap: 16 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.glass, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.neonViolet },
  tabText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: Colors.white },
  fieldGroup: { gap: 6 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: Colors.white, fontSize: 15, paddingVertical: 12 },
  inputFlex: { flex: 1 },
  eyeBtn: { padding: 4 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 8, padding: 10 },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },
  submitBtn: { backgroundColor: Colors.neonCyan, borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  featureRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  featureChip: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  featureText: { color: Colors.textSecondary, fontSize: 12 },
});
