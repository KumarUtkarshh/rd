'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Compass,
  Eye,
  EyeOff,
  ShieldAlert,
  Send,
  Building2,
  RotateCcw,
  Upload,
  ArrowRight
} from 'lucide-react';
import { DefectReport } from '@/lib/db';
import { DetectedPothole, PavementDiagnostics, detectPotholesFromPixels } from '@/lib/potholeDetector';
import { classifyRoadImageFromPixels, INVALID_ROAD_MESSAGE } from '@/lib/roadClassifier';
import { extractExifData } from '@/lib/exif';

export interface PresetLocation {
  name: string;
  lat: number;
  lng: number;
  area: string;
  contractorName: string;
  agency: string;
  budgetFormatted: string;
  roadType: string;
  status: string;
  tenderId: string;
  complaintCount: number;
}

export const PRESET_LOCATIONS: PresetLocation[] = [
  {
    name: 'Shaheed Path Service Road',
    lat: 26.8468,
    lng: 81.0105,
    area: 'Gomti Nagar Vistar Sector-1, Lucknow',
    contractorName: 'Lucknow Express Highways & Infra Ltd',
    agency: 'Lucknow Development Authority',
    budgetFormatted: '₹1.25 Cr',
    roadType: 'Service Road / Highway Connector',
    status: 'HIGH PRIORITY ESCALATED (Notice Issued)',
    tenderId: '2026_LDAUP_1175656_1',
    complaintCount: 4,
  },
  {
    name: 'Kanpur Road Yojna',
    lat: 26.7768,
    lng: 80.8845,
    area: 'Mragshira Apartment, Kanpur Road, Lucknow',
    contractorName: 'UP Rajkiya Nirman Nigam & Associates',
    agency: 'Lucknow Development Authority',
    budgetFormatted: '₹45.0 Lakhs',
    roadType: 'Arterial Road',
    status: 'Active Maintenance',
    tenderId: '2026_LDAUP_1175282_1',
    complaintCount: 1,
  },
  {
    name: 'Hardoi Road (Ward 85)',
    lat: 26.8732,
    lng: 80.8922,
    area: 'Mallahi Tola I, Hardoi Road, Lucknow',
    contractorName: 'Hardoi Road Builders & Co',
    agency: 'Rural Engineering Department (RED)',
    budgetFormatted: '₹24.0 Lakhs',
    roadType: 'State Highway / Ward Road',
    status: 'Active Contract',
    tenderId: '2026_REDUP_1174069_4',
    complaintCount: 0,
  },
  {
    name: 'Mohan Road (Nadarganj)',
    lat: 26.7892,
    lng: 80.8462,
    area: 'Nadarganj to TS Mishra Bridge, Mohan Road',
    contractorName: 'Mohan Highway Expansion Agency',
    agency: 'Lucknow Development Authority',
    budgetFormatted: '₹4.80 Cr',
    roadType: 'Major Industrial Highway',
    status: 'Active Widening Work',
    tenderId: '2026_LDAUP_1173891_1',
    complaintCount: 0,
  },
  {
    name: 'Chinhat Nandi Vihar',
    lat: 26.8892,
    lng: 81.0562,
    area: 'Chinhat, Lucknow',
    contractorName: 'Chinhat Roadlines & Developers',
    agency: 'Rural Engineering Department (RED)',
    budgetFormatted: '₹19.5 Lakhs',
    roadType: 'Suburban Link Road',
    status: 'Active Maintenance',
    tenderId: '2026_REDUP_1174069_6',
    complaintCount: 0,
  },
];

export default function MobileRoadCapture() {
  // State
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [lat, setLat] = useState<string>('26.8468');
  const [lng, setLng] = useState<string>('81.0105');
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'locked' | 'denied'>('idle');
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPresetName, setSelectedPresetName] = useState<string>('Shaheed Path Service Road');
  const [selectedPreset, setSelectedPreset] = useState<PresetLocation | null>(PRESET_LOCATIONS[0]);

  // Webcam modal state (for desktop/secure context)
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isMobile, setIsMobile] = useState(false);

  // AI Pothole Detection & Accountability State
  const [analysisReport, setAnalysisReport] = useState<DefectReport | null>(null);
  const [showAiOverlay, setShowAiOverlay] = useState(true);

  // Complaint Form State
  const [citizenRemark, setCitizenRemark] = useState('');
  const [citizenContact, setCitizenContact] = useState('');
  const [isLODGINGComplaint, setIsLODGINGComplaint] = useState(false);
  const [complaintNotice, setComplaintNotice] = useState<string | null>(null);
  const [liveComplaintCount, setLiveComplaintCount] = useState<number>(0);
  const [isEscalated, setIsEscalated] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Device detection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    }
  }, []);

  // Auto-fetch device GPS on mount
  useEffect(() => {
    fetchCurrentLocation(false);
  }, []);

  const fetchCurrentLocation = (isRefresh = false) => {
    if (typeof window === 'undefined') return;
    if (!('geolocation' in navigator)) {
      setGpsStatus('denied');
      setGpsNotice('GPS unavailable on this device');
      return;
    }

    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(5));
        setLng(position.coords.longitude.toFixed(5));
        setSelectedPresetName('Live Device GPS');
        setSelectedPreset(null);
        setGpsStatus('locked');
        if (isRefresh) {
          setGpsNotice('GPS Refreshed');
          setTimeout(() => setGpsNotice(null), 2500);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setGpsStatus('denied');
        setGpsNotice('GPS signal not found');
        setTimeout(() => setGpsNotice(null), 3500);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const handleSelectPreset = (preset: PresetLocation) => {
    setLat(preset.lat.toFixed(5));
    setLng(preset.lng.toFixed(5));
    setSelectedPresetName(preset.name);
    setSelectedPreset(preset);
    setGpsStatus('idle');
    if (analysisReport) {
      setAnalysisReport(null);
      setComplaintNotice(null);
    }
  };

  // Attach stream to videoRef when modal opens
  useEffect(() => {
    if (isWebcamOpen && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => console.warn('Webcam play error:', err));
    }
  }, [stream, isWebcamOpen]);

  // Clean up media tracks
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Stop Webcam
  const stopWebcam = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsWebcamOpen(false);
  }, [stream]);

  // Launch Desktop Webcam
  const openDesktopWebcam = async (mode: 'environment' | 'user' = facingMode) => {
    setErrorMsg(null);
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      });
      setStream(mediaStream);
      setIsWebcamOpen(true);
    } catch {
      // Fallback: trigger file camera input
      nativeCameraInputRef.current?.click();
    }
  };

  // Click handler for the primary "Capture Road Photo" button
  const handleCaptureClick = (e: React.MouseEvent) => {
    // On mobile phone or non-webcam setups: let native HTML label fire native camera directly
    if (isMobile || !navigator?.mediaDevices?.getUserMedia) {
      return;
    }
    // On desktop with webcam support: open in-browser webcam scanner
    e.preventDefault();
    openDesktopWebcam('environment');
  };

  // Optimize image dimensions and evaluate road recognition & real pothole detection
  const optimizeAndVerifyImage = async (
    source: File | HTMLCanvasElement
  ): Promise<{
    isRoad: boolean;
    reason?: string;
    blob: Blob;
    displayUrl: string;
    diagnostics?: PavementDiagnostics;
    exifLat?: number | null;
    exifLng?: number | null;
  }> => {
    return new Promise(async (resolve, reject) => {
      let exifLat: number | null = null;
      let exifLng: number | null = null;

      if (source instanceof File) {
        try {
          const arrayBuffer = await source.arrayBuffer();
          const exif = await extractExifData(arrayBuffer);
          if (exif.hasGps && exif.latitude !== null && exif.longitude !== null) {
            exifLat = exif.latitude;
            exifLng = exif.longitude;
          }
        } catch (exifErr) {
          console.warn('Client EXIF extraction fallback:', exifErr);
        }
      }

      const processCanvas = (canvas: HTMLCanvasElement, displayUrl: string) => {
        try {
          // 1. Generate 256x256 thumbnail for rapid Computer Vision road evaluation
          const cvCanvas = document.createElement('canvas');
          cvCanvas.width = 256;
          cvCanvas.height = 256;
          const cvCtx = cvCanvas.getContext('2d');
          if (!cvCtx) {
            reject(new Error('Canvas 2D context unavailable'));
            return;
          }
          cvCtx.drawImage(canvas, 0, 0, 256, 256);
          const imgData = cvCtx.getImageData(0, 0, 256, 256);

          // 2. Classify image with road & pothole recognition engine
          const classification = classifyRoadImageFromPixels(imgData.data, 256, 256);

          // 3. Detect real potholes from pixel features
          let diagnostics: PavementDiagnostics | undefined;
          if (classification.isRoad) {
            diagnostics = detectPotholesFromPixels(
              imgData.data,
              256,
              256,
              exifLat ?? parseFloat(lat),
              exifLng ?? parseFloat(lng)
            );
          }

          // 4. Compress main canvas to ~300KB JPEG (eliminates large payload network errors)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to encode optimized photo'));
                return;
              }
              resolve({
                isRoad: classification.isRoad,
                reason: classification.reason,
                blob,
                displayUrl,
                diagnostics,
                exifLat,
                exifLng,
              });
            },
            'image/jpeg',
            0.85
          );
        } catch (cvErr) {
          reject(cvErr);
        }
      };

      if (source instanceof HTMLCanvasElement) {
        const displayUrl = source.toDataURL('image/jpeg', 0.85);
        processCanvas(source, displayUrl);
      } else {
        const displayUrl = URL.createObjectURL(source);
        const img = new Image();
        img.onload = () => {
          // Downscale high-resolution mobile photos (e.g. 12-48MP) to max 1400px
          const MAX_DIM = 1400;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;

          if (w > MAX_DIM || h > MAX_DIM) {
            if (w > h) {
              h = Math.round((h * MAX_DIM) / w);
              w = MAX_DIM;
            } else {
              w = Math.round((w * MAX_DIM) / h);
              h = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          processCanvas(canvas, displayUrl);
        };
        img.onerror = () => {
          reject(new Error('Failed to load image for road analysis'));
        };
        img.src = displayUrl;
      }
    });
  };

  // Run Road Verification & Tender Match Analysis
  const processAndAnalyzeImage = async (source: File | HTMLCanvasElement) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    setAnalysisReport(null);
    setComplaintNotice(null);

    try {
      // 1. Client-side Image Optimization & Computer Vision Road Verification
      const processed = await optimizeAndVerifyImage(source);
      setCapturedImage(processed.displayUrl);

      if (!processed.isRoad) {
        // Image is not a recognized road or pothole
        setIsAnalyzing(false);
        setErrorMsg(processed.reason || INVALID_ROAD_MESSAGE);
        return;
      }

      // If photo contained real EXIF GPS coordinates, update coordinates
      let targetLat = lat;
      let targetLng = lng;
      if (processed.exifLat && processed.exifLng) {
        targetLat = processed.exifLat.toFixed(5);
        targetLng = processed.exifLng.toFixed(5);
        setLat(targetLat);
        setLng(targetLng);
        setSelectedPresetName('GPS Geotagged Camera Photo');
        setSelectedPreset(null);
        setGpsStatus('locked');
      }

      // 2. Submit optimized payload to server
      const file = new File([processed.blob], `road_defect_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });

      const formData = new FormData();
      formData.append('image', file);
      formData.append('latitude', targetLat);
      formData.append('longitude', targetLng);
      formData.append('userNotes', `Defect captured at ${selectedPresetName}`);
      formData.append('isRoadValid', 'true');
      if (processed.diagnostics) {
        formData.append('potholeDiagnostics', JSON.stringify(processed.diagnostics));
        const primary = processed.diagnostics.detectedPotholes?.[0];
        if (primary) {
          formData.append('defectDepthCm', String(primary.estimatedDepthCm));
          formData.append('defectWidthCm', String(primary.estimatedWidthCm));
        } else if (processed.diagnostics.potholeCount === 0) {
          formData.append('defectDepthCm', '0');
          formData.append('defectWidthCm', '0');
        }
      }

      const res = await fetch('/api/analyze-pothole', {
        method: 'POST',
        body: formData,
      });

      // Safe JSON decoding
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Server returned an invalid response format.');
      }

      if (!res.ok || data.error) {
        setErrorMsg(data.message || data.error || 'Failed to analyze road defect.');
      } else {
        setAnalysisReport(data.report);

        // Update GPS if photo had real EXIF coordinates
        if (data.report?.latitude && data.report?.longitude) {
          setLat(Number(data.report.latitude).toFixed(5));
          setLng(Number(data.report.longitude).toFixed(5));
        }

        const matchedTender = data.report?.matchResult?.matchedTender;
        if (matchedTender) {
          setLiveComplaintCount(matchedTender.complaint_count || 0);
          setIsEscalated(!!matchedTender.is_escalated);
        }

        if (typeof window !== 'undefined') {
          sessionStorage.setItem('current_defect_report', JSON.stringify(data.report));
          sessionStorage.setItem('current_defect_image', processed.displayUrl);
        }
      }
    } catch (err: any) {
      console.error('Image analysis error:', err);
      const msg = err.message || String(err);
      if (msg.includes('JSON') || msg.includes('Unexpected') || msg.includes('token')) {
        setErrorMsg(
          'Unable to parse road defect response. Please verify network connection and try again.'
        );
      } else {
        setErrorMsg('Network error: ' + msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Snapshot from desktop webcam
  const takeWebcamSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('Webcam video stream not ready yet');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopWebcam();
    processAndAnalyzeImage(canvas);
  };

  // Handle Photo Taken via Native Camera or Gallery Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processAndAnalyzeImage(file);
    }
    e.target.value = '';
  };

  // Lodge Official Grievance
  const handleLodgeComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analysisReport?.matchResult?.matchedTender) return;

    setIsLODGINGComplaint(true);
    setComplaintNotice(null);

    try {
      const tender = analysisReport.matchResult.matchedTender;
      const remarkText = citizenRemark.trim() || `Road defect & pothole complaint registered for: ${tender.title}`;
      const remarkWithContact = citizenContact.trim()
        ? `${remarkText} [Contact: ${citizenContact.trim()}]`
        : remarkText;

      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenderId: tender.tender_id,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          citizenRemark: remarkWithContact,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLiveComplaintCount(data.complaintCount);
        setIsEscalated(data.isEscalated);
        if (data.isEscalated) {
          setComplaintNotice(
            `GOVERNMENT ESCALATION NOTICE: Threshold reached (${data.complaintCount}/${data.threshold} Complaints). Official High Priority Notice issued to ${tender.organisation} & contractor ${tender.contractor_name}.`
          );
        } else {
          setComplaintNotice(
            `Official complaint registered successfully. (${data.complaintCount}/${data.threshold} complaints needed for automatic government escalation notice).`
          );
        }
      } else {
        setErrorMsg(data.error || 'Failed to lodge complaint.');
      }
    } catch (err: any) {
      setErrorMsg('Failed to submit grievance: ' + err.message);
    } finally {
      setIsLODGINGComplaint(false);
    }
  };

  const handleResetCapture = () => {
    setCapturedImage(null);
    setAnalysisReport(null);
    setComplaintNotice(null);
    setErrorMsg(null);
    setCitizenRemark('');
    setCitizenContact('');
  };

  const tender = analysisReport?.matchResult?.matchedTender;
  const diagnostics = analysisReport?.potholeDiagnostics;
  const geocoded = analysisReport?.geocodedLocation;

  return (
    <div className="w-full max-w-2xl mx-auto font-sans space-y-6">
      {/* Hidden Hardware Camera Input (Instant phone camera) */}
      <input
        ref={nativeCameraInputRef}
        id="camera-capture-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only opacity-0 absolute w-0 h-0 pointer-events-none"
      />

      {/* Hidden Gallery Input */}
      <input
        ref={galleryInputRef}
        id="gallery-upload-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only opacity-0 absolute w-0 h-0 pointer-events-none"
      />

      {/* MAIN CARD */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm dark:shadow-2xl space-y-6 transition-colors duration-150">
        {/* Top Status & GPS Bar */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-200 tracking-wider uppercase">
              ROAD TENDER & CONTRACTOR MATCHER
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {gpsNotice && (
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 animate-in fade-in hidden sm:inline">
                {gpsNotice}
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchCurrentLocation(gpsStatus === 'locked')}
              disabled={gpsStatus === 'locating'}
              className={`flex items-center justify-center gap-1.5 text-[11px] font-mono px-3.5 py-1.5 rounded-full border transition-all shrink-0 min-w-[122px] h-8 select-none ${
                gpsStatus === 'locked'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 shadow-sm dark:shadow-[0_0_12px_rgba(16,185,129,0.18)] cursor-pointer'
                  : gpsStatus === 'locating'
                  ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 cursor-wait'
                  : gpsStatus === 'denied'
                  ? 'bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/40 cursor-pointer'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer'
              }`}
              title={
                gpsStatus === 'locked'
                  ? `Live GPS Active (${lat}°N, ${lng}°E). Click to refresh.`
                  : gpsStatus === 'locating'
                    ? 'Acquiring high-accuracy GPS coordinates...'
                    : 'Auto-detect device GPS coordinates'
              }
            >
              {gpsStatus === 'locating' ? (
                <>
                  <Compass className="w-3.5 h-3.5 animate-spin text-zinc-600 dark:text-zinc-200 shrink-0" />
                  <span>Locating...</span>
                </>
              ) : gpsStatus === 'locked' ? (
                <>
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-semibold tracking-tight">GPS Locked</span>
                </>
              ) : gpsStatus === 'denied' ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0" />
                  <span>GPS Offline</span>
                </>
              ) : (
                <>
                  <Compass className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                  <span>Auto GPS</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* IMAGE DISPLAY AREA (Shown when photo is captured/uploaded) */}
        {capturedImage ? (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-4/3 flex items-center justify-center shadow-xl">
              <img
                src={capturedImage}
                alt="Captured Road Defect"
                className="w-full h-full object-cover grayscale contrast-125"
              />

              {/* AI Pothole Bounding Box Overlay */}
              {showAiOverlay && diagnostics?.detectedPotholes && (
                <div className="absolute inset-0 pointer-events-none">
                  {diagnostics.detectedPotholes.map((pothole: DetectedPothole, idx: number) => {
                    const [ymin, xmin, ymax, xmax] = pothole.box;
                    const top = `${ymin}%`;
                    const left = `${xmin}%`;
                    const width = `${xmax - xmin}%`;
                    const height = `${ymax - ymin}%`;

                    const isCritical = pothole.severity === 'CRITICAL';
                    const isHigh = pothole.severity === 'HIGH';

                    return (
                      <div
                        key={pothole.id}
                        style={{ top, left, width, height }}
                        className={`absolute border-2 rounded-lg transition-all ${isCritical
                          ? 'border-rose-500 bg-rose-500/10 shadow-[0_0_12px_rgba(244,63,94,0.5)]'
                          : isHigh
                            ? 'border-amber-400 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                            : 'border-white bg-white/10'
                          }`}
                      >
                        <div className="absolute -top-6 left-0 flex items-center gap-1 bg-black/90 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white border border-zinc-700 whitespace-nowrap shadow-md">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-rose-500 animate-ping' : 'bg-amber-400'
                              }`}
                          />
                          <span>#{idx + 1} Pothole ({pothole.confidence}%)</span>
                        </div>
                        <div className="absolute -bottom-5 right-0 bg-black/90 px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-300 border border-zinc-800">
                          {pothole.estimatedDepthCm}cm depth × {pothole.estimatedWidthCm}cm
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Toggle AI Overlay Button */}
              {diagnostics && (
                <button
                  type="button"
                  onClick={() => setShowAiOverlay(!showAiOverlay)}
                  className="absolute top-3 right-3 bg-black/80 hover:bg-black text-white px-3 py-1 rounded-full text-[11px] font-mono flex items-center gap-1.5 border border-zinc-700 shadow-md backdrop-blur cursor-pointer z-10"
                >
                  {showAiOverlay ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      <span>AI Boxes: ON</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                      <span>AI Boxes: OFF</span>
                    </>
                  )}
                </button>
              )}

              {/* Bottom Watermark Bar */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 flex items-center justify-between text-xs font-mono text-white">
                <span className="flex items-center gap-1.5 text-zinc-200">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>CAPTURED DEFECT</span>
                </span>
                <span className="text-[11px] text-zinc-400">
                  {lat}°N, {lng}°E
                </span>
              </div>
            </div>

            {/* Retake / New Photo Action */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetCapture}
                className="text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1.5 py-1 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 cursor-pointer transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Capture / Upload Another Photo</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* 
          EXACTLY TWO BUTTONS AS REQUESTED:
          1. "Capture Road Photo"
          2. "Gallery Upload"
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* BUTTON 1: Capture Road Photo */}
          <label
            htmlFor="camera-capture-input"
            onClick={handleCaptureClick}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-extrabold text-sm py-4 px-6 rounded-2xl shadow-md dark:shadow-lg flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer text-center select-none"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-inherit" />
                <span>Analyzing Photo...</span>
              </>
            ) : (
              <>
                <Camera className="w-5 h-5 text-inherit" />
                <span>Capture Road Photo</span>
              </>
            )}
          </label>

          {/* BUTTON 2: Gallery Upload */}
          <label
            htmlFor="gallery-upload-input"
            className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-100 font-bold text-sm py-4 px-6 rounded-2xl border border-zinc-300 dark:border-zinc-700 shadow-sm dark:shadow-md flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer text-center select-none"
          >
            <Upload className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            <span>Gallery Upload</span>
          </label>
        </div>

        {/* Error Alert / Road Verification Notice */}
        {errorMsg && (
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono animate-in fade-in duration-200 ${
              errorMsg === INVALID_ROAD_MESSAGE
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 shadow-sm dark:shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  errorMsg === INVALID_ROAD_MESSAGE ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-800 dark:text-white'
                }`}
              />
              <div className="space-y-1">
                <span className="font-semibold block leading-relaxed">{errorMsg}</span>
                {errorMsg === INVALID_ROAD_MESSAGE && (
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400 block">
                    Our AI models require asphalt pavement and visible potholes to match with civic road maintenance contracts.
                  </span>
                )}
              </div>
            </div>

            {errorMsg === INVALID_ROAD_MESSAGE && (
              <button
                type="button"
                onClick={handleResetCapture}
                className="self-end sm:self-center shrink-0 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-bold text-[11px] px-3.5 py-1.5 rounded-xl cursor-pointer transition-all active:scale-95"
              >
                Try Another Photo
              </button>
            )}
          </div>
        )}

        {/* Preset Location Chips */}
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300" /> Selected Road Stretch:
            </label>
            <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-400 truncate max-w-[200px]">
              {selectedPresetName}
            </span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {PRESET_LOCATIONS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all shrink-0 border cursor-pointer ${
                  selectedPresetName === preset.name
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white font-bold shadow-sm'
                    : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 border-zinc-200 dark:bg-black dark:text-zinc-400 dark:hover:text-white dark:border-zinc-800 dark:hover:border-zinc-700'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* Accountable Contractor & Tender Profile Card (Shown when a stretch is selected) */}
          {selectedPreset && (
            <div className="mt-2.5 bg-zinc-50 dark:bg-black/85 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 shadow-xs dark:shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800/70 pb-2.5">
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300" />
                    <span>Accountable Road Contractor:</span>
                  </div>
                  <div className="text-sm font-extrabold text-zinc-900 dark:text-white mt-0.5 tracking-tight flex items-center gap-2">
                    <span>{selectedPreset.contractorName}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Active Civic Contractor" />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-mono px-2.5 py-1 rounded-full border ${
                      selectedPreset.complaintCount >= 3
                        ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/40 font-bold'
                        : selectedPreset.complaintCount > 0
                        ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/40 font-bold'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800'
                    }`}
                  >
                    {selectedPreset.complaintCount >= 3
                      ? '🚨 Notice Issued'
                      : selectedPreset.complaintCount > 0
                        ? `⚡ ${selectedPreset.complaintCount}/3 Complaints`
                        : '0 Complaints'}
                  </span>
                  <span className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-800">
                    {selectedPreset.roadType}
                  </span>
                </div>
              </div>

              {/* Grid: Authority, Budget, Lifecycle Status */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                <div className="bg-white dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/60 shadow-2xs">
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase">Civic Authority</div>
                  <div className="text-zinc-800 dark:text-zinc-200 font-semibold mt-0.5 truncate">{selectedPreset.agency}</div>
                </div>
                <div className="bg-white dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/60 shadow-2xs">
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase">Contract Budget</div>
                  <div className="text-zinc-800 dark:text-zinc-200 font-semibold mt-0.5">{selectedPreset.budgetFormatted}</div>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-white dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/60 shadow-2xs">
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase">Work Status</div>
                  <div className="text-zinc-800 dark:text-zinc-200 font-semibold mt-0.5 truncate">{selectedPreset.status}</div>
                </div>
              </div>

              {/* Action Link to Full Tender Profile */}
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400 pt-1">
                <span className="truncate max-w-[260px]">Contract ID: {selectedPreset.tenderId}</span>
                <Link
                  href={`/tender-complaint?tenderId=${encodeURIComponent(selectedPreset.tenderId)}`}
                  className="text-zinc-900 dark:text-white hover:underline flex items-center gap-1 font-bold shrink-0"
                >
                  <span>View Contract Details & Lodge Complaint</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ANALYSIS RESULTS & CONTRACTOR ACCOUNTABILITY CARD */}
      {analysisReport && (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm dark:shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 transition-colors duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-zinc-900 dark:text-white" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-mono">
                Pothole Diagnostics & Accountable Tender
              </h2>
            </div>
            <span className="text-[11px] font-mono bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800">
              ID: {analysisReport.id}
            </span>
          </div>

          {/* 1. Computer Vision Pothole Metrics */}
          {diagnostics && (
            <div className="space-y-3">
              <div className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                1. AI Pothole Detection Analysis
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono">
                <div className="bg-zinc-50 dark:bg-black p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Defects Detected</div>
                  <div className="text-base font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {diagnostics.potholeCount} Pothole{diagnostics.potholeCount !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-black p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Measured Depth</div>
                  <div className="text-base font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {analysisReport.defectDepthCm} cm
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-black p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Pavement Index (PCI)</div>
                  <div className="text-base font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {diagnostics.pciScore} / 100
                  </div>
                  <div className="text-[9px] text-zinc-500 dark:text-zinc-400">{diagnostics.pciRating}</div>
                </div>

                <div className="bg-zinc-50 dark:bg-black p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Severity Level</div>
                  <div className="text-sm font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {analysisReport.priorityAssessment.level}
                  </div>
                  <div className="text-[9px] text-zinc-500 dark:text-zinc-400">SLA: {analysisReport.priorityAssessment.slaHours}h</div>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-black rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 font-mono">
                <span className="text-zinc-900 dark:text-white font-bold">Hazard Assessment: </span>
                <span className="text-zinc-600 dark:text-zinc-400">{diagnostics.damageRisk}</span>
              </div>
            </div>
          )}

          {/* 2. Geocoded Location */}
          {geocoded && (
            <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-4 font-mono">
              <div className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-zinc-500 dark:text-zinc-300" /> 2. Ground Location Determined
              </div>

              <div className="bg-zinc-50 dark:bg-black p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-1">
                <div className="text-sm font-bold text-zinc-900 dark:text-white">{geocoded.roadName}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {geocoded.locality} • {geocoded.ward} • {geocoded.city}, {geocoded.state}
                </div>
                <div className="text-[11px] text-zinc-500 pt-1">
                  GPS Coordinates: {lat}°N, {lng}°E
                </div>
              </div>
            </div>
          )}

          {/* 3. Accountable Road Tender & Contractor from Database or eTender Crawler */}
          {tender ? (
            <div className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-zinc-900 dark:text-white" /> 3. Responsible Tender & Contractor
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-full border bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {analysisReport?.matchResult?.dataSource === 'ETENDER_CRAWLER'
                      ? 'Live eTender Portal'
                      : 'Database Match'}
                  </span>
                  <span className="px-3 py-1 text-xs font-mono font-bold rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800">
                    Complaints: {liveComplaintCount} / 3
                  </span>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-black p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                {/* Contractor Name */}
                <div>
                  <div className="text-[10px] text-zinc-500 font-mono uppercase">Assigned Contractor Company</div>
                  <div className="text-lg font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {tender.contractor_name}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    Authority: <strong className="text-zinc-800 dark:text-zinc-200">{tender.organisation}</strong> • Tender ID: <span className="font-mono text-zinc-700 dark:text-zinc-300">{tender.tender_id}</span>
                  </div>
                </div>

                {/* Tender Work Title */}
                <div className="p-3 bg-zinc-100 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                  <span className="text-zinc-500 font-mono text-[10px] block uppercase">Tender Work Scope</span>
                  <div className="text-zinc-800 dark:text-zinc-200 font-medium mt-0.5">{tender.title}</div>
                </div>

                {/* Budget & DLP */}
                <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-1">
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase">Sanctioned Budget</div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                      ₹{(tender.budget_inr / 100000).toFixed(2)} Lakhs
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase">Defect Liability (DLP)</div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      Active Legal Liability
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono leading-relaxed border-t border-zinc-200 dark:border-zinc-900 pt-3">
                  <strong>Contractor Responsibility:</strong> Under UP PWD Clause 14.2 (Defect Liability Period), contractor <em>{tender.contractor_name}</em> is legally obligated to rectify potholes on this stretch at zero cost to the public.
                </div>
              </div>

              {/* 4. Lodge a Complaint Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                    <span>4. Lodge Official Citizen Grievance</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                    Threshold: 3 Complaints = Escalation
                  </span>
                </div>

                {/* Complaint Progress Meter */}
                <div className="p-3.5 bg-zinc-50 dark:bg-black rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-600 dark:text-zinc-400">Escalation Progress:</span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {liveComplaintCount} / 3 Registered
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-300 dark:border-zinc-800">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        liveComplaintCount >= 3 ? 'bg-rose-500 w-full' : liveComplaintCount === 2 ? 'bg-amber-400 w-2/3' : 'bg-zinc-900 dark:bg-white w-1/3'
                      }`}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500 flex justify-between">
                    <span>1: Logged</span>
                    <span>2: Warning</span>
                    <span className={liveComplaintCount >= 3 ? 'text-rose-500 dark:text-rose-400 font-bold' : ''}>3: Vigilance Notice</span>
                  </div>
                </div>

                {/* Quick Hazard Selector Chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Quick Defect Hazard Tags:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Rim & Tire Damage Hazard',
                      'Two-Wheeler Skid Risk',
                      'Waterlogged Deep Crater',
                      'Pedestrian Safety Risk'
                    ].map((hazard, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const current = citizenRemark.trim();
                          if (!current) {
                            setCitizenRemark(hazard);
                          } else if (!current.includes(hazard)) {
                            setCitizenRemark(`${current}, ${hazard}`);
                          }
                        }}
                        className="text-[11px] font-mono bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-all cursor-pointer"
                      >
                        + {hazard}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleLodgeComplaint} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">
                      Citizen Remarks (Optional)
                    </label>
                    <textarea
                      value={citizenRemark}
                      onChange={(e) => setCitizenRemark(e.target.value)}
                      placeholder="e.g. Dangerous pothole near sector turn causing severe vehicle damage..."
                      rows={2}
                      className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-900 dark:focus:border-white font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <input
                        type="tel"
                        value={citizenContact}
                        onChange={(e) => setCitizenContact(e.target.value)}
                        placeholder="Mobile for status SMS (optional)"
                        className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-900 dark:focus:border-white font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLODGINGComplaint}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-extrabold text-xs py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                    >
                      {isLODGINGComplaint ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-inherit" />
                          <span>Submitting Official Grievance...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-inherit" />
                          <span>Submit Official Complaint</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Complaint Notice / Escalation Banner */}
                {complaintNotice && (
                  <div className="p-4 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-mono space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                      <span className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-white" />
                        <span>Grievance Registered</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        REF: UP-PWD-{Date.now().toString().slice(-5)}
                      </span>
                    </div>

                    <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-[11px]">{complaintNotice}</div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <Link
                        href={`/tender-complaint?tenderId=${encodeURIComponent(tender.tender_id)}`}
                        className="flex-1 py-2 px-3 bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-black text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <span>Print Legal Notice</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>

                      {isEscalated && (
                        <Link
                          href="/escalated"
                          className="flex-1 py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-black rounded-xl text-center text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <span>View Escalation Board</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-5 bg-zinc-50 dark:bg-black rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
              <AlertCircle className="w-7 h-7 text-zinc-400 mx-auto" />
              <div className="text-xs font-bold text-zinc-900 dark:text-white font-mono">No Matching Active Road Tender Found</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">{analysisReport.matchResult.matchReason}</div>
            </div>
          )}
        </div>
      )}

      {/* Desktop Webcam Viewfinder Modal */}
      {isWebcamOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between">
          <div className="p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black to-transparent">
            <button
              type="button"
              onClick={stopWebcam}
              className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center border border-zinc-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              ALIGN POTHOLE IN WEBCAM
            </div>
            <button
              type="button"
              onClick={() => {
                const next = facingMode === 'environment' ? 'user' : 'environment';
                setFacingMode(next);
                openDesktopWebcam(next);
              }}
              className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center border border-zinc-800 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover grayscale contrast-125"
            />
            <div className="absolute inset-x-8 inset-y-16 border border-zinc-500/40 rounded-3xl pointer-events-none flex items-center justify-center">
              <div className="text-[11px] font-mono font-bold text-white bg-black/80 px-4 py-1.5 rounded-full border border-zinc-700">
                ALIGN ROAD DEFECT
              </div>
            </div>
          </div>

          <div className="p-6 bg-black flex flex-col items-center gap-3 z-10 border-t border-zinc-900">
            <button
              type="button"
              onClick={takeWebcamSnapshot}
              className="w-20 h-20 rounded-full border-4 border-white p-1 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-white"></div>
            </button>
            <span className="text-[11px] font-mono text-zinc-400">TAP TO SNAP & ANALYZE</span>
          </div>
        </div>
      )}
    </div>
  );
}
