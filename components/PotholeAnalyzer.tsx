'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Upload,
  MapPin,
  Camera,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Send,
  ArrowRight,
  Eye,
  EyeOff,
  Sliders,
  ShieldAlert,
  Building2,
  Sparkles
} from 'lucide-react';
import { DetectedPothole } from '@/lib/potholeDetector';

interface PresetSample {
  name: string;
  lat: number;
  lng: number;
  locationName: string;
}

const PRESET_SAMPLES: PresetSample[] = [
  {
    name: 'Shaheed Path Service Road',
    lat: 26.8468,
    lng: 81.0105,
    locationName: 'Gomti Nagar Vistar Sector-1, Lucknow',
  },
  {
    name: 'Kanpur Road Yojna',
    lat: 26.7768,
    lng: 80.8845,
    locationName: 'Mragshira Apartment, Kanpur Road, Lucknow',
  },
  {
    name: 'Hardoi Road (Ward 85)',
    lat: 26.8732,
    lng: 80.8922,
    locationName: 'Mallahi Tola I, Hardoi Road, Lucknow',
  },
  {
    name: 'Mohan Road (Nadarganj)',
    lat: 26.7892,
    lng: 80.8462,
    locationName: 'Nadarganj to TS Mishra Bridge, Mohan Road',
  },
  {
    name: 'New Nandi Vihar (Chinhat)',
    lat: 26.8892,
    lng: 81.0562,
    locationName: 'Chinhat, Lucknow',
  },
];

export default function PotholeAnalyzer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState<string>('26.8468');
  const [manualLng, setManualLng] = useState<string>('81.0105');
  const [defectDepth, setDefectDepth] = useState<string>('8.5');
  const [defectWidth, setDefectWidth] = useState<string>('42');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAiOverlay, setShowAiOverlay] = useState<boolean>(true);

  // Complaint registration state
  const [isRegisteringComplaint, setIsRegisteringComplaint] = useState<boolean>(false);
  const [complaintSuccessMsg, setComplaintSuccessMsg] = useState<string | null>(null);
  const [liveComplaintCount, setLiveComplaintCount] = useState<number>(0);
  const [isEscalated, setIsEscalated] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMsg(null);
      setResult(null);
      setComplaintSuccessMsg(null);
    }
  };

  const applyPreset = (preset: PresetSample) => {
    setManualLat(preset.lat.toString());
    setManualLng(preset.lng.toString());
    setErrorMsg(null);
    setResult(null);
    setComplaintSuccessMsg(null);
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    setResult(null);
    setComplaintSuccessMsg(null);

    try {
      let res: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('latitude', manualLat);
        formData.append('longitude', manualLng);
        formData.append('defectDepthCm', defectDepth);
        formData.append('defectWidthCm', defectWidth);

        res = await fetch('/api/analyze-pothole', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/analyze-pothole', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: parseFloat(manualLat),
            longitude: parseFloat(manualLng),
            defectDepthCm: parseFloat(defectDepth),
            defectWidthCm: parseFloat(defectWidth),
            imageName: 'road_inspection_sample.jpg',
          }),
        });
      }

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Server returned an unexpected response format.');
      }

      if (!res.ok || data.error) {
        setErrorMsg(data.message || data.error || 'Failed to match road tender.');
      } else {
        setResult(data.report);
        const tender = data.report?.matchResult?.matchedTender;
        if (tender) {
          setLiveComplaintCount(tender.complaint_count || 0);
          setIsEscalated(!!tender.is_escalated);
        }
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      if (msg.includes('JSON') || msg.includes('Unexpected') || msg.includes('token')) {
        setErrorMsg('Unable to parse road defect response. Please verify network connection and try again.');
      } else {
        setErrorMsg('Network error: ' + msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRegisterComplaint = async () => {
    if (!result?.matchResult?.matchedTender) return;

    setIsRegisteringComplaint(true);
    setComplaintSuccessMsg(null);

    try {
      const tender = result.matchResult.matchedTender;
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenderId: tender.tender_id,
          latitude: parseFloat(manualLat),
          longitude: parseFloat(manualLng),
          citizenRemark: `Citizen pothole complaint registered for road work: ${tender.title}`,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setLiveComplaintCount(data.complaintCount);
        setIsEscalated(data.isEscalated);
        if (data.isEscalated) {
          setComplaintSuccessMsg(
            `GOVERNMENT ESCALATION NOTICE: Threshold reached (${data.complaintCount}/${data.threshold} Complaints). Escalated to High Priority government escalation notice.`
          );
        } else {
          setComplaintSuccessMsg(
            `Grievance registered successfully. (${data.complaintCount}/${data.threshold} needed for high-priority escalation).`
          );
        }
      } else {
        setErrorMsg(data.error || 'Failed to register complaint.');
      }
    } catch (err: any) {
      setErrorMsg('Failed to submit complaint: ' + err.message);
    } finally {
      setIsRegisteringComplaint(false);
    }
  };

  const diagnostics = result?.potholeDiagnostics;
  const geocoded = result?.geocodedLocation;
  const tender = result?.matchResult?.matchedTender;

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      {/* Upload & Input Card */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-white" />
            <h2 className="text-base font-bold text-white">Manual Geotagged Road Photo Analyzer</h2>
          </div>
          <span className="text-xs font-mono text-zinc-400">AI CV & EXIF PIPELINE</span>
        </div>

        {/* Drag & Drop Photo Upload */}
        <div className="relative border border-dashed border-zinc-700 hover:border-white rounded-2xl p-6 text-center bg-black/50 transition-all cursor-pointer group">
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
          {previewUrl ? (
            <div className="relative space-y-3">
              <div className="relative inline-block max-h-72 rounded-xl overflow-hidden border border-zinc-800 shadow-md">
                <img
                  src={previewUrl}
                  alt="Uploaded Road Defect"
                  className="max-h-72 w-auto object-contain grayscale contrast-125 mx-auto"
                />

                {/* AI Bounding Box Overlay if results present */}
                {showAiOverlay && diagnostics?.detectedPotholes && (
                  <div className="absolute inset-0 pointer-events-none">
                    {diagnostics.detectedPotholes.map((pothole: DetectedPothole, idx: number) => {
                      const [ymin, xmin, ymax, xmax] = pothole.box;
                      return (
                        <div
                          key={pothole.id}
                          style={{
                            top: `${ymin}%`,
                            left: `${xmin}%`,
                            width: `${xmax - xmin}%`,
                            height: `${ymax - ymin}%`,
                          }}
                          className="absolute border-2 border-white bg-white/10 rounded-lg"
                        >
                          <div className="absolute -top-5 left-0 bg-black/90 px-1.5 py-0.5 rounded text-[9px] font-mono text-white border border-zinc-700 whitespace-nowrap">
                            #{idx + 1} Pothole ({pothole.confidence}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="text-xs font-mono text-zinc-300 truncate max-w-sm mx-auto">
                {selectedFile?.name}
              </div>
              <span className="inline-block text-xs bg-zinc-900 text-zinc-300 px-3 py-1 rounded-full border border-zinc-800">
                Click or drag another image to replace
              </span>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  Click to Upload or Drag Road Defect Photo
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  Extracts GPS coordinates automatically or use manual coordinate override
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preset Locations */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-zinc-300" /> Lucknow Sample Road Stretches:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {PRESET_SAMPLES.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => applyPreset(preset)}
                className="text-left p-3 rounded-xl bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all text-xs cursor-pointer group"
              >
                <div className="font-bold text-zinc-200 group-hover:text-white transition-colors">
                  {preset.name}
                </div>
                <div className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">{preset.locationName}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Defect Dimension Tuning & GPS Coordinates */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-zinc-800">
          <div>
            <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase block mb-1">LATITUDE (°N)</label>
            <input
              type="number"
              step="0.00001"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase block mb-1">LONGITUDE (°E)</label>
            <input
              type="number"
              step="0.00001"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase block mb-1">DEPTH (CM)</label>
            <input
              type="number"
              step="0.5"
              value={defectDepth}
              onChange={(e) => setDefectDepth(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase block mb-1">WIDTH (CM)</label>
            <input
              type="number"
              step="1"
              value={defectWidth}
              onChange={(e) => setDefectWidth(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-white"
            />
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={runAnalysis}
          disabled={isAnalyzing}
          className="w-full bg-white hover:bg-zinc-200 text-black font-extrabold text-sm py-3.5 px-6 rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              <span>Executing CV Pothole & Tender Match Analysis...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4 text-black" />
              <span>Run AI Pothole Detection & Find Accountable Contractor</span>
            </>
          )}
        </button>
      </div>

      {/* Error Output */}
      {errorMsg && (
        <div className="bg-zinc-950 border border-zinc-800 text-zinc-300 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-white shrink-0" />
          <div className="text-xs font-mono">{errorMsg}</div>
        </div>
      )}

      {/* Output Result Card */}
      {result && (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm dark:shadow-2xl space-y-6 animate-in fade-in duration-200 transition-colors">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-sm">
              <Sparkles className="w-4 h-4 text-zinc-900 dark:text-white" />
              <span>AI Detection & Tender Legal Attribution</span>
            </div>
            {result.matchResult && (
              <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-black px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800">
                Confidence: {result.matchResult.confidenceScore}% • {result.matchResult.distanceMeters}m away
              </span>
            )}
          </div>

          {/* Computer Vision Pothole Diagnostics */}
          {diagnostics && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-zinc-500 dark:text-zinc-300" /> Computer Vision Inspection Summary
                </div>
                {previewUrl && (
                  <button
                    onClick={() => setShowAiOverlay(!showAiOverlay)}
                    className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 flex items-center gap-1 cursor-pointer bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 transition-colors"
                  >
                    {showAiOverlay ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{showAiOverlay ? 'Bounding Boxes: ON' : 'Bounding Boxes: OFF'}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                <div className="bg-zinc-50 dark:bg-black p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Potholes Identified</div>
                  <div className="text-base font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {diagnostics.potholeCount} Defect{diagnostics.potholeCount > 1 ? 's' : ''}
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-black p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Measured Dimensions</div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white mt-1">
                    {result.defectDepthCm}cm × {result.defectWidthCm}cm
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-black p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">ASTM D6433 PCI</div>
                  <div className="text-base font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {diagnostics.pciScore} / 100
                  </div>
                  <div className="text-[9px] text-zinc-500 dark:text-zinc-400">{diagnostics.pciRating}</div>
                </div>

                <div className="bg-zinc-50 dark:bg-black p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Hazard Severity</div>
                  <div className="text-sm font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {result.priorityAssessment.level}
                  </div>
                  <div className="text-[9px] text-zinc-500 dark:text-zinc-400">SLA: {result.priorityAssessment.slaHours}h</div>
                </div>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-black rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 font-mono space-y-1">
                <div className="text-zinc-900 dark:text-white font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300" />
                  <span>Structural Road Assessment:</span>
                </div>
                <div className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                  {diagnostics.damageRisk} (Estimated Asphalt Repair Volume: ~{diagnostics.estimatedAsphaltRepairVolumeM3} m³)
                </div>
              </div>
            </div>
          )}

          {/* Reverse Geocoded Location */}
          {geocoded && (
            <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <div className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-zinc-500 dark:text-zinc-300" /> Reverse Geocoded Ground Location
              </div>

              <div className="bg-zinc-50 dark:bg-black p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div className="text-sm font-bold text-zinc-900 dark:text-white">{geocoded.roadName}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono flex flex-wrap gap-x-2">
                  <span>{geocoded.locality}</span>
                  <span>•</span>
                  <span>{geocoded.ward}</span>
                  <span>•</span>
                  <span>{geocoded.city}, {geocoded.state} ({geocoded.pincode})</span>
                </div>
                <div className="text-[11px] font-mono text-zinc-500 pt-1">
                  GPS: {manualLat}°N, {manualLng}°E • Geohash: {geocoded.geohash}
                </div>
              </div>
            </div>
          )}

          {/* Accountable Contractor & Tender Match */}
          {tender ? (
            <div className="space-y-6 border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <div>
                <div className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-zinc-500 dark:text-zinc-300" /> Assigned Government Road Tender
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-snug">
                  {tender.title}
                </h3>
                <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{tender.organisation}</span>
                  <span>•</span>
                  <span>Tender ID: {tender.tender_id}</span>
                </div>
              </div>

              {/* Accountable Contractor Liability Box */}
              <div className="bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-zinc-900 dark:text-white" /> Accountable Contractor Liability
                  </div>

                  <span className="px-3 py-1 text-xs font-mono font-bold rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800">
                    Complaints: {liveComplaintCount} / 3
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-zinc-500 font-mono">Assigned Contractor</div>
                    <div className="text-base font-extrabold text-zinc-900 dark:text-white mt-0.5">
                      {tender.contractor_name}
                    </div>
                  </div>

                  <div>
                    <div className="text-zinc-500 font-mono">Budget & Warranty Status</div>
                    <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                      ₹{(tender.budget_inr / 100000).toFixed(2)} Lakhs
                      <span className="text-zinc-500 dark:text-zinc-400 font-normal ml-2 font-mono">(DLP Active)</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-zinc-100 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed font-mono">
                  <strong>Contractor Liability Clause:</strong> Contractor is legally accountable for asphalt restoration under the Defect Liability Period (DLP) established by {tender.organisation}.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <Link
                  href={`/tender-complaint?tenderId=${encodeURIComponent(tender.tender_id)}`}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-extrabold text-sm py-3.5 px-6 rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  <span>Open Dedicated Contractor Grievance Notice</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <button
                  onClick={handleRegisterComplaint}
                  disabled={isRegisteringComplaint}
                  className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-sm py-3 px-6 rounded-2xl border border-zinc-300 dark:border-zinc-800 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isRegisteringComplaint ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-800 dark:border-white/30 dark:border-t-white rounded-full animate-spin"></div>
                      <span>Registering Grievance...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                      <span>Lodge Direct Citizen Grievance</span>
                    </>
                  )}
                </button>

                {complaintSuccessMsg && (
                  <div className="p-4 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 text-xs font-mono space-y-2 animate-in fade-in">
                    <div>{complaintSuccessMsg}</div>
                    {isEscalated && (
                      <div>
                        <Link
                          href="/escalated"
                          className="inline-flex items-center gap-1 text-xs font-bold text-zinc-900 dark:text-white underline"
                        >
                          View High Priority Escalation Board <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-2">
              <AlertCircle className="w-8 h-8 text-zinc-400 mx-auto" />
              <div className="text-sm font-bold text-zinc-900 dark:text-white">No Matching Active Road Tender</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{result.matchResult?.matchReason}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
