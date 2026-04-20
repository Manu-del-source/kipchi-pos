import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import POS from './pages/POS';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import useOfflineSync from './hooks/useOfflineSync';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;
  return children;
};

import { Toaster } from 'react-hot-toast';

function App() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  useOfflineSync(token);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <Router>
      <Toaster position="top-right" />
      <div className="min-h-screen flex flex-col">
        {token && (
          <nav className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-lg">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🛒</span>
              <div className="text-xl font-bold">Kipchi-POS 🇰🇪</div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/" className="hover:bg-blue-700 px-3 py-2 rounded transition">POS</Link>
              <Link to="/inventory" className="hover:bg-blue-700 px-3 py-2 rounded transition">Inventory</Link>
              <Link to="/customers" className="hover:bg-blue-700 px-3 py-2 rounded transition">Customers</Link>
              <Link to="/orders" className="hover:bg-blue-700 px-3 py-2 rounded transition">Orders</Link>
              {user.role === 'ADMIN' && (
                <Link to="/dashboard" className="hover:bg-blue-700 px-3 py-2 rounded transition">Reports</Link>
              )}
              <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 px-3 py-2 rounded transition">
                Logout
              </button>
            </div>
          </nav>
        )}
        <main className="flex-grow bg-gray-50">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><POS /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}


export default App;
