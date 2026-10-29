'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Camera,
  ShieldAlert,
  Menu,
  X,
  CheckCircle2,
  FileSpreadsheet,
  Compass,
  Zap,
  HelpCircle
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [escalatedCount, setEscalatedCount] = useState<number>(2);

  // Fetch live escalated count
  useEffect(() => {
    fetch('/api/complaints')
      .then((res) => res.json())
      .then((data) => {
        if (data.totalTracked !== undefined) {
          setEscalatedCount(data.totalTracked);
        }
      })
      .catch(() => { });
  }, [pathname]);

  // Close mobile menu on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isHome = pathname === '/';

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          {/* Brand Logo & Title */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center font-black text-xs sm:text-sm tracking-wider shadow-sm transition-transform group-hover:scale-105 shrink-0">
              RD
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 tracking-tight whitespace-nowrap">
                  RoadWatch AI
                </span>
                <span className="hidden sm:inline-block text-[9px] font-mono font-bold bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded-full">
                  CIVIC AI
                </span>
              </div>
              <span className="hidden lg:inline text-[10px] text-zinc-500 font-mono truncate max-w-[280px]">
                Road Defect & Tender Accountability
              </span>
            </div>
          </Link>

          {/* Desktop & Tablet Navigation Links (md and up) */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs lg:text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <a
              href={isHome ? '#procedure' : '/#procedure'}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              How It Works
            </a>
            <a
              href={isHome ? '#features' : '/#features'}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href={isHome ? '#faq' : '/#faq'}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              FAQ
            </a>
            <Link
              href="/escalated"
              className={`flex items-center gap-2 transition-colors ${
                pathname === '/escalated'
                  ? 'text-zinc-900 dark:text-white font-semibold'
                  : 'hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span>Escalation Board</span>
              <span className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono px-1.5 py-0.5 rounded-full">
                {escalatedCount}
              </span>
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Open Scanner button */}
            <Link
              href="/scan"
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-all active:scale-95 shadow-sm shrink-0"
              title="Open Road Defect Camera Scanner"
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="inline">Scanner</span>
            </Link>

            {/* Mobile Hamburger Toggle (md:hidden) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-800 cursor-pointer active:scale-95 transition-all shrink-0"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-200 dark:border-zinc-800/80 bg-white/98 dark:bg-zinc-950/98 backdrop-blur-xl px-4 py-4 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200 max-w-full overflow-hidden shadow-2xl">
          {/* Main Actions */}
          <Link
            href="/scan"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center justify-between p-3 rounded-2xl text-xs font-semibold transition-all ${
              pathname === '/scan'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-850'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Camera className="w-4 h-4 text-inherit" />
              <span>Camera Road Scanner</span>
            </div>
            <span className="text-[10px] font-mono opacity-80 bg-zinc-200 dark:bg-black/40 px-2 py-0.5 rounded-full">
              CAPTURE
            </span>
          </Link>

          <Link
            href="/escalated"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center justify-between p-3 rounded-2xl text-xs font-semibold transition-all ${
              pathname === '/escalated'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-850'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-inherit" />
              <span>Priority Escalation Board</span>
            </div>
            <span className="text-[10px] font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
              {escalatedCount} Active
            </span>
          </Link>

          <Link
            href="/tender-complaint"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center justify-between p-3 rounded-2xl text-xs font-semibold transition-all ${
              pathname === '/tender-complaint'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-850'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-4 h-4 text-inherit" />
              <span>Lodge Tender Complaint</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              LEGAL
            </span>
          </Link>

          {/* Theme Switch Row for Mobile */}
          <div className="pt-1">
            <ThemeToggle variant="row" />
          </div>

          {/* Quick Page Jump Links */}
          <div className="pt-2 pb-1 border-t border-zinc-200 dark:border-zinc-900 grid grid-cols-3 gap-2 text-center text-xs font-medium">
            <a
              href={isHome ? '#procedure' : '/#procedure'}
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white border border-zinc-200 dark:border-zinc-800/60 flex flex-col items-center gap-1 transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="text-[11px]">Procedure</span>
            </a>
            <a
              href={isHome ? '#features' : '/#features'}
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white border border-zinc-200 dark:border-zinc-800/60 flex flex-col items-center gap-1 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[11px]">Features</span>
            </a>
            <a
              href={isHome ? '#faq' : '/#faq'}
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white border border-zinc-200 dark:border-zinc-800/60 flex flex-col items-center gap-1 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="text-[11px]">FAQ</span>
            </a>
          </div>

          {/* System Footer Status */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-900/80 flex items-center justify-between text-[11px] font-mono text-zinc-500 px-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>20 Tenders Monitored</span>
            </span>
            <span>UP PWD / LDA</span>
          </div>
        </div>
      )}
    </header>
  );
}
