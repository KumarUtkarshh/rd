'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Send,
  ShieldAlert,
  Building2,
  RefreshCw,
  ArrowRight,
  MapPin,
  Eye,
  EyeOff,
  Printer
} from 'lucide-react';
import { DetectedPothole } from '@/lib/potholeDetector';

function TenderComplaintContent() {
  const searchParams = useSearchParams();
  const tenderIdParam = searchParams.get('tenderId');
  const noMatchParam = searchParams.get('noMatch');

  const [report, setReport] = useState<any | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [tender, setTender] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAiBoxes, setShowAiBoxes] = useState(true);

  // Complaint Form State
  const [citizenRemark, setCitizenRemark] = useState('');
  const [citizenContact, setCitizenContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complaintSuccess, setComplaintSuccess] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedReport = sessionStorage.getItem('current_defect_report');
      const storedImage = sessionStorage.getItem('current_defect_image');

      if (storedImage) {
        setCapturedPhotoUrl(storedImage);
      }

      if (storedReport) {
        try {
          const parsed = JSON.parse(storedReport);
          setReport(parsed);
          if (parsed.matchResult?.matchedTender) {
            setTender(parsed.matchResult.matchedTender);
          }
        } catch {
          // ignore parsing error
        }
      }

      // If tenderId passed via URL, fetch directly
      if (tenderIdParam) {
        fetch(`/api/complaints?tenderId=${encodeURIComponent(tenderIdParam)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.tender) {
              setTender(data.tender);
              setLiveCount(data.tender.complaint_count || 0);
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }
  }, [tenderIdParam]);

  const handleLodgeComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tender) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const lat = report?.gpsCoordinates?.latitude || 26.8467;
      const lng = report?.gpsCoordinates?.longitude || 80.9462;
      const remarkText = citizenRemark.trim() || 'Severe pothole observed; legal liability notice requested.';
      const remarkWithContact = citizenContact.trim()
        ? `${remarkText} [Contact: ${citizenContact.trim()}]`
        : remarkText;

      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenderId: tender.tender_id,
          latitude: lat,
          longitude: lng,
          citizenRemark: remarkWithContact,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setComplaintSuccess(data);
        setLiveCount(data.complaintCount);
      } else {
        setErrorMsg(data.error || 'Failed to lodge official complaint.');
      }
    } catch (err: any) {
      setErrorMsg('Submission error: ' + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintNotice = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const diagnostics = report?.potholeDiagnostics;
  const geocoded = report?.geocodedLocation;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center justify-center p-4 transition-colors duration-150">
        <RefreshCw className="w-6 h-6 text-zinc-900 dark:text-white animate-spin mb-3" />
        <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">LOADING CONTRACTOR PROFILE...</p>
      </div>
    );
  }

  if (noMatchParam || (!tender && !report?.matchResult?.matched)) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors duration-150">
        <Navbar />
        <div className="flex-1 p-4 max-w-md mx-auto flex flex-col justify-center items-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">No Matching Road Tender Found</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            The defect coordinates did not match any active government road tender in the database.
          </p>
          <Link
            href="/"
            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-bold text-xs py-3 px-6 rounded-xl flex items-center gap-2 transition-all shadow-md"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Scanner
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black pb-12 transition-colors duration-150">
      {/* Responsive Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400 pt-1 pb-1 print:hidden">
          <Link
            href="/"
            className="flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Scanner</span>
          </Link>
          <span className="text-zinc-500 uppercase tracking-widest text-[10px]">
            LEGAL NOTICE
          </span>
        </div>

        {/* Defect Preview Card with AI Bounding Boxes */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 shadow-sm dark:shadow-2xl space-y-3 transition-colors duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-mono text-zinc-900 dark:text-zinc-200 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> TENDER MATCHED
            </span>
            {report?.matchResult?.distanceMeters !== undefined && (
              <span className="font-mono text-[11px] bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                {report.matchResult.distanceMeters}m from centerline
              </span>
            )}
          </div>

          {capturedPhotoUrl && (
            <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-16/9 bg-zinc-100 dark:bg-black">
              <img
                src={capturedPhotoUrl}
                alt="Captured Road Defect"
                className="w-full h-full object-cover grayscale contrast-125"
              />

              {/* Overlaid AI Boxes */}
              {showAiBoxes && diagnostics?.detectedPotholes && (
                <div className="absolute inset-0 pointer-events-none">
                  {diagnostics.detectedPotholes.map((p: DetectedPothole, idx: number) => {
                    const [ymin, xmin, ymax, xmax] = p.box;
                    return (
                      <div
                        key={p.id}
                        style={{
                          top: `${ymin}%`,
                          left: `${xmin}%`,
                          width: `${xmax - xmin}%`,
                          height: `${ymax - ymin}%`,
                        }}
                        className="absolute border-2 border-white bg-white/10 rounded"
                      >
                        <span className="absolute -top-4 left-0 bg-black text-[9px] font-mono text-white px-1 rounded">
                          #{idx + 1} ({p.confidence}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {diagnostics && (
                <button
                  type="button"
                  onClick={() => setShowAiBoxes(!showAiBoxes)}
                  className="absolute top-2 right-2 bg-black/80 hover:bg-black px-2 py-0.5 rounded-full text-[10px] font-mono text-white flex items-center gap-1 border border-zinc-700 pointer-events-auto transition-colors cursor-pointer"
                >
                  {showAiBoxes ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3 text-zinc-400" />}
                  <span>{showAiBoxes ? 'AI Boxes' : 'Raw'}</span>
                </button>
              )}
            </div>
          )}

          {/* AI Metrics */}
          {report?.priorityAssessment && (
            <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
              <div className="bg-zinc-100 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="text-[9px] text-zinc-500 dark:text-zinc-400 uppercase">DEPTH</div>
                <div className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5">{report.defectDepthCm || 8} cm</div>
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="text-[9px] text-zinc-500 dark:text-zinc-400 uppercase">WIDTH</div>
                <div className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5">{report.defectWidthCm || 40} cm</div>
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="text-[9px] text-zinc-500 dark:text-zinc-400 uppercase">SEVERITY</div>
                <div className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5">
                  {report.priorityAssessment.level}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reverse Geocoded Ground Location */}
        {geocoded && (
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 shadow-sm dark:shadow-xl space-y-1.5 font-mono transition-colors duration-150">
            <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" /> Exact Ground Location
            </div>
            <div className="text-xs font-bold text-zinc-900 dark:text-white">{geocoded.roadName}</div>
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
              {geocoded.locality} • {geocoded.ward} • {geocoded.city}
            </div>
          </div>
        )}

        {/* Accountable Contractor Profile Card */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm dark:shadow-2xl space-y-4 transition-colors duration-150">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-zinc-900 dark:text-white" /> Contractor Liability
            </div>

            <span className="px-3 py-1 text-xs font-mono font-bold rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800">
              {liveCount} / 3 Complaints
            </span>
          </div>

          <div>
            <div className="text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight leading-snug">
              {tender?.contractor_name || 'Assigned Contractor'}
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300" />
              <span>Assigned by {tender?.organisation}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1 font-mono">
            <div className="bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase">BUDGET</div>
              <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                ₹{((tender?.budget_inr || 0) / 100000).toFixed(2)} Lakhs
              </div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase">STATUS / DLP</div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                Defect Liability Active
              </div>
            </div>
          </div>
        </div>

        {/* Tender Details */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm dark:shadow-xl space-y-3 transition-colors duration-150">
          <div className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-zinc-600 dark:text-zinc-300" /> Work Contract Summary
          </div>

          <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">
            {tender?.title}
          </h3>

          <div className="space-y-2 text-xs font-mono pt-1">
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-900 pb-2">
              <span>TENDER ID:</span>
              <span className="text-zinc-900 dark:text-zinc-200 font-bold">{tender?.tender_id}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-900 pb-2">
              <span>DEPARTMENT:</span>
              <span className="text-zinc-800 dark:text-zinc-200">{tender?.organisation}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>AREA:</span>
              <span className="text-zinc-800 dark:text-zinc-200">{tender?.geo_location?.area_name}</span>
            </div>
          </div>
        </div>

        {/* Lodge Complaint Section */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm dark:shadow-2xl space-y-4 print:hidden transition-colors duration-150">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-sm">
            <ShieldAlert className="w-5 h-5 text-zinc-900 dark:text-white" />
            <span>Lodge Official Citizen Grievance</span>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Submit an official record. 3 citizen complaints trigger an automatic High Priority Escalation Notice to officials and contractor.
          </p>

          <form onSubmit={handleLodgeComplaint} className="space-y-3">
            <div>
              <label className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase block mb-1">
                Citizen Defect Remark
              </label>
              <textarea
                value={citizenRemark}
                onChange={(e) => setCitizenRemark(e.target.value)}
                placeholder="Describe road damage or hazard..."
                rows={3}
                className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-900 dark:focus:border-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase block mb-1">
                Contact Number (Optional)
              </label>
              <input
                type="tel"
                value={citizenContact}
                onChange={(e) => setCitizenContact(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-900 dark:focus:border-white font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-extrabold text-sm py-4 px-6 rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-inherit" />
                  <span>Submitting Grievance...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-inherit" />
                  <span>Lodge Official Complaint</span>
                </>
              )}
            </button>
          </form>

          {/* Print Notice Action */}
          <button
            type="button"
            onClick={handlePrintNotice}
            className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 text-xs font-mono py-2.5 px-4 rounded-xl border dark:border-zinc-800 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Print Official Defect Notice for Submission</span>
          </button>

          {/* Success Banner */}
          {complaintSuccess && (
            <div className="p-4 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-mono space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Grievance Registered Successfully</span>
              </div>

              {complaintSuccess.escalationNotice ? (
                <div className="space-y-2">
                  <div className="p-3 bg-white dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-[11px] leading-relaxed">
                    OFFICIAL ESCALATION NOTICE: Threshold reached ({liveCount}/3 Complaints). Escalated to HIGH PRIORITY for immediate intervention by {tender?.organisation} and {tender?.contractor_name}.
                  </div>
                  <Link
                    href="/escalated"
                    className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <span>View Priority Escalation Board</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  Total logged complaints: <strong className="text-zinc-900 dark:text-white">{liveCount}/3</strong> needed for automatic high priority escalation notice.
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="bg-zinc-100 dark:bg-zinc-900 border border-rose-300 dark:border-zinc-800 text-rose-700 dark:text-zinc-300 p-3 rounded-xl flex items-center gap-2 text-xs font-mono">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-white shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function TenderComplaintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center justify-center p-4 transition-colors duration-150">
          <RefreshCw className="w-6 h-6 text-zinc-900 dark:text-white animate-spin mb-3" />
          <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      }
    >
      <TenderComplaintContent />
    </Suspense>
  );
}
