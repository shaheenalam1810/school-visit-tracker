"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

type ToastType = "success" | "error";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const showSuccess = useCallback((message: string) => push("success", message), [push]);
  const showError = useCallback((message: string) => push("error", message), [push]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm animate-toast-in flex items-start gap-3 rounded-xl2 border px-4 py-3 shadow-card ${
              t.type === "success"
                ? "bg-white border-emerald-200"
                : "bg-white border-red-200"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            )}
            <p className="flex-1 text-sm font-body text-ink-800">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              aria-label="Dismiss notification"
              className="text-ink-300 hover:text-ink-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
