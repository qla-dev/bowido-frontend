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
    default: 'bg-zinc-100 text-zinc-500 border-zinc-200',
    info: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    warning: 'bg-amber-50 text-amber-600 border-amber-100',
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    danger: 'bg-rose-50 text-rose-600 border-rose-100',
  };

  return (
    <div className={cn(
      "px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest inline-flex items-center justify-center whitespace-nowrap border",
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
    primary: 'bg-[#00A655] text-white hover:bg-[#008f49] border-[#00A655] shadow-md shadow-emerald-900/10',
    secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border-zinc-200',
    outline: 'bg-transparent border-zinc-200 text-zinc-900 hover:border-[#00A655] hover:bg-emerald-50',
    ghost: 'bg-transparent text-zinc-500 hover:bg-zinc-50 border-transparent',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600 shadow-md shadow-rose-900/10',
  };

  const sizes = {
    xs: 'px-3 py-1.5 text-[9px]',
    sm: 'px-4 py-2 text-[10px]',
    md: 'px-5 py-2.5 text-[11px]',
    lg: 'px-7 py-3.5 text-[12px]',
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
      "bg-white border border-zinc-200 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.06)] rounded-2xl flex flex-col",
      className
    )} {...props}>
      {(title || action) && (
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-[#00A655] rounded-sm" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-950 font-display">{title}</h3>
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
        "w-full px-4 py-3 bg-zinc-50 border border-zinc-200 focus:border-[#00A655] focus:bg-white rounded-xl font-black text-[12px] outline-none transition-all placeholder:text-zinc-300 uppercase tracking-tight",
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
          "w-full px-4 py-3 bg-zinc-50 border border-zinc-200 focus:border-[#00A655] focus:bg-white rounded-xl font-black text-[12px] outline-none transition-all uppercase tracking-tight appearance-none cursor-pointer pr-10",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-300">
        <svg fill="currentColor" viewBox="0 0 20 20" className="w-4 h-4"><path d="M5.293 7.293a1 1 0 011414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
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
    default: 'border-zinc-200 bg-white text-zinc-950',
    info: 'border-indigo-100 bg-indigo-50/40 text-indigo-900',
    warning: 'border-amber-100 bg-amber-50/40 text-amber-900',
    success: 'border-emerald-100 bg-emerald-50/40 text-emerald-900',
    danger: 'border-rose-100 bg-rose-50/40 text-rose-900',
  };

  return (
    <div className={cn(
      "p-5 rounded-2xl border shadow-sm relative overflow-hidden group",
      styles[variant]
    )}>
      <div className="flex justify-between items-start mb-2">
        <p className="text-[9px] font-black uppercase tracking-[0.1em] opacity-60 group-hover:translate-x-1 transition-transform">{label}</p>
        {trend && (
          <span className={cn(
            "text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded border",
            trendUp ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-rose-100 text-rose-700 border-rose-200"
          )}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-[2rem] font-black tracking-tight uppercase leading-none font-display">{value}</p>
    </div>
  );
};
