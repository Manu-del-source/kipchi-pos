import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const usePOSStore = create(
  persist(
    (set, get) => ({
      cart: [],
      customer: null,
      discount: 0,
      
      addToCart: (product) => {
        const cart = get().cart;
        const index = cart.findIndex(item => item.id === product.id);
        
        if (index > -1) {
          const newCart = [...cart];
          newCart[index].quantity += 1;
          newCart[index].subtotal = (parseFloat(newCart[index].unit_price) * newCart[index].quantity).toFixed(2);
          set({ cart: newCart });
        } else {
          set({ cart: [...cart, {
            id: product.id,
            product: product.id,
            name: product.name,
            unit_price: product.price,
            quantity: 1,
            subtotal: parseFloat(product.price).toFixed(2)
          }] });
        }
      },

      removeFromCart: (productId) => {
        set({ cart: get().cart.filter(item => item.id !== productId) });
      },

      updateQuantity: (productId, delta) => {
        const newCart = get().cart.map(item => {
          if (item.id === productId) {
            const newQty = Math.max(1, item.quantity + delta);
            return {
              ...item,
              quantity: newQty,
              subtotal: (parseFloat(item.unit_price) * newQty).toFixed(2)
            };
          }
          return item;
        });
        set({ cart: newCart });
      },

      setCustomer: (customer) => set({ customer }),
      setDiscount: (discount) => set({ discount }),
      clearCart: () => set({ cart: [], customer: null, discount: 0 }),
      
      getTotal: () => {
        const subtotal = get().cart.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
        return (subtotal - get().discount).toFixed(2);
      }
    }),
    { name: 'kipchi-cart-storage' }
  )
);
