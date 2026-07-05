import { AuthUser } from "@/types";

const STORAGE_KEY = "svt_auth_user";
const REMEMBER_KEY = "svt_remember";

/**
 * Persists the logged-in user. When "remember" is true the session
 * survives a browser restart (localStorage); otherwise it only
 * survives the current tab session (sessionStorage).
 */
export function persistUser(user: AuthUser, remember: boolean) {
  const value = JSON.stringify(user);
  if (remember) {
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.setItem(REMEMBER_KEY, "true");
    sessionStorage.removeItem(STORAGE_KEY);
  } else {
    sessionStorage.setItem(STORAGE_KEY, value);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }
}

export function readPersistedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      return JSON.parse(local) as AuthUser;
    } catch {
      return null;
    }
  }
  const session = sessionStorage.getItem(STORAGE_KEY);
  if (session) {
    try {
      return JSON.parse(session) as AuthUser;
    } catch {
      return null;
    }
  }
  return null;
}

export function clearPersistedUser() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}
