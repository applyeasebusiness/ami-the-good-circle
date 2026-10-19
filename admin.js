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
  }

  async function loadAll() {
    status('Loading dashboard data…');
    const [s, e, g, b] = await Promise.all([
      supabase.from('form_submissions').select('id,form_type,payload,status,admin_notes,created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('events').select('*').order('starts_at', { ascending: false, nullsFirst: false }),
      supabase.from('gallery_items').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('blog_posts').select('*').order('created_at', { ascending: false })
    ]);
    const failed = [s,e,g,b].find(x => x.error);
    if (failed) { status('Could not load some dashboard data. Confirm schema.sql was run and this user has the admin role.', true); console.error('Admin dashboard load error:', failed.error); }
    submissions = s.data || []; events = e.data || []; galleryItems = g.data || []; blogPosts = b.data || [];
    renderSubmissions(); renderEvents(); renderGallery(); renderBlogs();
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


  $('blog-title').addEventListener('input',()=>{if(!$('blog-id').value)$('blog-slug').value=$('blog-title').value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);});
  $('blog-form').addEventListener('submit',async event=>{event.preventDefault();const id=$('blog-id').value,st=$('blog-status').value;const payload={title:$('blog-title').value.trim(),slug:$('blog-slug').value.trim(),excerpt:$('blog-excerpt').value.trim(),body:$('blog-body').value.trim(),author_name:$('blog-author').value.trim(),cover_image_url:$('blog-cover').value.trim(),status:st,published_at:st==='published'?(blogPosts.find(x=>x.id===id)?.published_at||new Date().toISOString()):null};if(payload.cover_image_url&&!/^https:\/\//i.test(payload.cover_image_url)){status('Cover image URL must use HTTPS.',true);return;}const btn=$('blog-form').querySelector('[type="submit"]');btn.disabled=true;const r=id?await supabase.from('blog_posts').update(payload).eq('id',id):await supabase.from('blog_posts').insert(payload);btn.disabled=false;if(r.error){status('Could not save blog post. Make sure the blog database migration has been run.',true);return;}resetBlog();await loadAll();status('Blog post saved.');});
  $('blog-cancel').addEventListener('click',resetBlog);function resetBlog(){$('blog-form').reset();$('blog-id').value='';$('blog-form-title').textContent='Write a blog post';$('blog-status').value='draft';}
  function renderBlogs(){const host=$('blogs-list');if(!blogPosts.length){host.innerHTML='<p class="admin-empty">No blog posts yet. Write one above.</p>';return;}host.innerHTML='<table class="admin-table"><thead><tr><th>Article</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+blogPosts.map(p=>'<tr><td><strong>'+safe(p.title)+'</strong><br>'+safe(p.slug)+'<p>'+safe(p.excerpt)+'</p></td><td>'+safe(p.status)+'</td><td><div class="admin-actions"><button data-edit-blog="'+safe(p.id)+'">Edit</button><button class="danger" data-delete-blog="'+safe(p.id)+'">Delete</button></div></td></tr>').join('')+'</tbody></table>';host.querySelectorAll('[data-edit-blog]').forEach(btn=>btn.addEventListener('click',()=>{const p=blogPosts.find(x=>x.id===btn.dataset.editBlog);if(!p)return;$('blog-id').value=p.id;$('blog-title').value=p.title;$('blog-slug').value=p.slug;$('blog-excerpt').value=p.excerpt;$('blog-body').value=p.body;$('blog-author').value=p.author_name;$('blog-cover').value=p.cover_image_url;$('blog-status').value=p.status;$('blog-form-title').textContent='Edit blog post';$('panel-blogs').scrollIntoView({behavior:'smooth'});}));host.querySelectorAll('[data-delete-blog]').forEach(btn=>btn.addEventListener('click',async()=>{const p=blogPosts.find(x=>x.id===btn.dataset.deleteBlog);if(!p||!confirm('Delete blog post "'+p.title+'"?'))return;const {error}=await supabase.from('blog_posts').delete().eq('id',p.id);if(error)status('Could not delete blog post.',true);else{await loadAll();status('Blog post deleted.');}}));}

  supabase.auth.getSession().then(({ data }) => { if (data.session?.user) verifyAdmin(data.session.user); });
  supabase.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) showLogin(); });
})();
