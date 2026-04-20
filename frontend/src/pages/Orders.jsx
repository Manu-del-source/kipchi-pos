import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales');
      setOrders(res.data);
    } catch (err) {
      toast.error('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Transaction History</h1>
        <button 
          onClick={fetchOrders}
          className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-semibold text-gray-600 text-sm">Order #</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Date</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Total</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Method</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Status</th>
              <th className="p-4 font-semibold text-gray-600 text-sm text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition text-sm">
                <td className="p-4 font-medium text-blue-600">{order.saleNumber}</td>
                <td className="p-4 text-gray-500">{new Date(order.createdAt).toLocaleString()}</td>
                <td className="p-4 font-bold">KES {Number(order.total).toLocaleString()}</td>
                <td className="p-4 text-gray-600">{order.paymentMethod}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {order.paymentStatus}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => setSelectedOrder(order)}
                    className="text-blue-500 hover:underline"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && !loading && (
          <div className="p-10 text-center text-gray-400">No transactions found.</div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            >
              &times;
            </button>
            <h3 className="text-xl font-bold mb-4">Order Details</h3>
            <div className="space-y-2 text-sm">
               <p className="flex justify-between"><strong>Order:</strong> <span>{selectedOrder.saleNumber}</span></p>
               <p className="flex justify-between"><strong>Cashier:</strong> <span>{selectedOrder.cashier?.name}</span></p>
               <p className="flex justify-between"><strong>Date:</strong> <span>{new Date(selectedOrder.createdAt).toLocaleString()}</span></p>
               <hr className="my-4"/>
               <div className="max-h-40 overflow-y-auto">
                 {selectedOrder.items?.map((item, i) => (
                   <div key={i} className="flex justify-between text-gray-600 mb-1">
                     <span>{item.product?.name || 'Item'} x{item.quantity}</span>
                     <span>KES {(item.unitPrice * item.quantity).toFixed(2)}</span>
                   </div>
                 ))}
               </div>
               <hr className="my-4"/>
               <p className="flex justify-between text-lg font-bold"><strong>Total:</strong> <span>KES {Number(selectedOrder.total).toFixed(2)}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
