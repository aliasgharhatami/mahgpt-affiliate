/* MAH GPT Studio account & draft management.
 * All database calls use the browser's publishable key + logged-in user's
 * JWT. Authorization is enforced by Supabase RLS, NOT by this script.
 * No accounts are created while config is unverified or legal texts are drafts.
 */
(() => {
  'use strict';
  const config = window.MAH_STUDIO_CONFIG || {};
  const login = document.getElementById('login');
  const dialog = document.getElementById('auth-dialog');
  const email = document.getElementById('auth-email');
  const check = document.getElementById('auth-consent');
  const google = document.getElementById('auth-google');
  const emailButton = document.getElementById('auth-email-submit');
  const feedback = document.getElementById('auth-notice');
  const previewNote = document.getElementById('auth-preview-label');
  const projects = document.getElementById('my-projects');
  const list = document.getElementById('my-project-list');
  const projectNotice = document.getElementById('my-project-notice');
  const save = document.getElementById('my-project-save');
  const signout = document.getElementById('my-project-signout');
  const enabled = Boolean(
    config.authReady && config.legalApproved &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl || '') &&
    /^sb_publishable_[a-zA-Z0-9_-]+$/.test(config.supabasePublishableKey || '') &&
    config.termsVersion !== 'pending-final' &&
    config.privacyVersion !== 'pending-final' &&
    window.supabase?.createClient
  );
  const api = enabled ? window.supabase.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {auth: {flowType:'implicit', autoRefreshToken:true, persistSession:true,
      detectSessionInUrl:true}}
  ) : null;
  let currentUser = null;
  let agreementReady = false;
  const loginNote = 'Account creation is not enabled yet. No email was sent and no user data was submitted.';
  const redirectTo = window.location.origin + '/ai-video-studio/';
  function notice(node, text) {node.hidden=false; node.textContent=text;}
  function authButtons() {
    google.disabled = !enabled || !config.googleProviderReady || !check.checked;
    emailButton.disabled = !enabled || !check.checked;
    if (check.checked && !enabled) notice(feedback,loginNote);
    else feedback.hidden=true;
  }
  function openAuth() {
    check.checked=false;
    email.value='';
    authButtons();
    if(!dialog.open) dialog.showModal();
  }
  login.addEventListener('click', () => {
    if(currentUser && agreementReady) {
      projects.scrollIntoView({behavior:'smooth',block:'start'});
    } else openAuth();
  });
  document.getElementById('auth-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  check.addEventListener('change',authButtons);
  previewNote.textContent=enabled?
    'Your files remain yours. Please review our terms and privacy notice before continuing.':
    'Accounts are not enabled yet. No account or consent record is created here.';
  authButtons();
  if(!api) return;
  google.addEventListener('click',async()=>{
    if(!check.checked || !config.googleProviderReady)return;
    google.disabled=true;
    try {
      window.sessionStorage.setItem('mah-studio-terms-ack','yes');
      const {error}=await api.auth.signInWithOAuth({
        provider:'google',options:{redirectTo}
      });
      if(error)throw error;
    } catch(err) {
      notice(feedback,'Google sign-in failed: '+err.message);
      authButtons();
    }
  });
  document.getElementById('auth-email-form').addEventListener('submit',async e=>{
    e.preventDefault();
    if(!check.checked)return;
    if(!email.checkValidity()){email.reportValidity();return;}
    emailButton.disabled=true;
    try {
      window.sessionStorage.setItem('mah-studio-terms-ack','yes');
      const {error}=await api.auth.signInWithOtp({
        email:email.value.trim(),options:{emailRedirectTo:redirectTo}
      });
      if(error)throw error;
      notice(feedback,'Check your inbox for your sign-in link. If it does not arrive, check spam.');
    } catch(err) {
      notice(feedback,'Email sign-in failed: '+err.message);
    } finally {emailButton.disabled = !check.checked;}
  });
  async function confirmAgreement(user){
    const {data:records,error:readError}=await api.from('studio_agreement_acceptances')
      .select('id').eq('terms_version',config.termsVersion)
      .eq('privacy_version',config.privacyVersion).limit(1);
    if(readError)throw readError;
    if(records?.length)return true;
    if(window.sessionStorage.getItem('mah-studio-terms-ack')!=='yes')return false;
    const {error:acceptError}=await api.from('studio_agreement_acceptances')
      .insert({terms_version:config.termsVersion,privacy_version:config.privacyVersion});
    if(acceptError)throw acceptError;
    window.sessionStorage.removeItem('mah-studio-terms-ack');
    return true;
  }
  async function refreshProjects(){
    const {data,error}=await api.from('studio_projects')
      .select('id,title,brief,reference_url,selected_style,created_at,updated_at')
      .order('updated_at',{ascending:false}).limit(50);
    if(error){notice(projectNotice,'Could not load your projects: '+error.message);return;}
    list.replaceChildren();
    if(!data?.length){
      const info=document.createElement('p');info.textContent='No saved projects yet. Start with a brief above.';
      list.append(info);return;
    }
    for(const item of data){
      const row=document.createElement('div');row.className='my-project-row';
      const title=document.createElement('strong');title.textContent=item.title;
      const caption=document.createElement('small');
      caption.textContent='Saved '+new Date(item.updated_at).toLocaleString();
      const load=document.createElement('button');load.type='button';load.textContent='Load draft';
      load.addEventListener('click',()=>{
        document.getElementById('idea').value=item.brief || '';
        document.getElementById('reference-url').value=item.reference_url || '';
        const st=item.selected_style && typeof item.selected_style==='object' ? item.selected_style : {};
        document.getElementById('style-id').value=st.id||'';
        document.getElementById('style-name').value=st.title||'';
        document.getElementById('style-description').value=st.description||'';
        const chosen=document.getElementById('selected-style');
        chosen.hidden=!st.id;
        if(st.id){
          document.getElementById('selected-style-title').textContent=st.title||'Saved reference';
          document.getElementById('selected-style-description').textContent=st.description||'';
        }
        document.getElementById('reference').hidden=!item.reference_url;
        document.getElementById('link-toggle').setAttribute('aria-expanded',String(Boolean(item.reference_url)));
        window.scrollTo({top:0,behavior:'smooth'});
        notice(projectNotice,'Draft loaded into the editor. Changes are not saved until you save again.');
      });
      const remove=document.createElement('button');remove.type='button';remove.textContent='Delete';
      remove.addEventListener('click',async()=>{
        if(!window.confirm('Permanently delete this project and its uploaded files?'))return;
        remove.disabled=true;
        try{
          const {data:assets,error:assetsError}=await api.from('studio_assets')
            .select('storage_path').eq('project_id',item.id);
          if(assetsError)throw assetsError;
          if(assets?.length){
            const {error:storageError}=await api.storage.from('studio-project-media')
              .remove(assets.map(x=>x.storage_path));
            if(storageError)throw storageError;
          }
          const {error:deleteError}=await api.from('studio_projects')
            .delete().eq('id',item.id);
          if(deleteError)throw deleteError;
          notice(projectNotice,'Project deleted.');
          await refreshProjects();
        }catch(err){notice(projectNotice,'Could not delete the project: '+err.message);}
        finally{remove.disabled=false;}
      });
      const detail=document.createElement('div');detail.append(title,caption);
      const actions=document.createElement('div');actions.className='my-project-actions';
      actions.append(load,remove);row.append(detail,actions);list.append(row);
    }
  }
  async function refreshAuth(){
    const {data,error}=await api.auth.getUser();
    currentUser=!error ? data?.user : null;
    projects.hidden=true;
    if(!currentUser){
      agreementReady=false;
      login.textContent='Sign Up / Log In';
      return;
    }
    try{agreementReady=await confirmAgreement(currentUser);}
    catch(err){
      agreementReady=false;
      notice(feedback,'Could not verify your agreement: '+err.message);
    }
    if(!agreementReady){
      login.textContent='Accept Terms';
      openAuth();
      notice(feedback,'Please accept the Terms of Service and Privacy Notice before using your account.');
      check.addEventListener('change',async function acceptOnChange(){
        if(!check.checked)return;
        try {
          window.sessionStorage.setItem('mah-studio-terms-ack','yes');
          agreementReady=await confirmAgreement(currentUser);
          if(agreementReady){
            dialog.close();
            projects.hidden=false;
            login.textContent='My Projects';
            await refreshProjects();
          }
        }catch(err){notice(feedback,err.message);}
        check.removeEventListener('change',acceptOnChange);
      },{once:false});
      return;
    }
    if(dialog.open)dialog.close();
    login.textContent='My Projects';
    projects.hidden=false;
    projectNotice.hidden=true;
    await refreshProjects();
  }
  save.addEventListener('click',async()=>{
    if(!currentUser||!agreementReady)return openAuth();
    const brief=document.getElementById('idea').value.trim();
    const reference=document.getElementById('reference-url').value.trim();
    const title=brief.slice(0,80)||'Untitled project';
    save.disabled=true;
    try {
      const selectedStyleId=document.getElementById('style-id').value.trim();
      const selectedStyle=selectedStyleId ? {
        id:selectedStyleId.slice(0,100),
        title:document.getElementById('style-name').value.slice(0,140),
        description:document.getElementById('style-description').value.slice(0,500)
      }: {};
      const {data,error}=await api.from('studio_projects').insert({
        title,brief,reference_url:reference||null,selected_style:selectedStyle
      }).select('id').single();
      if(error)throw error;
      // Files are not automatically uploaded just because they are selected.
      // Uploaded media will be separately enabled after retention/consent finalization.
      notice(projectNotice,'Draft saved privately. File uploads are not enabled in this phase.');
      await refreshProjects();
    }catch(err){notice(projectNotice,'Could not save project: '+err.message);}
    finally{save.disabled=false;}
  });
  signout.addEventListener('click',async()=>{
    const {error}=await api.auth.signOut();
    if(error)notice(projectNotice,'Sign out failed: '+error.message);
    else {currentUser=null;agreementReady=false;projects.hidden=true;login.textContent='Sign Up / Log In';}
  });
  api.auth.onAuthStateChange((_event,_session)=>{setTimeout(()=>{void refreshAuth();},0);});
  void refreshAuth();
})();
