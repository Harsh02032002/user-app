import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Button, Notice } from '../../components/common';
import { colors, radius, spacing, type } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Otp'>;
type RouteType = RouteProp<RootStackParamList, 'Otp'>;

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function OtpScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { phone, email } = route.params;
  const { verifyEmail } = useAuth();

  const [otp, setOtp] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(RESEND_SECONDS);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const isEmailFlow = !!email;
  const code = otp.join('');

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async (otpCode: string) => {
    if (otpCode.length !== CODE_LENGTH || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (isEmailFlow && email) {
        await verifyEmail(email, otpCode);
        Toast.show({ type: 'success', text1: 'Email verified', text2: 'You can now sign in.' });
        navigation.navigate('Login');
      }
    } catch (err: any) {
      setError(err?.message || 'That code is incorrect or has expired.');
      setOtp(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, '');
    // Support pasting the whole code into one box
    if (digits.length > 1) {
      const next = digits.slice(0, CODE_LENGTH).split('');
      const filled = [...next, ...Array(CODE_LENGTH - next.length).fill('')];
      setOtp(filled);
      inputRefs.current[Math.min(next.length, CODE_LENGTH - 1)]?.focus();
      if (next.length === CODE_LENGTH) handleVerify(next.join(''));
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);
    if (error) setError(null);
    if (digits && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (index === CODE_LENGTH - 1 && digits && newOtp.join('').length === CODE_LENGTH) handleVerify(newOtp.join(''));
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    if (!isEmailFlow || !email) {
      Toast.show({ type: 'info', text1: 'Resend unavailable', text2: 'Please register again to receive a new code.' });
      return;
    }
    setResending(true);
    try {
      await api.auth.resendVerification(email);
      Toast.show({ type: 'success', text1: 'Code sent', text2: `A new code was sent to ${email}` });
      setResendTimer(RESEND_SECONDS);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not resend code', text2: err?.message || 'Please try again.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title={isEmailFlow ? 'Verify your email' : 'Verify your phone'}
      subtitle={
        <>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.destination}>{isEmailFlow ? email : `+91 ${phone}`}</Text>
        </>
      }
      footer={
        <View style={styles.resendRow}>
          <Text style={styles.footerText}>Didn't receive the code? </Text>
          <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0 || resending} accessibilityRole="button">
            <Text style={[styles.link, (resendTimer > 0 || resending) && styles.linkDisabled]}>
              {resending ? 'Sending…' : resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
      {error ? <Notice tone="danger" message={error} style={{ marginBottom: spacing.lg }} /> : null}
      <View style={styles.otpRow}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => { inputRefs.current[index] = ref; }}
            style={[styles.otpInput, !!digit && styles.otpInputFilled, !!error && styles.otpInputError]}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete={index === 0 ? 'sms-otp' : 'off'}
            maxLength={index === 0 ? CODE_LENGTH : 1}
            value={digit}
            onChangeText={(value) => handleOtpChange(value, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            autoFocus={index === 0}
            accessibilityLabel={`Digit ${index + 1}`}
            selectTextOnFocus
          />
        ))}
      </View>
      <Button title="Verify" onPress={() => handleVerify(code)} disabled={code.length !== CODE_LENGTH} loading={loading} fullWidth />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  destination: { ...type.subheading, color: colors.text },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xxl },
  otpInput: {
    flex: 1,
    maxWidth: 52,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  otpInputFilled: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  otpInputError: { borderColor: colors.danger },
  resendRow: { flexDirection: 'row', alignItems: 'center' },
  footerText: { ...type.small, color: colors.textSecondary },
  link: { ...type.label, color: colors.primary },
  linkDisabled: { color: colors.textTertiary },
});
