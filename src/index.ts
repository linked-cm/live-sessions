// Registers the package with @_linked/core whichever entry a consumer imports.
import './package.js';
/** The application owns identity, policy, audience partitioning, and seat leases. */
export type MediaSource = 'microphone' | 'camera' | 'screen_share' | 'screen_share_audio';
export type MediaProfile = 'audio' | 'call' | 'world' | 'presentation';
export type Enforcement = 'room-isolation' | 'coarse-subscribe-deny' | 'per-listener-track-acl';

/** Returned by an application-owned, server-side policy resolver. Never construct from a client WebID. */
export interface AdmissionDecision {
  readonly principalIri: string;
  readonly audienceIri: string;
  readonly audienceGeneration: string;
  /** A physical media room unique to this audience generation. */
  readonly mediaRoom: string;
  /** Stable, opaque within the media room; must not contain an unverified client identity. */
  readonly participantIdentity: string;
  readonly mediaProfile: MediaProfile;
  readonly allowedPublishSources: readonly MediaSource[];
  readonly canSubscribe: boolean;
  readonly expiresAtMs: number;
  readonly policyVersion: string;
}

export interface AdmissionAuthority<ServerContext> {
  /** Must authenticate context and resolve current policy and capacity on the server. */
  decide(context: ServerContext, audienceIri: string): Promise<AdmissionDecision>;
  /** Recheck the specific decision immediately before credential creation. */
  isCurrent(decision: AdmissionDecision): Promise<boolean>;
}

export interface MediaCredential {
  readonly token: string;
  readonly serverUrl: string;
  readonly room: string;
  readonly participantIdentity: string;
  readonly expiresAtMs: number;
}

/** A client delivery preference for one track, never an authorization grant. */
export interface SubscriptionIntent {
  readonly trackSid: string;
  readonly subscribed: boolean;
}

export interface MediaCredentialMinter {
  readonly capabilities: Readonly<Record<Enforcement, boolean>>;
  mint(decision: AdmissionDecision, nowMs: number): Promise<MediaCredential>;
}

export interface CredentialRequest<ServerContext> {
  readonly context: ServerContext;
  readonly audienceIri: string;
  readonly requiredEnforcement: readonly Enforcement[];
}

export class AdmissionError extends Error {
  constructor(readonly code: 'invalid-decision' | 'expired' | 'stale' | 'unsupported-enforcement') {
    super(code);
    this.name = 'AdmissionError';
  }
}

export function validateDecision(decision: AdmissionDecision, nowMs: number): void {
  const iri = (value: string): boolean => {
    try {
      const url = new URL(value);
      return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname;
    } catch { return false; }
  };
  if (!iri(decision.principalIri) || !iri(decision.audienceIri) ||
      !decision.audienceGeneration?.trim() || !decision.mediaRoom?.trim() ||
      !decision.participantIdentity?.trim() || !decision.policyVersion?.trim() ||
      !['audio', 'call', 'world', 'presentation'].includes(decision.mediaProfile) ||
      typeof decision.canSubscribe !== 'boolean' ||
      !Array.isArray(decision.allowedPublishSources) ||
      decision.allowedPublishSources.some(source => !['microphone', 'camera', 'screen_share', 'screen_share_audio'].includes(source)) ||
      !Number.isFinite(decision.expiresAtMs)) {
    throw new AdmissionError('invalid-decision');
  }
  if (decision.expiresAtMs <= nowMs) throw new AdmissionError('expired');
}

/** Server-only orchestration. The caller must keep ServerContext and the authority off clients. */
export async function issueCredential<ServerContext>(
  request: CredentialRequest<ServerContext>,
  authority: AdmissionAuthority<ServerContext>,
  minter: MediaCredentialMinter,
  now: () => number = Date.now,
): Promise<MediaCredential> {
  for (const capability of request.requiredEnforcement) {
    if (!minter.capabilities[capability]) throw new AdmissionError('unsupported-enforcement');
  }
  const decision = await authority.decide(request.context, request.audienceIri);
  const nowMs = now();
  validateDecision(decision, nowMs);
  if (decision.audienceIri !== request.audienceIri) throw new AdmissionError('invalid-decision');
  if (!(await authority.isCurrent(decision))) throw new AdmissionError('stale');
  // A policy update can happen during the await above; the short-lived credential
  // and generation-specific physical room bound that residual race.
  validateDecision(decision, now());
  return minter.mint(decision, now());
}

export type SessionPhase = 'admitted' | 'connecting' | 'connected' | 'leaving' | 'revoked' | 'ended';
export interface SessionEvent {
  readonly audienceIri: string;
  readonly participantIdentity: string;
  readonly phase: SessionPhase;
  readonly atMs: number;
}

export interface RevocationResult {
  /** True only after the media service acknowledges the removal request. */
  readonly transportAcknowledged: boolean;
  /** Acknowledgement alone may not invalidate an already issued token. */
  readonly tokenReusePrevented: boolean;
  readonly credentialExpiresAtMs: number;
}

export interface MediaTelemetry {
  readonly room: string;
  readonly participantIdentity: string;
  readonly atMs: number;
  readonly packetsLost?: number;
  readonly jitterMs?: number;
  readonly roundTripTimeMs?: number;
  readonly outboundBitrateBps?: number;
  readonly inboundBitrateBps?: number;
}
