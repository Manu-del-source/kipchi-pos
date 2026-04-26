import { create } from 'zustand';

export const usePOSStore = create((set, get) => ({
  cart: [],
  addToCart: (product) => {
    const { cart } = get();
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      set({
        cart: cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        )
      });
    } else {
      set({
        cart: [...cart, { ...product, quantity: 1, subtotal: product.price }]
      });
    }
  },
  updateQuantity: (id, delta) => {
    const { cart } = get();
    set({
      cart: cart.map(item => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty, subtotal: newQty * item.price };
        }
        return item;
      })
    });
  },
  removeFromCart: (id) => {
    set({ cart: get().cart.filter(item => item.id !== id) });
  },
  getTotal: () => {
    return get().cart.reduce((sum, item) => sum + item.subtotal, 0);
  },
  clearCart: () => set({ cart: [] })
}));
