(() => {
  const config = window.AMI_CONFIG || {};
  const hero = document.querySelector('.hero-art');
  if (!hero || !window.supabase?.createClient || !config.supabaseUrl || !config.supabaseAnonKey) return;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  client.from('site_settings').select('setting_key,setting_value')
    .in('setting_key', ['homepage_hero_image_url','homepage_hero_image_alt'])
    .then(({data,error}) => {
      if (error) { console.warn('Homepage hero settings could not be loaded.', error); return; }
      const values = Object.fromEntries((data || []).map(row => [row.setting_key,row.setting_value]));
      const url = (values.homepage_hero_image_url || '').trim();
      if (!url || !/^https:\/\//i.test(url)) return;
      hero.replaceChildren();
      hero.style.background = '#edf2ec';
      const img = document.createElement('img');
      img.src = url; img.alt = ''; img.loading = 'eager'; img.decoding = 'async';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;border-radius:inherit';
      img.addEventListener('error', () => { hero.replaceChildren(); hero.style.background = ''; }, {once:true});
      hero.appendChild(img);
      hero.setAttribute('aria-label', values.homepage_hero_image_alt || 'AMI – The Good Circle community and initiatives');
    });
})();
