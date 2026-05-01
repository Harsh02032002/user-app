import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { AppHeader } from '../../components/common/AppHeader';
import { AppFooter } from '../../components/common/AppFooter';

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
    <SafeAreaView style={styles.container}>
      <AppHeader showSearch={false} showBack={true} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.heroIconContainer}>
            <Ionicons name={config.icon as any || 'information-circle'} size={48} color="#FF6B00" />
          </View>
          <Text style={styles.heroTitle}>{config.title}</Text>
          <Text style={styles.heroSubtitle}>Last updated: April 2024</Text>
        </View>

        {config.sections.map((section, index) => (
          <View key={index} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name={section.icon as any || 'ellipse'} size={20} color="#FF6B00" />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        {type === 'contact' && (
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={() => Linking.openURL('tel:+917303023539')}
          >
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.ctaButtonText}>Call Support</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
        <AppFooter />
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  heroIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  ctaButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4,
  },
});
