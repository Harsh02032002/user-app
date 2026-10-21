import React, { useRef, useState } from 'react';
import { Text, StyleSheet, TextInput } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Button, Input, Notice } from '../../components/common';
import { colors, spacing, type } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;
type RouteType = RouteProp<RootStackParamList, 'Register'>;

type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'password', string>>;

const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const phone = route.params?.phone || '';
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleRegister = async () => {
    const finalPhone = phone || localPhone;
    const next: FieldErrors = {};
    if (!name.trim()) next.name = 'Enter your full name';
    if (!validateEmail(email.trim())) next.email = 'Enter a valid email address';
    if (finalPhone.length !== 10) next.phone = 'Enter a valid 10-digit phone number';
    if (password.length < 6) next.password = 'Use at least 6 characters';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone: finalPhone,
        password,
        role: 'user',
      });
      // After registration, redirect to verification screen
      navigation.navigate('Otp', { phone: finalPhone, email: email.trim() });
      Toast.show({ type: 'success', text1: 'Account created', text2: 'Enter the 6-digit code sent to your email.' });
    } catch (error: any) {
      setFormError(error?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join Dabba Nation today"
      footer={
        <Text style={styles.footerText}>
          Already have an account?{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('Login')} accessibilityRole="link">
            Sign in
          </Text>
        </Text>
      }
    >
      {formError ? <Notice tone="danger" message={formError} style={{ marginBottom: spacing.lg }} /> : null}
      <Input
        label="Full name"
        icon="person-outline"
        placeholder="Enter your name"
        autoComplete="name"
        textContentType="name"
        value={name}
        onChangeText={(v) => { setName(v); clearError('name'); }}
        error={errors.name}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <Input
        ref={emailRef}
        label="Email address"
        icon="mail-outline"
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={(v) => { setEmail(v); clearError('email'); }}
        error={errors.email}
        returnKeyType="next"
        onSubmitEditing={() => (phone ? passwordRef.current?.focus() : phoneRef.current?.focus())}
      />
      <Input
        ref={phoneRef}
        label="Phone number"
        icon="call-outline"
        placeholder="10-digit mobile number"
        keyboardType="phone-pad"
        maxLength={10}
        autoComplete="tel"
        textContentType="telephoneNumber"
        value={phone || localPhone}
        onChangeText={(v) => { setLocalPhone(v.replace(/\D/g, '')); clearError('phone'); }}
        editable={!phone}
        error={errors.phone}
        right={phone ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : undefined}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Input
        ref={passwordRef}
        label="Password"
        icon="lock-closed-outline"
        placeholder="At least 6 characters"
        secureTextEntry
        autoComplete="password-new"
        textContentType="newPassword"
        value={password}
        onChangeText={(v) => { setPassword(v); clearError('password'); }}
        error={errors.password}
        returnKeyType="go"
        onSubmitEditing={handleRegister}
        style={{ marginBottom: spacing.xl }}
      />
      <Button title="Create account" onPress={handleRegister} loading={loading} fullWidth />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  footerText: { ...type.small, color: colors.textSecondary },
  link: { ...type.label, color: colors.primary },
});
