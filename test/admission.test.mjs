import assert from 'node:assert/strict';
import test from 'node:test';
import { AdmissionError, issueCredential } from '../lib/esm/index.js';

const decision = { principalIri: 'https://example.org/people/a', audienceIri: 'https://example.org/rooms/1', audienceGeneration: 'g2', mediaRoom: 'room-g2', participantIdentity: 'p-a', mediaProfile: 'call', allowedPublishSources: ['microphone'], canSubscribe: true, expiresAtMs: 100_000, policyVersion: 'v3' };
const minter = { capabilities: { 'room-isolation': true, 'coarse-subscribe-deny': true, 'per-listener-track-acl': false }, mint: async (d) => ({ token: 'signed', serverUrl: 'wss://example.org', room: d.mediaRoom, participantIdentity: d.participantIdentity, expiresAtMs: d.expiresAtMs }) };
const request = { context: { authenticated: true }, audienceIri: decision.audienceIri, requiredEnforcement: ['room-isolation'] };

test('fresh server decision mints a credential', async () => {
  const authority = { decide: async () => decision, isCurrent: async () => true };
  assert.equal((await issueCredential(request, authority, minter, () => 1)).room, 'room-g2');
});
test('rejects unsupported enforcement before policy lookup', async () => {
  const authority = { decide: async () => { throw Error('must not run'); }, isCurrent: async () => true };
  await assert.rejects(issueCredential({ ...request, requiredEnforcement: ['per-listener-track-acl'] }, authority, minter, () => 1), { code: 'unsupported-enforcement' });
});
test('rejects stale, expired, and wrong audience decisions', async () => {
  const authority = { decide: async () => decision, isCurrent: async () => false };
  await assert.rejects(issueCredential(request, authority, minter, () => 1), { code: 'stale' });
  await assert.rejects(issueCredential(request, { ...authority, isCurrent: async () => true }, minter, () => 100_001), { code: 'expired' });
  await assert.rejects(issueCredential({ ...request, audienceIri: 'https://example.org/other' }, { ...authority, isCurrent: async () => true }, minter, () => 1), { code: 'invalid-decision' });
});
test('rejects malformed policy output', async () => {
  const authority = { decide: async () => ({ ...decision, principalIri: 'a client claim' }), isCurrent: async () => true };
  await assert.rejects(issueCredential(request, authority, minter, () => 1), AdmissionError);
});
