import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'info' | 'warning' | 'success' | 'danger';
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default',
  className,
  ...props 
}) => {
  const styles = {
    default: 'bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[color:var(--border-subtle)]',
    info: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[color:var(--status-info-border)]',
    warning: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[color:var(--status-warning-border)]',
    success: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[color:var(--status-success-border)]',
    danger: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[color:var(--status-danger-border)]',
  };

  return (
    <div className={cn(
      "max-w-full rounded px-2.5 py-1 text-center text-[10px] font-bold leading-4 tracking-[0.08em] inline-flex items-center justify-center whitespace-nowrap border",
      styles[variant],
      className
    )} {...props}>
      {children}
    </div>
  );
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className,
  ...props
}) => {
  const variants = {
    primary: 'border-[color:var(--action-primary)] bg-[var(--action-primary)] text-white shadow-md shadow-emerald-900/10 hover:bg-[var(--action-primary-hover)]',
    secondary: 'border-[color:var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--surface-input)]',
    outline: 'border-[color:var(--border-subtle)] bg-transparent text-[var(--text-primary)] hover:border-[color:var(--action-primary)] hover:bg-[var(--status-success-bg)]',
    ghost: 'border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]',
    danger: 'border-[color:var(--status-danger-text)] bg-[var(--status-danger-text)] text-white shadow-md shadow-rose-900/10 hover:brightness-90 dark:border-rose-600 dark:bg-rose-600 dark:text-white dark:hover:bg-rose-700',
  };

  const sizes = {
    xs: 'px-3 py-1.5 text-[10px]',
    sm: 'px-4 py-2 text-[11px]',
    md: 'px-5 py-2.5 text-[12px]',
    lg: 'px-7 py-3.5 text-[13px]',
  };

  return (
    <button 
      className={cn(
        "rounded-xl font-black uppercase tracking-tight transition-all active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center whitespace-nowrap border-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  title, 
  action, 
  noPadding = false,
  className,
  ...props
}) => {
  return (
    <div className={cn(
      "flex flex-col rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.06)] dark:shadow-[0_24px_70px_-24px_rgba(0,0,0,0.78)]",
      className
    )} {...props}>
      {(title || action) && (
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-[#00A655] rounded-sm dark:bg-zinc-500" />
            <h3 className="font-display text-[12px] font-black uppercase tracking-[0.1em] text-[var(--text-primary)]">{title}</h3>
          </div>
          {action && <div className="flex items-center">{action}</div>}
        </div>
      )}
      <div className={cn(
        "flex-1",
        !noPadding && "p-6"
      )}>
        {children}
      </div>
    </div>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = ({ className, ...props }) => {
  return (
    <input 
      className={cn(
        "w-full rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-input)] px-4 py-3 text-[14px] font-semibold tracking-normal text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[color:var(--action-primary)] focus:bg-[var(--surface-panel)]",
        className
      )}
      {...props}
    />
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select: React.FC<SelectProps> = ({ children, className, ...props }) => {
  return (
    <div className="relative w-full">
      <select 
        className={cn(
          "w-full cursor-pointer appearance-none rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-input)] px-4 py-3 pr-10 text-[14px] font-semibold tracking-normal text-[var(--text-primary)] outline-none transition-all focus:border-[color:var(--action-primary)] focus:bg-[var(--surface-panel)]",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
        <svg fill="none" viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
};

export const StatCard: React.FC<{ 
  label: string; 
  value: string | number; 
  variant?: 'default' | 'info' | 'warning' | 'success' | 'danger';
  trend?: string;
  trendUp?: boolean;
}> = ({ label, value, variant = 'default', trend, trendUp }) => {
  const styles = {
    default: 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-primary)]',
    info: 'border-[color:var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]',
    warning: 'border-[color:var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
    success: 'border-[color:var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
    danger: 'border-[color:var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
  };

  return (
    <div className={cn(
      "p-5 rounded-2xl border shadow-sm relative overflow-hidden group dark:shadow-[0_18px_44px_-26px_rgba(0,0,0,0.68)]",
      styles[variant]
    )}>
      <div className="flex justify-between items-start mb-2">
        <p className="text-[11px] font-bold tracking-[0.04em] opacity-70 transition-transform group-hover:translate-x-1">{label}</p>
        {trend && (
          <span className={cn(
            "rounded border px-2.5 py-1 text-[10px] font-bold tracking-[0.08em]",
            trendUp
              ? "border-[color:var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
              : "border-[color:var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
          )}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-[2rem] font-black tracking-tight uppercase leading-none font-display">{value}</p>
    </div>
  );
};
