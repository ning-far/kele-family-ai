/** Evaluate a locked database snapshot; never authorize from a browser snapshot. */
export type AcceptanceSnapshot = {
 recipientId: string;
 revoked: boolean;
 accepted: boolean;
 expiresAtMs: number;
 creatorEligible: boolean;
 recipientMembership: 'absent' | 'active' | 'revoked';
};
export function evaluateInvitationAcceptance(actor: string, snapshot: AcceptanceSnapshot, databaseNowMs: number): 'accept' | 'replay' {
 if (actor.toLowerCase() !== snapshot.recipientId.toLowerCase()) throw new Error('FORBIDDEN');
 if (snapshot.revoked) throw new Error('INVITATION_REVOKED');
 if (!snapshot.creatorEligible || snapshot.recipientMembership === 'revoked') throw new Error('FORBIDDEN');
 // Repeating a completed acceptance never refreshes a deadline or restores grants.
 if (snapshot.accepted) {
  if(snapshot.recipientMembership !== 'active') throw new Error('FORBIDDEN');
  return 'replay';
 }
 if (!Number.isFinite(snapshot.expiresAtMs) || !Number.isFinite(databaseNowMs) || snapshot.expiresAtMs <= databaseNowMs) throw new Error('INVITATION_EXPIRED');
 return 'accept';
}
