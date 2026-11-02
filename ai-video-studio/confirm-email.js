// First-party confirmation page: one-time verification happens only after explicit click.
// Never log or render token_hash; remove it from browser address bar on page load.
(() => {
  'use strict';
  const button = document.getElementById('confirm-email-button');
  const status = document.getElementById('confirm-email-status');
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get('token_hash');
  if(window.history?.replaceState)window.history.replaceState(null,'','/confirm-email.html');
  function message(value){status.textContent=value;status.hidden=false;}
  if(!tokenHash || tokenHash.length > 1024){
    message('This email link is missing its verification information. Request a fresh email from the Studio homepage.');
    return;
  }
  const cfg = window.MAH_STUDIO_CONFIG || {};
  if(!cfg.authReady || !window.supabase?.createClient){
    message('The sign-in service is temporarily unavailable. Please try again from the Studio homepage.');
    return;
  }
  const api = window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
    auth:{flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  button.disabled=false;
  button.addEventListener('click',async()=>{
    button.disabled=true;
    message('Confirming your email securely…');
    try{
      const {data,error}=await api.auth.verifyOtp({token_hash:tokenHash,type:'email'});
      if(error)throw error;
      if(!data?.session)throw new Error('Verification completed without an active session. Request a new sign-in email.');
      message('Email confirmed. Opening My Projects…');
      window.location.replace('/');
    }catch(err){
      message('This confirmation was not accepted: '+(err?.message||'Unknown error')+'. Please request a new email from the Studio homepage.');
    }
  });
})();
