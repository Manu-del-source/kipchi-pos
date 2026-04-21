import React, { useState, useEffect } from 'react';
import { usePOSStore } from '../store/posStore';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ShoppingCart, User, CreditCard, Smartphone, Trash2, Plus, Minus } from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5001');

const POS = () => {
  useBarcodeScanner();
  const { cart, customer, setCustomer, updateQuantity, removeFromCart, getTotal, clearCart } = usePOSStore();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    socket.on('payment_completed', (data) => {
      if (data.status === 'SUCCESS') {
        toast.success(`Payment Successful for Sale ${data.saleId}!`);
        clearCart();
      } else {
        toast.error(`Payment Failed for Sale ${data.saleId}`);
      }
    });

    return () => {
      socket.off('payment_completed');
    };
  }, [clearCart]);

  const handleMpesa = async () => {
    if (!customer && !phone) return toast.error('Enter customer phone');
    setLoading(true);
    try {
      const amount = getTotal();
      const phoneNumber = customer?.phone || phone;
      // Trigger Node.js Real-time Service
      await api.post('http://localhost:5001/api/realtime/mpesa/stkpush', {
        phoneNumber,
        amount,
        saleId: `SALE-${Date.now()}`
      });
      toast.success('STK Push Sent!');
    } catch (err) {
      toast.error('Payment Failed');
    } finally {
      setLoading(false);
    }
  };

  const completeSale = async (method) => {
    setLoading(true);
    try {
      const saleData = {
        sale_number: `SALE-${Date.now()}`,
        customer: customer?.id,
        total_amount: getTotal(),
        tax_amount: (getTotal() * 0.16).toFixed(2), // 16% VAT
        payment_method: method,
        items: cart.map(item => ({
          product: item.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal
        }))
      };

      await api.post('/sales/', saleData);
      toast.success('Sale Completed!');
      clearCart();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100-64px)] overflow-hidden">
      {/* Left: Cart Area */}
      <div className="flex-grow p-4 overflow-y-auto bg-white border-r">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center">
            <ShoppingCart className="mr-2" /> Current Order
          </h2>
          <button onClick={clearCart} className="text-red-500 hover:text-red-700">Clear All</button>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <ShoppingCart size={48} className="mb-2" />
            <p>Ready to scan products...</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-gray-500 text-sm">
                <th className="py-2">Product</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-4 font-medium">{item.name}</td>
                  <td>KES {item.unit_price}</td>
                  <td>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded bg-gray-100"><Minus size={14}/></button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 rounded bg-gray-100"><Plus size={14}/></button>
                    </div>
                  </td>
                  <td className="font-bold">KES {item.subtotal}</td>
                  <td>
                    <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Right: Summary & Payment */}
      <div className="w-96 p-6 bg-gray-50 flex flex-col shadow-inner">
        <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border">
          <label className="block text-sm text-gray-500 mb-2 flex items-center">
            <User size={14} className="mr-1"/> Customer (Optional)
          </label>
          <input 
            type="text" 
            placeholder="Search phone (e.g. 07...)"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="mt-auto space-y-4">
          <div className="flex justify-between text-lg">
            <span>Subtotal</span>
            <span>KES {getTotal()}</span>
          </div>
          <div className="flex justify-between text-2xl font-bold text-blue-600 border-t pt-4">
            <span>TOTAL</span>
            <span>KES {getTotal()}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-4">
            <button 
              disabled={loading || cart.length === 0}
              onClick={handleMpesa}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center hover:bg-green-700 transition disabled:opacity-50"
            >
              <Smartphone className="mr-2" /> M-PESA STK PUSH
            </button>
            <button 
              disabled={loading || cart.length === 0}
              onClick={() => completeSale('CASH')}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center hover:bg-blue-700 transition disabled:opacity-50"
            >
              <CreditCard className="mr-2" /> CASH PAYMENT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POS;
