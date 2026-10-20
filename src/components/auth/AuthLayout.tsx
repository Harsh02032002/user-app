import React from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, elevation, spacing, type, fonts } from '../../theme';
import { IconButton } from '../common';

/** Shared shell for sign-in, registration and OTP: cream canvas, logo, title, keyboard-safe scroll */
export const AuthLayout: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
}> = ({ title, subtitle, children, footer, onBack }) => {
  const navigation = useNavigation<any>();
  const goBack = onBack || (() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Landing')));
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>
            <IconButton icon="arrow-back" accessibilityLabel="Go back" onPress={goBack} style={styles.back} />
            <View style={styles.logoCircle}>
              <Image source={require('../../../assets/images/logo.png')} style={styles.logo} resizeMode="cover" accessibilityLabel="Dabba Nation" />
            </View>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <View style={styles.form}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 440, paddingHorizontal: spacing.screen + 4, paddingBottom: spacing.xxl },
  back: { marginTop: spacing.sm, marginLeft: -spacing.sm },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.none,
  },
  logo: { width: 64, height: 64, borderRadius: 32 },
  title: { ...type.display, fontSize: 30, lineHeight: 36, marginTop: spacing.xl },
  subtitle: { ...type.body, color: colors.textSecondary, marginTop: spacing.xs },
  form: { marginTop: spacing.xxl },
  footer: { marginTop: spacing.xl, alignItems: 'center' },
});
