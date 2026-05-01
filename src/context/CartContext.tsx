import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
          setItems(parsedCart);
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

  const addToCart = React.useCallback((newItem: Omit<CartItem, 'quantity'>) => {
    console.log('[CartContext] addToCart called with:', newItem);
    setItems(currentItems => {
      const existingItem = currentItems.find(item => item.id === newItem.id);
      
      if (existingItem) {
        // Update quantity if item already exists
        return currentItems.map(item =>
          item.id === newItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Add new item
        return [...currentItems, { ...newItem, quantity: 1 }];
      }
    });
  }, []);

  const removeFromCart = React.useCallback((itemId: string) => {
    setItems(currentItems => currentItems.filter(item => item.id !== itemId));
  }, []);

  const updateQuantity = React.useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setItems(currentItems =>
      currentItems.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  }, [removeFromCart]);

  const clearCart = React.useCallback(() => {
    setItems([]);
  }, []);

  const getItemQuantity = React.useCallback((itemId: string): number => {
    const item = items.find(item => item.id === itemId);
    return item ? item.quantity : 0;
  }, [items]);

  const totalItems = Array.isArray(items) ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;
  const totalAmount = Array.isArray(items) ? items.reduce((sum, item) => {
    const price = item.discountPrice || item.price;
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