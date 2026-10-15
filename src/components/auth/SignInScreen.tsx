import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Button, Input, Notice } from '../common';
import { colors, spacing, type } from '../../theme';
import { AuthLayout } from './AuthLayout';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** Single sign-in experience used by both the `SimpleLogin` and `Login` routes */
export default function SignInScreen() {
  const navigation = useNavigation<any>();
  const { loginWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Enter your email';
    else if (!isEmail(email)) next.email = 'Enter a valid email address';
    if (!password) next.password = 'Enter your password';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    setFormError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      // Navigation switches automatically when AuthContext marks the user authenticated
    } catch (error: any) {
      setFormError(error?.message || 'Login failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to order delicious food"
      footer={
        <Text style={styles.footerText}>
          Don't have an account?{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('Register', { phone: '' })} accessibilityRole="link">
            Sign up
          </Text>
        </Text>
      }
    >
      {formError ? <Notice tone="danger" message={formError} style={{ marginBottom: spacing.lg }} /> : null}
      <Input
        label="Email"
        icon="mail-outline"
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={(v) => { setEmail(v); if (errors.email) setErrors((e) => ({ ...e, email: undefined })); }}
        error={errors.email}
        returnKeyType="next"
      />
      <Input
        label="Password"
        icon="lock-closed-outline"
        placeholder="Enter your password"
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        value={password}
        onChangeText={(v) => { setPassword(v); if (errors.password) setErrors((e) => ({ ...e, password: undefined })); }}
        error={errors.password}
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        style={{ marginBottom: spacing.sm }}
      />
      <View style={styles.forgotRow}>
        <TouchableOpacity
          onPress={() => Toast.show({ type: 'info', text1: 'Reset password', text2: 'Please use the Dabba Nation website to reset your password.' })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.link}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
      <Button title="Sign in" onPress={handleLogin} loading={loading} fullWidth />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgotRow: { alignItems: 'flex-end', marginBottom: spacing.xl },
  footerText: { ...type.small, color: colors.textSecondary },
  link: { ...type.label, color: colors.primary },
});
