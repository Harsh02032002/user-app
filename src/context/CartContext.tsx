import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

/**
 * Unit price the backend charges (services/order-pricing.service.js → getUnitPrice):
 * the discount price only when it is a real discount, otherwise the selling price.
 */
export const getCartUnitPrice = (item: { price: number; discountPrice?: number }) => {
  const price = Number(item.price) || 0;
  const discount = Number(item.discountPrice) || 0;
  return discount > 0 && discount < price ? discount : price;
};

export interface CartItem {
  id: string;
  /** Product id; differs from `id` only for half/full plate lines added on the website */
  menuItemId?: string;
  selectedSize?: 'half' | 'full';
  name: string;
  price: number;
  discountPrice?: number;
  quantity: number;
  image: string;
  sellerId: string;
  sellerName: string;
  isVeg: boolean;
  description?: string;
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getItemQuantity: (itemId: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Server cart (GET/PUT /api/user/cart) is shared with the website
const toServerCart = (items: CartItem[]) => ({
  sellerId: items.find(i => !!i.sellerId)?.sellerId || null,
  items: items.map(i => ({ menuItemId: i.menuItemId || i.id, quantity: i.quantity, selectedSize: i.selectedSize || null })),
});

const fromServerCart = (data: any): CartItem[] =>
  (Array.isArray(data?.items) ? data.items : [])
    .filter((i: any) => i?.menuItem?._id)
    .map((i: any) => {
      const p = i.menuItem;
      const size: 'half' | 'full' | undefined = i.selectedSize === 'half' || i.selectedSize === 'full' ? i.selectedSize : undefined;
      const sizePrice = Number(size === 'half' ? p.halfPlatePrice : size === 'full' ? p.fullPlatePrice : 0) || 0;
      return {
        id: size ? `${p._id}_${size}` : String(p._id),
        menuItemId: String(p._id),
        selectedSize: size,
        name: size ? `${p.name} (${size === 'half' ? 'Half' : 'Full'} Plate)` : p.name,
        price: sizePrice > 0 ? sizePrice : Number(p.sellingPrice) || 0,
        discountPrice: sizePrice > 0 ? undefined : p.discountPrice,
        quantity: i.quantity,
        image: p.image || '',
        sellerId: String(data.sellerId || p.sellerId || ''),
        sellerName: data.sellerName || 'Restaurant',
        isVeg: !!p.isVeg,
        description: p.description || '',
      };
    });

const sameCart = (a: CartItem[], b: CartItem[]) => JSON.stringify(toServerCart(a)) === JSON.stringify(toServerCart(b));

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load cart from storage on app start
  useEffect(() => {
    loadCart();
  }, []);

  const { token } = useAuth();
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const prevTokenRef = useRef(token);
  // Token whose server cart has been loaded; local changes are pushed only after that
  const syncedTokenRef = useRef<string | null>(null);
  const skipPushRef = useRef(false);
  const pendingPushRef = useRef(false);

  const applyRemoteCart = React.useCallback((next: CartItem[]) => {
    if (sameCart(next, itemsRef.current)) return;
    skipPushRef.current = true;
    setItems(next);
  }, []);

  const pullServerCart = React.useCallback(async (authToken: string, isLogin: boolean) => {
    try {
      const res: any = await api.user.getCart();
      const server = fromServerCart(res?.data);
      if (server.length > 0 || !isLogin) {
        applyRemoteCart(server);
      } else if (itemsRef.current.length > 0) {
        // Server empty at login: keep what was added before logging in
        api.user.saveCart(toServerCart(itemsRef.current)).catch(() => {});
      }
      syncedTokenRef.current = authToken;
    } catch (error: any) {
      console.warn('[CartContext] Failed to load server cart:', error?.message);
    }
  }, [applyRemoteCart]);

  // Load the account's cart on login (once local storage is read); drop it on logout
  useEffect(() => {
    if (!isInitialized) return;
    const prevToken = prevTokenRef.current;
    prevTokenRef.current = token;
    if (!token) {
      syncedTokenRef.current = null;
      if (prevToken) applyRemoteCart([]);
      return;
    }
    pullServerCart(token, true);
  }, [token, isInitialized]);

  // Pick up changes made on the website when the app comes back to the foreground
  useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' || pendingPushRef.current) return;
      pullServerCart(token, syncedTokenRef.current !== token);
    });
    return () => sub.remove();
  }, [token, pullServerCart]);

  // Save cart to storage whenever items change (after initialization), and to the server when logged in
  useEffect(() => {
    if (!isInitialized) return;
    saveCart();
    if (skipPushRef.current) {
      skipPushRef.current = false;
      return;
    }
    if (!token || syncedTokenRef.current !== token) return;
    pendingPushRef.current = true;
    const timer = setTimeout(() => {
      api.user.saveCart(toServerCart(items))
        .catch((error: any) => console.warn('[CartContext] Failed to save server cart:', error?.message))
        .finally(() => { pendingPushRef.current = false; });
    }, 400);
    return () => {
      clearTimeout(timer);
      pendingPushRef.current = false;
    };
  }, [items, isInitialized]);

  const loadCart = React.useCallback(async () => {
    try {
      const savedCart = await AsyncStorage.getItem('cart');
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        if (Array.isArray(parsedCart)) {
          const normalized = parsedCart.map((item: any, idx: number) => ({
            ...item,
            id: String(item.id || item._id || item.menuItemId || item.name || idx),
          }));
          setItems(normalized);
        } else {
          setItems([]);
        }
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const saveCart = React.useCallback(async () => {
    try {
      await AsyncStorage.setItem('cart', JSON.stringify(items));
      console.log('[CartContext] Cart saved:', items.length, 'items');
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  }, [items]);

  const addToCart = React.useCallback((newItem: any, argSellerId?: any, argSellerName?: string) => {
    console.log('[CartContext] addToCart called with:', newItem);
    const resolvedId = String(newItem?.id || newItem?._id || newItem?.menuItemId || newItem?.name || Date.now());
    const rawSeller = argSellerId || newItem?.sellerId;
    const resolvedSellerId = (typeof rawSeller === 'object' ? rawSeller?._id : rawSeller) || '';
    const resolvedSellerName = argSellerName || (typeof rawSeller === 'object' ? rawSeller?.businessName : '') || newItem?.sellerName || 'Restaurant';

    const normalizedItem: CartItem = {
      id: resolvedId,
      name: newItem?.name || '',
      price: newItem?.sellingPrice || newItem?.price || 0,
      discountPrice: newItem?.discountPrice,
      quantity: 1,
      image: newItem?.image || '',
      sellerId: String(resolvedSellerId),
      sellerName: resolvedSellerName,
      isVeg: !!newItem?.isVeg,
      description: newItem?.description || '',
    };

    setItems(currentItems => {
      // Prevent mixing dishes from two different restaurants/sellers
      if (currentItems.length > 0 && normalizedItem.sellerId) {
        const existingSellerId = currentItems[0].sellerId;
        if (existingSellerId && existingSellerId !== normalizedItem.sellerId) {
          const existingSellerName = currentItems[0].sellerName || 'your current restaurant';
          Alert.alert(
            'Replace cart items?',
            `Your cart contains dishes from "${existingSellerName}". An order can only be placed from one restaurant at a time. Do you want to discard your current cart and add items from "${normalizedItem.sellerName}"?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Replace Items',
                style: 'destructive',
                onPress: () => setItems([normalizedItem]),
              },
            ]
          );
          return currentItems;
        }
      }

      const existingItem = currentItems.find(item => String(item.id || (item as any)._id) === normalizedItem.id);
      
      if (existingItem) {
        // Update quantity if item already exists
        return currentItems.map(item =>
          String(item.id || (item as any)._id) === normalizedItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Add new item
        return [...currentItems, normalizedItem];
      }
    });
  }, []);

  const removeFromCart = React.useCallback((itemId: string) => {
    const targetId = String(itemId);
    setItems(currentItems =>
      currentItems.filter(item => {
        const currentId = String(item.id || (item as any)._id || (item as any).menuItemId || item.name);
        return currentId !== targetId;
      })
    );
  }, []);

  const updateQuantity = React.useCallback((itemId: string, quantity: number) => {
    const targetId = String(itemId);
    if (quantity <= 0) {
      removeFromCart(targetId);
      return;
    }

    setItems(currentItems =>
      currentItems.map(item => {
        const currentId = String(item.id || (item as any)._id || (item as any).menuItemId || item.name);
        return currentId === targetId ? { ...item, quantity } : item;
      })
    );
  }, [removeFromCart]);

  const clearCart = React.useCallback(() => {
    setItems([]);
  }, []);

  const getItemQuantity = React.useCallback((itemId: string): number => {
    const targetId = String(itemId);
    const item = items.find(i => String(i.id || (i as any)._id || (i as any).menuItemId) === targetId);
    return item ? item.quantity : 0;
  }, [items]);

  const totalItems = Array.isArray(items) ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;
  const totalAmount = Array.isArray(items) ? items.reduce((sum, item) => {
    const price = getCartUnitPrice(item);
    return sum + (price * item.quantity);
  }, 0) : 0;

  const value = React.useMemo(() => ({
    items,
    totalItems,
    totalAmount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getItemQuantity,
  }), [items, totalItems, totalAmount, addToCart, removeFromCart, updateQuantity, clearCart, getItemQuantity]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};