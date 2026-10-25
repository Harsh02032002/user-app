import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Clipboard, Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { PAYMENT_QR_DATA } from '../assets/qrCodeData';
import { BottomSheet, Button, Input } from './common';
import { colors, formatPrice, radius, spacing, type, fonts } from '../theme';

interface OnlinePaymentModalProps {
  visible: boolean;
  onClose: () => void;
  amount: number;
  title?: string;
  onPaymentSuccess: (transactionId?: string) => Promise<void> | void;
}

const QR_NOTE: string | undefined = (PAYMENT_QR_DATA as { qrNote?: string }).qrNote;

export function OnlinePaymentModal({
  visible,
  onClose,
  amount,
  title = 'Pay with UPI',
  onPaymentSuccess,
}: OnlinePaymentModalProps) {
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyUpi = () => {
    Clipboard.setString(PAYMENT_QR_DATA.upiId);
    setCopied(true);
    Toast.show({ type: 'success', text1: 'UPI ID copied' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onPaymentSuccess(transactionId);
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={loading ? () => {} : onClose}
      title={title}
      subtitle="PhonePe, GPay, Paytm or any UPI app"
      footer={
        <View style={styles.footer}>
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={loading} style={{ flex: 1 }} />
          <Button title="I have paid" icon="checkmark-done" onPress={handleConfirm} loading={loading} style={{ flex: 2 }} />
        </View>
      }
    >
      <View style={styles.amountBox}>
        <Text style={type.overline}>Amount to pay</Text>
        <Text style={styles.amount}>{formatPrice(Number(Number(amount).toFixed(2)))}</Text>
      </View>

      <View style={styles.steps}>
        {['Scan the QR code or copy the UPI ID', 'Pay the exact amount in your UPI app', 'Come back and tap "I have paid"'].map((s, i) => (
          <View key={s} style={styles.step}>
            <View style={styles.stepDot}><Text style={styles.stepDotText}>{i + 1}</Text></View>
            <Text style={[type.small, { flex: 1 }]}>{s}</Text>
          </View>
        ))}
      </View>

      <View style={styles.qrWrapper}>
        <Image source={require('../../assets/images/payment_qr.jpg')} style={styles.qrImage} resizeMode="contain" accessibilityLabel="UPI payment QR code" />
      </View>
      {QR_NOTE ? <Text style={[type.caption, { textAlign: 'center', marginBottom: spacing.md }]}>{QR_NOTE}</Text> : null}

      <View style={styles.payee}>
        <View style={styles.payeeRow}>
          <Text style={type.caption}>Account name</Text>
          <Text style={type.label}>{PAYMENT_QR_DATA.payeeName}</Text>
        </View>
        <View style={styles.payeeDivider} />
        <TouchableOpacity style={styles.payeeRow} onPress={handleCopyUpi} accessibilityRole="button" accessibilityLabel="Copy UPI ID">
          <Text style={type.caption}>UPI ID</Text>
          <View style={styles.copyRow}>
            <Text style={type.label}>{PAYMENT_QR_DATA.upiId}</Text>
            <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </View>

      <Input
        label="UTR / transaction reference (optional)"
        placeholder="e.g. 423456789012"
        value={transactionId}
        onChangeText={setTransactionId}
        keyboardType="numeric"
        maxLength={22}
        helper="The 12-digit UTR from your payment app receipt helps us confirm your payment faster."
        style={{ marginTop: spacing.lg, marginBottom: 0 }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  amountBox: { alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft, marginBottom: spacing.lg },
  amount: { ...type.display, color: colors.primary, fontVariant: ['tabular-nums'], marginTop: 2 },
  steps: { gap: spacing.sm, marginBottom: spacing.lg },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  stepDotText: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary },
  qrWrapper: { alignSelf: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.md },
  qrImage: { width: 220, height: 220 },
  payee: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  payeeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md, height: 48 },
  payeeDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { flexDirection: 'row', gap: spacing.md },
});
