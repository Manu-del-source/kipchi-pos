import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/dashboard', { params: dateRange });
      setStats(res.data);
    } catch (err) {
      toast.error('Failed to load dashboard stats');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  if (loading && !stats) return <div className="p-8 text-center">Loading reports...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
        <div className="flex space-x-4 bg-white p-2 rounded-lg shadow-sm">
          <input 
            type="date" 
            className="border-none focus:ring-0"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
          />
          <span className="text-gray-400">to</span>
          <input 
            type="date" 
            className="border-none focus:ring-0"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Revenue</p>
          <h2 className="text-3xl font-black text-blue-600">KES {Number(stats?.summary?.totalRevenue || 0).toLocaleString()}</h2>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Transactions</p>
          <h2 className="text-3xl font-black text-green-600">{stats?.summary?.totalTransactions || 0}</h2>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Avg. Sale Value</p>
          <h2 className="text-3xl font-black text-purple-600">
            KES {stats?.summary?.totalTransactions > 0 
              ? (stats.summary.totalRevenue / stats.summary.totalTransactions).toLocaleString(undefined, {maximumFractionDigits: 0}) 
              : 0}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Popular Items */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Top 5 Selling Items</h3>
          <div className="space-y-4">
            {stats?.popularItems?.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-gray-700 font-medium">{item.name}</span>
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                  {item.quantity} sold
                </span>
              </div>
            ))}
            {stats?.popularItems?.length === 0 && <p className="text-gray-400 text-center py-4">No data available</p>}
          </div>
        </div>

        {/* Daily Sales Trend (Simple List) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Sales Trend</h3>
          <div className="overflow-y-auto max-h-64">
             <table className="w-full">
               <thead>
                 <tr className="text-left text-gray-400 text-xs uppercase">
                   <th className="pb-2">Date</th>
                   <th className="pb-2 text-right">Revenue</th>
                 </tr>
               </thead>
               <tbody>
                 {stats?.salesTrend?.map((day, i) => (
                   <tr key={i} className="border-t border-gray-50">
                     <td className="py-2 text-gray-600">{day.date}</td>
                     <td className="py-2 text-right font-bold text-gray-800">KES {day.total.toLocaleString()}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
