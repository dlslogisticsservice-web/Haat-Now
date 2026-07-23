// Marketing OS · cross-channel campaign targeting.
//
// A campaign can now target specific experience channels. The rule that must not
// drift: an empty/absent channel list means the campaign is cross-channel (all
// channels), so every campaign authored before channels existed keeps working.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignMatchesChannel, type CampaignTargeting } from '../../services/marketing.service';

const targeting = (channels?: string[]): CampaignTargeting =>
  ({ countries: [], cities: [], languages: [], audience: 'all', ...(channels ? { channels } : {}) });

test('a campaign with no channel list targets every channel (backward compatible)', () => {
  const c = { targeting: targeting() };
  for (const ch of ['website', 'customer', 'merchant', 'driver']) {
    assert.equal(campaignMatchesChannel(c, ch), true, `should target ${ch}`);
  }
});

test('an empty channel list is also treated as all channels', () => {
  const c = { targeting: targeting([]) };
  assert.equal(campaignMatchesChannel(c, 'driver'), true);
});

test('a channel-scoped campaign targets only its channels', () => {
  const c = { targeting: targeting(['customer', 'merchant']) };
  assert.equal(campaignMatchesChannel(c, 'customer'), true);
  assert.equal(campaignMatchesChannel(c, 'merchant'), true);
  assert.equal(campaignMatchesChannel(c, 'website'), false);
  assert.equal(campaignMatchesChannel(c, 'driver'), false);
});

test('a single-channel campaign is exclusive', () => {
  const c = { targeting: targeting(['driver']) };
  assert.equal(campaignMatchesChannel(c, 'driver'), true);
  assert.equal(campaignMatchesChannel(c, 'customer'), false);
});
