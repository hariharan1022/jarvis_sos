import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = API_BASE_URL;

  useEffect(() => {
    // Load token from AsyncStorage on startup
    const bootstrapAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('safenova_token');
        if (storedToken) {
          setToken(storedToken);
          await fetchUserProfile(storedToken);
        }
      } catch (e) {
        console.error('Auth bootstrap error:', e);
      } finally {
        setLoading(false);
      }
    };
    bootstrapAuth();
  }, []);

  const fetchUserProfile = async (authToken) => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        await logout();
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || 'Login failed');
    }
    const data = await res.json();
    await AsyncStorage.setItem('safenova_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || 'Registration failed');
    }
    return await res.json();
  };

  const logout = async () => {
    await AsyncStorage.removeItem('safenova_token');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (profileData) => {
    if (!token) return;
    const res = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(profileData)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || 'Failed to update profile');
    }
    const updatedUser = await res.json();
    setUser(updatedUser);
    return updatedUser;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateProfile, API_URL }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
