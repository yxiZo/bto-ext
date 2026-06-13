import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Route helpers — use the adapter directly
import { mukakuAdapter, MUKAKU_CONSTANTS } from '../lib/adapters/sites/mukaku.ts';

// Validation
import { validateSnapshot } from '../lib/core/validate.ts';
import { emptySnapshot, type MediaSnapshot } from '../lib/core/types.ts';

describe('Mukaku route helpers', () => {
  it('detects media detail routes', () => {
    assert.equal(mukakuAdapter.detectRouteKind('https://web5.mukaku.com/mv/123456'), 'detail');
    assert.equal(mukakuAdapter.extractMediaId('https://web5.mukaku.com/mv/123456'), '123456');
  });

  it('detects search routes', () => {
    assert.equal(mukakuAdapter.detectRouteKind('https://web5.mukaku.com/search?sb=test'), 'search');
  });

  it('detects movie and tv listing routes', () => {
    assert.equal(mukakuAdapter.detectRouteKind('https://web5.mukaku.com/movie/0_0_0_0_0_1_1_0_0x10_0_0.html'), 'listing');
    assert.equal(mukakuAdapter.detectRouteKind('https://web5.mukaku.com/tvseries/0_0_0_0_0_1_1_0_0x10_0_0.html'), 'listing');
  });

  it('detects detail routes on all mirror domains', () => {
    for (const host of ['web5.mukaku.com', 'www.0bt0.com', 'www.9bt0.com']) {
      assert.equal(mukakuAdapter.detectRouteKind(`https://${host}/mv/123`), 'detail');
    }
  });

  it('rejects unknown and offsite routes', () => {
    assert.equal(mukakuAdapter.detectRouteKind('https://web5.mukaku.com/notice/1.html'), 'other');
    assert.equal(mukakuAdapter.detectRouteKind('https://example.com/mv/123456'), 'other');
    assert.equal(mukakuAdapter.extractMediaId('https://example.com/mv/123456'), null);
  });
});

describe('Mukaku constants', () => {
  it('exports expected constants', () => {
    assert.equal(MUKAKU_CONSTANTS.ORIGIN, 'https://web5.mukaku.com');
    assert.equal(MUKAKU_CONSTANTS.API_BASE, '/prod/api/v1');
    assert.equal(MUKAKU_CONSTANTS.APP_ID, '83768d9ad4');
    assert.equal(MUKAKU_CONSTANTS.IDENTITY, '23734adac0301bccdcb107c4aa21f96c');
    assert.ok(MUKAKU_CONSTANTS.MIRROR_HOSTNAMES.includes('www.0bt0.com'));
    assert.ok(MUKAKU_CONSTANTS.MIRROR_HOSTNAMES.includes('web5.mukaku.com'));
    assert.equal(MUKAKU_CONSTANTS.MIRROR_HOSTNAMES.length, 11);
  });
});

describe('validateSnapshot', () => {
  const baseSnapshot: MediaSnapshot = emptySnapshot('https://web5.mukaku.com/mv/123', 'detail');
  // Fill in realistic data
  baseSnapshot.title = '测试影片';
  baseSnapshot.mediaId = '123';
  baseSnapshot.posterUrl = 'https://example.com/poster.png';
  baseSnapshot.pageReady = true;
  baseSnapshot.ratings.sourceA = '8.7';

  it('passes for a complete detail snapshot', () => {
    const result = validateSnapshot(baseSnapshot);
    assert.equal(result.valid, true);
    assert.equal(result.missingFields.length, 0);
  });

  it('flags missing required fields', () => {
    const partial = { ...baseSnapshot };
    delete (partial as Record<string, unknown>).url;
    const result = validateSnapshot(partial as MediaSnapshot);
    assert.equal(result.valid, false);
    assert.ok(result.missingFields.includes('url'));
  });

  it('warns when detail page has no mediaId', () => {
    const noId = { ...baseSnapshot, mediaId: null };
    const result = validateSnapshot(noId);
    assert.ok(result.warnings.includes('mediaId is missing on detail page'));
  });

  it('warns when no rating data', () => {
    const noRating = { ...baseSnapshot, ratings: { sourceA: null, sourceB: null } };
    const result = validateSnapshot(noRating);
    assert.ok(result.warnings.includes('no rating data found'));
  });

  it('skips detail warnings for non-detail routes', () => {
    const listing = emptySnapshot('https://web5.mukaku.com/movie/test.html', 'listing');
    listing.title = '测试';
    listing.pageReady = true;
    const result = validateSnapshot(listing);
    assert.equal(result.warnings.length, 0);
  });
});
