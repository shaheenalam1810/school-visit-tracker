import { HTMLAttributes, ReactNode, memo } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl2 bg-white shadow-card border border-ink-50 p-5 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export default memo(Card);
