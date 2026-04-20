import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { db, queueSaleOffline } from '../services/db';
import toast from 'react-hot-toast';

const POS = () => {
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('pos_cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [barcode, setBarcode] = useState('');
  const [total, setTotal] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [showReceipt, setShowReceipt] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const barcodeRef = useRef(null);

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    const newTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    setTotal(newTotal);
    localStorage.setItem('pos_cart', JSON.stringify(cart));
    barcodeRef.current?.focus();
  }, [cart]);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!barcode) return;

    let product = await db.products.where('barcode').equals(barcode).first();

    if (!product) {
      if (!isOnline) {
        toast.error('Product not in local DB and you are offline!');
        setBarcode('');
        return;
      }
      try {
        const res = await api.get(`/inventory/products/${barcode}`);
        product = res.data;
      } catch (err) {
        toast.error('Product not found!');
        setBarcode('');
        return;
      }
    }

    const existing = cart.find(i => i.id === product.id);
    if (existing) {
      setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    setBarcode('');
    toast.success(`${product.name} added`);
  };

  const handleCustomerSearch = async (e) => {
    e.preventDefault();
    if (!customerSearch) return;
    try {
      const res = await api.get(`/customers/${customerSearch}`);
      setSelectedCustomer(res.data);
      toast.success(`Customer: ${res.data.name}`);
      setCustomerSearch('');
    } catch (err) {
      toast.error('Customer not found');
    }
  };

  const redeemLoyaltyPoints = () => {
    if (!selectedCustomer) return;
    const pointsToRedeem = 10;
    const discountAmount = 10; // 1 point = 1 KES

    if (selectedCustomer.loyaltyPoints < pointsToRedeem) {
      toast.error('Not enough points');
      return;
    }

    if (total < discountAmount) {
      toast.error('Order total is less than discount');
      return;
    }

    setLoyaltyDiscount(prev => prev + discountAmount);
    setSelectedCustomer({
      ...selectedCustomer,
      loyaltyPoints: selectedCustomer.loyaltyPoints - pointsToRedeem
    });
    toast.success('Discount applied!');
  };

  const validatePhone = (phone) => {
    const regex = /^(2547|2541|07|01)\d{8}$/;
    return regex.test(phone);
  };

  const handleCheckout = async (method) => {
    if (cart.length === 0) return;

    let phone = '';
    if (method === 'MPESA') {
      if (!isOnline) {
        toast.error('M-Pesa requires an internet connection!');
        return;
      }
      phone = prompt('Enter M-Pesa Phone Number (e.g. 254712345678):');
      if (!phone) return;
      if (!validatePhone(phone)) {
        toast.error('Invalid Safaricom phone number!');
        return;
      }
      // Normalize phone
      if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    }

    setIsProcessing(true);
    const finalTotal = total - loyaltyDiscount;
    const saleData = {
      items: cart.map(i => ({ productId: i.id, quantity: i.quantity, unitPrice: i.price, subtotal: i.price * i.quantity, name: i.name })),
      total: finalTotal,
      paymentMethod: method,
      tax: finalTotal * 0.16,
      discount: loyaltyDiscount,
      customerId: selectedCustomer?.id || null
    };

    if (isOnline) {
      const loadingToast = toast.loading('Processing sale...');
      try {
        // If we have points redemption, tell the backend to deduct them
        if (loyaltyDiscount > 0 && selectedCustomer) {
           await api.post(`/customers/${selectedCustomer.id}/redeem`, { points: loyaltyDiscount });
        }

        const saleRes = await api.post('/sales', saleData);
        toast.dismiss(loadingToast);

        if (method === 'MPESA') {
          const mpesaRes = await api.post('/payments/mpesa/stkpush', {
            phoneNumber: phone || selectedCustomer?.phone,
            amount: finalTotal,
            saleId: saleRes.data.id
          });
          pollMpesaStatus(mpesaRes.data.CheckoutRequestID, { ...saleData, saleNumber: saleRes.data.saleNumber });
        } else {
          toast.success('Sale completed!');
          setShowReceipt({ ...saleData, saleNumber: saleRes.data.saleNumber });
          setCart([]);
          setSelectedCustomer(null);
          setLoyaltyDiscount(0);
          setIsProcessing(false);
        }
      } catch (err) {
        toast.dismiss(loadingToast);
        console.error(err);
        const errorMsg = err.response?.data?.message || 'Server error';
        if (errorMsg.includes('stock')) {
           toast.error(errorMsg);
           setIsProcessing(false);
        } else {
           await queueSaleOffline(saleData);
           toast.error('Connection failed. Sale queued offline.');
           setCart([]);
           setSelectedCustomer(null);
           setLoyaltyDiscount(0);
           setIsProcessing(false);
        }
      }
    } else {
      await queueSaleOffline(saleData);
      toast.success('Offline sale saved!');
      setCart([]);
      setSelectedCustomer(null);
      setLoyaltyDiscount(0);
      setIsProcessing(false);
    }
    };
    const pollMpesaStatus = async (checkoutRequestId, saleInfo) => {
    setPaymentStatus('Waiting for M-Pesa pin...');
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/payments/mpesa/status/${checkoutRequestId}`);
        attempts++;

        if (res.data.ResultCode === '0') {
          clearInterval(interval);
          setPaymentStatus(null);
          toast.success('Payment Received!');
          setShowReceipt(saleInfo);
          setCart([]);
          setSelectedCustomer(null);
          setIsProcessing(false);
        } else if (res.data.ResultCode && res.data.ResultCode !== '0') {
          clearInterval(interval);
          setPaymentStatus(null);
          toast.error(`Payment failed: ${res.data.ResultDesc}`);
          setIsProcessing(false);
        }
        if (attempts > 12) {
          clearInterval(interval);
          setPaymentStatus(null);
          toast.error('M-Pesa timed out. Please verify manually.');
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden relative">
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-center text-xs py-1 z-50">
          OFFLINE MODE - Sales will be synced when connection is restored
        </div>
      )}

      {/* Product Scanner & Cart */}
      <div className="flex-1 p-4 bg-white shadow-inner flex flex-col">
        {/* Customer Search */}
        <div className="mb-4 flex items-center space-x-2">
          {!selectedCustomer ? (
            <form onSubmit={handleCustomerSearch} className="flex-grow flex space-x-2">
              <input
                type="text"
                placeholder="Search Customer by Phone..."
                className="flex-grow p-2 border rounded focus:ring-2 focus:ring-blue-500"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded">Search</button>
            </form>
          ) : (
            <div className="flex-grow flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-200">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-blue-800">👤 {selectedCustomer.name}</span>
                <span className="text-sm bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">⭐ {selectedCustomer.loyaltyPoints} pts</span>
              </div>
              <div className="flex items-center space-x-2">
                {selectedCustomer.loyaltyPoints >= 10 && (
                   <button 
                     onClick={() => redeemLoyaltyPoints()}
                     className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold hover:bg-yellow-600"
                   >
                     Redeem 10pts (KES 10)
                   </button>
                )}
                <button onClick={() => setSelectedCustomer(null)} className="text-red-500 text-sm hover:underline">Change</button>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleScan} className="mb-4">
          <input
            ref={barcodeRef}
            disabled={isProcessing}
            className="w-full p-4 border-2 border-blue-600 rounded-lg text-2xl focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:bg-gray-100"
            placeholder="Scan Barcode (e.g. 111111)"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            autoFocus
          />
        </form>

        <div className="flex-grow overflow-y-auto border rounded bg-gray-50">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                <th className="p-3 border-b">Item</th>
                <th className="p-3 border-b text-center">Qty</th>
                <th className="p-3 border-b text-right">Price</th>
                <th className="p-3 border-b text-right">Subtotal</th>
                <th className="p-3 border-b text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-white transition">
                  <td className="p-3 font-medium">{item.name}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center space-x-2">
                       <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: Math.max(1, i.quantity - 1)} : i))} className="px-2 bg-gray-200 rounded">-</button>
                       <span>{item.quantity}</span>
                       <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i))} className="px-2 bg-gray-200 rounded">+</button>
                    </div>
                  </td>
                  <td className="p-3 text-right">{item.price}</td>
                  <td className="p-3 text-right font-bold">{(item.price * item.quantity).toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-500 hover:text-red-700">Remove</button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                   <td colSpan="5" className="p-10 text-center text-gray-400">Cart is empty. Start scanning!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Checkout Sidebar */}
      <div className="w-96 bg-gray-100 p-6 flex flex-col justify-between border-l">
        <div>
          <h2 className="text-2xl font-bold mb-4 flex justify-between items-center">
             Summary
             <span className={`text-xs px-2 py-1 rounded ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isOnline ? 'Online' : 'Offline'}
             </span>
          </h2>
          <div className="flex justify-between text-xl mb-2 text-gray-600">
            <span>Subtotal (incl. tax):</span>
            <span>KES {total.toFixed(2)}</span>
          </div>
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between text-xl mb-2 text-green-600 font-bold">
              <span>Loyalty Discount:</span>
              <div className="flex items-center space-x-2">
                <span>- KES {loyaltyDiscount.toFixed(2)}</span>
                <button onClick={() => {
                  setLoyaltyDiscount(0);
                  // Refresh customer points if we had deducted them locally
                  toast('Discount removed');
                }} className="text-red-500 text-xs">✕</button>
              </div>
            </div>
          )}
          <hr className="my-4" />
          <div className="flex justify-between text-3xl font-black text-blue-900">
            <span>TOTAL:</span>
            <span>KES {(total - loyaltyDiscount).toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-4">
          {paymentStatus && (
            <div className={`bg-yellow-100 text-yellow-800 p-3 rounded-lg text-center font-bold ${isProcessing ? 'animate-pulse' : ''}`}>
              {paymentStatus}
            </div>
          )}
          
          <button
            onClick={() => handleCheckout('CASH')}
            disabled={isProcessing || cart.length === 0}
            className="w-full bg-green-600 text-white py-5 rounded-xl text-xl font-bold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-lg active:scale-95"
          >
            {isProcessing && !paymentStatus ? 'Processing...' : '💵 Cash Payment'}
          </button>

          <button
            onClick={() => handleCheckout('MPESA')}
            disabled={isProcessing || cart.length === 0 || !isOnline}
            className="w-full bg-blue-500 text-white py-5 rounded-xl text-xl font-bold hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-lg active:scale-95"
          >
            {isProcessing && paymentStatus ? 'Waiting...' : '📱 M-Pesa STK'}
          </button>

          <button
            onClick={() => {
              setCart([]);
              toast('Cart cleared', { icon: '🗑️' });
            }}
            disabled={isProcessing || cart.length === 0}
            className="w-full bg-red-100 text-red-600 py-3 rounded-xl font-bold hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Clear Cart
          </button>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">✅</div>
              <h3 className="text-2xl font-bold text-gray-900">Sale Complete</h3>
              <p className="text-gray-500">Order #{showReceipt.saleNumber}</p>
            </div>

            <div className="border-t border-b border-dashed py-4 mb-4">
              {showReceipt.items.map((item, i) => (
                <div key={i} className="flex justify-between mb-1 text-sm">
                  <span>{item.name} x{item.quantity}</span>
                  <span>KES {(item.unitPrice * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-xl font-bold text-gray-900 mb-6">
              <span>Total Paid ({showReceipt.paymentMethod}):</span>
              <span>KES {showReceipt.total.toFixed(2)}</span>
            </div>

            <button
              onClick={() => {
                setShowReceipt(null);
                barcodeRef.current?.focus();
              }}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition"
            >
              Done & Next Customer
            </button>
            <button
              onClick={() => window.print()}
              className="w-full mt-2 text-blue-600 py-2 font-medium hover:underline"
            >
              Print Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
