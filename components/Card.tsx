import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl2 bg-white shadow-card border border-ink-50 p-5 ${className}`}
    >
      {children}
    </div>
  );
}
