// ---------------------------------------------------------------------------
// Platform-agnostic snapshot validation
// ---------------------------------------------------------------------------

import type { MediaSnapshot, RouteKind } from './types.ts';

export type SnapshotValidation = {
  valid: boolean;
  missingFields: string[];
  warnings: string[];
};

/** Fields that must be present for any snapshot */
const REQUIRED_FIELDS: Array<keyof MediaSnapshot> = [
  'url',
  'title',
  'routeKind',
  'pageReady',
  'capturedAt',
];

/** Additional checks for detail pages */
function checkDetailPage(snapshot: MediaSnapshot, warnings: string[]) {
  if (!snapshot.mediaId) {
    warnings.push('mediaId is missing on detail page');
  }
  if (!snapshot.posterUrl) {
    warnings.push('posterUrl is missing');
  }
  if (!snapshot.ratings.sourceA && !snapshot.ratings.sourceB) {
    warnings.push('no rating data found');
  }
  if (!snapshot.summary) {
    warnings.push('summary is missing');
  }
}

/** Extra checks per route kind — can be extended by adapters */
const DETAIL_CHECKS: Partial<Record<RouteKind, (s: MediaSnapshot, w: string[]) => void>> = {
  detail: checkDetailPage,
};

export function validateSnapshot(snapshot: MediaSnapshot): SnapshotValidation {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (snapshot[field] == null || snapshot[field] === '') {
      missingFields.push(field);
    }
  }

  const routeCheck = DETAIL_CHECKS[snapshot.routeKind];
  if (routeCheck) {
    routeCheck(snapshot, warnings);
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}
