import React from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, elevation, fonts, gradients, radius, spacing, surfaces, type } from '../../theme';

/**
 * Shared shell for sign-in, registration and OTP.
 * Brand-gradient hero (same as the Landing screen and .gradient-primary in the panels)
 * with the form in a raised card that overlaps it.
 */
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
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Image source={require('../../../assets/images/hero-bg.jpg')} style={styles.heroTexture} resizeMode="cover" />
            <SafeAreaView edges={['top']} style={styles.heroInner}>
              <View style={styles.topRow}>
                <TouchableOpacity onPress={goBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="arrow-back" size={20} color={colors.white} />
                </TouchableOpacity>
                <View style={styles.brandRow}>
                  <Image source={require('../../../assets/images/logo.png')} style={styles.logo} resizeMode="cover" accessibilityLabel="Dabba Nation" />
                  <Text style={styles.brandName}>Dabba Nation</Text>
                </View>
                <View style={styles.backSpacer} />
              </View>
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </SafeAreaView>
          </LinearGradient>

          <View style={styles.inner}>
            <View style={styles.card}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxxl },

  hero: {
    paddingBottom: spacing.xxxl * 2,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroTexture: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: 0.12 },
  heroInner: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: spacing.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backSpacer: { width: 38, height: 38 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  brandName: { fontFamily: fonts.displayBold, fontSize: 17, lineHeight: 22, color: colors.white },
  title: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 36, color: colors.white, marginTop: spacing.xxxl },
  subtitle: { ...type.body, color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs },

  inner: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: spacing.screen },
  card: {
    ...surfaces.card,
    ...elevation.raised,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    marginTop: -spacing.xxxl,
    padding: spacing.xl,
  },
  footer: { marginTop: spacing.xl, alignItems: 'center' },
});
