
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import api from "../api/axios";

type AuthContextType = {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
  isChecking: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        let token = sessionStorage.getItem("accessToken");

        if (!token) {
          const { data } = await api.post<{ accessToken: string }>(
            "/auth/refresh"
          );
          token = data.accessToken;
          sessionStorage.setItem("accessToken", token);
        }

        await api.get("/profile");
        setIsAuthenticated(true);
      } catch {
        sessionStorage.removeItem("accessToken");
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    }

    void checkSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, setIsAuthenticated, isChecking }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}