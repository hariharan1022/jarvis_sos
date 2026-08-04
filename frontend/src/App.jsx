import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EmergencyProvider } from './contexts/EmergencyContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { UserDashboard } from './pages/UserDashboard';
import { GuardianDashboard } from './pages/GuardianDashboard';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { AdminRoute } from './components/AdminRoute';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminIncidents } from './pages/admin/AdminIncidents';

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
      <AdminAuthProvider>
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
                <ProtectedRoute allowedRoles={['USER', 'user']}>
                  <UserDashboard />
                </ProtectedRoute>
              } 
            />

            {/* Separate Admin Authentication System */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Protected Admin Shell */}
            <Route path="/admin" element={<AdminRoute requiredRoles={['SUPER_ADMIN', 'ADMIN', 'MODERATOR']} />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="incidents" element={<AdminIncidents />} />
                {/* Placeholders for future pages */}
                <Route path="reports" element={<div className="p-8 text-white">Reports Module (Coming Soon)</div>} />
                <Route path="analytics" element={<div className="p-8 text-white">Analytics Module (Coming Soon)</div>} />
                <Route path="system" element={<div className="p-8 text-white">System Status (Coming Soon)</div>} />
                <Route path="settings" element={<div className="p-8 text-white">Settings Module (Coming Soon)</div>} />
              </Route>
            </Route>

            {/* Fallbacks */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </EmergencyProvider>
      </AuthProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

export default App;
