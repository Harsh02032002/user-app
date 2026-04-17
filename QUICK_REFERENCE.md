# Updated Files - Quick Reference

## Files Modified

### 1. ProfileScreen.tsx
**Location:** `src/screens/tabs/ProfileScreen.tsx`

**Key Changes:**
```typescript
// Added API integration for real data
const [walletRes, ordersRes] = await Promise.all([
  api.user.getWalletTransactions(),
  api.user.getOrders()
]);

// Updated user profile with real data
wallet: walletRes?.data?.balance || 0,
totalOrders: (ordersRes?.orders || []).length,
```

**New Features:**
- Real-time wallet balance
- Actual order count
- Logout functionality
- Bio and address fields

---

### 2. OrdersScreen.tsx
**Location:** `src/screens/tabs/OrdersScreen.tsx`

**Key Changes:**
```typescript
// Added visual progress tracker
const statusSteps = ['pending', 'confirmed', 'preparing', 'out-the-way', 'delivered'];
const currentStep = statusSteps.indexOf(item.status);

// Progress UI with dots and lines
<View style={styles.progressContainer}>
  {statusSteps.map((step, idx) => (...))}
</View>
```

**New Features:**
- Visual order progress tracker
- Rate order button for delivered orders
- Enhanced order card layout
- Better status indicators

---

### 3. WalletScreen.tsx
**Location:** `src/screens/tabs/WalletScreen.tsx`

**Key Changes:**
```typescript
// Added subscription data fetching
const [walletResponse, subResponse] = await Promise.all([
  api.user.getWalletTransactions(),
  api.user.getActiveSubscription()
]);

// Display subscription details
{subscription && subscription.status === 'active' && (
  <View style={styles.subscriptionCard}>
    <Text>Remaining Balance: ₹{subscription.remaining_amount}</Text>
    <Text>Days Left: {subscription.remaining_days}</Text>
  </View>
)}
```

**New Features:**
- Dabba Express subscription section
- Subscription balance and days display
- Enhanced wallet UI
- Better transaction history

---

## API Endpoints Used

### ProfileScreen
- `api.user.getWalletTransactions()` → Wallet balance
- `api.user.getOrders()` → Total orders

### OrdersScreen
- `api.user.getOrders(status?)` → Order history with optional status filter

### WalletScreen
- `api.user.getWalletTransactions()` → Wallet data
- `api.user.getActiveSubscription()` → Subscription details
- `api.user.topupWallet(amount)` → Add money to wallet

---

## Style Updates

### New Styles Added

**OrdersScreen:**
```typescript
progressContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 }
progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#e0e0e0' }
progressDotActive: { backgroundColor: '#FF6B00' }
progressLine: { flex: 1, height: 2, backgroundColor: '#e0e0e0' }
progressLineActive: { backgroundColor: '#FF6B00' }
rateButton: { backgroundColor: '#FFF5F0', borderColor: '#FF6B00' }
```

**WalletScreen:**
```typescript
subscriptionCard: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }
subscriptionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }
subscriptionTitle: { fontSize: 16, fontWeight: '600', color: '#2E7D32' }
subscriptionRow: { flexDirection: 'row', justifyContent: 'space-between' }
```

---

## Testing Commands

```bash
# Run the app
npm start

# Test on Android
npm run android

# Test on iOS
npm run ios

# Clear cache if needed
npm start -- --reset-cache
```

---

## Common Issues & Solutions

### Issue 1: API not returning data
**Solution:** Check if backend is running and API_BASE_URL is correct in `src/services/api.ts`

### Issue 2: Token not found
**Solution:** Make sure user is logged in and token is stored in AsyncStorage

### Issue 3: Subscription not showing
**Solution:** User needs an active subscription. Check backend subscription status.

---

## Color Palette

```typescript
Primary: '#FF6B00'      // Orange - Main brand color
Success: '#4CAF50'      // Green - Subscription, success states
Warning: '#FF9800'      // Orange - Preparing status
Info: '#2196F3'         // Blue - On the way status
Danger: '#FF4444'       // Red - Cancelled, error states
Background: '#fff'      // White
Secondary: '#f5f5f5'    // Light gray
Text: '#1a1a1a'         // Dark gray
Muted: '#666'           // Medium gray
```

---

## File Structure

```
DabbaExpoApp/
├── src/
│   ├── screens/
│   │   └── tabs/
│   │       ├── HomeScreen.tsx ✅ (Already perfect)
│   │       ├── ProfileScreen.tsx ✅ (Updated)
│   │       ├── OrdersScreen.tsx ✅ (Updated)
│   │       ├── WalletScreen.tsx ✅ (Updated)
│   │       ├── SubscriptionScreen.tsx
│   │       └── WishlistScreen.tsx
│   ├── services/
│   │   └── api.ts ✅ (Already configured)
│   └── context/
│       ├── AuthContext.tsx
│       └── CartContext.tsx
├── UPDATES_SUMMARY.md ✅ (New)
└── QUICK_REFERENCE.md ✅ (This file)
```

---

## Next Development Tasks

1. ✅ Profile screen - DONE
2. ✅ Orders screen - DONE
3. ✅ Wallet screen - DONE
4. ⏳ Subscription screen - Needs update
5. ⏳ Wishlist screen - Needs update
6. ⏳ Add real-time order tracking
7. ⏳ Implement payment gateway
8. ⏳ Add push notifications

---

## Contact & Support

For any issues or questions:
- Check backend logs
- Verify API endpoints in Postman
- Test with real user account
- Check AsyncStorage for token
