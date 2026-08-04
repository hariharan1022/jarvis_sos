import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { Loader2 } from 'lucide-react';

export const AdminRoute = ({ requiredRoles = [] }) => {
  const { admin, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(admin.role)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-rose-500 text-xl font-bold">
        Access Denied. Insufficient Administrator Privileges.
      </div>
    );
  }

  return <Outlet />;
};
