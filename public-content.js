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
    host.innerHTML = data.map(item => `<article class="simple-card"><div class="simple-grid" style="align-items:start"><div>${item.cover_image_url ? `<img src="${esc(item.cover_image_url)}" alt="" loading="lazy" class="content-image event-cover">` : ''}</div><div><p class="eyebrow">AMI EVENT</p><h2 style="font-size:1.65rem">${esc(item.title)}</h2><p>${esc(item.description)}</p><p><strong>Date:</strong> ${esc(date(item.starts_at) || 'To be announced')}${item.ends_at && date(item.ends_at)!==date(item.starts_at) ? ` – ${esc(date(item.ends_at))}` : ''}</p>${item.location ? `<p><strong>Venue:</strong> ${esc(item.location)}</p>` : ''}${item.registration_url && /^https:\/\//i.test(item.registration_url) ? `<a class="button button-primary" href="${esc(item.registration_url)}" target="_blank" rel="noopener noreferrer">Event registration ↗</a>` : ''}</div></div></article>`).join('');
  }
  async function loadGallery() {
    const host = document.getElementById('published-gallery'); if (!host) return;
    const { data, error } = await client.from('gallery_items').select('title,image_url,alt_text,caption,event_date').eq('published',true).order('sort_order',{ascending:true}).order('created_at',{ascending:false});
    if (error) { message('published-gallery','The gallery is temporarily unavailable. Please check back later.'); return; }
    if (!data?.length) { message('published-gallery','No photographs have been published yet. Please check back after approved photos are added.'); return; }
    host.innerHTML = data.map(item => `<article class="simple-card gallery-card"><button class="image-open" type="button" data-view-image="${esc(item.image_url)}" data-view-title="${esc(item.title)}" data-view-description="${esc(item.alt_text)}" data-view-caption="${esc(item.caption)}" data-view-date="${esc(date(item.event_date))}"><img src="${esc(item.image_url)}" alt="${esc(item.alt_text)}" loading="lazy" class="content-image gallery-thumb"></button><h3>${esc(item.title)}</h3>${item.caption ? `<p>${esc(item.caption)}</p>` : ''}${item.event_date ? `<p class="admin-muted">${esc(date(item.event_date))}</p>` : ''}<button class="text-link viewer-link" type="button" data-view-image="${esc(item.image_url)}" data-view-title="${esc(item.title)}" data-view-description="${esc(item.alt_text)}" data-view-caption="${esc(item.caption)}" data-view-date="${esc(date(item.event_date))}">View full image & details ↗</button></article>`).join('');
    document.querySelectorAll('[data-view-image]:not([data-view-wired])').forEach(button => { button.dataset.viewWired='1'; button.addEventListener('click',()=>{ const d=document.getElementById('content-viewer'); if(!d)return; d.querySelector('.viewer-image').src=button.dataset.viewImage; d.querySelector('.viewer-image').alt=button.dataset.viewDescription||''; d.querySelector('.viewer-title').textContent=button.dataset.viewTitle||''; d.querySelector('.viewer-description').textContent=button.dataset.viewDescription||''; d.querySelector('.viewer-caption').textContent=button.dataset.viewCaption||''; d.querySelector('.viewer-date').textContent=button.dataset.viewDate?'Date: '+button.dataset.viewDate:''; d.showModal(); }); });
  }

  async function loadBlogs() {
    const host = document.getElementById('published-blogs'); if (!host) return;
    const { data, error } = await client.from('blog_posts').select('title,slug,excerpt,cover_image_url,author_name,published_at').eq('status','published').order('published_at',{ascending:false,nullsFirst:false});
    if (error) { message('published-blogs','Blog articles are temporarily unavailable.'); return; }
    if (!data?.length) { message('published-blogs','No articles have been published yet.'); return; }
    host.innerHTML = data.map(x => `<article class="simple-card">${x.cover_image_url ? `<img class="content-image blog-cover" src="${esc(x.cover_image_url)}" alt="">` : ''}<p class="eyebrow">${esc(date(x.published_at))}</p><h2 class="content-card-title">${esc(x.title)}</h2><p>${esc(x.excerpt)}</p><p class="admin-muted">${esc(x.author_name)}</p><a class="text-link" href="blog.html?slug=${encodeURIComponent(x.slug)}">Read article ↗</a></article>`).join('');
  }
  async function loadArticle() {
    const host = document.getElementById('blog-article'); if (!host) return;
    const slug = new URLSearchParams(location.search).get('slug');
    const { data, error } = await client.from('blog_posts').select('title,excerpt,body,cover_image_url,author_name,published_at').eq('slug',slug || '').eq('status','published').maybeSingle();
    if (error || !data) { message('blog-article','This article is unavailable or has not been published.'); return; }
    document.title = data.title + ' | AMI – The Good Circle';
    host.innerHTML = `<article class="blog-article">${data.cover_image_url ? `<img class="content-image blog-article-cover" src="${esc(data.cover_image_url)}" alt="">` : ''}<p class="eyebrow">${esc(date(data.published_at))}</p><h1>${esc(data.title)}</h1><p class="section-lead">${esc(data.excerpt)}</p><p class="admin-muted">${esc(data.author_name)}</p><div class="blog-body">${esc(data.body).replace(/\n/g,'<br>')}</div></article>`;
  }
  loadEvents(); loadGallery(); loadBlogs(); loadArticle();
})();
