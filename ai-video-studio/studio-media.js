/* MAH GPT Studio: private founder media pilot inside My Projects.
 * Uses the existing signed-in Supabase session; never embeds R2 credentials.
 * Only renders file uploads after server has verified pilot eligibility.
 */
(()=>{
'use strict';
function make(tag,text,cls){
 const el=document.createElement(tag);
 if(text!==undefined&&text!==null)el.textContent=text;
 if(cls)el.className=cls;
 return el;
}
function labelDate(s){try{return new Date(s).toLocaleString()}catch{return ''}}
function fmtBytes(n){return Number(n)>=1000000?(Number(n)/1000000).toFixed(1)+' MB':(Number(n)/1000).toFixed(0)+' KB'}
async function tokenFor(api){
 const {data,error}=await api.auth.getSession();
 if(error||!data?.session?.access_token)throw Error('Sign in again to manage files.');
 return data.session.access_token;
}
async function request(api,path,options={}){
 const token=await tokenFor(api);
 const res=await fetch('/api/studio/media'+path,{
  ...options,headers:{Authorization:'Bearer '+token,...(options.headers||{})},cache:'no-store'
 });
 if(options.download){
  if(!res.ok){let m='Download failed';try{m=(await res.json()).error||m}catch{}throw Error(m);}
  return res.blob();
 }
 let data={};try{data=await res.json()}catch{}
 if(!res.ok)throw Error(data.error||'Media request failed.');return data;
}
async function uploadFile(api,form,progress){
 const tok=await tokenFor(api);
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  xhr.open('POST','/api/studio/media');
  xhr.setRequestHeader('Authorization','Bearer '+tok);
  xhr.upload.onprogress=e=>{
   if(e.lengthComputable)progress(Math.round(100*e.loaded/e.total));
   else progress(null);
  };
  xhr.onload=()=>{
   let data;try{data=JSON.parse(xhr.responseText)}catch{data={}}
   if(xhr.status>=200&&xhr.status<300)resolve(data);
   else reject(Error(data.error||'Upload failed (HTTP '+xhr.status+').'));
  };
  xhr.onerror=()=>reject(Error('Network error while uploading.'));
  xhr.onabort=()=>reject(Error('Upload cancelled.'));
  xhr.send(form);
 });
}
function mount({container,project,api}){
 if(!container||!api||!project?.id)return;
 const wrap=make('div',null,'media-pilot');
 const open=make('button','Media archive ▸','media-toggle');open.type='button';open.setAttribute('aria-expanded','false');
 const panel=make('div',null,'media-panel');panel.hidden=true;
 const status=make('p','','media-status');status.setAttribute('role','status');
 const mediaList=make('div',null,'media-file-list');
 wrap.append(open,panel);container.append(wrap);
 let busy=false,pilot=false;
 function message(text){status.textContent=text;}
 async function reload(){
  message('Checking your private media archive…');
  let data;
  try{data=await request(api,'?project_id='+encodeURIComponent(project.id));}
  catch(err){message(err.message);return;}
  panel.replaceChildren();
  mediaList.replaceChildren();
  panel.append(status);
  if(!data.pilot){message('Media uploads are available only to the owner test account during this beta.');return;}
  pilot=true;
  const quota=make('p','Private test · '+fmtBytes(data.consumed_lifetime_bytes)+' of 80 MB lifetime used. 15 MB per file.','media-limits');
  const note=make('p','Pilot only. Files remain private in Cloudflare R2. Don’t upload sensitive documents, payment details, or images of people without permission.','media-note');
  const field=make('input');field.type='file';field.accept='.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.mp3,.wav,.m4a';field.className='media-picker';
  const permission=make('label',null,'media-permission');
  const check=make('input');check.type='checkbox';check.required=true;
  permission.append(check,document.createTextNode(' I own this media or have permission from its rights holders and identifiable people to upload it for private testing. No portfolio or AI training permission is given.'));
  const send=make('button','Upload privately','media-upload');send.type='button';
  const help=make('p','Save a text draft first, then attach media to that project.','media-help');
  panel.append(quota,note,field,permission,send,help,mediaList);
  const all=(data.files||[]);
  if(!all.length)mediaList.append(make('p','No uploaded files in this project.','media-empty'));
  for(const asset of all){
   const row=make('div',null,'media-file-row');
   const info=make('div',null,'media-file-info');
   info.append(make('strong',asset.filename),make('small',fmtBytes(asset.byte_size)+' · '+labelDate(asset.created_at)));
   const actions=make('div',null,'media-file-actions');
   const download=make('button','Download');download.type='button';
   download.addEventListener('click',async()=>{
    if(busy)return;busy=true;download.disabled=true;
    try{
     const blob=await request(api,'?project_id='+encodeURIComponent(project.id)+'&asset_id='+encodeURIComponent(asset.id),{download:true});
     const url=URL.createObjectURL(blob);
     const a=document.createElement('a');a.href=url;a.download=asset.filename;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
     setTimeout(()=>URL.revokeObjectURL(url),30000);
     message('Private download started.');
    }catch(e){message(e.message)}finally{busy=false;download.disabled=false;}
   });
   const remove=make('button','Delete file');remove.type='button';
   remove.addEventListener('click',async()=>{
    if(busy||!confirm('Permanently delete "'+asset.filename+'" from private storage?'))return;
    busy=true;remove.disabled=true;message('Removing private file…');
    try{
     await request(api,'',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({project_id:project.id,asset_id:asset.id})});
     message('File deleted from private storage.');await reload();
    }catch(e){message(e.message)}finally{busy=false;remove.disabled=false}
   });
   actions.append(download,remove);row.append(info,actions);mediaList.append(row);
  }
  send.addEventListener('click',async()=>{
   if(busy)return;
   const file=field.files?.[0];
   if(!file){message('Choose an image, video or audio file.');return;}
   if(!check.checked){message('Confirm your rights to this media before uploading.');return;}
   if(file.size>15000000||file.size<100){message('Choose a file between 100 bytes and 15 MB.');return;}
   busy=true;send.disabled=true;
   const form=new FormData();form.append('project_id',project.id);form.append('rights_confirmed','true');form.append('file',file,file.name);
   message('Uploading private file… 0%');
   try{
    await uploadFile(api,form,n=>message(n===null?'Uploading private file…':'Uploading private file… '+n+'%'));
    message('Upload completed.');await reload();
   }catch(err){message(err.message)}finally{busy=false;send.disabled=false;}
  });
  message('Private archive ready.'); // No automatic upload.
 }
 open.addEventListener('click',async()=>{
  panel.hidden=!panel.hidden;
  open.textContent=panel.hidden?'Media archive ▸':'Media archive ▾';
  open.setAttribute('aria-expanded',String(!panel.hidden));
  if(!panel.hidden&&!pilot)await reload();
 });
}
async function uploadToProject({api,projectId,file,progress=()=>{}}){
 const form=new FormData();
 form.append('project_id',projectId);
 form.append('rights_confirmed','true');
 form.append('file',file,file.name);
 return uploadFile(api,form,progress);
}
async function listProject({api,projectId}){
 return request(api,'?project_id='+encodeURIComponent(projectId));
}
async function downloadFile({api,projectId,asset}){
 const blob=await request(api,'?project_id='+encodeURIComponent(projectId)+'&asset_id='+encodeURIComponent(asset.id),{download:true});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=asset.filename;
 a.style.display='none';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function deleteFile({api,projectId,asset}){
 return request(api,'',{method:'DELETE',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({project_id:projectId,asset_id:asset.id})});
}
window.MAH_STUDIO_MEDIA=Object.freeze({mount,uploadToProject,listProject,downloadFile,deleteFile});
})();
