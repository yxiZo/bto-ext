import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getMukakuMediaId, getMukakuRouteKind, MUKAKU_API_BASE, MUKAKU_APP_ID, MUKAKU_IDENTITY, MUKAKU_ORIGIN, MUKAKU_SNAPSHOT_MESSAGE } from '../lib/mukaku.ts';

describe('Mukaku route helpers', () => {
  it('detects media detail routes', () => {
    assert.equal(getMukakuRouteKind('https://web5.mukaku.com/mv/123456'), 'detail');
    assert.equal(getMukakuMediaId('https://web5.mukaku.com/mv/123456'), '123456');
  });

  it('detects search routes', () => {
    assert.equal(getMukakuRouteKind('https://web5.mukaku.com/search?sb=test'), 'search');
  });

  it('detects movie and tv listing routes', () => {
    assert.equal(getMukakuRouteKind('https://web5.mukaku.com/movie/0_0_0_0_0_1_1_0_0x10_0_0.html'), 'listing');
    assert.equal(getMukakuRouteKind('https://web5.mukaku.com/tvseries/0_0_0_0_0_1_1_0_0x10_0_0.html'), 'listing');
  });

  it('rejects unknown and offsite routes', () => {
    assert.equal(getMukakuRouteKind('https://web5.mukaku.com/notice/1.html'), 'other');
    assert.equal(getMukakuRouteKind('https://example.com/mv/123456'), 'other');
    assert.equal(getMukakuMediaId('https://example.com/mv/123456'), '123456');
  });
});

describe('Mukaku constants', () => {
  it('exports expected constants', () => {
    assert.equal(MUKAKU_ORIGIN, 'https://web5.mukaku.com');
    assert.equal(MUKAKU_SNAPSHOT_MESSAGE, 'BT0_GET_MUKAKU_SNAPSHOT');
    assert.equal(MUKAKU_API_BASE, '/prod/api/v1');
    assert.equal(MUKAKU_APP_ID, '83768d9ad4');
    assert.equal(MUKAKU_IDENTITY, '23734adac0301bccdcb107c4aa21f96c');
  });
});
