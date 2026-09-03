'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/state/authStore';
import { resetUser } from '@/lib/client/analytics';
import { Sparkles, History as HistoryIcon, BookOpen, User, LogOut, ShieldAlert, Zap } from 'lucide-react';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const totalCredits =
    typeof user?.credits?.total === 'number'
      ? user.credits.total
      : (user?.credits?.free ?? 5) + (user?.credits?.purchased ?? 0);

  const navItems = [
    { href: '/generate', label: 'Send', icon: Sparkles },
    { href: '/history', label: 'History', icon: HistoryIcon },
    { href: '/playbook', label: 'Playbook', icon: BookOpen },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  if (user?.is_admin) {
    navItems.push({ href: '/admin', label: 'Admin', icon: ShieldAlert });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#121316]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href={user && user.is_profile_complete === false ? '/onboarding' : '/generate'} className="flex items-center gap-2.5 group">
          <Image
            src="/Outreach.png"
            alt="Outreach Logo"
            width={32}
            height={32}
            className="w-8 h-8 rounded-xl object-contain shadow-sm group-hover:scale-105 transition-transform"
            priority
          />
          <span className="font-bold text-base tracking-tight text-white group-hover:text-[#2CB7A5] transition-colors">
            Outreach
          </span>
        </Link>

        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Credits Badge */}
            <Link
              href="/credits"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-mono border transition-all cursor-pointer ${
                totalCredits === 0
                  ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'border-[#2CB7A5]/30 bg-[#2CB7A5]/10 text-[#2CB7A5] hover:bg-[#2CB7A5]/20'
              }`}
              title="View your credit balance"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{totalCredits} {totalCredits === 1 ? 'credit' : 'credits'}</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'bg-[#2CB7A5] text-[#121316] font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <button
              onClick={() => {
                resetUser();
                logout();
                router.replace('/login');
              }}
              title="Log out"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-medium text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-xs font-semibold bg-[#2CB7A5] text-[#121316] px-3.5 py-1.5 rounded-xl hover:bg-[#24998A] transition-all shadow-sm"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
