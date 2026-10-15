import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Save cart to storage whenever items change (after initialization)
  useEffect(() => {
    if (isInitialized) {
      saveCart();
    }
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