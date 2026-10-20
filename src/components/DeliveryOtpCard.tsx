import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, hairline, radius, spacing, type } from '../theme';

type Props = {
  otp?: string | null;
  /** Rider is on the way: draw attention to the code */
  active?: boolean;
};

/** The 4-digit code the customer reads out to the rider at handover */
export function DeliveryOtpCard({ otp, active = false }: Props) {
  const code = String(otp || '').trim();
  if (!/^\d{4,6}$/.test(code)) return null;

  return (
    <View
      style={[styles.card, active && styles.cardActive]}
      accessible
      accessibilityLabel={`Delivery code ${code.split('').join(' ')}. Share it with your rider only when you receive your order.`}
    >
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Ionicons name="lock-closed" size={13} color={active ? colors.primaryInk : colors.textSecondary} />
          <Text style={[styles.overline, active && styles.overlineActive]}>Delivery code</Text>
        </View>
        <Text style={styles.hint}>
          {active ? 'Your rider is on the way. Share this code when you receive your food.' : 'Share it with your rider only when you receive your food.'}
        </Text>
      </View>
      <View style={styles.digits}>
        {code.split('').map((d, i) => (
          <View key={i} style={[styles.digit, active && styles.digitActive]}>
            <Text style={styles.digitText}>{d}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  cardActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
  },
  text: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overline: { ...type.overline },
  overlineActive: { color: colors.primaryInk },
  hint: { ...type.caption },
  digits: { flexDirection: 'row', gap: 6 },
  digit: {
    width: 34,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryBorder },
  digitText: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});
