import assert from 'assert';
import { classifyRoadImageFromPixels } from '../lib/roadClassifier.ts';
import { detectPotholesFromPixels, analyzePotholesAndSurface } from '../lib/potholeDetector.ts';
import { calculateDefectPriority } from '../lib/priorityEngine.ts';

console.log('====================================================');
console.log('🧪 VERIFYING COMPUTER VISION POTHOLE DETECTION');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Real Pothole on Asphalt Road
// -----------------------------------------------------------------------------
console.log('Test 1: Testing detection of an actual pothole on asphalt pavement...');
const width = 256;
const height = 256;
const roadData = new Uint8ClampedArray(width * height * 4);

// Fill with asphalt road texture (gray tones with small grain variation)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    const noise = Math.sin(x * 0.4) * Math.cos(y * 0.4) * 8;
    const base = 120 + noise;
    // Real road with slight warm sunlight tint
    roadData[idx] = Math.min(255, Math.max(0, base + 8));     // R
    roadData[idx + 1] = Math.min(255, Math.max(0, base + 2)); // G
    roadData[idx + 2] = Math.min(255, Math.max(0, base - 5)); // B
    roadData[idx + 3] = 255;
  }
}

// Add a visible dark pothole cavity in the lower center:
// Y from 120 to 180 (47% to 70%), X from 90 to 160 (35% to 62%)
for (let y = 120; y < 180; y++) {
  for (let x = 90; x < 160; x++) {
    const dx = (x - 125) / 35;
    const dy = (y - 150) / 30;
    if (dx * dx + dy * dy <= 1.0) {
      const idx = (y * width + x) * 4;
      // Dark cavity with broken edges
      const cavityNoise = (Math.random() - 0.5) * 12;
      roadData[idx] = Math.max(15, 45 + cavityNoise);
      roadData[idx + 1] = Math.max(15, 40 + cavityNoise);
      roadData[idx + 2] = Math.max(15, 38 + cavityNoise);
    }
  }
}

// 1A: Road classification
const classification1 = classifyRoadImageFromPixels(roadData, width, height);
console.log('  Road Classification Result:', {
  isRoad: classification1.isRoad,
  confidence: classification1.confidence,
  defectPresenceScore: classification1.metrics.defectPresenceScore,
});
assert.strictEqual(classification1.isRoad, true, 'Image must be classified as a valid road');

// 1B: Pothole detection
const diagnostics1 = detectPotholesFromPixels(roadData, width, height, 26.8468, 81.0105);
console.log('  Pothole Detection Result:', {
  potholeCount: diagnostics1.potholeCount,
  pciScore: diagnostics1.pciScore,
  pciRating: diagnostics1.pciRating,
  primaryDistressType: diagnostics1.primaryDistressType,
  detectedBoxes: diagnostics1.detectedPotholes.map(p => ({
    id: p.id,
    box: p.box,
    depthCm: p.estimatedDepthCm,
    widthCm: p.estimatedWidthCm,
    severity: p.severity,
    confidence: p.confidence,
  })),
});

assert(diagnostics1.potholeCount >= 1, 'Should detect at least 1 pothole');
const p1 = diagnostics1.detectedPotholes[0];
// Verify the box is located in the lower-middle region (around y: 40-75%, x: 30-68%)
assert(p1.box[0] >= 35 && p1.box[0] <= 55, `ymin (${p1.box[0]}) should be near 47%`);
assert(p1.box[1] >= 25 && p1.box[1] <= 45, `xmin (${p1.box[1]}) should be near 35%`);
assert(p1.box[2] >= 60 && p1.box[2] <= 85, `ymax (${p1.box[2]}) should be near 70%`);
assert(p1.box[3] >= 50 && p1.box[3] <= 75, `xmax (${p1.box[3]}) should be near 62%`);
console.log('  ✅ Test 1 Passed: Pothole detected accurately at actual coordinates!\n');

// -----------------------------------------------------------------------------
// Test 2: Clean Smooth Road with NO Potholes
// -----------------------------------------------------------------------------
console.log('Test 2: Testing clean road pavement with NO potholes...');
const cleanRoadData = new Uint8ClampedArray(width * height * 4);
for (let i = 0; i < totalPixels(width, height); i++) {
  const noise = (Math.random() - 0.5) * 6;
  cleanRoadData[i * 4] = 110 + noise;     // R
  cleanRoadData[i * 4 + 1] = 108 + noise; // G
  cleanRoadData[i * 4 + 2] = 105 + noise; // B
  cleanRoadData[i * 4 + 3] = 255;
}

const classification2 = classifyRoadImageFromPixels(cleanRoadData, width, height);
assert.strictEqual(classification2.isRoad, true, 'Clean road should still be classified as road');

const diagnostics2 = detectPotholesFromPixels(cleanRoadData, width, height);
console.log('  Clean Road Detection Result:', {
  potholeCount: diagnostics2.potholeCount,
  pciScore: diagnostics2.pciScore,
  pciRating: diagnostics2.pciRating,
  detectedCount: diagnostics2.detectedPotholes.length,
});
assert.strictEqual(diagnostics2.potholeCount, 0, 'Clean road should have 0 potholes detected');
assert.strictEqual(diagnostics2.detectedPotholes.length, 0, 'No bounding boxes on clean road');
assert.strictEqual(diagnostics2.pciRating, 'Good', 'Clean road rating should be Good');
console.log('  ✅ Test 2 Passed: 0 potholes detected on smooth road!\n');

// -----------------------------------------------------------------------------
// Test 3: Rejection of Non-Road Surfaces (e.g. Blank Wall)
// -----------------------------------------------------------------------------
console.log('Test 3: Testing non-road image rejection (blank white indoor wall)...');
const blankWallData = new Uint8ClampedArray(width * height * 4);
for (let i = 0; i < totalPixels(width, height); i++) {
  blankWallData[i * 4] = 230;
  blankWallData[i * 4 + 1] = 230;
  blankWallData[i * 4 + 2] = 230;
  blankWallData[i * 4 + 3] = 255;
}

const classification3 = classifyRoadImageFromPixels(blankWallData, width, height);
console.log('  Blank Wall Result:', {
  isRoad: classification3.isRoad,
  reason: classification3.reason,
});
assert.strictEqual(classification3.isRoad, false, 'Blank wall must be rejected');
console.log('  ✅ Test 3 Passed: Non-road surface correctly rejected!\n');

// -----------------------------------------------------------------------------
// Test 4: Priority Assessment with 0 Potholes vs Severe Pothole
// -----------------------------------------------------------------------------
console.log('Test 4: Testing Priority Engine with 0 defects vs critical pothole...');
const priorityClean = calculateDefectPriority({
  roadType: 'Service Road',
  defectDepthCm: 0,
  defectWidthCm: 0,
});
assert.strictEqual(priorityClean.level, 'LOW', 'Zero defects should yield LOW priority');

const priorityCritical = calculateDefectPriority({
  roadType: 'Major Highway',
  defectDepthCm: 14,
  defectWidthCm: 70,
  trafficDensity: 'HEAVY',
});
assert.strictEqual(priorityCritical.level, 'CRITICAL', 'Deep crater on highway should yield CRITICAL priority');
console.log('  Priority clean level:', priorityClean.level, '| SLA:', priorityClean.slaHours, 'h');
console.log('  Priority critical level:', priorityCritical.level, '| SLA:', priorityCritical.slaHours, 'h');
console.log('  ✅ Test 4 Passed: Priority calculation correctly adjusted!\n');

console.log('====================================================');
console.log('🎉 ALL COMPUTER VISION POTHOLE DETECTION TESTS PASSED!');
console.log('====================================================');

function totalPixels(w, h) {
  return w * h;
}

