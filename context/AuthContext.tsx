"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AuthUser, UserRole, UserStatus } from "@/types";
import { loginRequest, logoutRequest } from "@/lib/api";
import { persistUser, readPersistedUser, clearPersistedUser } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (
    username: string,
    password: string,
    remember: boolean
  ) => Promise<{ success: boolean; message?: string; user?: AuthUser }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const persisted = readPersistedUser();
    setUser(persisted);
    setIsLoading(false);
  }, []);

  async function login(username: string, password: string, remember: boolean) {
    try {
      const res = await loginRequest(username, password);
      if (res.success) {
        const authUser: AuthUser = {
          username,
          name: res.name || username,
          role: (res.role as UserRole) || "user",
          status: (res.status as UserStatus) || "active",
        };
        setUser(authUser);
        persistUser(authUser, remember);
        return { success: true, user: authUser };
      }
      return { success: false, message: res.message || "Invalid username or password." };
    } catch (err) {
      return {
        success: false,
        message: "Could not reach the server. Please check your connection.",
      };
    }
  }

  function logout() {
    if (user) {
      // Fire-and-forget — don't block navigation on the logging call.
      logoutRequest(user.username);
    }
    clearPersistedUser();
    setUser(null);
    router.replace("/login");
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
