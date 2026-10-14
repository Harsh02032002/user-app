import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { registerForPushNotifications } from '../utils/pushNotifications';
import { initSocket } from '../services/socket';

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  address?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  sendLoginOtp: (identifier: string, password?: string) => Promise<any>;
  verifyLoginOtp: (identifier: string, otp: string) => Promise<void>;
  register: (data: RegisterData) => Promise<any>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  uploadAvatar: (formData: FormData) => Promise<void>;
  uploadBanner: (formData: FormData) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password?: string;
  role?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = React.useCallback(async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        const parsed = JSON.parse(storedUser);
        setToken(storedToken);
        setUser({ ...parsed, profileImage: parsed.profileImage || parsed.avatar });
        
        // Verify token is still valid
        try {
          const response = await api.auth.getProfile();
          const normalizedUser = { ...response, profileImage: response.avatar || response.profileImage };
          setUser(normalizedUser);
          await AsyncStorage.setItem('user', JSON.stringify(normalizedUser));
          registerForPushNotifications(storedToken);
          initSocket().catch(() => {});
        } catch (error) {
          // Token invalid, clear storage
          await logout();
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyEmail = React.useCallback(async (email: string, code: string) => {
    try {
      await api.auth.verifyEmail(email, code);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to verify email');
    }
  }, []);


  const loginWithEmail = React.useCallback(async (email: string, password: string) => {
    try {
      // Use real API for email login
      const response = await api.auth.login(email, password);
      
      if (!response.token) {
        throw new Error('No token received from server');
      }
      
      const { token: authToken, user: rawUser } = response;
      const userData = { ...rawUser, profileImage: rawUser?.avatar || rawUser?.profileImage };
      
      await AsyncStorage.setItem('token', authToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      setToken(authToken);
      setUser(userData);
      registerForPushNotifications(authToken);
      initSocket().catch(() => {});
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  }, []);

  const sendLoginOtp = React.useCallback(async (identifier: string, password?: string) => {
    try {
      return await api.auth.sendLoginOtp(identifier, password);
    } catch (error: any) {
      throw new Error(error.message || 'Could not send OTP');
    }
  }, []);

  const verifyLoginOtp = React.useCallback(async (identifier: string, otp: string) => {
    try {
      const response = await api.auth.verifyLoginOtp(identifier, otp);
      if (!response.token) {
        throw new Error('No token received from server');
      }
      const { token: authToken, user: rawUser } = response;
      const userData = { ...rawUser, profileImage: rawUser?.avatar || rawUser?.profileImage };

      await AsyncStorage.setItem('token', authToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      setToken(authToken);
      setUser(userData);
      registerForPushNotifications(authToken);
      initSocket().catch(() => {});
    } catch (error: any) {
      throw new Error(error.message || 'Invalid or expired OTP');
    }
  }, []);

  const register = React.useCallback(async (data: RegisterData) => {
    try {
      const response = await api.auth.register(data);
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    }
  }, []);

  const logout = React.useCallback(async () => {
    const { clearTokenCache } = require('../services/api');
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    clearTokenCache();
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = React.useCallback(async (data: Partial<User>) => {
    try {
      const response = await api.auth.updateProfile(data);
      // API response could be { user: {...} } or directly the user object
      const updatedData = response?.user || response?.data || response;
      const merged = { ...user, ...updatedData };
      const updatedUser = { ...merged, profileImage: merged.avatar || merged.profileImage } as User;
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error: any) {
      throw new Error(error.message || 'Update failed');
    }
  }, [user]);

  const uploadAvatar = React.useCallback(async (formData: FormData) => {
    try {
      const response = await api.auth.uploadAvatar(formData);
      const avatarUrl = response.avatar || response.user?.avatar || response.url;
      const updatedUser = { ...user, avatar: avatarUrl, profileImage: avatarUrl } as User;
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error: any) {
      throw new Error(error.message || 'Avatar upload failed');
    }
  }, [user]);

  const uploadBanner = React.useCallback(async (formData: FormData) => {
    try {
      const response = await api.auth.uploadBanner(formData);
      const bannerUrl = response.banner || response.user?.banner || response.url;
      const updatedUser = { ...user, banner: bannerUrl } as User;
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error: any) {
      throw new Error(error.message || 'Banner upload failed');
    }
  }, [user]);

  const refreshProfile = React.useCallback(async () => {
    try {
      const response = await api.auth.getProfile();
      const userData = { ...response, profileImage: response.avatar } as User;
      setUser(userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Refresh profile error:', error);
    }
  }, []);

  const value = React.useMemo(() => ({
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    loginWithEmail,
    sendLoginOtp,
    verifyLoginOtp,
    register,
    verifyEmail,
    logout,
    updateProfile,
    uploadAvatar,
    uploadBanner,
    refreshProfile,
  }), [user, token, isLoading, loginWithEmail, sendLoginOtp, verifyLoginOtp, register, verifyEmail, logout, updateProfile, uploadAvatar, uploadBanner, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
