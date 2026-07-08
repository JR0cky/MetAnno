import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem("metanno_token");
      if (token) {
        try {
          const userData = await api.getMe();
          setUser(userData);
        } catch (err) {
          console.error("Token verification failed, logging out:", err);
          localStorage.removeItem("metanno_token");
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const data = await api.login(email, password);
      localStorage.setItem("metanno_token", data.access_token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message || "Login failed");
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("metanno_token");
    localStorage.removeItem("metanno_current_project_id");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
