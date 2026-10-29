export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PriorityAssessmentInput {
  roadType?: string;
  defectDepthCm?: number; // e.g. 8 cm
  defectWidthCm?: number; // e.g. 45 cm
  trafficDensity?: 'HEAVY' | 'MODERATE' | 'LIGHT';
  distanceToTenderMeters?: number;
  tenderStatus?: string;
  contractorName?: string;
  organisationName?: string;
}

export interface PriorityAssessmentResult {
  score: number; // 0 - 100
  level: PriorityLevel;
  badgeColor: string;
  borderColor: string;
  contractorLiability: 'DIRECT_LIABILITY' | 'CONTRIBUTORY' | 'PENDING_CONTRACT';
  slaHours: number; // SLA hours to fix defect
  recommendedAction: string;
  breakdown: {
    roadImpactScore: number;
    severityScore: number;
    trafficScore: number;
    proximityScore: number;
  };
}

export function calculateDefectPriority(input: PriorityAssessmentInput): PriorityAssessmentResult {
  const depth = input.defectDepthCm ?? 8; // Default 8cm
  const width = input.defectWidthCm ?? 40; // Default 40cm
  const roadType = (input.roadType || '').toLowerCase();
  const traffic = input.trafficDensity || 'MODERATE';
  const dist = input.distanceToTenderMeters ?? 100;
  const status = (input.tenderStatus || '').toLowerCase();

  // 1. Road Impact Score (0 - 30)
  let roadImpactScore = 15;
  if (roadType.includes('highway') || roadType.includes('arterial') || roadType.includes('30m')) {
    roadImpactScore = 30;
  } else if (roadType.includes('sector main') || roadType.includes('18m') || roadType.includes('service')) {
    roadImpactScore = 24;
  } else if (roadType.includes('sector') || roadType.includes('ward') || roadType.includes('link')) {
    roadImpactScore = 18;
  } else {
    roadImpactScore = 12;
  }

  // 2. Defect Severity Score (0 - 35) based on depth & diameter
  let severityScore = 0;
  if (depth === 0 && width === 0) {
    severityScore = 0;
  } else if (depth >= 15 || width >= 80) {
    severityScore = 35;
  } else if (depth >= 10 || width >= 50) {
    severityScore = 28;
  } else if (depth >= 5 || width >= 30) {
    severityScore = 20;
  } else {
    severityScore = 12;
  }

  // 3. Traffic Density Score (0 - 20)
  let trafficScore = 12;
  if (traffic === 'HEAVY') trafficScore = 20;
  else if (traffic === 'MODERATE') trafficScore = 14;
  else trafficScore = 8;

  // 4. Proximity & Contract Status Score (0 - 15)
  let proximityScore = 10;
  if (dist <= 150) proximityScore = 15;
  else if (dist <= 500) proximityScore = 12;
  else if (dist <= 1000) proximityScore = 8;
  else proximityScore = 4;

  const totalScore = Math.min(100, Math.max(10, roadImpactScore + severityScore + trafficScore + proximityScore));

  let level: PriorityLevel = 'MEDIUM';
  let badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  let borderColor = 'border-amber-500';
  let slaHours = 72;

  if (depth === 0 && width === 0) {
    level = 'LOW';
    badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    borderColor = 'border-emerald-500';
    slaHours = 168;
  } else if (totalScore >= 78) {
    level = 'CRITICAL';
    badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    borderColor = 'border-rose-500';
    slaHours = 24;
  } else if (totalScore >= 60) {
    level = 'HIGH';
    badgeColor = 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    borderColor = 'border-orange-500';
    slaHours = 48;
  } else if (totalScore >= 40) {
    level = 'MEDIUM';
    badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    borderColor = 'border-amber-500';
    slaHours = 96;
  } else {
    level = 'LOW';
    badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    borderColor = 'border-emerald-500';
    slaHours = 168;
  }

  let contractorLiability: 'DIRECT_LIABILITY' | 'CONTRIBUTORY' | 'PENDING_CONTRACT' = 'CONTRIBUTORY';
  if (status.includes('maintenance') || status.includes('awarded') || status.includes('active')) {
    contractorLiability = 'DIRECT_LIABILITY';
  } else if (status.includes('bidding') || status.includes('tender')) {
    contractorLiability = 'PENDING_CONTRACT';
  }

  const contractor = input.contractorName || 'Assigned Contractor';
  const org = input.organisationName || 'Managing Authority';

  let recommendedAction = '';
  if (depth === 0 && width === 0) {
    recommendedAction = `Road pavement condition verified. No active pothole hazards detected. Continue routine inspection schedule.`;
  } else if (contractorLiability === 'DIRECT_LIABILITY') {
    recommendedAction = `Issue urgent ${slaHours}h defect rectification notice to contractor "${contractor}" under active ${org} tender. Defect falls directly within operational contract scope.`;
  } else if (contractorLiability === 'PENDING_CONTRACT') {
    recommendedAction = `Forward pothole coordinates to ${org} Engineering Wing to add mandatory defect repair patch to pending tender contract prior to bid closing.`;
  } else {
    recommendedAction = `Log defect with ${org} emergency road maintenance squad for routine asphalt patching within ${slaHours}h.`;
  }

  return {
    score: totalScore,
    level,
    badgeColor,
    borderColor,
    contractorLiability,
    slaHours,
    recommendedAction,
    breakdown: {
      roadImpactScore,
      severityScore,
      trafficScore,
      proximityScore,
    },
  };
}
