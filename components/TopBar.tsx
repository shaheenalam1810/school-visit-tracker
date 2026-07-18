"use client";

import { memo } from "react";
import { ArrowLeft, LogOut, School } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface TopBarProps {
  title: string;
  showBack?: boolean;
}

function TopBar({ title, showBack = false }: TopBarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-50 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-50 text-ink-700 active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-white">
              <School className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="font-display text-lg font-bold leading-none text-ink-900">{title}</h1>
            {user && <p className="mt-0.5 text-xs font-body text-ink-400">{user.name}</p>}
          </div>
        </div>
        {!showBack && (
          <button
            onClick={logout}
            aria-label="Log out"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-50 text-ink-700 active:scale-95"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}

export default memo(TopBar);
