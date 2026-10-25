import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { Button, Card, Divider, ScreenHeader } from '../../components/common';
import { colors, spacing, type as typo } from '../../theme';

type StaticPageScreenRouteProp = RouteProp<RootStackParamList, 'StaticPage'>;

interface Section {
  title: string;
  content: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function StaticPageScreen() {
  const navigation = useNavigation();
  const route = useRoute<StaticPageScreenRouteProp>();
  const { type } = route.params;

  const getPageConfig = () => {
    switch (type) {
      case 'about':
        return {
          title: 'About Us',
          icon: 'information-circle' as const,
          sections: [
            {
              title: 'Our Story',
              content: 'Dabba Nation started with a simple idea: bringing the warmth and health of home-cooked meals to everyone. We connect passionate home chefs and quality restaurants with people who value good food.',
              icon: 'book' as const,
            },
            {
              title: 'Our Mission',
              content: 'To empower home chefs and provide our customers with delicious, hygienic, and affordable meal options while ensuring a seamless delivery experience.',
              icon: 'rocket' as const,
            },
            {
              title: 'Quality Assured',
              content: 'Every partner on our platform undergoes a strict quality check to ensure you get nothing but the best.',
              icon: 'checkmark-circle' as const,
            }
          ]
        };
      case 'help':
        return {
          title: 'Help Center',
          icon: 'help-circle' as const,
          sections: [
            {
              title: 'How to Order',
              content: '1. Browse restaurants or home chefs.\n2. Add items to your cart.\n3. Choose delivery address.\n4. Pay and relax!',
              icon: 'cart' as const,
            },
            {
              title: 'Subscriptions',
              content: 'Save more with our Dabba subscriptions. Choose a plan, select your favorite chef, and get daily meals delivered.',
              icon: 'calendar' as const,
            },
            {
              title: 'Payments',
              content: 'We support Wallet, Razorpay (UPI, Cards), and Cash on Delivery.',
              icon: 'card' as const,
            }
          ]
        };
      case 'privacy':
        return {
          title: 'Privacy Policy',
          icon: 'shield-checkmark' as const,
          sections: [
            {
              title: 'Data Collection',
              content: 'We collect your name, phone, and address to provide delivery services. Your data is secure with us.',
              icon: 'lock-closed' as const,
            },
            {
              title: 'Usage',
              content: 'Your location is used only for delivery tracking. We do not sell your personal information.',
              icon: 'eye-off' as const,
            }
          ]
        };
      case 'terms':
        return {
          title: 'Terms of Service',
          icon: 'document-text' as const,
          sections: [
            {
              title: 'User Agreement',
              content: 'By using our app, you agree to provide accurate information and follow our guidelines.',
              icon: 'people' as const,
            },
            {
              title: 'Delivery Terms',
              content: 'Delivery times are estimates. We strive for punctuality but traffic and weather may cause delays.',
              icon: 'bicycle' as const,
            }
          ]
        };
      case 'contact':
        return {
          title: 'Contact Us',
          icon: 'mail' as const,
          sections: [
            {
              title: 'Phone Support',
              content: '+91 73030 23539\nMon-Sat, 9 AM - 9 PM',
              icon: 'call' as const,
            },
            {
              title: 'Email Us',
              content: 'support@dabbanation.com\nWe reply within 24 hours',
              icon: 'mail' as const,
            },
            {
              title: 'Office Address',
              content: 'East Shastri Nagar, Ram Gulam Tola, Deoria, UP 274001',
              icon: 'location' as const,
            }
          ]
        };
      case 'refund':
        return {
          title: 'Refund Policy',
          icon: 'refresh-circle' as const,
          sections: [
            {
              title: 'Refund Process',
              content: 'Refunds for cancelled orders are processed to your wallet within 24 hours.',
              icon: 'wallet' as const,
            },
            {
              title: 'Cancellations',
              content: 'Orders can be cancelled before preparation starts for a full refund.',
              icon: 'close-circle' as const,
            }
          ]
        };
      default:
        return { title: 'Information', sections: [] };
    }
  };

  const config = getPageConfig();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={config.title} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={(config as any).icon || 'information-circle'} size={28} color={colors.primary} />
          </View>
          <Text style={[typo.title, { textAlign: 'center' }]}>{config.title}</Text>
          <Text style={[typo.caption, { textAlign: 'center' }]}>Last updated: April 2024</Text>
        </View>

        <Card padded={false}>
          {config.sections.map((section: Section, index: number) => (
            <View key={index}>
              {index > 0 ? <Divider style={{ marginHorizontal: spacing.lg }} /> : null}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name={(section.icon as any) || 'ellipse'} size={18} color={colors.primary} />
                  <Text style={typo.heading}>{section.title}</Text>
                </View>
                <Text style={[typo.body, { color: colors.textSecondary }]}>{section.content}</Text>
              </View>
            </View>
          ))}
        </Card>

        {type === 'contact' ? (
          <Button
            title="Call support"
            icon="call"
            onPress={() => Linking.openURL('tel:+917303023539')}
            fullWidth
            style={{ marginTop: spacing.xl }}
          />
        ) : null}

        {type === 'privacy' || type === 'terms' ? (
          <Button
            title={type === 'privacy' ? 'Read the full privacy policy' : 'Read the full terms'}
            icon="open-outline"
            onPress={() => Linking.openURL(type === 'privacy' ? 'https://dabbanation.in/privacy-policy' : 'https://dabbanation.in/terms')}
            fullWidth
            style={{ marginTop: spacing.xl }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.screen, paddingBottom: spacing.xxxl },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  section: { padding: spacing.lg, gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
