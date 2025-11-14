/**
 * Authentication Store using Zustand
 * Manages auth state, user session, and token storage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth, type User } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await auth.login({
            email,
            password,
            interface: 'sentient',
          });

          const { token, user } = response;

          // Store token in localStorage
          localStorage.setItem('sentient_auth_token', token);
          localStorage.setItem('sentient_user', JSON.stringify(user));

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.message ||
            error.message ||
            'Login failed. Please check your credentials.';

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });

          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });

        try {
          await auth.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear local storage
          localStorage.removeItem('sentient_auth_token');
          localStorage.removeItem('sentient_user');

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
        localStorage.setItem('sentient_user', JSON.stringify(user));
      },

      setToken: (token: string) => {
        set({ token, isAuthenticated: true });
        localStorage.setItem('sentient_auth_token', token);
      },

      clearError: () => {
        set({ error: null });
      },

      refreshUser: async () => {
        try {
          const user = await auth.getCurrentUser();
          set({ user });
          localStorage.setItem('sentient_user', JSON.stringify(user));
        } catch (error) {
          console.error('Failed to refresh user:', error);
          // If refresh fails, user might need to re-login
          get().logout();
        }
      },
    }),
    {
      name: 'sentient-auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
