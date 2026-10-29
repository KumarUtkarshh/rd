'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import MobileRoadCapture from '@/components/MobileRoadCapture';

export default function ScanPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-150">
      {/* Responsive Navbar */}
      <Navbar />

      {/* Main Content Area: Camera Scanner & Pothole Defect Analyzer */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 flex flex-col justify-center">
        <MobileRoadCapture />
      </main>

      {/* Minimalist Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-900 bg-white dark:bg-black py-4 text-center text-xs text-zinc-500 font-mono tracking-tight transition-colors duration-150">
        RD SYSTEM • ROAD DEFECT & CONTRACTOR ACCOUNTABILITY PLATFORM
      </footer>
    </div>
  );
}
