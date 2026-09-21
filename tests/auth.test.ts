import test from 'node:test';
import assert from 'node:assert/strict';
import { callbackFailureCode, callbackFailureMessage, otpFailure, signInFailure } from '../lib/auth';

test('auth errors expose actionable delivery and cooldown guidance',()=>{
  assert.match(signInFailure({code:'email_address_not_authorized'}).message,/custom SMTP/i);
  assert.equal(signInFailure({status:429}).retryAfterSeconds,60);
  assert.match(signInFailure({message:'rate limit exceeded'}).message,/newest link/i);
});

test('OTP verification errors remain specific without exposing account existence',()=>{
  assert.match(otpFailure({code:'otp_expired'}),/expired/i);
  assert.match(otpFailure({message:'invalid token'}),/do not match/i);
});

test('callback errors distinguish PKCE browser mismatch from expired links',()=>{
  assert.equal(callbackFailureCode({code:'bad_code_verifier'}),'browser');
  assert.equal(callbackFailureCode({code:'otp_expired'}),'expired');
  assert.match(callbackFailureMessage('browser'),/same browser/i);
});
