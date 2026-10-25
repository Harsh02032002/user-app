import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { ScreenHeader } from '../components/common';
import { AppFooter } from '../components/common/AppFooter';

import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { getImageUrl } from '../services/api';
import api from '../services/api';
import { colors, fonts } from '../theme';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  bio: string;
  profileImage: string;
  banner: string;
}

export function EditProfileScreen() {
  const { user, updateProfile, refreshProfile, uploadAvatar, uploadBanner } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<'profileImage' | 'banner' | null>(null);
  const [pickerModalType, setPickerModalType] = useState<'profileImage' | 'banner' | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [bannerLoadError, setBannerLoadError] = useState(false);

  const [profile, setProfile] = useState<UserProfile>({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    bio: user?.bio || '',
    profileImage: user?.profileImage || user?.avatar || '',
    banner: user?.banner || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Update profile when user data changes
  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        bio: user.bio || '',
        profileImage: user.profileImage || user.avatar || '',
        banner: user.banner || '',
      });
    }
  }, [user]);

  const showMessage = (type: 'success' | 'error', title: string, message: string) => {
    Toast.show({
      type,
      text1: title,
      text2: message,
      position: 'top',
    });
    if (Platform.OS !== 'web') {
      Alert.alert(title, message);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await updateProfile({
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
        bio: profile.bio,
      });
      await refreshProfile();
      showMessage('success', 'Success', 'Profile updated successfully');
    } catch (error: any) {
      showMessage('error', 'Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword) {
      showMessage('error', 'Error', 'Please enter your current password');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      showMessage('error', 'Error', 'New password must be at least 6 characters');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showMessage('error', 'Error', 'Passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      await api.auth.changePassword(passwordData.currentPassword, passwordData.newPassword);
      showMessage('success', 'Success', 'Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      showMessage('error', 'Error', error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const launchGalleryPicker = async (type: 'profileImage' | 'banner') => {
    setPickerModalType(null);
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showMessage('error', 'Permission Denied', 'Camera roll permission is required to choose a photo.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'profileImage' ? [1, 1] : [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleImageUpload(type, result.assets[0]);
      }
    } catch (err: any) {
      console.error('Gallery picker error:', err);
      showMessage('error', 'Error', err.message || 'Could not open image picker');
    }
  };

  const launchCameraPicker = async (type: 'profileImage' | 'banner') => {
    setPickerModalType(null);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showMessage('error', 'Permission Denied', 'Camera permission is required to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'profileImage' ? [1, 1] : [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleImageUpload(type, result.assets[0]);
      }
    } catch (err: any) {
      console.error('Camera picker error:', err);
      showMessage('error', 'Error', err.message || 'Could not open camera');
    }
  };

  const pickImage = async (type: 'profileImage' | 'banner') => {
    // On Web, directly open the file chooser dialog (Alert.alert multi-button doesn't work on Web)
    if (Platform.OS === 'web') {
      await launchGalleryPicker(type);
      return;
    }
    // On Mobile (Android/iOS), show custom modal for Camera or Gallery
    setPickerModalType(type);
  };

  const handleImageUpload = async (type: 'profileImage' | 'banner', asset: any) => {
    setUploadingType(type);
    if (type === 'profileImage') {
      setAvatarLoadError(false);
    } else {
      setBannerLoadError(false);
    }

    // Set local preview immediately
    setProfile(prev => ({
      ...prev,
      [type]: asset.uri,
    }));

    try {
      const formData = new FormData();
      const fieldName = type === 'profileImage' ? 'avatar' : 'banner';
      const defaultFileName = type === 'profileImage' ? 'avatar.jpg' : 'banner.jpg';

      if (Platform.OS === 'web') {
        if (asset.file) {
          const validName =
            asset.file.name && /\.(jpg|jpeg|png|gif|webp)$/i.test(asset.file.name)
              ? asset.file.name
              : defaultFileName;
          formData.append(fieldName, asset.file, validName);
        } else {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const mime = blob.type || asset.mimeType || 'image/jpeg';
          const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
          formData.append(fieldName, blob, `${fieldName}.${ext}`);
        }
      } else {
        const rawName = asset.fileName || asset.uri.split('/').pop() || defaultFileName;
        const fileName = /\.(jpg|jpeg|png|gif|webp)$/i.test(rawName) ? rawName : defaultFileName;
        const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
        const fileType =
          asset.mimeType ||
          `image/${ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg'}`;

        formData.append(fieldName, {
          uri: asset.uri,
          name: fileName,
          type: fileType,
        } as any);
      }

      if (type === 'profileImage') {
        await uploadAvatar(formData);
      } else {
        await uploadBanner(formData);
      }

      showMessage(
        'success',
        'Success',
        `${type === 'profileImage' ? 'Profile photo' : 'Banner image'} updated successfully`
      );
    } catch (error: any) {
      console.error('Image upload error:', error);
      showMessage('error', 'Upload Failed', error.message || 'Failed to upload image');
      // Revert to original user data on error
      setProfile(prev => ({
        ...prev,
        [type]: (type === 'profileImage' ? user?.profileImage || user?.avatar : user?.banner) || '',
      }));
    } finally {
      setUploadingType(null);
    }
  };

  const resolvedAvatarUri = getImageUrl(profile.profileImage || user?.avatar || user?.profileImage);
  const resolvedBannerUri = getImageUrl(profile.banner || user?.banner);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Edit profile" />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Profile Information Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Profile Information</Text>
          </View>

          {/* Profile Picture */}
          <View style={styles.profileSection}>
            <TouchableOpacity
              onPress={() => pickImage('profileImage')}
              style={styles.avatarContainer}
              disabled={uploadingType === 'profileImage'}
              activeOpacity={0.8}
            >
              {resolvedAvatarUri && !avatarLoadError ? (
                <Image 
                  source={{ uri: resolvedAvatarUri }} 
                  style={styles.avatar}
                  onError={() => setAvatarLoadError(true)}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color={colors.primary} />
                </View>
              )}
              {uploadingType === 'profileImage' && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color={colors.white} />
                </View>
              )}
              <View style={styles.cameraButton}>
                <Ionicons name="camera" size={16} color={colors.white} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => pickImage('profileImage')}
              style={styles.changePhotoButton}
              disabled={uploadingType === 'profileImage'}
              activeOpacity={0.8}
            >
              {uploadingType === 'profileImage' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="camera-outline" size={16} color={colors.primary} />
              )}
              <Text style={styles.changePhotoText}>
                {uploadingType === 'profileImage' ? 'Uploading...' : 'Change Photo'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Banner Image */}
          <View style={[styles.inputGroup, { marginBottom: 0 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.label, { marginBottom: 0 }]}>Banner Image</Text>
              <TouchableOpacity
                onPress={() => pickImage('banner')}
                disabled={uploadingType === 'banner'}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="cloud-upload-outline" size={15} color={colors.primary} />
                <Text style={{ fontSize: 13, fontFamily: fonts.semiBold, color: colors.primary }}>
                  {uploadingType === 'banner'
                    ? 'Uploading...'
                    : resolvedBannerUri && !bannerLoadError
                    ? 'Change Banner'
                    : 'Upload Banner'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => pickImage('banner')}
              style={[styles.bannerContainer, { marginBottom: 10 }]}
              disabled={uploadingType === 'banner'}
              activeOpacity={0.85}
            >
              {resolvedBannerUri && !bannerLoadError ? (
                <>
                  <Image 
                    source={{ uri: resolvedBannerUri }} 
                    style={styles.bannerImage}
                    resizeMode="cover"
                    onError={() => setBannerLoadError(true)}
                  />
                  <View style={styles.bannerEditBadge}>
                    <Ionicons name="camera" size={14} color={colors.white} />
                    <Text style={styles.bannerEditBadgeText}>Tap to change</Text>
                  </View>
                </>
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <View style={styles.bannerUploadIconCircle}>
                    <Ionicons name="camera-outline" size={24} color={colors.primary} />
                  </View>
                  <Text style={styles.bannerPlaceholderText}>Tap to Upload Banner Photo</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>JPG, PNG or WEBP (16:9 recommended)</Text>
                </View>
              )}
              {uploadingType === 'banner' && (
                <View style={styles.bannerLoadingOverlay}>
                  <ActivityIndicator size="large" color={colors.white} />
                  <Text style={{ color: colors.surface, fontSize: 13, fontFamily: fonts.semiBold, marginTop: 6 }}>
                    Uploading Banner...
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Basic Info */}
          <View style={[styles.inputGroup, { marginTop: 36 }]}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={profile.name}
              onChangeText={(text) => setProfile(prev => ({ ...prev, name: text }))}
              placeholder="Enter your name"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={profile.email}
              onChangeText={(text) => setProfile(prev => ({ ...prev, email: text }))}
              placeholder="Enter your email"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={profile.phone}
              onChangeText={(text) => setProfile(prev => ({ ...prev, phone: text }))}
              placeholder="Enter your phone"
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={profile.address}
              onChangeText={(text) => setProfile(prev => ({ ...prev, address: text }))}
              placeholder="Enter your location"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profile.bio}
              onChangeText={(text) => setProfile(prev => ({ ...prev, bio: text }))}
              placeholder="Tell us about yourself..."
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={colors.white} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Change Password */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Change Password</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={passwordData.currentPassword}
              onChangeText={(text) => setPasswordData(prev => ({ ...prev, currentPassword: text }))}
              placeholder="Enter current password"
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
              placeholder="Enter new password"
              secureTextEntry
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
              placeholder="Confirm new password"
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
        <AppFooter />
      </ScrollView>

      {/* Camera / Gallery Picker Modal for Mobile */}
      <Modal
        visible={pickerModalType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalType(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerModalType(null)}
        >
          <View style={styles.pickerModalSheet}>
            <Text style={styles.pickerModalTitle}>
              {pickerModalType === 'profileImage' ? 'Update Profile Photo' : 'Update Banner Image'}
            </Text>
            <Text style={styles.pickerModalSubtitle}>Choose an image source</Text>

            <TouchableOpacity
              style={styles.pickerOptionBtn}
              onPress={() => pickerModalType && launchCameraPicker(pickerModalType)}
            >
              <View style={[styles.pickerOptionIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="camera" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerOptionTitle}>Take Photo</Text>
                <Text style={styles.pickerOptionDesc}>Use your camera to capture a new photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerOptionBtn}
              onPress={() => pickerModalType && launchGalleryPicker(pickerModalType)}
            >
              <View style={[styles.pickerOptionIcon, { backgroundColor: colors.infoSoft }]}>
                <Ionicons name="images" size={22} color={colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.pickerOptionDesc}>Select an existing photo from your device</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerCancelBtn}
              onPress={() => setPickerModalType(null)}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#403126',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.text,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primaryBorder,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    gap: 8,
  },
  changePhotoText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  bannerContainer: {
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primaryBorder,
    borderStyle: 'dashed',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  bannerUploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerPlaceholderText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  bannerEditBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bannerEditBadgeText: {
    color: colors.surface,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  bannerLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.text,
    marginBottom: 4,
  },
  pickerModalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16, fontFamily: fonts.regular,
  },
  pickerOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.canvas,
    marginBottom: 10,
    gap: 14,
  },
  pickerOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerOptionTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  pickerOptionDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2, fontFamily: fonts.regular,
  },
  pickerCancelBtn: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.canvas,
    alignItems: 'center',
  },
  pickerCancelText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface, fontFamily: fonts.regular,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontFamily: fonts.bold,
  },
});