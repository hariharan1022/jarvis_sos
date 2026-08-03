import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EmergencyProvider } from './contexts/EmergencyContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { UserDashboard } from './pages/UserDashboard';
import { GuardianDashboard } from './pages/GuardianDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

// Protected Route wrapper
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080d] flex items-center justify-center text-cyan-400 font-bold uppercase tracking-widest text-xs">
        Booting SafeNova Shell...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <EmergencyProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Public Tracking Link (No login needed so family can access instantly in a crisis) */}
            <Route path="/guardian" element={<GuardianDashboard />} />

            {/* Protected User Dashboard */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <UserDashboard />
                </ProtectedRoute>
              } 
            />

            {/* Protected Admin Control Desk */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />

            {/* Fallbacks */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </EmergencyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
