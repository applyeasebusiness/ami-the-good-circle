(() => {
  const config = window.AMI_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const loginPanel = $('login-panel');
  const dashboard = $('dashboard');
  const globalStatus = $('global-status');
  let supabase = null;
  let currentUser = null;
  let submissions = [];
  let events = [];
  let galleryItems = [];
  let blogPosts = [];
  let teamMembers = [];
  let publicDocuments = [];

  function status(message, error = false) {
    globalStatus.innerHTML = '';
    if (!message) return;
    const div = document.createElement('div');
    div.className = `admin-status${error ? ' error' : ''}`;
    div.textContent = message;
    globalStatus.appendChild(div);
  }
  function safe(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function formatDate(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(); }
  function inputDate(value) { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return ''; return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); }
  function setLoginMessage(message, error = false) { const el = $('login-status'); el.textContent = message; el.style.color = error ? '#a52b21' : 'var(--green)'; }
  function showDashboard(user) { currentUser = user; loginPanel.hidden = true; dashboard.hidden = false; $('admin-user').textContent = `Signed in as ${user.email || user.id}`; }
  function showLogin() { dashboard.hidden = true; loginPanel.hidden = false; currentUser = null; }

  if (!config.supabaseUrl || !config.supabaseAnonKey || config.supabaseUrl.includes('YOUR_PROJECT_REF') || config.supabaseAnonKey.includes('YOUR_SUPABASE')) {
    setLoginMessage('Setup required: add your Supabase project URL and anon/publishable key in admin-config.js.', true);
    $('login-form').addEventListener('submit', e => { e.preventDefault(); setLoginMessage('Please configure admin-config.js first.', true); });
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    setLoginMessage('The authentication library could not load. Check the network and refresh.', true);
    return;
  }
  supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    setLoginMessage('Signing in…');
    const { data, error } = await supabase.auth.signInWithPassword({ email: $('login-email').value.trim(), password: $('login-password').value });
    if (error) { setLoginMessage('Sign-in failed. Check your credentials and try again.', true); return; }
    await verifyAdmin(data.user);
  });
  $('signout-button').addEventListener('click', async () => { await supabase.auth.signOut(); showLogin(); setLoginMessage('You have signed out.'); });
  $('refresh-button').addEventListener('click', loadAll);
  $('submission-filter').addEventListener('change', renderSubmissions);

  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b === button)));
    document.querySelectorAll('.admin-panel').forEach(panel => panel.hidden = panel.id !== `panel-${button.dataset.tab}`);
  }));

  async function verifyAdmin(user) {
    const { data: profile, error } = await supabase.from('profiles').select('role,display_name').eq('id', user.id).maybeSingle();
    if (error || !profile || profile.role !== 'admin') {
      await supabase.auth.signOut(); showLogin();
      setLoginMessage('This account is not authorized as an AMI administrator. Ask the project owner to promote its user UUID in Supabase SQL Editor.', true);
      return;
    }
    showDashboard(user);
    if (profile.display_name) $('admin-user').textContent = `${profile.display_name} · ${user.email || user.id}`;
    await loadAll();
    await loadHeroSettings();
  }

  async function loadAll() {
    status('Loading dashboard data…');
    const [s, e, g, b, t, d] = await Promise.all([
      supabase.from('form_submissions').select('id,form_type,payload,status,admin_notes,created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('events').select('*').order('starts_at', { ascending: false, nullsFirst: false }),
      supabase.from('gallery_items').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('blog_posts').select('*').order('created_at', { ascending: false }),
      supabase.from('team_members').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('public_documents').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false })
    ]);
    const failed = [s,e,g,b,t,d].find(x => x.error);
    if (failed) { status('Could not load some dashboard data. Confirm schema.sql was run and this user has the admin role.', true); console.error('Admin dashboard load error:', failed.error); }
    submissions = s.data || []; events = e.data || []; galleryItems = g.data || []; blogPosts = b.data || []; teamMembers = t.data || []; publicDocuments = d.data || [];
    renderSubmissions(); renderEvents(); renderGallery(); renderBlogs(); renderTeam(); renderDocuments();
    if (!failed) status(`Loaded ${submissions.length} submissions, ${events.length} events and ${galleryItems.length} gallery items.`);
  }

  function renderSubmissions() {
    const filter = $('submission-filter').value;
    const rows = submissions.filter(item => filter === 'all' || item.status === filter);
    const host = $('submissions-list');
    if (!rows.length) { host.innerHTML = '<p class="admin-empty">No submissions match this filter.</p>'; return; }
    host.innerHTML = `<table class="admin-table"><thead><tr><th>Received</th><th>Type / details</th><th>Status & notes</th><th>Save</th></tr></thead><tbody>${rows.map(item => {
      const p = item.payload || {};
      const detailRows = Object.entries(p).filter(([key]) => !['consent'].includes(key)).map(([key,value]) => `<div><strong>${safe(key.replace(/_/g,' '))}:</strong> ${safe(value)}</div>`).join('');
      return `<tr><td>${safe(formatDate(item.created_at))}<br><span class="admin-badge">#${safe(item.id)}</span></td><td><strong>${safe(item.form_type)}</strong>${detailRows}</td><td><select data-status-for="${safe(item.id)}" aria-label="Submission status">${[['new','New'],['in_review','In review'],['responded','Responded'],['closed','Closed']].map(([v,l])=>`<option value="${v}" ${item.status===v?'selected':''}>${l}</option>`).join('')}</select><p><textarea data-notes-for="${safe(item.id)}" rows="3" placeholder="Internal notes (private)" aria-label="Internal notes">${safe(item.admin_notes || '')}</textarea></p></td><td><button data-save-submission="${safe(item.id)}">Save status</button></td></tr>`;
    }).join('')}</tbody></table>`;
    host.querySelectorAll('[data-save-submission]').forEach(button => button.addEventListener('click', async () => {
      const id = Number(button.dataset.saveSubmission);
      const newStatus = host.querySelector(`[data-status-for="${id}"]`).value;
      const notes = host.querySelector(`[data-notes-for="${id}"]`).value.trim().slice(0,4000);
      button.disabled = true;
      const { error } = await supabase.from('form_submissions').update({ status: newStatus, admin_notes: notes }).eq('id', id);
      button.disabled = false;
      if (error) status('Could not update this submission. Check permissions and database schema.', true);
      else { const item = submissions.find(x => x.id === id); if (item) { item.status = newStatus; item.admin_notes = notes; } status(`Submission #${id} updated.`); renderSubmissions(); }
    }));
  }

  $('event-title').addEventListener('input', () => { if (!$('event-id').value) $('event-slug').value = $('event-title').value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100); });
  $('event-form').addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('event-id').value;
    const payload = { title: $('event-title').value.trim(), slug: $('event-slug').value.trim(), description: $('event-description').value.trim(), location: $('event-location').value.trim(), registration_url: $('event-registration').value.trim(), cover_image_url: $('event-image').value.trim(), status: $('event-status').value, starts_at: $('event-start').value ? new Date($('event-start').value).toISOString() : null, ends_at: $('event-end').value ? new Date($('event-end').value).toISOString() : null };
    if (payload.registration_url && !/^https:\/\//i.test(payload.registration_url)) { status('Registration URL must use HTTPS.', true); return; }
    if (payload.cover_image_url && !/^https:\/\//i.test(payload.cover_image_url)) { status('Cover image URL must use HTTPS.', true); return; }
    if (payload.ends_at && payload.starts_at && payload.ends_at < payload.starts_at) { status('Event end must be after its start.', true); return; }
    const button = $('event-form').querySelector('[type="submit"]'); button.disabled = true;
    const result = id ? await supabase.from('events').update(payload).eq('id', id) : await supabase.from('events').insert(payload);
    button.disabled = false;
    if (result.error) { status(result.error.code === '23505' ? 'That URL slug already exists. Choose a unique slug.' : 'Could not save event. Check required fields and permissions.', true); console.error(result.error); return; }
    resetEventForm(); await loadAll(); status('Event saved.');
  });
  $('event-cancel').addEventListener('click', resetEventForm);
  function resetEventForm() { $('event-form').reset(); $('event-id').value = ''; $('event-form-title').textContent = 'Add an event'; $('event-status').value = 'draft'; }
  function renderEvents() {
    const host = $('events-list');
    if (!events.length) { host.innerHTML = '<p class="admin-empty">No events yet. Add one above.</p>'; return; }
    host.innerHTML = `<table class="admin-table"><thead><tr><th>Event</th><th>Date / venue</th><th>Status</th><th>Actions</th></tr></thead><tbody>${events.map(item => `<tr><td><strong>${safe(item.title)}</strong><br><span class="admin-muted">/${safe(item.slug)}</span><p>${safe(item.description).slice(0,180)}</p></td><td>${safe(formatDate(item.starts_at))}<br>${safe(item.location || 'No venue')}</td><td><span class="admin-badge">${safe(item.status)}</span></td><td><div class="admin-actions"><button data-edit-event="${safe(item.id)}">Edit</button><button class="danger" data-delete-event="${safe(item.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table>`;
    host.querySelectorAll('[data-edit-event]').forEach(button => button.addEventListener('click', () => {
      const item = events.find(x => x.id === button.dataset.editEvent); if (!item) return;
      $('event-id').value = item.id; $('event-title').value = item.title; $('event-slug').value = item.slug; $('event-description').value = item.description; $('event-location').value = item.location; $('event-registration').value = item.registration_url; $('event-image').value = item.cover_image_url; $('event-start').value = inputDate(item.starts_at); $('event-end').value = inputDate(item.ends_at); $('event-status').value = item.status; $('event-form-title').textContent = 'Edit event'; $('panel-events').scrollIntoView({behavior:'smooth',block:'start'});
    }));
    host.querySelectorAll('[data-delete-event]').forEach(button => button.addEventListener('click', async () => {
      const item = events.find(x => x.id === button.dataset.deleteEvent); if (!item || !confirm(`Delete event “${item.title}”? This cannot be undone.`)) return;
      const { error } = await supabase.from('events').delete().eq('id', item.id);
      if (error) status('Could not delete event.', true); else { await loadAll(); status('Event deleted.'); }
    }));
  }

  $('gallery-form').addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('gallery-id').value;
    const file = $('gallery-file').files[0];
    let imageUrl = $('gallery-existing-image').value;
    if (file) {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { status('Choose a JPG, PNG or WebP image no larger than 5 MB.', true); return; }
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const upload = await supabase.storage.from('ami-gallery').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (upload.error) { status('Image upload failed. Confirm the storage policies and admin role.', true); console.error(upload.error); return; }
      imageUrl = supabase.storage.from('ami-gallery').getPublicUrl(path).data.publicUrl;
    }
    if (!imageUrl) { status('Please choose an image file.', true); return; }
    const payload = { title: $('gallery-title').value.trim(), image_url: imageUrl, alt_text: $('gallery-alt').value.trim(), caption: $('gallery-caption').value.trim(), event_date: $('gallery-date').value || null, published: $('gallery-published').value === 'true', sort_order: Math.max(0, Number($('gallery-order').value) || 0) };
    const button = $('gallery-form').querySelector('[type="submit"]'); button.disabled = true;
    const result = id ? await supabase.from('gallery_items').update(payload).eq('id', id) : await supabase.from('gallery_items').insert(payload);
    button.disabled = false;
    if (result.error) { status('Could not save gallery item. Check permissions and required fields.', true); console.error(result.error); return; }
    resetGalleryForm(); await loadAll(); status('Gallery item saved.');
  });
  $('gallery-cancel').addEventListener('click', resetGalleryForm);
  function resetGalleryForm() { $('gallery-form').reset(); $('gallery-id').value = ''; $('gallery-existing-image').value = ''; $('gallery-form-title').textContent = 'Add gallery item'; $('gallery-published').value = 'false'; $('gallery-order').value = '0'; }
  function renderGallery() {
    const host = $('gallery-list');
    if (!galleryItems.length) { host.innerHTML = '<p class="admin-empty">No gallery items yet. Add one above.</p>'; return; }
    host.innerHTML = `<table class="admin-table"><thead><tr><th>Image</th><th>Details</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>${galleryItems.map(item => `<tr><td><img class="admin-thumb" src="${safe(item.image_url)}" alt=""></td><td><strong>${safe(item.title)}</strong><br>${safe(item.alt_text)}<br><span class="admin-muted">${safe(item.caption)}</span></td><td><span class="admin-badge">${item.published?'published':'draft'}</span></td><td><div class="admin-actions"><button data-edit-gallery="${safe(item.id)}">Edit</button><button class="danger" data-delete-gallery="${safe(item.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table>`;
    host.querySelectorAll('[data-edit-gallery]').forEach(button => button.addEventListener('click', () => {
      const item = galleryItems.find(x => x.id === button.dataset.editGallery); if (!item) return;
      $('gallery-id').value = item.id; $('gallery-existing-image').value = item.image_url; $('gallery-title').value = item.title; $('gallery-alt').value = item.alt_text; $('gallery-caption').value = item.caption; $('gallery-date').value = item.event_date || ''; $('gallery-published').value = String(item.published); $('gallery-order').value = item.sort_order; $('gallery-form-title').textContent = 'Edit gallery item'; $('panel-gallery').scrollIntoView({behavior:'smooth',block:'start'});
    }));
    host.querySelectorAll('[data-delete-gallery]').forEach(button => button.addEventListener('click', async () => {
      const item = galleryItems.find(x => x.id === button.dataset.deleteGallery); if (!item || !confirm(`Delete gallery item “${item.title}”? The stored image file may remain in storage.`)) return;
      const { error } = await supabase.from('gallery_items').delete().eq('id', item.id);
      if (error) status('Could not delete gallery item.', true); else { await loadAll(); status('Gallery item deleted. Remove the unused image from Supabase Storage if no longer needed.'); }
    }));
  }





  $('team-photo-file').addEventListener('change', () => {
    const file = $('team-photo-file').files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      status('Choose a JPG, PNG or WebP image up to 5 MB.', true); $('team-photo-file').value = ''; return;
    }
    $('team-photo-preview').innerHTML = '<p class="admin-muted">Selected photo: ' + safe(file.name) + '</p>';
  });
  $('team-photo-url').addEventListener('input', () => {
    const url = $('team-photo-url').value.trim();
    $('team-photo-preview').innerHTML = /^https:\/\//i.test(url) ? '<img src="' + safe(url) + '" alt="Team photo preview" style="display:block;width:100%;max-height:240px;object-fit:contain;border-radius:12px">' : '';
  });
  $('team-form').addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('team-id').value;
    let photoUrl = $('team-photo-url').value.trim();
    const file = $('team-photo-file').files?.[0];
    if (file) {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = 'team/' + crypto.randomUUID() + '.' + ext;
      status('Uploading team photo…');
      const upload = await supabase.storage.from('ami-gallery').upload(path, file, {cacheControl:'3600',upsert:false,contentType:file.type});
      if (upload.error) { status('Photo upload failed. Check the ami-gallery bucket permissions.', true); console.error(upload.error); return; }
      photoUrl = supabase.storage.from('ami-gallery').getPublicUrl(path).data.publicUrl;
    }
    if (photoUrl && !/^https:\/\//i.test(photoUrl)) { status('Photo URL must use HTTPS.', true); return; }
    const payload = { name:$('team-name').value.trim(), role_title:$('team-role').value.trim(), bio:$('team-bio').value.trim(), photo_url:photoUrl, sort_order:Math.max(0,Number($('team-order').value)||0), published:$('team-published').value==='true' };
    const result = id ? await supabase.from('team_members').update(payload).eq('id',id) : await supabase.from('team_members').insert(payload);
    if (result.error) { status('Could not save team member. Run supabase/team_members_migration.sql first.',true); console.error(result.error); return; }
    resetTeamForm(); await loadAll(); status('Team profile saved.');
  });
  $('team-cancel').addEventListener('click', resetTeamForm);
  function resetTeamForm() { $('team-form').reset(); $('team-id').value=''; $('team-order').value='0'; $('team-published').value='false'; $('team-form-title').textContent='Add team member'; $('team-photo-preview').innerHTML=''; }
  function renderTeam() {
    const host = $('team-list'); if (!host) return;
    if (!teamMembers.length) { host.innerHTML='<p class="admin-empty">No team profiles yet. Add a member above.</p>'; return; }
    host.innerHTML='<table class="admin-table"><thead><tr><th>Person</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>'+teamMembers.map(m=>'<tr><td>'+(m.photo_url?'<img class="admin-thumb" src="'+safe(m.photo_url)+'" alt="">':'')+'<strong>'+safe(m.name)+'</strong><br><span class="admin-muted">'+safe(m.role_title)+'</span><p>'+safe(m.bio).slice(0,180)+'</p></td><td><span class="admin-badge">'+(m.published?'published':'draft')+'</span></td><td><div class="admin-actions"><button data-edit-team="'+safe(m.id)+'">Edit</button><button class="danger" data-delete-team="'+safe(m.id)+'">Delete</button></div></td></tr>').join('')+'</tbody></table>';
    host.querySelectorAll('[data-edit-team]').forEach(btn=>btn.addEventListener('click',()=>{const m=teamMembers.find(x=>x.id===btn.dataset.editTeam);if(!m)return;$('team-id').value=m.id;$('team-name').value=m.name;$('team-role').value=m.role_title;$('team-bio').value=m.bio;$('team-photo-url').value=m.photo_url;$('team-order').value=m.sort_order;$('team-published').value=String(m.published);$('team-form-title').textContent='Edit team member';$('team-photo-preview').innerHTML=m.photo_url?'<img src="'+safe(m.photo_url)+'" alt="Team photo preview" style="display:block;width:100%;max-height:240px;object-fit:contain;border-radius:12px">':'';$('panel-team').scrollIntoView({behavior:'smooth'});}));
    host.querySelectorAll('[data-delete-team]').forEach(btn=>btn.addEventListener('click',async()=>{const m=teamMembers.find(x=>x.id===btn.dataset.deleteTeam);if(!m||!confirm('Delete team profile for '+m.name+'?'))return;const {error}=await supabase.from('team_members').delete().eq('id',m.id);if(error)status('Could not delete team profile.',true);else{await loadAll();status('Team profile deleted.');}}));
  }


  $('document-form').addEventListener('submit', async event => {
    event.preventDefault();
    const id=$('document-id').value;
    let documentUrl=$('document-url').value.trim();
    const file=$('document-file').files?.[0];
    if(file){
      if(file.size>10*1024*1024){status('Document must be 10 MB or smaller.',true);return;}
      const ext=(file.name.split('.').pop()||'pdf').toLowerCase().replace(/[^a-z0-9]/g,'');
      if(!['pdf','doc','docx','xlsx','csv'].includes(ext)){status('Choose a PDF, DOC, DOCX, XLSX or CSV file.',true);return;}
      const path='transparency/'+crypto.randomUUID()+'.'+ext;
      status('Uploading document…');
      const upload=await supabase.storage.from('ami-gallery').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'application/octet-stream'});
      if(upload.error){status('Document upload failed. Check the ami-gallery storage permissions.',true);console.error(upload.error);return;}
      documentUrl=supabase.storage.from('ami-gallery').getPublicUrl(path).data.publicUrl;
    }
    if(!/^https:\/\//i.test(documentUrl)){status('Provide an HTTPS document URL or upload a file.',true);return;}
    const payload={title:$('document-title').value.trim(),category:$('document-category').value,description:$('document-description').value.trim(),document_url:documentUrl,published:$('document-published').value==='true',sort_order:Math.max(0,Number($('document-order').value)||0)};
    const result=id?await supabase.from('public_documents').update(payload).eq('id',id):await supabase.from('public_documents').insert(payload);
    if(result.error){status('Could not save document. Run supabase/transparency_documents_migration.sql first.',true);console.error(result.error);return;}
    resetDocumentForm();await loadAll();status('Transparency document saved.');
  });
  $('document-cancel').addEventListener('click',resetDocumentForm);
  function resetDocumentForm(){$('document-form').reset();$('document-id').value='';$('document-order').value='0';$('document-published').value='false';$('document-form-title').textContent='Add public document or update';}
  function renderDocuments(){
    const host=$('documents-list');if(!host)return;
    if(!publicDocuments.length){host.innerHTML='<p class="admin-empty">No public documents yet. Add an approved document above.</p>';return;}
    host.innerHTML='<table class="admin-table"><thead><tr><th>Document</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>'+publicDocuments.map(d=>'<tr><td><strong>'+safe(d.title)+'</strong><br><span class="admin-muted">'+safe(d.category)+'</span><p>'+safe(d.description)+'</p><a href="'+safe(d.document_url)+'" target="_blank" rel="noopener noreferrer">Open document</a></td><td><span class="admin-badge">'+(d.published?'published':'draft')+'</span></td><td><div class="admin-actions"><button data-edit-document="'+safe(d.id)+'">Edit</button><button class="danger" data-delete-document="'+safe(d.id)+'">Delete</button></div></td></tr>').join('')+'</tbody></table>';
    host.querySelectorAll('[data-edit-document]').forEach(btn=>btn.addEventListener('click',()=>{const d=publicDocuments.find(x=>x.id===btn.dataset.editDocument);if(!d)return;$('document-id').value=d.id;$('document-title').value=d.title;$('document-category').value=d.category;$('document-description').value=d.description;$('document-url').value=d.document_url;$('document-order').value=d.sort_order;$('document-published').value=String(d.published);$('document-form-title').textContent='Edit public document';$('panel-documents').scrollIntoView({behavior:'smooth'});}));
    host.querySelectorAll('[data-delete-document]').forEach(btn=>btn.addEventListener('click',async()=>{const d=publicDocuments.find(x=>x.id===btn.dataset.deleteDocument);if(!d||!confirm('Delete public document '+d.title+'?'))return;const {error}=await supabase.from('public_documents').delete().eq('id',d.id);if(error)status('Could not delete document.',true);else{await loadAll();status('Document deleted.');}}));
  }


  $('page-copy-form').addEventListener('submit', async event => {
    event.preventDefault();
    const pairs = [
      ['homepage_eyebrow','copy-home-eyebrow'],['homepage_heading_first','copy-home-heading-first'],
      ['homepage_heading_highlight','copy-home-heading-highlight'],['homepage_subtitle','copy-home-subtitle'],
      ['about_heading','copy-about-heading'],['about_intro','copy-about-intro'],
      ['initiatives_heading','copy-initiatives-heading'],['initiatives_intro','copy-initiatives-intro'],
      ['transparency_heading','copy-transparency-heading'],['transparency_intro','copy-transparency-intro'],['home_intro_heading','copy-home-intro-heading'],['home_intro_body','copy-home-intro-body'],['nature_title','copy-nature-title'],['nature_description','copy-nature-description'],['society_title','copy-society-title'],['society_description','copy-society-description'],['culture_title','copy-culture-title'],['culture_description','copy-culture-description'],['about_vision','copy-about-vision'],['about_mission','copy-about-mission'],['about_values_intro','copy-about-values'],['initiatives_nature_description','copy-initiative-nature'],['initiatives_society_description','copy-initiative-society'],['initiatives_culture_description','copy-initiative-culture']
    ];
    const rows = pairs.map(([setting_key,id]) => ({setting_key,setting_value:$(id).value.trim()}));
    const {error}=await supabase.from('site_settings').upsert(rows,{onConflict:'setting_key'});
    if(error){status('Could not save page copy. Run supabase/page_content_settings_migration.sql first.',true);console.error(error);return;}
    status('Page headings and introductions saved. Refresh the public pages to see the changes.');
  });

  async function loadHeroSettings() {
    const preview = $('hero-image-preview');
    const { data, error } = await supabase.from('site_settings').select('setting_key,setting_value');
    if (error) { preview.innerHTML = '<p class="admin-muted">Homepage image settings are not configured yet. Run the homepage image migration in Supabase SQL Editor.</p>'; console.warn('Homepage settings unavailable:', error); return; }
    const values = Object.fromEntries((data || []).map(row => [row.setting_key, row.setting_value]));
    $('hero-image-url').value = values.homepage_hero_image_url || '';
    $('hero-image-alt').value = values.homepage_hero_image_alt || 'AMI – The Good Circle community and initiatives';
    renderHeroPreview(values.homepage_hero_image_url || '');
    const fields = { 'copy-home-eyebrow':'homepage_eyebrow','copy-home-heading-first':'homepage_heading_first','copy-home-heading-highlight':'homepage_heading_highlight','copy-home-subtitle':'homepage_subtitle','copy-about-heading':'about_heading','copy-about-intro':'about_intro','copy-initiatives-heading':'initiatives_heading','copy-initiatives-intro':'initiatives_intro','copy-transparency-heading':'transparency_heading','copy-transparency-intro':'transparency_intro', 'copy-home-intro-heading':'home_intro_heading','copy-home-intro-body':'home_intro_body','copy-nature-title':'nature_title','copy-nature-description':'nature_description','copy-society-title':'society_title','copy-society-description':'society_description','copy-culture-title':'culture_title','copy-culture-description':'culture_description','copy-about-vision':'about_vision','copy-about-mission':'about_mission','copy-about-values':'about_values_intro','copy-initiative-nature':'initiatives_nature_description','copy-initiative-society':'initiatives_society_description','copy-initiative-culture':'initiatives_culture_description' };
    Object.entries(fields).forEach(([id,key]) => { if ($(id)) $(id).value = values[key] || ''; });
  }
  function renderHeroPreview(url) {
    const preview = $('hero-image-preview');
    if (!url) { preview.innerHTML = '<p class="admin-muted">No custom hero image saved. The default illustration will be shown.</p>'; return; }
    preview.innerHTML = '<img src="' + safe(url) + '" alt="Homepage hero preview" style="display:block;width:100%;max-height:320px;object-fit:contain;border-radius:12px;background:#f5f5f0"><p class="admin-muted">Current hero image</p>';
  }
  $('hero-image-file').addEventListener('change', () => {
    const file = $('hero-image-file').files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      status('Choose a JPG, PNG or WebP image up to 5 MB.', true); $('hero-image-file').value = ''; return;
    }
    renderHeroPreview(URL.createObjectURL(file));
  });
  $('hero-image-url').addEventListener('change', () => { if ($('hero-image-url').value.trim()) renderHeroPreview($('hero-image-url').value.trim()); });
  $('hero-image-form').addEventListener('submit', async event => {
    event.preventDefault();
    const file = $('hero-image-file').files?.[0];
    let imageUrl = $('hero-image-url').value.trim();
    if (file) {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { status('Choose a JPG, PNG or WebP image up to 5 MB.', true); return; }
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = 'homepage/hero-' + crypto.randomUUID() + '.' + ext;
      status('Uploading homepage hero image…');
      const upload = await supabase.storage.from('ami-gallery').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (upload.error) { status('Hero upload failed. Check the ami-gallery bucket and admin storage permissions.', true); console.error(upload.error); return; }
      imageUrl = supabase.storage.from('ami-gallery').getPublicUrl(path).data.publicUrl;
    }
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) { status('Image URL must use HTTPS.', true); return; }
    const alt = $('hero-image-alt').value.trim().slice(0,250) || 'AMI – The Good Circle community and initiatives';
    const rows = [
      { setting_key: 'homepage_hero_image_url', setting_value: imageUrl },
      { setting_key: 'homepage_hero_image_alt', setting_value: alt }
    ];
    const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'setting_key' });
    if (error) { status('Could not save homepage image settings. Run the homepage image migration in Supabase first.', true); console.error(error); return; }
    $('hero-image-file').value = ''; $('hero-image-url').value = imageUrl;
    renderHeroPreview(imageUrl);
    status(imageUrl ? 'Homepage hero image saved. Refresh the public homepage to view it.' : 'Homepage hero image URL cleared.');
  });
  $('hero-image-reset').addEventListener('click', async () => {
    if (!confirm('Remove the custom homepage hero image and restore the default illustration?')) return;
    const rows = [
      { setting_key: 'homepage_hero_image_url', setting_value: '' },
      { setting_key: 'homepage_hero_image_alt', setting_value: 'AMI – The Good Circle community and initiatives' }
    ];
    const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'setting_key' });
    if (error) { status('Could not restore the default illustration. Run the homepage image migration in Supabase first.', true); console.error(error); return; }
    $('hero-image-file').value = ''; $('hero-image-url').value = '';
    $('hero-image-alt').value = 'AMI – The Good Circle community and initiatives';
    renderHeroPreview(''); status('Default homepage illustration restored.');
  });

  const richEditor=$('blog-body');
  let savedEditorRange=null;
  function rememberEditorSelection(){const sel=window.getSelection();if(sel&&sel.rangeCount&&richEditor.contains(sel.anchorNode))savedEditorRange=sel.getRangeAt(0).cloneRange();}
  document.addEventListener('selectionchange',rememberEditorSelection);
  function restoreEditorSelection(){richEditor.focus();const sel=window.getSelection();if(savedEditorRange&&sel){sel.removeAllRanges();sel.addRange(savedEditorRange);}}
  function editorCommand(command,value=null){restoreEditorSelection();document.execCommand(command,false,value);rememberEditorSelection();}
  document.querySelectorAll('[data-command]').forEach(btn=>btn.addEventListener('click',()=>editorCommand(btn.dataset.command)));
  $('blog-text-color').addEventListener('input',e=>editorCommand('foreColor',e.target.value));
  $('blog-highlight-color').addEventListener('input',e=>editorCommand('hiliteColor',e.target.value));
  $('blog-font-size').addEventListener('change',e=>{const size=Number(e.target.value);if(!size)return;const sel=window.getSelection();if(!sel||sel.rangeCount===0||sel.isCollapsed){status('Select the text you want to resize first.',true);e.target.value='';return;}const range=savedEditorRange||sel.getRangeAt(0),span=document.createElement('span');span.style.fontSize=size+'px';try{range.surroundContents(span);}catch(_){span.appendChild(range.extractContents());range.insertNode(span);}sel.removeAllRanges();e.target.value='';});
  $('blog-insert-image').addEventListener('click',()=>$('blog-inline-image-file').click());
  async function uploadBlogImage(file){if(!file)return null;if(!file.type.startsWith('image/')){status('Choose an image file.',true);return null;}if(file.size>8*1024*1024){status('Image must be 8 MB or smaller.',true);return null;}const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg',path='blogs/'+crypto.randomUUID()+'.'+ext;status('Uploading image…');const {error}=await supabase.storage.from('ami-gallery').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});if(error){status('Image upload failed. Check the ami-gallery bucket and admin storage policies.',true);console.error(error);return null;}return supabase.storage.from('ami-gallery').getPublicUrl(path).data.publicUrl;}
  $('blog-inline-image-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;const url=await uploadBlogImage(file);if(url){richEditor.focus();const img=document.createElement('img');img.src=url;img.alt='';img.style.maxWidth='100%';img.style.height='auto';const sel=window.getSelection();if(sel&&sel.rangeCount){const range=sel.getRangeAt(0);range.insertNode(img);range.setStartAfter(img);range.collapse(true);sel.removeAllRanges();sel.addRange(range);}else richEditor.appendChild(img);status('Image uploaded and inserted into the article.');}e.target.value='';});
  $('blog-upload-cover').addEventListener('click',async()=>{const file=$('blog-cover-file').files?.[0];if(!file){status('Choose a cover image file first.',true);return;}const url=await uploadBlogImage(file);if(url){$('blog-cover').value=url;$('blog-cover-preview').innerHTML='<img src="'+safe(url)+'" alt="Cover image preview">';status('Cover image uploaded. Save the post to keep the URL.');}});
  $('blog-cover').addEventListener('change',()=>{$('blog-cover-preview').innerHTML=$('blog-cover').value?'<img src="'+safe($('blog-cover').value)+'" alt="Cover image preview">':'';});
  $('blog-seo-description').addEventListener('input',()=>{$('blog-seo-count').textContent=String($('blog-seo-description').value.length);});
  $('blog-title').addEventListener('input',()=>{if(!$('blog-id').value)$('blog-slug').value=$('blog-title').value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);});
  $('blog-form').addEventListener('submit',async event=>{event.preventDefault();const id=$('blog-id').value,st=$('blog-status').value;if(!$('blog-body').innerText.trim()){status('Please write the article body first.',true);return;}const payload={title:$('blog-title').value.trim(),slug:$('blog-slug').value.trim(),excerpt:$('blog-excerpt').value.trim(),seo_description:$('blog-seo-description').value.trim(),body:$('blog-body').innerHTML.trim(),author_name:$('blog-author').value.trim(),cover_image_url:$('blog-cover').value.trim(),status:st,published_at:st==='published'?(blogPosts.find(x=>x.id===id)?.published_at||new Date().toISOString()):null};if(payload.cover_image_url&&!/^https:\/\//i.test(payload.cover_image_url)){status('Cover image URL must use HTTPS.',true);return;}const btn=$('blog-form').querySelector('[type="submit"]');btn.disabled=true;const r=id?await supabase.from('blog_posts').update(payload).eq('id',id):await supabase.from('blog_posts').insert(payload);btn.disabled=false;if(r.error){status('Could not save blog post. Make sure the blog database migration has been run.',true);return;}resetBlog();await loadAll();status('Blog post saved.');});
  $('blog-cancel').addEventListener('click',resetBlog);function resetBlog(){$('blog-form').reset();$('blog-seo-count').textContent='0';$('blog-body').innerHTML='';$('blog-cover-preview').innerHTML='';$('blog-id').value='';$('blog-form-title').textContent='Write a blog post';$('blog-status').value='draft';}
  function renderBlogs(){const host=$('blogs-list');if(!blogPosts.length){host.innerHTML='<p class="admin-empty">No blog posts yet. Write one above.</p>';return;}host.innerHTML='<table class="admin-table"><thead><tr><th>Article</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+blogPosts.map(p=>'<tr><td><strong>'+safe(p.title)+'</strong><br>'+safe(p.slug)+'<p>'+safe(p.excerpt)+'</p></td><td>'+safe(p.status)+'</td><td><div class="admin-actions"><button data-edit-blog="'+safe(p.id)+'">Edit</button><button class="danger" data-delete-blog="'+safe(p.id)+'">Delete</button></div></td></tr>').join('')+'</tbody></table>';host.querySelectorAll('[data-edit-blog]').forEach(btn=>btn.addEventListener('click',()=>{const p=blogPosts.find(x=>x.id===btn.dataset.editBlog);if(!p)return;$('blog-id').value=p.id;$('blog-title').value=p.title;$('blog-slug').value=p.slug;$('blog-excerpt').value=p.excerpt;$('blog-seo-description').value=p.seo_description||'';$('blog-seo-count').textContent=String(($('blog-seo-description').value||'').length);$('blog-body').innerHTML=p.body||'';$('blog-author').value=p.author_name;$('blog-cover').value=p.cover_image_url;$('blog-status').value=p.status;$('blog-form-title').textContent='Edit blog post';$('panel-blogs').scrollIntoView({behavior:'smooth'});}));host.querySelectorAll('[data-delete-blog]').forEach(btn=>btn.addEventListener('click',async()=>{const p=blogPosts.find(x=>x.id===btn.dataset.deleteBlog);if(!p||!confirm('Delete blog post "'+p.title+'"?'))return;const {error}=await supabase.from('blog_posts').delete().eq('id',p.id);if(error)status('Could not delete blog post.',true);else{await loadAll();status('Blog post deleted.');}}));}

  supabase.auth.getSession().then(({ data }) => { if (data.session?.user) verifyAdmin(data.session.user); });
  supabase.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) showLogin(); });
})();
