import React, { createContext, useContext, useState, useEffect } from 'react';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('safenova_admin_token') || null);
  const [loading, setLoading] = useState(true);

  const API_URL = 'http://127.0.0.1:8000/api';

  useEffect(() => {
    if (adminToken) {
      fetchAdminProfile(adminToken);
    } else {
      setLoading(false);
    }
  }, [adminToken]);

  const fetchAdminProfile = async (token) => {
    try {
      const res = await fetch(`${API_URL}/admin/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const adminData = await res.json();
        setAdmin(adminData);
      } else {
        // Token expired/invalid or not an admin
        adminLogout();
      }
    } catch (err) {
      console.error('Error fetching admin profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const adminLogin = async (email, password) => {
    const res = await fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || 'Login failed');
    }
    
    const data = await res.json();
    localStorage.setItem('safenova_admin_token', data.access_token);
    setAdminToken(data.access_token);
    setAdmin(data.user);
    return data.user;
  };

  const adminLogout = async () => {
    try {
      if (adminToken) {
        await fetch(`${API_URL}/admin/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      localStorage.removeItem('safenova_admin_token');
      setAdminToken(null);
      setAdmin(null);
    }
  };

  return (
    <AdminAuthContext.Provider value={{ admin, adminToken, loading, adminLogin, adminLogout, API_URL }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
