'use client';
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Modal({ isOpen, onClose, title, description, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={twMerge(
          clsx(
            'w-full rounded-2xl border border-white/10 bg-[#18191D] text-white p-6 shadow-2xl relative my-auto',
            maxWidth
          )
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {(title || description) && (
          <div className="mb-4 pr-8">
            {title && <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>}
            {description && <p className="text-xs text-zinc-400 mt-1">{description}</p>}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
