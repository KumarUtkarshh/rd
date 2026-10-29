'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'pill' | 'row';
}

export default function ThemeToggle({
  className = '',
  variant = 'icon',
}: ThemeToggleProps) {
  const { theme, toggleTheme, isDark } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid layout shift / mismatched icon before client mount
  if (!mounted) {
    if (variant === 'row') {
      return (
        <div className={`flex items-center justify-between p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${className}`}>
          <div className="flex items-center gap-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <div className="w-4 h-4 rounded-full bg-zinc-300 dark:bg-zinc-700 animate-pulse" />
            <span>Theme</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Dark</span>
        </div>
      );
    }

    return (
      <button
        type="button"
        disabled
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0 opacity-80 ${className}`}
        aria-label="Toggle theme"
      >
        <Moon className="w-4 h-4" />
      </button>
    );
  }

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer select-none bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 active:scale-[0.98] ${className}`}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        <div className="flex items-center gap-2.5">
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 rotate-0" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600 transition-transform duration-300" />
          )}
          <span>{isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold uppercase tracking-wider">
          {isDark ? 'Dark' : 'Light'}
        </span>
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 transition-all active:scale-95 cursor-pointer shadow-sm ${className}`}
        title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        {isDark ? (
          <>
            <Sun className="w-3.5 h-3.5 text-amber-400 transition-transform hover:rotate-45" />
            <span>Light</span>
          </>
        ) : (
          <>
            <Moon className="w-3.5 h-3.5 text-zinc-700 transition-transform hover:-rotate-12" />
            <span>Dark</span>
          </>
        )}
      </button>
    );
  }

  // Default: icon button matching navbar header height & style
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-black dark:hover:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-800 cursor-pointer active:scale-95 transition-all shadow-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 ${className}`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        <Sun
          className={`w-4 h-4 text-amber-500 absolute transition-all duration-300 ease-in-out ${
            isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
          }`}
        />
        <Moon
          className={`w-4 h-4 text-indigo-600 dark:text-zinc-200 absolute transition-all duration-300 ease-in-out ${
            isDark ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
        />
      </div>
    </button>
  );
}
