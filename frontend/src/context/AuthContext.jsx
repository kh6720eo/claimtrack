import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/api';

const STORAGE_KEY = 'claimtrack_auth';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [auth]);

  async function login(email, password) {
    const data = await authApi.login({ email, password });
    setAuth(data);
    return data;
  }

  async function register(name, email, password, role) {
    const data = await authApi.register({ name, email, password, role });
    setAuth(data);
    return data;
  }

  function logout() {
    setAuth(null);
  }

  const value = {
    user: auth?.user ?? null,
    token: auth?.token ?? null,
    isAuthenticated: Boolean(auth?.token),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
