'use client';
import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function GlassCard({ children, className, hover = false, ...props }) {
  return (
    <div
      className={twMerge(
        clsx(
          'glass-card p-5 transition-all text-white',
          hover && 'hover-lift hover:border-white/20',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}
