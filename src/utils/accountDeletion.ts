import { Alert, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { api } from '../services/api';

const TITLE = 'Delete your account?';
const MESSAGE =
  'This permanently deletes your profile, saved addresses, wishlist and notifications, and any wallet balance. ' +
  'Past orders and invoices are kept without your name, as required by tax law. This cannot be undone.';

const confirmDelete = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(typeof window !== 'undefined' && window.confirm(`${TITLE}\n\n${MESSAGE}`));
      return;
    }
    Alert.alert(TITLE, MESSAGE, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete account', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });

/** Ask for confirmation, delete the account on the server, then sign out */
export async function deleteAccountFlow(logout: () => void | Promise<void>) {
  if (!(await confirmDelete())) return;
  try {
    await api.auth.deleteAccount();
    Toast.show({ type: 'success', text1: 'Account deleted', text2: 'We are sorry to see you go.' });
    await logout();
  } catch (error: any) {
    const message = error?.message || 'Could not delete your account. Please try again.';
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert('Account not deleted', message);
  }
}

/** Public web page where anyone can request deletion without the app (Play Store requirement) */
export const ACCOUNT_DELETION_URL = 'https://dabbanation.in/delete-account';
