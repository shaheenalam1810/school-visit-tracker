"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { School, User, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import Input from "@/components/Input";
import Button from "@/components/Button";
import Card from "@/components/Card";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, isLoading, login } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      showError("Please enter both username and password.");
      return;
    }
    setIsSubmitting(true);
    const result = await login(username.trim(), password, remember);
    setIsSubmitting(false);

    if (result.success) {
      showSuccess("Welcome back! Redirecting to your dashboard...");
      router.replace("/dashboard");
    } else {
      showError(result.message || "Login failed. Please try again.");
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-ink-800">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center gap-3 px-6 pb-10 pt-16 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 shadow-cardHover">
          <School className="h-8 w-8 text-ink-900" />
        </div>
        <h1 className="text-center font-display text-2xl font-bold">School Visit Tracker</h1>
        <p className="text-center text-sm font-body text-ink-200">
          Log every campus visit in seconds, synced straight to your team&apos;s sheet.
        </p>
      </div>

      {/* Form card */}
      <div className="flex-1 rounded-t-[2rem] bg-[#F5F7F9] px-5 pb-10 pt-8 animate-slide-up">
        <Card className="mx-auto max-w-md">
          <h2 className="mb-5 font-display text-xl font-bold text-ink-900">Sign in</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Username"
              type="text"
              placeholder="e.g. jane.doe"
              icon={<User className="h-4 w-4" />}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                icon={<Lock className="h-4 w-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-[2.55rem] text-ink-300 hover:text-ink-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <label className="flex items-center gap-2 pt-1 text-sm font-body text-ink-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-ink-200 text-amber-500 focus:ring-amber-300"
              />
              Remember me on this device
            </label>

            <Button type="submit" isLoading={isSubmitting} className="mt-2">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Card>
        <p className="mt-6 text-center text-xs font-body text-ink-300">
          Access is managed by your admin via the Users sheet.
        </p>
      </div>
    </main>
  );
}
