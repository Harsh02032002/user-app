import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useCart } from '../context/CartContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';

// Tab Screens - Updated to match Dabba Delights
import { HomeScreen } from '../screens/tabs/HomeScreen';
import { OrdersScreen } from '../screens/tabs/OrdersScreen';
import SubscriptionPlansScreen from '../screens/SubscriptionPlansScreen';
import { WalletScreen } from '../screens/tabs/WalletScreen';
import { SettingsScreen } from '../screens/tabs/SettingsScreen';

export type MainTabParamList = {
  Home: undefined;
  Orders: undefined;
  MyPlans: undefined;
  Wallet: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { totalItems } = useCart();
  const insets = useSafeAreaInsets();
  const [orderCount, setOrderCount] = React.useState(0);
            
  React.useEffect(() => {
    const fetchOrderCount = async () => {
      try {
        const res = await api.user.getOrders();
        const orders = Array.isArray(res) ? res : res.orders || res.data || [];
        const activeCount = orders.filter((o: any) => 
          ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status)
        ).length;
        setOrderCount(activeCount);
      } catch (e) {
        console.error('Error fetching order count for badge:', e);
      }
    };
    
    fetchOrderCount();
    const interval = setInterval(fetchOrderCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Orders') {
            iconName = focused ? 'bag' : 'bag-outline';
          } else if (route.name === 'MyPlans') {
            iconName = focused ? 'star' : 'star-outline';
          } else if (route.name === 'Wallet') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-outline';
          }

          return (
            <View>
              <Ionicons name={iconName as any} size={size} color={color} />
              {route.name === 'Home' && totalItems > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{totalItems}</Text>
                </View>
              )}
              {route.name === 'Orders' && orderCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{orderCount}</Text>
                </View>
              )}
            </View>
          );
        },
        tabBarActiveTintColor: '#FF6B00',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { display: 'none' }, // Using custom MobileNavBar instead
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ title: 'Orders' }}
      />
      <Tab.Screen
        name="MyPlans"
        component={SubscriptionPlansScreen}
        options={{ title: 'My Plans' }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ title: 'Wallet' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#FF6B00',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
