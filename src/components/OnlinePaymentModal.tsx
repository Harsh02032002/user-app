import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Clipboard,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PAYMENT_QR_DATA } from '../assets/qrCodeData';

interface OnlinePaymentModalProps {
  visible: boolean;
  onClose: () => void;
  amount: number;
  title?: string;
  onPaymentSuccess: (transactionId?: string) => Promise<void> | void;
}

export function OnlinePaymentModal({
  visible,
  onClose,
  amount,
  title = 'Pay Online via PhonePe / UPI',
  onPaymentSuccess,
}: OnlinePaymentModalProps) {
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyUpi = () => {
    Clipboard.setString(PAYMENT_QR_DATA.upiId);
    setCopied(true);
    Alert.alert('Copied!', 'UPI ID copied to clipboard');
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="qr-code" size={24} color="#059669" />
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {/* Amount Banner */}
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Total Amount Payable</Text>
              <Text style={styles.amountText}>₹{amount.toLocaleString('en-IN')}</Text>
            </View>

            {/* QR Code Image */}
            <View style={styles.qrWrapper}>
              <Image
                source={require('../../assets/images/payment_qr.jpg')}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.qrNote}>{PAYMENT_QR_DATA.qrNote}</Text>

            {/* Payee Info */}
            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account Name:</Text>
                <Text style={styles.infoValue}>{PAYMENT_QR_DATA.payeeName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>UPI ID:</Text>
                <TouchableOpacity onPress={handleCopyUpi} style={styles.upiCopyRow}>
                  <Text style={styles.upiText}>{PAYMENT_QR_DATA.upiId}</Text>
                  <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={16} color="#059669" />
                </TouchableOpacity>
              </View>
            </View>

            {/* UTR Input */}
            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>UTR / Transaction ID / Reference No. (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 423456789012"
                placeholderTextColor="#999"
                value={transactionId}
                onChangeText={setTransactionId}
                keyboardType="numeric"
              />
              <Text style={styles.inputHint}>Enter 12-digit UTR from your payment app receipt</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={20} color="#fff" />
                    <Text style={styles.confirmText}>I Have Paid / Confirm</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  amountBox: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 14,
    width: '100%',
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#047857',
    marginTop: 2,
  },
  qrWrapper: {
    backgroundColor: '#000',
    padding: 8,
    borderRadius: 16,
    width: 220,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  qrNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 12,
    width: '100%',
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  upiCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upiText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  inputBox: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  inputHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
