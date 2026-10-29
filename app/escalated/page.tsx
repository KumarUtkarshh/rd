'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  Flame,
  BellRing,
  Search,
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MapPin,
  Sparkles,
  Layers,
  X,
  ShieldAlert
} from 'lucide-react';

interface RoadTenderItem {
  tender_id: string;
  title: string;
  reference_number?: string;
  organisation: string;
  contractor_name: string;
  budget_inr: number;
  status: string;
  road_type?: string;
  complaint_count?: number;
  is_escalated?: boolean;
  geo_location?: {
    area_name?: string;
    latitude?: number;
    longitude?: number;
  };
}

export default function EscalatedBoardPage() {
  const [tendersInThreshold, setTendersInThreshold] = useState<RoadTenderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [threshold, setThreshold] = useState<number>(3);
  const [activeTab, setActiveTab] = useState<'all' | 'escalated' | 'near'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTenderId, setExpandedTenderId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/complaints');
      const data = await res.json();
      
      // ONLY load road tenders that have complaints in the threshold pipeline
      const list: RoadTenderItem[] = (data.escalatedTenders || []).filter(
        (t: RoadTenderItem) => (t.complaint_count || 0) > 0
      );
      setTendersInThreshold(list);

      if (data.threshold) {
        setThreshold(data.threshold);
      }
    } catch (err) {
      console.error('Error loading escalation data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncETenders = async () => {
    try {
      setSyncing(true);
      setSyncStatus('Fetching live tenders from etender.up.nic.in...');
      const res = await fetch('/api/tenders/crawl', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncStatus(`Synced ${data.crawled_count} live tenders from UP PWD`);
        await fetchData();
      } else {
        setSyncStatus('Crawl error: ' + (data.details || 'failed'));
      }
    } catch {
      setSyncStatus('Network error while crawling.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Metrics for roads in the threshold area
  const escalatedCount = tendersInThreshold.filter((t) => (t.complaint_count || 0) >= threshold).length;
  const nearEscalatedCount = tendersInThreshold.filter(
    (t) => (t.complaint_count || 0) > 0 && (t.complaint_count || 0) < threshold
  ).length;

  // Filtered list based on search and tab (Strictly complaint_count > 0)
  const filteredList = useMemo(() => {
    return tendersInThreshold.filter((t) => {
      const count = t.complaint_count || 0;
      if (count <= 0) return false;

      const q = searchQuery.toLowerCase().trim();
      const area = t.geo_location?.area_name || '';
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        area.toLowerCase().includes(q) ||
        t.contractor_name.toLowerCase().includes(q) ||
        t.tender_id.toLowerCase().includes(q) ||
        (t.road_type && t.road_type.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeTab === 'escalated') return count >= threshold;
      if (activeTab === 'near') return count > 0 && count < threshold;

      return true;
    });
  }, [tendersInThreshold, activeTab, searchQuery, threshold]);

  const toggleExpand = (id: string) => {
    setExpandedTenderId(expandedTenderId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black flex flex-col transition-colors duration-150">
      {/* Responsive Unified Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Top Summary Banner */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-lg dark:shadow-2xl relative overflow-hidden transition-colors duration-150">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
                <BellRing className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                <span>Escalation Rule: {threshold} Reports = Official Notice Issued</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                Road Escalation Threshold Board
              </h1>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Showing road tenders currently in the citizen complaint threshold area. When a road accumulates {threshold} defect reports, high-priority notices are automatically dispatched to Lucknow PWD and LDA engineers.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 self-start md:self-center shrink-0">
              <button
                type="button"
                onClick={handleSyncETenders}
                disabled={syncing}
                className="inline-flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 border dark:border-zinc-700 font-bold text-xs px-3.5 py-2.5 rounded-2xl transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Fetch and sync live tenders from etender.up.nic.in"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-amber-500' : 'text-zinc-500 dark:text-zinc-400'}`} />
                <span>{syncing ? 'Crawling eTender...' : 'Sync eTender UP'}</span>
              </button>

              <Link
                href="/scan"
                className="inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-extrabold text-xs px-4 py-2.5 rounded-2xl transition-all shadow-md shrink-0 text-center"
              >
                <span>Scan Road Defect</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {syncStatus && (
            <div className="mt-4 px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-800 dark:text-zinc-300 flex items-center justify-between animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{syncStatus}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncStatus(null)}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Metric Stats Cards (Only for roads with reports) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800/80">
            {/* Stat 1: Escalated */}
            <div
              onClick={() => setActiveTab('escalated')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'escalated'
                  ? 'bg-rose-50 border-rose-300 dark:bg-rose-950/30 dark:border-rose-500/50 shadow-sm dark:shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                  : 'bg-zinc-50/70 dark:bg-black/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-rose-600 dark:text-rose-400 font-bold">
                <Flame className="w-3.5 h-3.5" />
                <span>Notices Issued</span>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                {escalatedCount}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                {threshold}+ reports reached
              </div>
            </div>

            {/* Stat 2: Near Escalation */}
            <div
              onClick={() => setActiveTab('near')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'near'
                  ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-500/50 shadow-sm dark:shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                  : 'bg-zinc-50/70 dark:bg-black/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Near Escalation</span>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                {nearEscalatedCount}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                1-2 reports logged
              </div>
            </div>

            {/* Stat 3: Total Reported Roads in Threshold */}
            <div
              onClick={() => setActiveTab('all')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600'
                  : 'bg-zinc-50/70 dark:bg-black/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
                <Layers className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300" />
                <span>In Threshold Area</span>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                {tendersInThreshold.length}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                Active complaint pipeline
              </div>
            </div>

            {/* Stat 4: Action Rule */}
            <div className="p-3.5 rounded-2xl border bg-zinc-50/70 dark:bg-black/60 border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Threshold Target</span>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                {threshold} Reports
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                Mandatory action notice
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Controls Bar: Filter Tabs & Real-time Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/90 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 p-2.5 rounded-2xl backdrop-blur shadow-sm">
          {/* Filter Tabs (Only relevant states in threshold) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-bold shadow-sm'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white dark:hover:bg-zinc-900'
              }`}
            >
              All in Threshold ({tendersInThreshold.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('escalated')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'escalated'
                  ? 'bg-rose-500 text-white font-bold shadow-md'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white dark:hover:bg-zinc-900'
              }`}
            >
              <Flame className="w-3 h-3 text-rose-500 dark:text-rose-400" />
              <span>Notices Issued ({escalatedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('near')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'near'
                  ? 'bg-amber-500 text-black font-bold shadow-md'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white dark:hover:bg-zinc-900'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              <span>Near Escalation ({nearEscalatedCount})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative shrink-0 sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reported road or contractor..."
              className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-all font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Road Tenders Ledger */}
        {loading ? (
          <div className="py-16 text-center text-xs font-mono text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-zinc-800 dark:text-white" />
            <span>Loading Escalation Threshold Board...</span>
          </div>
        ) : tendersInThreshold.length === 0 ? (
          /* Empty state when NO complaints exist at all in database */
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mx-auto text-zinc-500 dark:text-zinc-400">
              <BellRing className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">No Roads Currently in Threshold Area</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                Only road tenders with active citizen defect reports appear on this board. Use the camera scanner to capture road potholes and trigger accountability.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md"
            >
              <span>Scan Road Defect Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : filteredList.length === 0 ? (
          /* Empty state when search or filter returns no results */
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center space-y-3 shadow-sm">
            <AlertTriangle className="w-7 h-7 text-zinc-400 dark:text-zinc-500 mx-auto" />
            <div className="text-sm font-bold text-zinc-900 dark:text-white">No Matching Reported Roads</div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              No roads in the threshold area match your search or filter criteria.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
              }}
              className="mt-1 text-xs font-mono font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer transition-colors"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400 px-1">
              <span>Showing {filteredList.length} Road Stretches in Threshold Area</span>
              <span>Sorted by Complaint Count</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredList.map((tender) => {
                const count = tender.complaint_count || 0;
                const isHighPriority = count >= threshold;
                const isNearThreshold = count > 0 && count < threshold;
                const isExpanded = expandedTenderId === tender.tender_id;

                // Clean road stretch name
                const roadStretchName =
                  tender.geo_location?.area_name ||
                  tender.title.split(' hetu')[0].split(' ke antergat')[0] ||
                  'Monitored Road Stretch';

                return (
                  <div
                    key={tender.tender_id}
                    className={`bg-white dark:bg-zinc-950 border rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl space-y-4 transition-all ${
                      isHighPriority
                        ? 'border-rose-400 dark:border-rose-500/40 hover:border-rose-500 dark:hover:border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.06)]'
                        : isNearThreshold
                        ? 'border-amber-300 dark:border-amber-500/30 hover:border-amber-400 dark:hover:border-amber-500/50'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    {/* Header Row: Road Name & Status Badges */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight">
                            {roadStretchName}
                          </h2>
                          {tender.road_type && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
                              {tender.road_type}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                          <span>{tender.organisation}</span>
                          <span>•</span>
                          <span className="text-zinc-400 dark:text-zinc-500">{tender.tender_id}</span>
                        </div>
                      </div>

                      {/* Development / Notice Status Badge */}
                      <div className="shrink-0">
                        {isHighPriority ? (
                          <span className="px-3 py-1 text-xs font-mono font-bold rounded-full bg-rose-500 text-white flex items-center gap-1.5 shadow-[0_0_12px_rgba(244,63,94,0.3)]">
                            <Flame className="w-3.5 h-3.5" />
                            <span>GOVERNMENT NOTICE ISSUED</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 text-xs font-mono font-bold rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                            <span>NEARING THRESHOLD</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Visual 3-Step Escalation Progress Meter */}
                    <div className="bg-zinc-50 dark:bg-black/70 border border-zinc-200 dark:border-zinc-800/90 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <BellRing className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                          <span>Citizen Escalation Progress:</span>
                        </span>
                        <span
                          className={`font-bold ${
                            isHighPriority ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {count} / {threshold} Citizen Reports
                        </span>
                      </div>

                      {/* 3-Segment Progress Bar */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Step 1 */}
                        <div
                          className={`h-2.5 rounded-full transition-all ${
                            count >= 1
                              ? isHighPriority
                                ? 'bg-rose-500'
                                : 'bg-amber-400'
                              : 'bg-zinc-200 dark:bg-zinc-800'
                          }`}
                        />
                        {/* Step 2 */}
                        <div
                          className={`h-2.5 rounded-full transition-all ${
                            count >= 2
                              ? isHighPriority
                                ? 'bg-rose-500'
                                : 'bg-amber-400'
                              : 'bg-zinc-200 dark:bg-zinc-800'
                          }`}
                        />
                        {/* Step 3 (Escalation) */}
                        <div
                          className={`h-2.5 rounded-full transition-all ${
                            count >= 3
                              ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                              : 'bg-zinc-200 dark:bg-zinc-800'
                          }`}
                        />
                      </div>

                      {/* Impact Description for Next Complaint */}
                      <div className="text-[11px] font-mono">
                        {count === 1 && (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            1 complaint registered. <strong className="text-zinc-900 dark:text-zinc-200">2 more reports</strong> will trigger an official government escalation notice.
                          </span>
                        )}
                        {count === 2 && (
                          <span className="text-amber-700 dark:text-amber-300 font-semibold">
                            ⚡ 2 complaints registered! <strong className="text-zinc-900 dark:text-white underline">Just 1 more complaint</strong> will immediately issue an official escalation notice to engineers.
                          </span>
                        )}
                        {count >= 3 && (
                          <span className="text-rose-700 dark:text-rose-300 font-semibold">
                            🚨 Threshold reached ({count}/{threshold} reports). Official Escalation Notice issued to {tender.organisation} & contractor {tender.contractor_name}.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Key Project Specs (Contractor & Budget) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                      <div className="bg-white dark:bg-black/50 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
                        <span className="text-[10px] text-zinc-500 uppercase block font-bold">Contractor</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate block mt-0.5" title={tender.contractor_name}>
                          {tender.contractor_name}
                        </span>
                      </div>

                      <div className="bg-white dark:bg-black/50 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
                        <span className="text-[10px] text-zinc-500 uppercase block font-bold">Contract Budget</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 block mt-0.5">
                          ₹{((tender.budget_inr || 0) / 100000).toFixed(1)} Lakhs
                        </span>
                      </div>

                      <div className="col-span-2 sm:col-span-1 bg-white dark:bg-black/50 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
                        <span className="text-[10px] text-zinc-500 uppercase block font-bold">Road Work Status</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 block mt-0.5 truncate">
                          {tender.status}
                        </span>
                      </div>
                    </div>

                    {/* Collapsible Tender Full Details */}
                    {isExpanded && (
                      <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs font-mono space-y-2 animate-in fade-in duration-200">
                        <div className="text-[10px] text-zinc-500 uppercase font-bold">Official Tender Scope:</div>
                        <p className="text-zinc-800 dark:text-zinc-300 leading-relaxed">{tender.title}</p>
                        {tender.reference_number && (
                          <div className="text-[11px] text-zinc-500">
                            Ref Number: {tender.reference_number}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-900 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => toggleExpand(tender.tender_id)}
                        className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>{isExpanded ? 'Hide Details' : 'Full Scope Details'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <Link
                        href={`/tender-complaint?tenderId=${encodeURIComponent(tender.tender_id)}`}
                        className={`inline-flex items-center gap-2 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                          count === 2
                            ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-md font-extrabold'
                            : isHighPriority
                            ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-md'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black shadow-sm'
                        }`}
                      >
                        <span>{count === 2 ? 'Lodge Escalation Complaint' : 'Lodge Another Complaint'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-900 bg-white dark:bg-black py-4 text-center text-xs text-zinc-500 font-mono tracking-tight transition-colors duration-150">
        RD SYSTEM • CITIZEN ACTION & CONTRACTOR ACCOUNTABILITY
      </footer>
    </div>
  );
}
