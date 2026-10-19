(() => {
  const cfg = window.AMI_CONFIG || {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'}); };
  function message(id, text) { const node = document.getElementById(id); if (node) node.textContent = text; }
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || cfg.supabaseUrl.includes('YOUR_PROJECT_REF') || cfg.supabaseAnonKey.includes('YOUR_SUPABASE')) {
    message('published-events', 'Event listings will appear here once the website database is configured and events are published.');
    message('published-gallery', 'Approved gallery photographs will appear here once the database is configured and items are published.');
    message('featured-blog', 'Featured stories will appear here once published.'); message('featured-event', 'Featured events will appear here once published.'); message('featured-gallery', 'Approved gallery photographs will appear here once published.'); message('team-grid', 'Team profiles will appear here once published.'); message('public-documents', 'Public documents will appear here once published.');
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

  function safeRichHtml(html){const doc=new DOMParser().parseFromString(String(html||''),'text/html');const allowed=new Set(['P','BR','STRONG','B','EM','I','U','UL','OL','LI','H2','H3','H4','BLOCKQUOTE','A','SPAN','IMG','DIV']);doc.body.querySelectorAll('*').forEach(el=>{if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return;}[...el.attributes].forEach(a=>{if(el.tagName==='A'&&a.name==='href'&&/^https:\/\//i.test(a.value)){el.setAttribute('rel','noopener noreferrer');el.setAttribute('target','_blank');}else if(el.tagName==='IMG'&&a.name==='src'&&/^https:\/\//i.test(a.value)){}else if(a.name==='style'){const keep=[];a.value.split(';').forEach(rule=>{const z=rule.split(':');if(z.length<2)return;const k=z[0].trim().toLowerCase(),v=z.slice(1).join(':').trim();if(k==='color'&&/^(#[0-9a-f]{3,8}|rgb\(|rgba\(|[a-z]+$)/i.test(v))keep.push(k+':'+v);if(k==='background-color'&&/^(#[0-9a-f]{3,8}|rgb\(|rgba\(|[a-z]+$)/i.test(v))keep.push(k+':'+v);if(k==='font-size'&&/^\d{1,2}(px|pt|em|rem|%)$/.test(v))keep.push(k+':'+v);if(k==='text-align'&&/^(left|right|center|justify)$/.test(v))keep.push(k+':'+v);if(k==='max-width'&&v==='100%')keep.push(k+':'+v);if(k==='height'&&v==='auto')keep.push(k+':'+v);});if(keep.length)el.setAttribute('style',keep.join(';'));else el.removeAttribute('style');}else if(!((el.tagName==='A'&&a.name==='href')||(el.tagName==='IMG'&&a.name==='src')||['alt','title'].includes(a.name)))el.removeAttribute(a.name);});});return doc.body.innerHTML;}
  async function loadBlogs() {
    const host = document.getElementById('published-blogs'); if (!host) return;
    const { data, error } = await client.from('blog_posts').select('title,slug,excerpt,seo_description,cover_image_url,author_name,published_at').eq('status','published').order('published_at',{ascending:false,nullsFirst:false});
    if (error) { message('published-blogs','Blog articles are temporarily unavailable.'); return; }
    if (!data?.length) { message('published-blogs','No articles have been published yet.'); return; }
    host.innerHTML = data.map(x => `<article class="simple-card">${x.cover_image_url ? `<img class="content-image blog-cover" src="${esc(x.cover_image_url)}" alt="">` : ''}<p class="eyebrow">${esc(date(x.published_at))}</p><h2 class="content-card-title">${esc(x.title)}</h2><p>${esc(x.excerpt)}</p><p class="admin-muted">${esc(x.author_name)}</p><a class="text-link" href="blog.html?slug=${encodeURIComponent(x.slug)}">Read article ↗</a></article>`).join('');
  }
  async function loadArticle() {
    const host = document.getElementById('blog-article'); if (!host) return;
    const slug = new URLSearchParams(location.search).get('slug');
    const { data, error } = await client.from('blog_posts').select('title,excerpt,seo_description,body,cover_image_url,author_name,published_at').eq('slug',slug || '').eq('status','published').maybeSingle();
    if (error || !data) { message('blog-article','This article is unavailable or has not been published.'); return; }
    document.title = data.title + ' | AMI – The Good Circle';
    const seoDescription = (data.seo_description || data.excerpt || '').slice(0,160);
    let descMeta = document.querySelector('meta[name="description"]'); if(!descMeta){descMeta=document.createElement('meta');descMeta.name='description';document.head.appendChild(descMeta);} descMeta.content=seoDescription;
    const canonical = location.origin + '/blog?slug=' + encodeURIComponent(slug || '');
    let canonicalTag=document.querySelector('link[rel="canonical"]');if(!canonicalTag){canonicalTag=document.createElement('link');canonicalTag.rel='canonical';document.head.appendChild(canonicalTag);}canonicalTag.href=canonical;
    for(const item of [['og:title',document.title],['og:description',seoDescription],['og:url',canonical],['og:type','article'],['og:image',data.cover_image_url || location.origin+'/ami-logo.jpg']]){let tag=document.querySelector('meta[property="'+item[0]+'"]');if(!tag){tag=document.createElement('meta');tag.setAttribute('property',item[0]);document.head.appendChild(tag);}tag.content=item[1];}
    let twitterDesc=document.querySelector('meta[name="twitter:description"]');if(twitterDesc)twitterDesc.content=seoDescription;
    host.innerHTML = `<article class="blog-article">${data.cover_image_url ? `<img class="content-image blog-article-cover" src="${esc(data.cover_image_url)}" alt="">` : ''}<p class="eyebrow">${esc(date(data.published_at))}</p><h1>${esc(data.title)}</h1><p class="section-lead">${esc(data.excerpt)}</p><p class="admin-muted">${esc(data.author_name)}</p><div class="blog-body">${safeRichHtml(data.body)}</div></article>`;
  }

  async function loadHomepageFeatures() {
    const blogHost = document.getElementById('featured-blog');
    if (blogHost) {
      const {data,error} = await client.from('blog_posts').select('title,slug,excerpt,cover_image_url,author_name,published_at').eq('status','published').order('published_at',{ascending:false,nullsFirst:false}).limit(3);
      if (error || !data?.length) blogHost.innerHTML = '<p class="admin-muted">New stories will appear here when published by the AMI team.</p>';
      else blogHost.innerHTML = data.map(x => '<article class="home-feature-card">'+(x.cover_image_url?'<img class="feature-card-image" src="'+esc(x.cover_image_url)+'" alt="" loading="lazy">':'<div class="feature-card-image event-feature-art">AMI STORIES</div>')+'<div class="feature-card-body"><p class="eyebrow">'+esc(date(x.published_at))+'</p><h3>'+esc(x.title)+'</h3><p>'+esc(x.excerpt)+'</p><a class="text-link" href="blog.html?slug='+encodeURIComponent(x.slug)+'">Read story →</a></div></article>').join('');
    }
    const eventHost = document.getElementById('featured-event');
    if (eventHost) {
      const now = new Date().toISOString();
      let result = await client.from('events').select('title,slug,description,location,starts_at,registration_url,cover_image_url').eq('status','published').gte('starts_at',now).order('starts_at',{ascending:true}).limit(1);
      if (!result.data?.length) result = await client.from('events').select('title,slug,description,location,starts_at,registration_url,cover_image_url').eq('status','published').order('starts_at',{ascending:false,nullsFirst:false}).limit(1);
      const x = result.data?.[0];
      if (result.error || !x) eventHost.innerHTML='<p class="admin-muted">No public events are featured right now. Check back for updates.</p>';
      else eventHost.innerHTML='<article class="featured-event-card">'+(x.cover_image_url?'<img src="'+esc(x.cover_image_url)+'" alt="" loading="lazy">':'<div class="event-feature-art">AMI EVENT</div>')+'<div class="feature-card-body"><p class="eyebrow">PUBLISHED EVENT</p><h3>'+esc(x.title)+'</h3><p>'+esc(x.description)+'</p><p><strong>Date:</strong> '+esc(date(x.starts_at)||'To be announced')+(x.location?'<br><strong>Venue:</strong> '+esc(x.location):'')+'</p><a class="button button-primary" href="events.html">View event details</a></div></article>';
    }
    const galleryHost = document.getElementById('featured-gallery');
    if (galleryHost) {
      const {data,error} = await client.from('gallery_items').select('title,image_url,alt_text,caption,event_date').eq('published',true).order('sort_order',{ascending:true}).order('created_at',{ascending:false}).limit(3);
      if (error || !data?.length) galleryHost.innerHTML='<p class="admin-muted">Approved photographs will appear here when published by the AMI team.</p>';
      else galleryHost.innerHTML=data.map(x=>'<article class="home-feature-card"><a href="events.html#gallery" aria-label="View '+esc(x.title)+' in gallery"><img class="feature-card-image" src="'+esc(x.image_url)+'" alt="'+esc(x.alt_text)+'" loading="lazy"></a><div class="feature-card-body"><p class="eyebrow">COMMUNITY GALLERY</p><h3>'+esc(x.title)+'</h3><p>'+esc(x.caption)+'</p><a class="text-link" href="events.html#gallery">View gallery →</a></div></article>').join('');
    }
  }
  async function loadTeam() {
    const host=document.getElementById('team-grid'); if(!host)return;
    const {data,error}=await client.from('team_members').select('name,role_title,bio,photo_url').eq('published',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
    if(error||!data?.length){host.innerHTML='<p class="admin-muted">Team profiles will appear here when approved and published by the AMI team.</p>';return;}
    host.innerHTML=data.map(m=>'<article class="team-card">'+(m.photo_url?'<img src="'+esc(m.photo_url)+'" alt="Portrait of '+esc(m.name)+'" loading="lazy">':'<div class="team-placeholder" aria-hidden="true">'+esc((m.name||'AMI').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase())+'</div>')+'<div class="team-card-body"><p class="team-role">'+esc(m.role_title)+'</p><h2>'+esc(m.name)+'</h2><p>'+esc(m.bio)+'</p></div></article>').join('');
  }


  async function loadPublicDocuments() {
    const host=document.getElementById('public-documents'); if(!host)return;
    const {data,error}=await client.from('public_documents').select('title,category,description,document_url').eq('published',true).order('sort_order',{ascending:true}).order('created_at',{ascending:false});
    if(error||!data?.length){host.innerHTML='<p class="admin-muted">Public documents will appear here when approved and published by the AMI team.</p>';return;}
    host.innerHTML=data.map(d=>'<article class="document-card"><span class="doc-icon">'+esc((d.category||'DOC').slice(0,5).toUpperCase())+'</span><div><p class="eyebrow">'+esc(d.category)+'</p><h3>'+esc(d.title)+'</h3><p>'+esc(d.description)+'</p><a class="text-link" href="'+esc(d.document_url)+'" target="_blank" rel="noopener noreferrer">View document →</a></div></article>').join('');
  }


  async function loadPageCopy() {
    const {data,error}=await client.from('site_settings').select('setting_key,setting_value');
    if(error)return;
    const v=Object.fromEntries((data||[]).map(row=>[row.setting_key,row.setting_value]));
    const targets={
      'home-eyebrow':'homepage_eyebrow','home-heading-first':'homepage_heading_first',
      'home-heading-highlight':'homepage_heading_highlight','home-subtitle':'homepage_subtitle',
      'about-page-heading':'about_heading','about-page-intro':'about_intro',
      'initiatives-page-heading':'initiatives_heading','initiatives-page-intro':'initiatives_intro',
      'transparency-page-heading':'transparency_heading','transparency-page-intro':'transparency_intro',
      'home-intro-heading':'home_intro_heading','home-intro-body':'home_intro_body','home-nature-title':'nature_title','home-nature-description':'nature_description','home-society-title':'society_title','home-society-description':'society_description','home-culture-title':'culture_title','home-culture-description':'culture_description','about-vision':'about_vision','about-mission':'about_mission','about-values-intro':'about_values_intro','initiative-nature-description':'initiatives_nature_description','initiative-society-description':'initiatives_society_description','initiative-culture-description':'initiatives_culture_description'
    };
    Object.entries(targets).forEach(([id,key])=>{const el=document.getElementById(id);if(el&&v[key])el.textContent=v[key];});
  }

  loadEvents(); loadGallery(); loadBlogs(); loadArticle(); loadHomepageFeatures(); loadTeam(); loadPublicDocuments(); loadPageCopy();
})();
