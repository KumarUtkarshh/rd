'use client';

import React, { useEffect, useState } from 'react';
import { DefectReport } from '@/lib/db';
import {
  FileText,
  Building2,
  ShieldCheck,
  Zap,
  Clock,
} from 'lucide-react';

export default function ReportsDashboard() {
  const [reports, setReports] = useState<DefectReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.reports) {
        setReports(data.reports);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const criticalCount = reports.filter((r) => r.priorityAssessment?.level === 'CRITICAL').length;
  const highCount = reports.filter((r) => r.priorityAssessment?.level === 'HIGH').length;
  const directLiabilityCount = reports.filter(
    (r) => r.priorityAssessment?.contractorLiability === 'DIRECT_LIABILITY'
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors">
          <div>
            <div className="text-xs text-zinc-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Total Geotagged Defects</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{reports.length} Reports</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors">
          <div>
            <div className="text-xs text-zinc-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Direct Contractor Liability</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{directLiabilityCount} Notices</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors">
          <div>
            <div className="text-xs text-zinc-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Critical SLA Deficiencies</div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{criticalCount + highCount} Urgent</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Reports Feed */}
      <div className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> Defect Inspection & Accountability Log
        </h3>

        {loading ? (
          <div className="text-center py-12 text-zinc-500 dark:text-slate-400 text-xs">Loading reports log...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 dark:text-slate-500 text-xs">No defect reports logged yet.</div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-zinc-50 dark:bg-slate-950 border border-zinc-200 dark:border-slate-800 hover:border-zinc-300 dark:hover:border-slate-700 rounded-xl p-5 space-y-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">{report.id}</span>
                    <span className="text-xs text-zinc-500 dark:text-slate-500">
                      {new Date(report.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${report.priorityAssessment?.badgeColor}`}>
                      {report.priorityAssessment?.level} ({report.priorityAssessment?.score}/100)
                    </span>
                    <span className="px-2.5 py-0.5 bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-slate-300 text-xs rounded-full border border-zinc-200 dark:border-slate-700 font-semibold">
                      {report.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                  <div className="md:col-span-7 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-slate-200">
                      <Building2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      {report.matchResult.matched && report.matchResult.matchedTender ? (
                        <span>Matched: {report.matchResult.matchedTender.title}</span>
                      ) : (
                        <span>Unmatched Location</span>
                      )}
                    </div>

                    <div className="text-zinc-600 dark:text-slate-400">
                      Coordinates: <span className="font-mono text-zinc-800 dark:text-slate-200">{report.latitude.toFixed(5)}°N, {report.longitude.toFixed(5)}°E</span>
                    </div>

                    {report.userNotes && (
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-zinc-200 dark:border-slate-800 text-zinc-700 dark:text-slate-300 italic">
                        &quot;{report.userNotes}&quot;
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-5 bg-white dark:bg-slate-900 p-3 rounded-xl border border-zinc-200 dark:border-slate-800 space-y-1.5">
                    <div className="text-[11px] text-zinc-500 dark:text-slate-500 font-semibold uppercase">Accountable Entity</div>
                    {report.matchResult.matched && report.matchResult.matchedTender ? (
                      <>
                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {report.matchResult.matchedTender.contractor_name}
                        </div>
                        <div className="text-zinc-600 dark:text-slate-400 text-[11px]">
                          Tender ID: <span className="text-indigo-600 dark:text-indigo-300 font-mono">{report.matchResult.matchedTender.tender_id}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-amber-600 dark:text-amber-400 font-medium">Unassigned / General PWD Pool</div>
                    )}
                  </div>
                </div>

                {report.priorityAssessment?.recommendedAction && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/20 p-3 rounded-xl text-xs text-indigo-900 dark:text-indigo-200">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">Action Plan: </span>
                    {report.priorityAssessment.recommendedAction}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
