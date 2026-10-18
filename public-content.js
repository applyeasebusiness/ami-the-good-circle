(() => {
  const cfg = window.AMI_CONFIG || {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'}); };
  function message(id, text) { const node = document.getElementById(id); if (node) node.textContent = text; }
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || cfg.supabaseUrl.includes('YOUR_PROJECT_REF') || cfg.supabaseAnonKey.includes('YOUR_SUPABASE')) {
    message('published-events', 'Event listings will appear here once the website database is configured and events are published.');
    message('published-gallery', 'Approved gallery photographs will appear here once the database is configured and items are published.');
    return;
  }
  if (!window.supabase?.createClient) return;
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  async function loadEvents() {
    const host = document.getElementById('published-events'); if (!host) return;
    const { data, error } = await client.from('events').select('title,slug,description,location,starts_at,ends_at,registration_url,cover_image_url').eq('status','published').order('starts_at',{ascending:true,nullsFirst:false});
    if (error) { message('published-events','Event listings are temporarily unavailable. Please check back later.'); return; }
    if (!data?.length) { message('published-events','No public events are listed right now. Please check back for updates.'); return; }
    host.innerHTML = data.map(item => `<article class="simple-card"><div class="simple-grid" style="align-items:start"><div>${item.cover_image_url ? `<img src="${esc(item.cover_image_url)}" alt="" loading="lazy" style="width:100%;max-height:260px;object-fit:cover;border-radius:12px">` : ''}</div><div><p class="eyebrow">AMI EVENT</p><h2 style="font-size:1.65rem">${esc(item.title)}</h2><p>${esc(item.description)}</p><p><strong>Date:</strong> ${esc(date(item.starts_at) || 'To be announced')}${item.ends_at && date(item.ends_at)!==date(item.starts_at) ? ` – ${esc(date(item.ends_at))}` : ''}</p>${item.location ? `<p><strong>Venue:</strong> ${esc(item.location)}</p>` : ''}${item.registration_url && /^https:\/\//i.test(item.registration_url) ? `<a class="button button-primary" href="${esc(item.registration_url)}" target="_blank" rel="noopener noreferrer">Event registration ↗</a>` : ''}</div></div></article>`).join('');
  }
  async function loadGallery() {
    const host = document.getElementById('published-gallery'); if (!host) return;
    const { data, error } = await client.from('gallery_items').select('title,image_url,alt_text,caption,event_date').eq('published',true).order('sort_order',{ascending:true}).order('created_at',{ascending:false});
    if (error) { message('published-gallery','The gallery is temporarily unavailable. Please check back later.'); return; }
    if (!data?.length) { message('published-gallery','No photographs have been published yet. Please check back after approved photos are added.'); return; }
    host.innerHTML = data.map(item => `<article class="simple-card"><img src="${esc(item.image_url)}" alt="${esc(item.alt_text)}" loading="lazy" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px"><h3 style="margin-top:14px">${esc(item.title)}</h3>${item.caption ? `<p>${esc(item.caption)}</p>` : ''}${item.event_date ? `<p class="admin-muted">${esc(date(item.event_date))}</p>` : ''}</article>`).join('');
  }
  loadEvents(); loadGallery();
})();
