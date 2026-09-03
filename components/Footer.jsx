'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="w-full border-t border-white/10 bg-[#121316]/90 backdrop-blur-md text-zinc-400 py-8 px-6 mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Image
            src="/Outreach.png"
            alt="Outreach Logo"
            width={20}
            height={20}
            className="w-5 h-5 rounded-md object-contain"
          />
          <span className="font-semibold text-white tracking-tight">Outreach</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-500">Tailored Job Outreach &amp; Company Intel</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-zinc-400">
          <Link href="/privacy" className="hover:text-[#2CB7A5] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-[#2CB7A5] transition-colors">
            Terms of Service
          </Link>
          <a
            href="mailto:support@wavyai.in"
            className="hover:text-[#2CB7A5] transition-colors"
          >
            Support
          </a>
        </div>

        <div className="text-zinc-500 text-[11px]">
          &copy; {new Date().getFullYear()} Outreach. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default Footer;
