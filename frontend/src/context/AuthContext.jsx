import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken as persistToken } from "../lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      persistToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = (data) => { persistToken(data.token); setUser(data.user); };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* noop */ }
    persistToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, loading, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
