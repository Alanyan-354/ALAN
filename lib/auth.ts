export interface AuthFailure {
  code?: string;
  message?: string;
  status?: number;
}

const includes = (value:string|undefined,needle:string)=>value?.toLowerCase().includes(needle)??false;

export function signInFailure(error:AuthFailure):{message:string;retryAfterSeconds?:number}{
  if(error.code==='email_address_not_authorized'||includes(error.message,'email address not authorized'))return {
    message:'Email delivery is not configured for students yet. Ask an administrator to enable custom SMTP in Supabase.'
  };
  if(error.status===429||error.code==='over_email_send_rate_limit'||error.code==='over_request_rate_limit'||includes(error.message,'rate limit'))return {
    message:'Email sending is temporarily limited. Use the newest link already in your inbox, or wait before requesting another one.',
    retryAfterSeconds:60
  };
  return {message:'Unable to send your sign-in link. Check the address and try again.'};
}

export function callbackFailureCode(error:AuthFailure|null|undefined){
  if(error?.code==='bad_code_verifier'||includes(error?.message,'code verifier'))return 'browser';
  if(error?.code==='otp_expired'||includes(error?.message,'expired'))return 'expired';
  return 'invalid';
}

export function callbackFailureMessage(code:string|undefined){
  if(code==='browser')return 'Open the newest sign-in link in the same browser where you requested it.';
  if(code==='denied')return 'Sign-in was cancelled or denied. Request a new link below.';
  return 'Your link expired or could not be verified. Request a new link below.';
}

export function otpFailure(error:AuthFailure){
  if(error.status===429||error.code==='over_request_rate_limit'||includes(error.message,'rate limit'))return 'Too many verification attempts. Wait a minute and try again.';
  if(error.code==='otp_expired'||includes(error.message,'expired'))return 'That sign-in code expired. Request a new email.';
  return 'That email and sign-in code do not match. Check the newest email and try again.';
}
