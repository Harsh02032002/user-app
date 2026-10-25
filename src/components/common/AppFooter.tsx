import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts } from '../../theme';

export const AppFooter = () => {
  // Footer is not needed in mobile app
  return null;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.inkSurface,
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
    fontFamily: fonts.displayBold,
    color: colors.primary,
    marginBottom: 12,
  },
  description: {
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textTertiary,
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
    fontFamily: fonts.bold,
    color: colors.white,
    marginBottom: 16,
  },
  linkText: {
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  contactText: {
    fontSize: 14, fontFamily: fonts.regular,
    color: colors.textTertiary,
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
    fontSize: 12, fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  madeIn: {
    fontSize: 12, fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});
