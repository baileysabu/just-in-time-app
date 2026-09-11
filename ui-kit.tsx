import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">) {
  return (
    <section
      {...rest}
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "primary",
  className,
}: {
  children: ReactNode;
  tone?: "primary" | "success" | "warning" | "accent" | "danger" | "muted";
  className?: string;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary text-primary-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    accent: "bg-accent text-accent-foreground",
    danger: "bg-destructive text-destructive-foreground",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "accent";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className, ...props }: BtnProps) {
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:brightness-110",
    accent: "bg-accent text-accent-foreground hover:brightness-110",
    outline: "border border-border bg-transparent text-foreground hover:bg-muted",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        className={cn(
          "w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary",
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-6 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.95)] sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
