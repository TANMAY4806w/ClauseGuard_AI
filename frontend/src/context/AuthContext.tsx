import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile } from '../types';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  loginWithEmail: (email: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage on startup
    const storedToken = localStorage.getItem('clauseguard_token');
    const storedUser = localStorage.getItem('clauseguard_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('clauseguard_token');
        localStorage.removeItem('clauseguard_user');
      }
    }
    setIsLoading(false);
  }, []);

  const loginWithEmail = async (email: string) => {
    setIsLoading(true);
    try {
      const data = await apiClient.login(email.trim().toLowerCase(), false);
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('clauseguard_token', data.access_token);
      localStorage.setItem('clauseguard_user', JSON.stringify(data.user));
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsGuest = async () => {
    setIsLoading(true);
    try {
      const randomGuestId = Math.random().toString(36).substring(2, 9);
      const guestEmail = `guest_${randomGuestId}@clauseguard.local`;
      const data = await apiClient.login(guestEmail, true);
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('clauseguard_token', data.access_token);
      localStorage.setItem('clauseguard_user', JSON.stringify(data.user));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('clauseguard_token');
    localStorage.removeItem('clauseguard_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        loginWithEmail,
        loginAsGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
