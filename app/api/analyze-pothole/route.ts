import { NextRequest, NextResponse } from 'next/server';
import { extractExifData } from '@/lib/exif';
import { getAllTenders, saveReport, DefectReport } from '@/lib/db';
import { matchPotholeToTender } from '@/lib/tenderMatcher';
import { crawlETenders } from '@/lib/crawler';
import { calculateDefectPriority } from '@/lib/priorityEngine';
import {
  analyzePotholesAndSurface,
  detectPotholesFromPixels,
  reverseGeocodeLocation,
  PavementDiagnostics,
} from '@/lib/potholeDetector';
import { classifyRoadImageFromPixels, INVALID_ROAD_MESSAGE } from '@/lib/roadClassifier';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let latitude: number | null = null;
    let longitude: number | null = null;
    let userNotes = '';
    let defectDepthCm = 8;
    let defectWidthCm = 40;
    let imageName = 'uploaded_image.jpg';
    let exifInfo: any = null;
    let potholeDiagnostics: PavementDiagnostics | null = null;

    let isRoadValid = true;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('image') as File | null;
      const customLat = formData.get('latitude') as string | null;
      const customLng = formData.get('longitude') as string | null;
      const isRoadValidParam = formData.get('isRoadValid') as string | null;
      if (isRoadValidParam === 'false') {
        isRoadValid = false;
      }

      const clientDiagnosticsStr = formData.get('potholeDiagnostics') as string | null;
      if (clientDiagnosticsStr) {
        try {
          potholeDiagnostics = JSON.parse(clientDiagnosticsStr);
        } catch (e) {
          console.warn('Could not parse client pothole diagnostics:', e);
        }
      }

      userNotes = (formData.get('userNotes') as string) || '';
      if (formData.get('defectDepthCm')) defectDepthCm = parseFloat(formData.get('defectDepthCm') as string);
      if (formData.get('defectWidthCm')) defectWidthCm = parseFloat(formData.get('defectWidthCm') as string);

      if (file) {
        imageName = file.name;
        try {
          const arrayBuffer = await file.arrayBuffer();
          exifInfo = await extractExifData(arrayBuffer);

          if (exifInfo.hasGps && exifInfo.latitude !== null && exifInfo.longitude !== null) {
            latitude = exifInfo.latitude;
            longitude = exifInfo.longitude;
          }

          // If client didn't supply potholeDiagnostics, run server-side CV analysis with sharp
          if (!potholeDiagnostics) {
            try {
              const buffer = Buffer.from(arrayBuffer);
              const sharp = (await import('sharp')).default;
              const { data, info } = await sharp(buffer)
                .resize(256, 256, { fit: 'inside' })
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

              const classification = classifyRoadImageFromPixels(data, info.width, info.height);
              if (!classification.isRoad) {
                isRoadValid = false;
              } else {
                potholeDiagnostics = detectPotholesFromPixels(
                  data,
                  info.width,
                  info.height,
                  latitude || 26.8468,
                  longitude || 81.0105
                );
              }
            } catch (sharpErr) {
              console.warn('Server sharp pixel analysis failed, fallback:', sharpErr);
            }
          }
        } catch (exifErr) {
          console.warn('Could not read EXIF data:', exifErr);
        }
      }

      // Fallback to manually provided coordinates if EXIF tag was absent or user overrode it
      if ((latitude === null || longitude === null) && customLat && customLng) {
        latitude = parseFloat(customLat);
        longitude = parseFloat(customLng);
      }
    } else {
      let body: any = {};
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          {
            error: 'Invalid JSON Format',
            message: 'Malformed request payload. Please ensure valid form data or JSON is submitted.',
          },
          { status: 400 }
        );
      }

      latitude = body.latitude ? parseFloat(body.latitude) : null;
      longitude = body.longitude ? parseFloat(body.longitude) : null;
      userNotes = body.userNotes || '';
      defectDepthCm = body.defectDepthCm ? parseFloat(body.defectDepthCm) : 8;
      defectWidthCm = body.defectWidthCm ? parseFloat(body.defectWidthCm) : 40;
      imageName = body.imageName || 'api_submission.jpg';
      if (body.isRoadValid === false) {
        isRoadValid = false;
      }
      if (body.potholeDiagnostics) {
        potholeDiagnostics = body.potholeDiagnostics;
      }
    }

    // Check road recognition validation
    if (!isRoadValid) {
      return NextResponse.json(
        {
          error: 'Unrecognized Road Image',
          message: INVALID_ROAD_MESSAGE,
        },
        { status: 400 }
      );
    }

    if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        {
          error: 'GPS coordinates missing',
          message:
            'Could not extract GPS EXIF coordinates from the image. Please select a GPS-enabled image or specify latitude and longitude manually.',
          exifInfo,
        },
        { status: 400 }
      );
    }

    // 1. Fetch Tenders Database
    let tenders = getAllTenders();
    let dataSource: 'DATABASE' | 'ETENDER_CRAWLER' = 'DATABASE';

    // 2. Perform Spatial Matching against Road Tenders
    let matchResult = matchPotholeToTender(latitude, longitude, tenders);

    // If not matched or database empty, query the live e-tender crawler for newly published tenders
    if (!matchResult.matched || tenders.length === 0) {
      try {
        console.log(`[Analyze Pothole] No direct database match for (${latitude}, ${longitude}). Invoking live e-tender crawler...`);
        await crawlETenders();
        tenders = getAllTenders();
        const liveMatch = matchPotholeToTender(latitude, longitude, tenders);
        if (liveMatch.matched) {
          matchResult = liveMatch;
          dataSource = 'ETENDER_CRAWLER';
          matchResult.matchReason = `${matchResult.matchReason} (Synchronized live via UP eTender crawler)`;
        }
      } catch (crawlErr) {
        console.warn('[Analyze Pothole] Live crawl fallback failed:', crawlErr);
      }
    }

    // Determine data provenance if matched tender originated from live UP e-tender portal
    if (
      matchResult.matchedTender?.tender_id?.includes('CEUCZ') ||
      matchResult.matchedTender?.organisation?.includes('Central Zone') ||
      matchResult.matchedTender?.organisation?.includes('UPPWD')
    ) {
      dataSource = 'ETENDER_CRAWLER';
    }

    matchResult.dataSource = dataSource;

    // 3. Computer Vision Pothole Diagnostics & Surface Severity
    if (!potholeDiagnostics) {
      potholeDiagnostics = analyzePotholesAndSurface(
        latitude,
        longitude,
        defectDepthCm,
        defectWidthCm
      );
    }

    // 4. Reverse Geocode GPS to Exact Lucknow Road & Ward
    const geocodedLocation = reverseGeocodeLocation(latitude, longitude);

    // 5. Perform Priority Assessment
    const primaryPothole = potholeDiagnostics.detectedPotholes[0];
    const effectiveDepth = primaryPothole
      ? primaryPothole.estimatedDepthCm
      : (potholeDiagnostics.potholeCount === 0 ? 0 : defectDepthCm);
    const effectiveWidth = primaryPothole
      ? primaryPothole.estimatedWidthCm
      : (potholeDiagnostics.potholeCount === 0 ? 0 : defectWidthCm);

    const priorityAssessment = calculateDefectPriority({
      roadType: matchResult.matchedTender?.road_type,
      defectDepthCm: effectiveDepth,
      defectWidthCm: effectiveWidth,
      distanceToTenderMeters: matchResult.distanceMeters,
      tenderStatus: matchResult.matchedTender?.status,
      contractorName: matchResult.matchedTender?.contractor_name,
      organisationName: matchResult.matchedTender?.organisation,
    });

    // 6. Save to Database
    const newReport: DefectReport = {
      id: `REP-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      imageName,
      hasGps: true,
      latitude,
      longitude,
      userNotes,
      defectDepthCm: effectiveDepth,
      defectWidthCm: effectiveWidth,
      matchResult,
      priorityAssessment,
      potholeDiagnostics,
      geocodedLocation,
      status: matchResult.matched ? 'NOTICE_ISSUED' : 'REPORTED',
    };

    saveReport(newReport);

    return NextResponse.json({
      success: true,
      report: newReport,
      exifMetadata: exifInfo,
    });
  } catch (error: any) {
    console.error('Error in analyze-pothole API:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || String(error) },
      { status: 500 }
    );
  }
}
