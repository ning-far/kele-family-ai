import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateInvitationAcceptance, type AcceptanceSnapshot} from '../apps/server/src/invitation-acceptance-state.ts';
const actor='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const pending:AcceptanceSnapshot={recipientId:actor,revoked:false,accepted:false,expiresAtMs:2000,creatorEligible:true,recipientMembership:'absent'};
test('acceptance requires the bound recipient and supports canonical UUID casing',()=>{
 assert.equal(evaluateInvitationAcceptance(actor.toUpperCase(),pending,1000),'accept');
 assert.throws(()=>evaluateInvitationAcceptance('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',pending,1000),/FORBIDDEN/);
});
test('pending acceptance expires at the exact server boundary and rejects invalid times',()=>{
 for(const now of [2000,2001,NaN,Infinity])assert.throws(()=>evaluateInvitationAcceptance(actor,pending,now),/INVITATION_EXPIRED/);
 assert.throws(()=>evaluateInvitationAcceptance(actor,{...pending,expiresAtMs:NaN},1000),/INVITATION_EXPIRED/);
});
test('revocation and live eligibility take precedence over an accepted replay',()=>{
 assert.throws(()=>evaluateInvitationAcceptance(actor,{...pending,accepted:true,revoked:true},3000),/INVITATION_REVOKED/);
 assert.throws(()=>evaluateInvitationAcceptance(actor,{...pending,accepted:true,creatorEligible:false},3000),/FORBIDDEN/);
 assert.throws(()=>evaluateInvitationAcceptance(actor,{...pending,accepted:true,recipientMembership:'revoked'},3000),/FORBIDDEN/);
});
test('accepted replay is a distinct result; active membership can accept without replacing its role',()=>{
 assert.equal(evaluateInvitationAcceptance(actor,{...pending,accepted:true,recipientMembership:'active'},3000),'replay');
 assert.throws(()=>evaluateInvitationAcceptance(actor,{...pending,accepted:true},3000),/FORBIDDEN/);
 assert.equal(evaluateInvitationAcceptance(actor,{...pending,recipientMembership:'active'},1000),'accept');
});
