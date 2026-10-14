import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { Feather, Ionicons } from '@expo/vector-icons';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { sendLoginOtp, verifyLoginOtp } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpInfo, setOtpInfo] = useState<{ maskedEmail?: string; maskedPhone?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (!identifier.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Required',
        text2: 'Please enter your Email or Phone Number',
      });
      return;
    }
    if (loginMode === 'password' && !password) {
      Toast.show({
        type: 'error',
        text1: 'Required',
        text2: 'Please enter your password',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await sendLoginOtp(
        identifier.trim(),
        loginMode === 'password' ? password : undefined
      );
      setOtpInfo({
        maskedEmail: res?.maskedEmail,
        maskedPhone: res?.maskedPhone,
      });
      setOtpStep(true);
      Toast.show({
        type: 'success',
        text1: 'OTP Sent!',
        text2: res?.message || '6-digit OTP sent to your Email & Phone number',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: error.message || 'Invalid credentials',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.trim().length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Required',
        text2: 'Please enter the 6-digit OTP',
      });
      return;
    }

    setLoading(true);
    try {
      await verifyLoginOtp(identifier.trim(), otp.trim());
      Toast.show({
        type: 'success',
        text1: 'Welcome Back!',
        text2: 'Logged in successfully',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'OTP Verification Failed',
        text2: error.message || 'Invalid or expired OTP',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const res = await sendLoginOtp(
        identifier.trim(),
        loginMode === 'password' ? password : undefined
      );
      Toast.show({
        type: 'success',
        text1: 'OTP Resent!',
        text2: res?.message || 'New 6-digit OTP sent to your Email & Phone',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to resend OTP',
      });
    } finally {
      setLoading(false);
    }
  };

  const isPhoneInput = /^\d+$/.test(identifier.replace(/\+/g, '')) && identifier.length > 0;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back to Home Button */}
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.navigate('Landing' as any)}
          >
            <Feather name="arrow-left" size={18} color="#666" />
            <Text style={styles.backText}>Back to Home</Text>
          </TouchableOpacity>

          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Image 
                source={require('../../../assets/images/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Header Text */}
          <View style={styles.headerSection}>
            <Text style={styles.title}>{otpStep ? 'Verify OTP' : 'Welcome Back!'}</Text>
            <Text style={styles.subtitle}>
              {otpStep
                ? `Enter the 6-digit OTP sent to ${[otpInfo.maskedEmail, otpInfo.maskedPhone].filter(Boolean).join(' & ') || 'your Email & Phone'}`
                : 'Sign in with your Email or Phone Number'}
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.formContainer}>
            {!otpStep ? (
              <>
                {/* Mode Toggle */}
                <View style={styles.modeToggleContainer}>
                  <TouchableOpacity
                    style={[styles.modeTab, loginMode === 'password' && styles.modeTabActive]}
                    onPress={() => setLoginMode('password')}
                  >
                    <Text style={[styles.modeTabText, loginMode === 'password' && styles.modeTabTextActive]}>
                      Password + OTP
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeTab, loginMode === 'otp' && styles.modeTabActive]}
                    onPress={() => setLoginMode('otp')}
                  >
                    <Text style={[styles.modeTabText, loginMode === 'otp' && styles.modeTabTextActive]}>
                      Direct OTP Login
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email or Phone Number</Text>
                  <View style={styles.inputWrapper}>
                    <Feather name={isPhoneInput ? 'phone' : 'mail'} size={18} color="#999" />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter Email or 10-digit Phone Number"
                      value={identifier}
                      onChangeText={setIdentifier}
                      autoCapitalize="none"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>

                {loginMode === 'password' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.inputWrapper}>
                      <Feather name="lock" size={18} color="#999" />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        placeholderTextColor="#999"
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#999" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.forgotPasswordContainer}
                  onPress={() =>
                    Toast.show({
                      type: 'info',
                      text1: 'Tip',
                      text2: 'Switch to "Direct OTP Login" above to sign in without a password!',
                    })
                  }
                >
                  <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.signInButton}
                  onPress={handleRequestOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Continue & Send OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>6-Digit OTP (Sent via SMS & Email)</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="key-outline" size={18} color="#999" />
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChangeText={(val) => setOtp(val.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.signInButton}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify OTP & Sign In</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.otpActionRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setOtpStep(false);
                      setOtp('');
                    }}
                  >
                    <Text style={styles.changeAccountText}>Change Email / Phone</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                    <Text style={styles.resendOtpText}>Resend OTP</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.registerLinkContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register', { phone: '' })}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF8F1',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginBottom: 20,
  },
  backText: {
    fontSize: 13,
    color: '#666',
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
      default: { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 }
    })
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  formContainer: {
    width: '100%',
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3EDE2',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#fff',
    elevation: 2,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  modeTabTextActive: {
    color: '#E86F2A',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFCE8',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1a1a1a',
  },
  otpInput: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 6,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#E86F2A',
    fontWeight: '500',
  },
  signInButton: {
    backgroundColor: '#E86F2A',
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(232, 111, 42, 0.25)' },
      default: { elevation: 3, shadowColor: '#E86F2A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }
    })
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  otpActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  changeAccountText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  resendOtpText: {
    fontSize: 13,
    color: '#E86F2A',
    fontWeight: '700',
  },
  registerLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  registerText: {
    fontSize: 14,
    color: '#666',
  },
  registerLink: {
    fontSize: 14,
    color: '#E86F2A',
    fontWeight: 'bold',
  },
});
