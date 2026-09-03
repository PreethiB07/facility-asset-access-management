import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../services/auth.service';
import { setUnauthorizedHandler } from '../services/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<void>;
  loadCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => authApi.getStoredToken());
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    authApi.clearToken();
    setToken(null);
    setUser(null);
  }, []);

  const loadCurrentUser = useCallback(async () => {
    const storedToken = authApi.getStoredToken();
    if (!storedToken) {
      setLoading(false);
      return;
    }

    setToken(storedToken);
    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, [clearAuth]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuth();
    });
    void loadCurrentUser();
  }, [clearAuth, loadCurrentUser]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const result = await authApi.login(email, password);
    authApi.saveToken(result.token);
    setToken(result.token);
    const currentUser = await authApi.me();
    setUser(currentUser);
    return currentUser;
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<void> => {
      await authApi.register(name, email, password);
    },
    [],
  );

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      loading,
      login,
      logout,
      register,
      loadCurrentUser,
    }),
    [user, token, loading, login, logout, register, loadCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function useIsManagerOrAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === 'MANAGER' || user?.role === 'ADMIN';
}

export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === 'ADMIN';
}
