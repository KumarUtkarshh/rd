/**
 * Road & Pothole Image Recognition Engine
 * Evaluates visual features (color distribution, asphalt achromatic balance,
 * texture edge variance, and cavity distress) to recognize valid road pavement
 * and reject non-road objects (faces, indoor rooms, furniture, screens, animals, etc.)
 */

export interface RoadClassificationResult {
  isRoad: boolean;
  confidence: number; // 0 to 100
  reason?: string;
  metrics: {
    asphaltNeutralScore: number; // 0 to 100
    textureVariance: number; // local edge roughness
    averageLuminance: number; // 0 to 255
    colorSaturation: number; // 0 to 1
    defectPresenceScore: number; // 0 to 100
  };
}

export const INVALID_ROAD_MESSAGE =
  'This is not a recognized image of a road. Please upload the proper image of the road potholes only, so that it can be detected and tenders can be seen';

/**
 * Evaluates RGBA pixel buffer from an HTML5 Canvas or image buffer
 * Expected image size: normalized 256x256 or similar for fast CV analysis
 */
export function classifyRoadImageFromPixels(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): RoadClassificationResult {
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return {
      isRoad: false,
      confidence: 0,
      reason: 'Empty image buffer',
      metrics: {
        asphaltNeutralScore: 0,
        textureVariance: 0,
        averageLuminance: 0,
        colorSaturation: 0,
        defectPresenceScore: 0,
      },
    };
  }

  let totalLuminance = 0;
  let totalSaturation = 0;
  let roadPavementPixels = 0;
  let skinTonePixels = 0;
  let foliagePixels = 0;
  let vividPixels = 0;

  // Grayscale buffer for texture & gradient analysis
  const gray = new Float32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    totalLuminance += lum;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const sat = max === 0 ? 0 : delta / max;
    totalSaturation += sat;

    const rgDiff = Math.abs(r - g);
    const gbDiff = Math.abs(g - b);
    const rbDiff = Math.abs(r - b);

    // 1. Road pavement characteristics (Asphalt, Bitumen, Concrete, Sand, or Road Dirt):
    // Real roads in outdoor lighting can have warm sunlight, brown dirt, or gray concrete.
    const isNeutralAsphalt = sat < 0.45 && rgDiff < 55 && gbDiff < 50 && rbDiff < 65 && lum >= 15 && lum <= 235;
    const isEarthyRoadOrMud = sat < 0.60 && lum >= 15 && lum <= 220 && (r >= b || rbDiff < 70) && gbDiff < 45;
    const isConcretePavement = sat < 0.35 && lum >= 30 && lum <= 240 && rgDiff < 35 && gbDiff < 35;

    if (isNeutralAsphalt || isEarthyRoadOrMud || isConcretePavement) {
      roadPavementPixels++;
    }

    // 2. Skin tone detection (reject selfies/portraits - smooth human skin)
    if (r > 95 && g > 45 && b > 25 && r > g && r > b && (r - g) >= 15 && sat > 0.25 && sat < 0.68) {
      skinTonePixels++;
    }

    // 3. Foliage/grass detection (reject garden/parks without roads)
    if (g > r * 1.25 && g > b * 1.25 && sat > 0.35) {
      foliagePixels++;
    }

    // 4. High vivid saturation (indoor toys, posters, colorful clothing, vibrant screens)
    if (sat > 0.62) {
      vividPixels++;
    }
  }

  const avgLuminance = totalLuminance / totalPixels;
  const avgSaturation = totalSaturation / totalPixels;
  const roadRatio = roadPavementPixels / totalPixels;
  const skinRatio = skinTonePixels / totalPixels;
  const foliageRatio = foliagePixels / totalPixels;
  const vividRatio = vividPixels / totalPixels;

  // 5. Texture & Edge Variance (Sobel gradient approximation)
  let gradientSum = 0;
  let edgeCount = 0;
  let darkCavityPixels = 0;

  const step = 2;
  let sampledCount = 0;
  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const idx = y * width + x;
      const gx = gray[idx + 1] - gray[idx - 1];
      const gy = gray[idx + width] - gray[idx - width];
      const grad = Math.sqrt(gx * gx + gy * gy);
      gradientSum += grad;
      sampledCount++;

      if (grad > 18) {
        edgeCount++;
      }

      // Check for pothole cavity (localized dark region relative to road median)
      if (gray[idx] < avgLuminance * 0.75 && gray[idx] >= 10) {
        darkCavityPixels++;
      }
    }
  }

  const meanGradient = sampledCount > 0 ? gradientSum / sampledCount : 0;
  const edgeDensity = sampledCount > 0 ? edgeCount / sampledCount : 0;
  const cavityRatio = sampledCount > 0 ? darkCavityPixels / sampledCount : 0;

  // Calculate scores
  const asphaltNeutralScore = Math.min(100, Math.round(roadRatio * 110));
  const textureVariance = Math.round(meanGradient * 10) / 10;
  const defectPresenceScore = Math.min(
    100,
    Math.round(edgeDensity * 120 + cavityRatio * 90 + (roadRatio > 0.3 ? 20 : 0))
  );

  // REJECTION CRITERIA:
  // 1. Extreme non-road objects:

  // Pure portrait selfie (high skin tone AND low texture variance typical of human skin)
  if (skinRatio > 0.42 && meanGradient < 14.0) {
    return {
      isRoad: false,
      confidence: Math.round((1 - skinRatio) * 100),
      reason: 'Detected portrait or skin tones instead of road surface.',
      metrics: {
        asphaltNeutralScore,
        textureVariance,
        averageLuminance: Math.round(avgLuminance),
        colorSaturation: Math.round(avgSaturation * 100) / 100,
        defectPresenceScore,
      },
    };
  }

  // Pure indoor vivid toys / colorful synthetic graphics
  if (vividRatio > 0.48) {
    return {
      isRoad: false,
      confidence: Math.round((1 - vividRatio) * 100),
      reason: 'Detected vivid indoor objects or colorful surfaces.',
      metrics: {
        asphaltNeutralScore,
        textureVariance,
        averageLuminance: Math.round(avgLuminance),
        colorSaturation: Math.round(avgSaturation * 100) / 100,
        defectPresenceScore,
      },
    };
  }

  // Pure dense vegetation / garden lawn without road surface
  if (foliageRatio > 0.60 && roadRatio < 0.20) {
    return {
      isRoad: false,
      confidence: Math.round((1 - foliageRatio) * 100),
      reason: 'Detected predominantly vegetation or grass without road pavement.',
      metrics: {
        asphaltNeutralScore,
        textureVariance,
        averageLuminance: Math.round(avgLuminance),
        colorSaturation: Math.round(avgSaturation * 100) / 100,
        defectPresenceScore,
      },
    };
  }

  // 2. Plain blank surface check (painted wall, paper, ceiling, laptop screen)
  if (edgeDensity < 0.008 && meanGradient < 4.0 && cavityRatio < 0.02) {
    return {
      isRoad: false,
      confidence: 15,
      reason: 'Surface lacks asphalt texture, pavement aggregate, or road defects (blank/smooth surface).',
      metrics: {
        asphaltNeutralScore,
        textureVariance,
        averageLuminance: Math.round(avgLuminance),
        colorSaturation: Math.round(avgSaturation * 100) / 100,
        defectPresenceScore,
      },
    };
  }

  // 3. Over-exposure or lens blackout
  if (avgLuminance > 248 || avgLuminance < 8) {
    return {
      isRoad: false,
      confidence: 10,
      reason: 'Image is severely over-exposed or dark/blocked.',
      metrics: {
        asphaltNeutralScore,
        textureVariance,
        averageLuminance: Math.round(avgLuminance),
        colorSaturation: Math.round(avgSaturation * 100) / 100,
        defectPresenceScore,
      },
    };
  }

  // 4. Road presence threshold:
  // Must exhibit road pavement characteristics OR visible surface defects/aggregate texture
  if (roadRatio < 0.20 && defectPresenceScore < 15 && textureVariance < 8.0) {
    return {
      isRoad: false,
      confidence: Math.round(roadRatio * 100),
      reason: 'Pavement asphalt characteristics not identified in photo.',
      metrics: {
        asphaltNeutralScore,
        textureVariance,
        averageLuminance: Math.round(avgLuminance),
        colorSaturation: Math.round(avgSaturation * 100) / 100,
        defectPresenceScore,
      },
    };
  }

  // PASSED: Recognizable road surface
  const confidence = Math.min(
    99,
    Math.max(68, Math.round(roadRatio * 50 + Math.min(30, meanGradient * 2) + (defectPresenceScore > 20 ? 15 : 10)))
  );

  return {
    isRoad: true,
    confidence,
    metrics: {
      asphaltNeutralScore,
      textureVariance,
      averageLuminance: Math.round(avgLuminance),
      colorSaturation: Math.round(avgSaturation * 100) / 100,
      defectPresenceScore,
    },
  };
}
