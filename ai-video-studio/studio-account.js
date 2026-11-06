/* MAH GPT Studio account & draft management.
 * All database calls use the browser's publishable key + logged-in user's
 * JWT. Authorization is enforced by Supabase RLS, NOT by this script.
 * Public email beta sign-in is now available with verified custom Resend SMTP.
 * Google is enabled automatically only when Supabase's public auth settings report it enabled.
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
  const composer = document.getElementById('brief');
  const thread = document.getElementById('studio-thread');
  const uploads = document.getElementById('studio-uploads');
  const rightsRow = document.getElementById('main-media-consent');
  const rightsCheck = document.getElementById('main-rights-check');
  const newRequest = document.getElementById('studio-new-request');
  const action = composer?.querySelector('button.action');
  const intakeStatus = document.getElementById('message');
  const signout = document.getElementById('my-project-signout');
  const enabled = Boolean(
    config.authReady && config.redirectsReady && (config.legalApproved || config.registrationAudience === 'public-beta') &&
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
  let googleAvailable = false;
  let activeIntakeId = null;
  let intakeBusy = false;
  let oracleTester = false;
  // Private founder pilot: a browser flag never replaces server-side allowlist/RLS.
  let activeRenderId=null,renderPoll=null;
  const renderPreview=document.createElement('button');
  renderPreview.type='button';renderPreview.textContent='Render 8-second private preview';
  renderPreview.className='action';renderPreview.id='studio-render-private-preview';
  renderPreview.hidden=true;renderPreview.disabled=true;
  const renderInfo=document.createElement('p');renderInfo.id='studio-render-private-status';
  renderInfo.hidden=true;
  newRequest?.insertAdjacentElement('afterend',renderPreview);
  renderPreview.insertAdjacentElement('afterend',renderInfo);
  function renderNotice(message){renderInfo.hidden=false;renderInfo.textContent=message;}
  function showPreviewAction(){
    renderPreview.hidden=!config.oraclePrivatePreviewEnabled||!oracleTester||!activeIntakeId||
      !currentUser||!agreementReady;
    renderPreview.disabled=!activeIntakeId||Boolean(activeRenderId)||intakeBusy;
  }
  async function watchRender(jobId){
    if(renderPoll)clearInterval(renderPoll);
    activeRenderId=jobId;showPreviewAction();
    const check=async()=>{
      if(!currentUser){clearInterval(renderPoll);renderPoll=null;return;}
      const {data,error}=await api.from('studio_render_jobs')
        .select('id,status,error_code,output_asset_id').eq('id',jobId).maybeSingle();
      if(error||!data){renderNotice('Unable to refresh render status.');return;}
      if(data.status==='queued')renderNotice('Private video queued on Oracle.');
      if(data.status==='rendering')renderNotice('Oracle is rendering your private preview.');
      if(['completed','failed'].includes(data.status)){
        clearInterval(renderPoll);renderPoll=null;activeRenderId=null;
        showPreviewAction();
        if(data.status==='completed'){
          resetComposer();await refreshProjects();
          renderNotice('MP4 ready in My Projects → Media archive.');
          projects?.scrollIntoView({behavior:'smooth',block:'start'});
        }else renderNotice('Render failed ('+(data.error_code||'render_failed')+'). You can retry within your private quota.');
      }
    };
    await check();
    if(activeRenderId)renderPoll=setInterval(()=>{void check();},7000);
  }
  async function resumeRender(){
    if(!config.oraclePrivatePreviewEnabled||!oracleTester||!activeIntakeId)return;
    const {data,error}=await api.from('studio_render_jobs')
      .select('id,status').eq('project_id',activeIntakeId)
      .in('status',['queued','rendering']).order('created_at',{ascending:false}).limit(1);
    if(!error&&data?.[0])await watchRender(data[0].id);
  }
  renderPreview.addEventListener('click',async()=>{
    if(!config.oraclePrivatePreviewEnabled||!oracleTester||!activeIntakeId||activeRenderId||
      intakeBusy||!currentUser||!agreementReady)return;
    renderPreview.disabled=true;renderNotice('Submitting private render…');
    try{
      const {data,error}=await api.from('studio_render_jobs')
        .insert({project_id:activeIntakeId,preset:'brief-preview-v1'})
        .select('id,status').single();
      if(error)throw error;
      await watchRender(data.id);
    }catch(e){renderNotice('Cannot start private preview: '+e.message);}
    finally{showPreviewAction();}
  });

  const loginNote = 'Sign-in is not enabled. No email was sent and no user data was submitted.';
  // Product model: intake is hidden from My Projects until a trusted render
  // backend marks a final output complete. The AI API is NOT connected yet.
  function localIntakeKey(){
    return currentUser ? 'mah-studio-current-intake:' + currentUser.id : null;
  }
  function status(text){
    if(intakeStatus)notice(intakeStatus,text);
  }
  function selectedUploads(){
    return ['image','video','audio'].flatMap(id=>{
      const control=document.getElementById(id);
      return control ? Array.from(control.files||[]) : [];
    });
  }
  function syncMediaConsent(){
    if(rightsRow)rightsRow.hidden=!selectedUploads().length;
    if(rightsCheck && !selectedUploads().length)rightsCheck.checked=false;
  }
  for(const kind of ['image','video','audio']){
    document.getElementById(kind)?.addEventListener('change',syncMediaConsent);
  }
  function addThreadLine(text,who='user'){
    if(!thread)return;
    thread.hidden=false;
    const line=document.createElement('div');
    line.className='studio-thread-line '+(who==='user'?'from-user':'from-system');
    const mark=document.createElement('strong');
    mark.textContent=who==='user'?'You':'Studio status';
    const content=document.createElement('p');
    content.textContent=text;
    line.append(mark,content);
    thread.append(line);
  }
  function resetComposer(){
    activeIntakeId=null;
    showPreviewAction();
    const key=localIntakeKey();if(key)sessionStorage.removeItem(key);
    if(thread){thread.replaceChildren();thread.hidden=true;}
    if(uploads){uploads.replaceChildren();uploads.hidden=true;}
    for(const id of ['image','video','audio'])document.getElementById(id).value='';
    const currentSelected=document.getElementById('files');if(currentSelected)currentSelected.textContent='';
    document.getElementById('idea').value='';
    document.getElementById('reference-url').value='';
    if(rightsCheck)rightsCheck.checked=false;
    syncMediaConsent();
    if(newRequest)newRequest.hidden=true;
    if(intakeStatus)intakeStatus.hidden=true;
  }
  newRequest?.addEventListener('click',async()=>{
    if(intakeBusy||activeRenderId){status('Finish the current render before starting another request.');return;}
    intakeBusy=true;newRequest.disabled=true;
    try{
      if(activeIntakeId){
        const {data:files,error:filesError}=await api.from('studio_assets')
          .select('id,status,storage_provider').eq('project_id',activeIntakeId);
        if(filesError)throw filesError;
        const stillActive=(files||[]).filter(a=>a.storage_provider==='r2'&&a.status!=='deleted');
        if(stillActive.length){
          status('Remove the current request files above before starting a new request, so they do not occupy storage.');
          return;
        }
        const {error}=await api.from('studio_projects')
          .delete().eq('id',activeIntakeId).eq('lifecycle','intake');
        if(error)throw error;
      }
      resetComposer();
      document.getElementById('idea').focus();
    }catch(err){status('Could not safely discard the unfinished request: '+err.message)}
    finally{intakeBusy=false;newRequest.disabled=false;}
  });
  async function showIntakeFiles(){
    if(!uploads||!activeIntakeId||!window.MAH_STUDIO_MEDIA)return;
    const data=await window.MAH_STUDIO_MEDIA.listProject({api,projectId:activeIntakeId});
    uploads.replaceChildren();
    if(!data.pilot || !data.files?.length){uploads.hidden=true;return;}
    uploads.hidden=false;
    const title=document.createElement('strong');
    title.textContent='Files in this private request';
    uploads.append(title);
    for(const asset of data.files){
      const row=document.createElement('div');row.className='studio-upload-item';
      const name=document.createElement('span');name.textContent=asset.filename+' ('+(asset.byte_size/1000000).toFixed(1)+' MB)';
      const down=document.createElement('button');down.type='button';down.textContent='Download';
      down.addEventListener('click',async()=>{
        down.disabled=true;
        try{await window.MAH_STUDIO_MEDIA.downloadFile({api,projectId:activeIntakeId,asset});}
        catch(e){status('Download failed: '+e.message)}
        finally{down.disabled=false;}
      });
      const del=document.createElement('button');del.type='button';del.textContent='Remove';
      del.addEventListener('click',async()=>{
        if(!confirm('Delete this file from private R2 storage?'))return;
        del.disabled=true;
        try{
          await window.MAH_STUDIO_MEDIA.deleteFile({api,projectId:activeIntakeId,asset});
          await showIntakeFiles();
          status('File removed from this request.');
        }catch(e){status('Delete failed: '+e.message)}
        finally{del.disabled=false;}
      });
      row.append(name,down,del);uploads.append(row);
    }
  }
  async function resumeIntake(){
    if(!currentUser||!agreementReady)return;
    const key=localIntakeKey();
    const id=key?sessionStorage.getItem(key):null;
    if(!id||!/^[0-9a-f-]{36}$/.test(id))return;
    const {data,error}=await api.from('studio_projects').select('id,lifecycle')
      .eq('id',id).in('lifecycle',['intake','processing']).maybeSingle();
    if(error||!data){if(key)sessionStorage.removeItem(key);return;}
    activeIntakeId=data.id;
    showPreviewAction();
    if(newRequest)newRequest.hidden=false;
    const {data:messages}=await api.from('studio_intake_messages')
      .select('body').eq('project_id',id).order('created_at').limit(30);
    if(thread){thread.replaceChildren();thread.hidden=true;}
    (messages||[]).forEach(m=>addThreadLine(m.body));
    try{await showIntakeFiles();}catch(e){status('Private files could not be loaded: '+e.message)}
    await resumeRender();
    if(messages?.length && !activeRenderId)status('Your private request is ready. The full AI editing workflow is not enabled yet.');
  }
  async function submitIntake(event){
    event.preventDefault();
    // The earlier static-preview handler must not overwrite real upload status.
    event.stopImmediatePropagation();
    if(intakeBusy||activeRenderId){status('Your current preview render must finish first.');return;}
    if(!currentUser||!agreementReady){
      openAuth();
      status('Sign in to submit your request securely. Text and files have not been sent.');
      return;
    }
    const message=document.getElementById('idea').value.trim();
    const ref=document.getElementById('reference-url').value.trim();
    const attached=selectedUploads();
    if(!message&&!ref&&!attached.length){status('Describe your edit or choose a reference or file first.');return;}
    if(message.length>10000){status('Please keep each message under 10,000 characters.');return;}
    if(attached.length&&(!rightsCheck||!rightsCheck.checked)){
      status('Please confirm you have permission to use these files before uploading.');
      rightsCheck?.focus();
      return;
    }
    intakeBusy=true;
    if(action)action.disabled=true;
    if(newRequest)newRequest.disabled=true;
    try{
      // Until the render pipeline and safe R2 cleanup exist, the full intake
      // remains founder-only. Public login remains available without accepting
      // production requests we cannot fulfill.
      const {data:tester,error:testError}=await api.from('studio_media_testers')
        .select('user_id').limit(1);
      if(testError)throw testError;
      if(!tester?.length)throw Error('The editing workflow is in private testing. No request or files were submitted.');
      let projectId=activeIntakeId;
      if(!projectId){
        const selectedStyleId=document.getElementById('style-id').value.trim();
        const selectedStyle=selectedStyleId?{
          id:selectedStyleId.slice(0,100),title:document.getElementById('style-name').value.slice(0,140),
          description:document.getElementById('style-description').value.slice(0,500)
        }:{};
        const title=(message||ref||'New video edit request').slice(0,80);
        const {data,error}=await api.from('studio_projects').insert({
          title,brief:message.slice(0,20000),reference_url:ref||null,selected_style:selectedStyle
        }).select('id').single();
        if(error)throw error;
        projectId=data.id;
        activeIntakeId=projectId;
        showPreviewAction();
        const key=localIntakeKey();if(key)sessionStorage.setItem(key,projectId);
        if(newRequest)newRequest.hidden=false;
      }
      if(ref && projectId===activeIntakeId){
        // A later reference is part of this SAME private intake.
        const {error:referenceError}=await api.from('studio_projects')
          .update({reference_url:ref}).eq('id',projectId).eq('lifecycle','intake');
        if(referenceError)throw referenceError;
      }
      if(message){
        const {error}=await api.from('studio_intake_messages')
          .insert({project_id:projectId,body:message.slice(0,10000)});
        if(error)throw error;
        addThreadLine(message);
      }
      // A reference alone is stored on the intake project (no video download).
      for(let i=0;i<attached.length;i++){
        const file=attached[i];
        if(file.size>15000000)throw Error(file.name+' exceeds the 15 MB private test limit.');
        if(!window.MAH_STUDIO_MEDIA?.uploadToProject)throw Error('Secure upload module has not loaded.');
        status('Uploading '+(i+1)+' of '+attached.length+': '+file.name);
        await window.MAH_STUDIO_MEDIA.uploadToProject({
          api,projectId,file,
          progress:p=>status('Uploading '+file.name+(p===null?'…':' · '+p+'%'))
        });
      }
      for(const id of ['image','video','audio'])document.getElementById(id).value='';
    const currentSelected=document.getElementById('files');if(currentSelected)currentSelected.textContent='';
      syncMediaConsent();
      if(rightsCheck)rightsCheck.checked=false;
      if(message)document.getElementById('idea').value='';
      await showIntakeFiles();
      status(config.oraclePrivatePreviewEnabled && oracleTester?'Request saved. You can now render an 8-second private preview using Oracle.':'Request saved privately in this conversation. Video editing, AI replies, quotes and payments are not active yet.');
       showPreviewAction();
      // This is a real status notice, NOT a fabricated AI reply.
    }catch(err){status('Could not complete the request: '+err.message)}
    finally{
      intakeBusy=false;if(action)action.disabled=false;
      if(newRequest)newRequest.disabled=false;
    }
  }
  // Capture before the old static preview submit handler (bubbling listener).
  composer?.addEventListener('submit',submitIntake,true);

  const redirectTo = window.location.origin + '/';
  const queryParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const emailCallbackError = queryParams.get('error_code') || hashParams.get('error_code') || queryParams.get('error') || hashParams.get('error');

  function notice(node, text) {node.hidden=false; node.textContent=text;}
  function authButtons() {
    google.disabled = !enabled || !googleAvailable || !check.checked;
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
  // Avoid accidental closing on backdrop taps. Close via X or Escape only.
  check.addEventListener('change',authButtons);
  previewNote.textContent=enabled ?
    'Email registration is open. A private 8-second Oracle preview is available to the founder test account only; full AI editing and payments are not yet active.' :
    'Accounts are not enabled yet. No account or consent record is created here.';
  authButtons();
  if(emailCallbackError){
    openAuth();
    notice(feedback,'Email confirmation failed ('+emailCallbackError+'). Request a fresh message and use only the newest link.');
    const hint = document.getElementById('auth-retry-hint');
    if(hint)hint.hidden=false;
  }
  if(!api) {
    notice(feedback, window.supabase?.createClient ?
      'Email sign-in is temporarily unavailable due to configuration. Nothing has been sent.' :
      'The sign-in service could not load in this browser. Please refresh the page. If it persists, try another browser or disable script blockers for this page. No email was sent.');
    return;
  }
  // Provider availability is public Supabase Auth metadata; never load OAuth secrets into the browser.
  async function checkGoogleAvailability(){
    if(!enabled)return;
    try{
      const reply=await fetch(config.supabaseUrl+'/auth/v1/settings',{
        method:'GET',headers:{apikey:config.supabasePublishableKey},cache:'no-store'
      });
      if(!reply.ok)return;
      const settings=await reply.json();
      googleAvailable=settings?.external?.google === true;
      google.innerHTML='<span aria-hidden="true" class="auth-google-mark">G</span> '+
        (googleAvailable ? 'Continue with Google' : 'Google Sign-In · Setup in progress');
      authButtons();
    }catch(err){
      // Keep Google disabled when the provider cannot be verified.
      googleAvailable=false;
      authButtons();
    }
  }
  void checkGoogleAvailability();
    google.addEventListener('click',async()=>{
    if(!check.checked || !googleAvailable)return;
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
  // This button is deliberately type=button; it can never submit/navigate the page.
  emailButton.dataset.authHandlerReady='1';
  document.getElementById('auth-email-form').addEventListener('submit',e=>{
    e.preventDefault();
    if(!emailButton.disabled)emailButton.click();
  });
  emailButton.addEventListener('click',async e=>{
    e.preventDefault();
    e.stopPropagation();
    if(!check.checked)return;
    if(!email.checkValidity()){email.reportValidity();return;}
    emailButton.disabled=true;
    notice(feedback,'Contacting the secure sign-in service…');
    try {
      window.sessionStorage.setItem('mah-studio-terms-ack','yes');
      const {error}=await api.auth.signInWithOtp({
        email:email.value.trim(),options:{emailRedirectTo:redirectTo}
      });
      if(error)throw error;
      notice(feedback,'A sign-in email was requested. Check your inbox or spam folder. Open only the newest email and confirm it on the secure MAH GPT Studio page.');
    } catch(err) {
      const restricted=/not authorized|not allowed|only.*team/i.test(err.message||'');
      notice(feedback,restricted ? 'This email address cannot receive the sign-in email. Please check the address or contact info@mahgpt.com.' : 'Email sign-in failed: '+err.message);
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
    if(acceptError && acceptError.code!=='23505')throw acceptError;
    window.sessionStorage.removeItem('mah-studio-terms-ack');
    return true;
  }
  function expirationText(date){
    const deadline=new Date(date);
    if(Number.isNaN(deadline.getTime()))return 'Expiry date unavailable';
    const remaining=deadline.getTime()-Date.now();
    if(remaining<=0)return 'Retention deadline reached — pending automatic cleanup';
    const days=Math.max(1,Math.ceil(remaining/86400000));
    return 'Automatic deletion in '+days+' day'+(days===1?'':'s')+' · '+deadline.toLocaleString();
  }
  async function refreshProjects(){
    const {data,error}=await api.from('studio_projects')
      .select('id,title,brief,reference_url,selected_style,created_at,updated_at,expires_at')
      .eq('lifecycle','completed').gt('expires_at',new Date().toISOString()).order('updated_at',{ascending:false}).limit(50);
    if(error){notice(projectNotice,'Could not load your projects: '+error.message);return;}
    list.replaceChildren();
    if(!data?.length){
      const info=document.createElement('p');info.textContent='No completed videos yet. When a final edit is ready, it will appear here automatically.';
      list.append(info);return;
    }
    for(const item of data){
      const row=document.createElement('div');row.className='my-project-row';
      const title=document.createElement('strong');title.textContent=item.title;
      const caption=document.createElement('small');
      caption.textContent=item.expires_at?expirationText(item.expires_at):'Retention date not yet set';
      if(item.expires_at && (new Date(item.expires_at).getTime()-Date.now())<2*86400000){
        caption.classList.add('archive-expiring-soon');
      }
      const load=document.createElement('button');load.type='button';load.textContent='Reuse this edit';
      load.addEventListener('click',async()=>{
        load.disabled=true;
        try {
          const {data:newExpiry,error:touchError}=await api.rpc('studio_touch_completed_project',{p_project:item.id});
          if(touchError)throw touchError;
          if(!newExpiry)throw Error('This project has already expired; it cannot be reopened.');
          item.expires_at=newExpiry;
          caption.textContent=expirationText(newExpiry);
        }catch(err){
          notice(projectNotice,'Could not renew project retention: '+err.message);
          await refreshProjects();
          return;
        }finally{load.disabled=false;}
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
        notice(projectNotice,'Project reopened. Its automatic deletion deadline was extended by seven days. The original brief is available in the composer.');
      });
      const remove=document.createElement('button');remove.type='button';remove.textContent='Delete';
      remove.addEventListener('click',async()=>{
        if(!window.confirm('Permanently delete this project and its uploaded files?'))return;
        remove.disabled=true;
        try{
          const {data:assets,error:assetsError}=await api.from('studio_assets')
            .select('storage_path,storage_provider,status').eq('project_id',item.id);
          if(assetsError)throw assetsError;
          const r2StillActive=(assets||[]).filter(x=>x.storage_provider==='r2'&&x.status!=='deleted');
          if(r2StillActive.length)throw Error('Delete the private uploaded files in Media archive before deleting the project.');
          const oldSupabaseFiles=(assets||[]).filter(x=>x.storage_provider!=='r2');
          if(oldSupabaseFiles.length){
            const {error:storageError}=await api.storage.from('studio-project-media')
              .remove(oldSupabaseFiles.map(x=>x.storage_path));
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
      actions.append(load,remove);row.append(detail,actions);
      const itemContainer=document.createElement('div');
      itemContainer.className='project-with-media';
      itemContainer.append(row);
      const mediaContainer=document.createElement('div');
      itemContainer.append(mediaContainer);
      list.append(itemContainer);
      if(window.MAH_STUDIO_MEDIA?.mount){
        window.MAH_STUDIO_MEDIA.mount({container:mediaContainer,project:item,api});
      }
    }
  }
  async function refreshOracleTester(){
    oracleTester=false;
    if(!config.oraclePrivatePreviewEnabled||!currentUser||!agreementReady){
      showPreviewAction();
      return;
    }
    // RLS restricts this view to the signed-in tester's own eligibility row.
    // Browser visibility is cosmetic; the queue policies enforce eligibility.
    try{
      const userId=currentUser.id;
      const {data,error}=await api.from('studio_media_testers')
        .select('user_id').eq('user_id',userId).limit(1);
      if(!error && currentUser?.id===userId)oracleTester=Boolean(data?.length);
    }catch{/* Fail closed if the allowlist cannot be confirmed. */}
    showPreviewAction();
  }
  async function refreshAuth(){
    const {data,error}=await api.auth.getUser();
    currentUser=!error ? data?.user : null;
    oracleTester=false;
    projects.hidden=true;
    showPreviewAction();
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
      notice(feedback,'Please review the updated privacy information and agree to the current Terms of Service to continue using My Projects.');
      return;
    }
    if(dialog.open)dialog.close();
    login.textContent='My Projects';
    projects.hidden=false;
    projectNotice.hidden=true;
    await refreshOracleTester();
    await refreshProjects();
    await resumeIntake();
    showPreviewAction();
  }
  // Register this only once: repeated AUTH events must not add consent handlers.
  let acceptingAgreement=false;
  check.addEventListener('change',async()=>{
    if(!check.checked || !currentUser || agreementReady || acceptingAgreement)return;
    acceptingAgreement=true;
    try {
      window.sessionStorage.setItem('mah-studio-terms-ack','yes');
      agreementReady=await confirmAgreement(currentUser);
      if(agreementReady){
        dialog.close();
        login.textContent='My Projects';
        projects.hidden=false;
        projectNotice.hidden=true;
        await refreshOracleTester();
        await refreshProjects();
        await resumeIntake();
      }
    }catch(err){
      notice(feedback,'Could not save the acceptance: '+err.message);
    }finally{
      acceptingAgreement=false;
    }
  });
  signout.addEventListener('click',async()=>{
    const {error}=await api.auth.signOut();
    if(error)notice(projectNotice,'Sign out failed: '+error.message);
    else {currentUser=null;agreementReady=false;oracleTester=false;projects.hidden=true;login.textContent='Sign Up / Log In';if(renderPoll)clearInterval(renderPoll);renderPoll=null;activeRenderId=null;resetComposer();}
  });
  api.auth.onAuthStateChange((_event,_session)=>{setTimeout(()=>{void refreshAuth();},0);});
  void refreshAuth();
})();
