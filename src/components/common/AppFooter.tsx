import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export const AppFooter = () => {
  const navigation = useNavigation<any>();
  const currentYear = new Date().getFullYear();

  const handleLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Company Info */}
        <View style={styles.section}>
          <Text style={styles.brandTitle}>Dabba Nation</Text>
          <Text style={styles.description}>
            Your trusted food delivery partner, bringing delicious homemade and restaurant meals to your doorstep.
          </Text>
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialIcon}>
              <Ionicons name="logo-facebook" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialIcon}>
              <Ionicons name="logo-twitter" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialIcon}>
              <Ionicons name="logo-instagram" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialIcon}>
              <Ionicons name="logo-youtube" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Links Grid */}
        <View style={styles.linksGrid}>
          <View style={styles.linkColumn}>
            <Text style={styles.columnTitle}>Quick Links</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'StaticPage', params: { type: 'about' } })}>
              <Text style={styles.linkText}>About Us</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'StaticPage', params: { type: 'help' } })}>
              <Text style={styles.linkText}>How it Works</Text>
            </TouchableOpacity>
            <TouchableOpacity><Text style={styles.linkText}>Become a Partner</Text></TouchableOpacity>
            <TouchableOpacity><Text style={styles.linkText}>Careers</Text></TouchableOpacity>
          </View>
          <View style={styles.linkColumn}>
            <Text style={styles.columnTitle}>Support</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'StaticPage', params: { type: 'help' } })}>
              <Text style={styles.linkText}>Help Center</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'StaticPage', params: { type: 'contact' } })}>
              <Text style={styles.linkText}>Contact Us</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'StaticPage', params: { type: 'privacy' } })}>
              <Text style={styles.linkText}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'StaticPage', params: { type: 'terms' } })}>
              <Text style={styles.linkText}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.columnTitle}>Contact Us</Text>
          <View style={styles.contactItem}>
            <Ionicons name="call" size={18} color="#FF6B00" />
            <Text style={styles.contactText}>+91 73030 23539</Text>
          </View>
          <View style={styles.contactItem}>
            <Ionicons name="location" size={18} color="#FF6B00" />
            <Text style={styles.contactText}>
              East Shastri Nagar, Ram Gulam Tola, Deoria 274001
            </Text>
          </View>
          <View style={styles.contactItem}>
            <Ionicons name="mail" size={18} color="#FF6B00" />
            <Text style={styles.contactText}>support@dabbanation.com</Text>
          </View>
        </View>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <Text style={styles.copyright}>
            © {currentYear} Dabba Nation. All rights reserved.
          </Text>
          <Text style={styles.madeIn}>Made with ❤️ in India</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    paddingTop: 40,
    paddingBottom: 20,
    marginTop: 20,
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 30,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 20,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 15,
  },
  socialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linksGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  linkColumn: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  linkText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 15,
  },
  contactText: {
    fontSize: 14,
    color: '#ccc',
    flex: 1,
    lineHeight: 20,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 20,
    alignItems: 'center',
  },
  copyright: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  madeIn: {
    fontSize: 12,
    color: '#666',
  },
});
