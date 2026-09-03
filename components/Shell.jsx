'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import { Sparkles, History, BookOpen, User } from 'lucide-react';

const TABS = [
  { href: '/generate', label: 'Send', icon: Sparkles },
  { href: '/history', label: 'History', icon: History },
  { href: '/playbook', label: 'Playbook', icon: BookOpen },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function Shell({ children }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-[#121316] text-[#F4F4F5]">
      <Header />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-12">
        {children}
      </main>

      <Footer />

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121316]/90 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[11px] font-medium transition-all ${
                  active
                    ? 'text-[#2CB7A5] font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div
                  className={`p-1 rounded-lg ${
                    active ? 'bg-[#2CB7A5]/15' : 'bg-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
