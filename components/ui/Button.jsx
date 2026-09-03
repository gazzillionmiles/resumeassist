'use client';
import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  type = 'button',
  ...props
}) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-5 py-3 gap-2.5',
  };

  const variantClasses = {
    primary: 'bg-[#2CB7A5] hover:bg-[#24998A] text-[#121316] font-semibold shadow-md active:scale-[0.99]',
    secondary: 'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20',
    danger: 'bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30',
    ghost: 'bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={twMerge(
        clsx(baseClasses, sizeClasses[size] || sizeClasses.md, variantClasses[variant] || variantClasses.primary, className)
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
