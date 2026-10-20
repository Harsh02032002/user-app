import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCart, getCartUnitPrice } from '../context/CartContext';
import { Button, EmptyState, QuantityStepper, ScreenHeader, StickyFooter, VegIndicator } from '../components/common';
import { KitchenMark } from '../components/cards';
import { colors, fonts, formatPrice, radius, spacing, type } from '../theme';

export function CartScreen() {
  const navigation = useNavigation<any>();
  const { items, totalItems, totalAmount, updateQuantity, clearCart } = useCart();

  // The cart is single-kitchen in practice; group defensively in case it isn't
  const kitchens = React.useMemo(() => {
    const map = new Map<string, { name: string; items: typeof items }>();
    items.forEach((i) => {
      const key = String(i.sellerId || 'unknown');
      const entry = map.get(key) || { name: i.sellerName || 'Kitchen', items: [] as typeof items };
      entry.items.push(i);
      map.set(key, entry);
    });
    return Array.from(map.entries());
  }, [items]);

  const confirmClear = () => {
    const doClear = () => clearCart();
    if (Platform.OS === 'web') {
      if (window.confirm('Remove all items from your cart?')) doClear();
      return;
    }
    Alert.alert('Clear cart?', 'This removes every item from your cart.', [
      { text: 'Keep items', style: 'cancel' },
      { text: 'Clear cart', style: 'destructive', onPress: doClear },
    ]);
  };

  const goHome = () => navigation.navigate('MainTabs', { screen: 'Home' });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Your cart"
        subtitle={totalItems ? `${totalItems} ${totalItems === 1 ? 'item' : 'items'}` : undefined}
        right={items.length ? (
          <TouchableOpacity onPress={confirmClear} hitSlop={10} accessibilityRole="button">
            <Text style={styles.clear}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="bag-handle-outline"
          title="Your cart is empty"
          subtitle="Pick a home kitchen near you and add a few dishes."
          actionText="Browse kitchens"
          onAction={goHome}
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {kitchens.map(([sellerId, kitchen]) => (
              <View key={sellerId} style={styles.card}>
                <TouchableOpacity
                  style={styles.kitchenRow}
                  onPress={() => sellerId !== 'unknown' && navigation.navigate('Restaurant', { sellerId, sellerName: kitchen.name })}
                  accessibilityRole="button"
                >
                  <KitchenMark name={kitchen.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.subheading} numberOfLines={1}>{kitchen.name}</Text>
                    <Text style={type.caption}>Add more from this kitchen</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primaryInk} />
                </TouchableOpacity>

                {kitchen.items.map((item) => {
                  const unit = getCartUnitPrice(item);
                  return (
                    <View key={item.id} style={styles.itemRow}>
                      <VegIndicator isVeg={item.isVeg} size={12} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                        <Text style={type.caption}>{formatPrice(unit)} each</Text>
                      </View>
                      <QuantityStepper
                        quantity={item.quantity}
                        size="sm"
                        onIncrement={() => updateQuantity(item.id, item.quantity + 1)}
                        onDecrement={() => updateQuantity(item.id, item.quantity - 1)}
                      />
                      <Text style={styles.lineTotal}>{formatPrice(unit * item.quantity)}</Text>
                    </View>
                  );
                })}
              </View>
            ))}

            <View style={styles.card}>
              <View style={styles.billRow}>
                <Text style={type.body}>Item total</Text>
                <Text style={styles.billValue}>{formatPrice(totalAmount)}</Text>
              </View>
              <View style={styles.billNote}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={[type.caption, { flex: 1 }]}>
                  Delivery fee and taxes depend on your delivery address and are shown at checkout before you pay.
                </Text>
              </View>
            </View>
          </ScrollView>

          <StickyFooter>
            <View style={styles.footerRow}>
              <View>
                <Text style={type.caption}>Item total</Text>
                <Text style={styles.footerTotal}>{formatPrice(totalAmount)}</Text>
              </View>
              <Button title="Checkout" iconRight="arrow-forward" onPress={() => navigation.navigate('Checkout')} style={{ flex: 1, marginLeft: spacing.lg }} />
            </View>
          </StickyFooter>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  clear: { fontFamily: fonts.bold, fontSize: 14, color: colors.danger },
  scroll: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  kitchenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  itemName: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text },
  lineTotal: { fontFamily: fonts.heavy, fontSize: 14, color: colors.text, minWidth: 58, textAlign: 'right' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billValue: { fontFamily: fonts.heavy, fontSize: 16, color: colors.text },
  billNote: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  footerTotal: { fontFamily: fonts.heavy, fontSize: 18, color: colors.text },
});

export default CartScreen;
