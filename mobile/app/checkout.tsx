import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { GlassCard } from '@/components/GlassCard';
import { formatCurrency } from '@/lib/api';

type PaymentMethod = 'card' | 'blik' | 'transfer';

const ORDER_TOTAL = 757.98; // subtotal + shipping

const PAYMENT_METHODS: { id: PaymentMethod; icon: string; label: string; desc: string }[] = [
  { id: 'card', icon: 'card-outline', label: 'Karta płatnicza', desc: 'Visa / Mastercard' },
  { id: 'blik', icon: 'phone-portrait-outline', label: 'BLIK', desc: '6-cyfrowy kod' },
  { id: 'transfer', icon: 'business-outline', label: 'Przelew bankowy', desc: '1–2 dni robocze' },
];

export default function CheckoutScreen() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [payment, setPayment] = useState<PaymentMethod>('card');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePlaceOrder = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1200));
    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successState}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.neonCyan} />
          </View>
          <Text style={styles.successTitle}>Zamówienie złożone!</Text>
          <Text style={styles.successDesc}>
            Dziękujemy za zamówienie. Otrzymasz e-mail z potwierdzeniem.
          </Text>
          <GlassCard padding={16} style={styles.successOrder}>
            <Text style={styles.successOrderNum}>Numer zamówienia</Text>
            {/* TODO: replace with real order ID returned by POST /api/orders */}
            <Text style={styles.successOrderId}>#QM-{Math.floor(100000 + Math.random() * 900000)}</Text>
          </GlassCard>
          <TouchableOpacity style={styles.successBtn} activeOpacity={0.85}>
            <Ionicons name="home-outline" size={20} color="#000" />
            <Text style={styles.successBtnText}>Wróć do sklepu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="bag-check-outline" size={22} color={Colors.neonCyan} />
        <Text style={styles.title}>Kasa</Text>
      </View>

      {/* Steps indicator */}
      <View style={styles.stepsRow}>
        {(['Dostawa', 'Płatność', 'Przegląd'] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const active = step === n;
          const done = step > n;
          return (
            <React.Fragment key={label}>
              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, done && styles.stepDone, active && styles.stepActive]}>
                  {done
                    ? <Ionicons name="checkmark" size={14} color="#000" />
                    : <Text style={[styles.stepNum, (active || done) && { color: '#000' }]}>{n}</Text>
                  }
                </View>
                <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
              </View>
              {i < 2 && <View style={[styles.stepLine, done && styles.stepLineDone]} />}
            </React.Fragment>
          );
        })}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Step 1: Delivery */}
          {step === 1 && (
            <GlassCard padding={16} style={styles.stepCard}>
              <Text style={styles.stepCardTitle}>Adres dostawy</Text>
              {[
                { label: 'Imię', value: firstName, setter: setFirstName, placeholder: 'Jan', autoComplete: 'given-name' as any },
                { label: 'Nazwisko', value: lastName, setter: setLastName, placeholder: 'Kowalski', autoComplete: 'family-name' as any },
                { label: 'Ulica i numer', value: address, setter: setAddress, placeholder: 'ul. Przykładowa 1/2', autoComplete: 'street-address' as any },
                { label: 'Miasto', value: city, setter: setCity, placeholder: 'Warszawa', autoComplete: 'address-level2' as any },
                { label: 'Kod pocztowy', value: postalCode, setter: setPostalCode, placeholder: '00-001', autoComplete: 'postal-code' as any },
              ].map(({ label, value, setter, placeholder, autoComplete }) => (
                <View key={label} style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textMuted}
                    value={value}
                    onChangeText={setter}
                    autoComplete={autoComplete}
                  />
                </View>
              ))}
            </GlassCard>
          )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <GlassCard padding={16} style={styles.stepCard}>
              <Text style={styles.stepCardTitle}>Metoda płatności</Text>
              {PAYMENT_METHODS.map(({ id, icon, label, desc }) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.paymentOption, payment === id && styles.paymentOptionActive]}
                  onPress={() => setPayment(id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.paymentIcon, payment === id && { backgroundColor: 'rgba(0,212,255,0.15)' }]}>
                    <Ionicons name={icon as any} size={22} color={payment === id ? Colors.neonCyan : Colors.textSecondary} />
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentLabel}>{label}</Text>
                    <Text style={styles.paymentDesc}>{desc}</Text>
                  </View>
                  <View style={[styles.paymentRadio, payment === id && styles.paymentRadioActive]}>
                    {payment === id && <View style={styles.paymentRadioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </GlassCard>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <>
              <GlassCard padding={16} style={styles.stepCard}>
                <Text style={styles.stepCardTitle}>Podsumowanie zamówienia</Text>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Dostawa do</Text>
                  <Text style={styles.reviewValue}>{`${firstName} ${lastName}\n${address}\n${postalCode} ${city}`}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Płatność</Text>
                  <Text style={styles.reviewValue}>{PAYMENT_METHODS.find(m => m.id === payment)?.label}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewTotal}>Do zapłaty</Text>
                  <Text style={styles.reviewTotalValue}>{formatCurrency(ORDER_TOTAL)}</Text>
                </View>
              </GlassCard>
            </>
          )}

        </ScrollView>

        {/* Bottom action bar */}
        <View style={styles.actionBar}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setStep(s => (s - 1) as 1 | 2 | 3)}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
              <Text style={styles.backBtnText}>Wstecz</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, step === 1 && { flex: 1 }, loading && styles.nextBtnDisabled]}
            onPress={step < 3 ? () => setStep(s => (s + 1) as 2 | 3) : handlePlaceOrder}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>
                  {step === 3 ? 'Złóż zamówienie' : 'Dalej'}
                </Text>
                {step < 3 && <Ionicons name="arrow-forward" size={18} color="#000" />}
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  title: { color: Colors.white, fontSize: 18, fontWeight: '800', flex: 1 },
  stepsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepActive: { backgroundColor: Colors.neonCyan, borderColor: Colors.neonCyan },
  stepDone: { backgroundColor: Colors.neonCyan, borderColor: Colors.neonCyan },
  stepNum: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  stepLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  stepLabelActive: { color: Colors.neonCyan },
  stepLine: { flex: 1, height: 1, backgroundColor: Colors.border, marginHorizontal: 6, marginBottom: 14 },
  stepLineDone: { backgroundColor: Colors.neonCyan },
  scroll: { padding: 16, gap: 16, paddingBottom: 100 },
  stepCard: { gap: 14 },
  stepCardTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  fieldGroup: { gap: 5 },
  fieldLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
    color: Colors.white, fontSize: 15,
  },
  paymentOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.glass,
  },
  paymentOptionActive: { borderColor: Colors.neonCyan, backgroundColor: 'rgba(0,212,255,0.05)' },
  paymentIcon: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  paymentInfo: { flex: 1 },
  paymentLabel: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  paymentDesc: { color: Colors.textMuted, fontSize: 12 },
  paymentRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  paymentRadioActive: { borderColor: Colors.neonCyan },
  paymentRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.neonCyan },
  reviewRow: { gap: 4 },
  reviewLabel: { color: Colors.textMuted, fontSize: 12 },
  reviewValue: { color: Colors.white, fontSize: 14, fontWeight: '500' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  reviewTotal: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  reviewTotalValue: { color: Colors.neonCyan, fontSize: 20, fontWeight: '900' },
  actionBar: {
    flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 24,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
  },
  backBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
  nextBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.neonCyan, borderRadius: 12, paddingVertical: 14,
  },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  successState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  successIcon: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(0,212,255,0.1)', borderWidth: 2, borderColor: 'rgba(0,212,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { color: Colors.white, fontSize: 26, fontWeight: '900' },
  successDesc: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center' },
  successOrder: { alignItems: 'center', gap: 4, minWidth: 200 },
  successOrderNum: { color: Colors.textMuted, fontSize: 12 },
  successOrderId: { color: Colors.neonCyan, fontSize: 20, fontWeight: '800' },
  successBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.neonCyan, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24,
  },
  successBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
});
