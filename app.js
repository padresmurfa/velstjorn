/* Fetches the encrypted plan, derives the key from the URL, renders the page.
   Key is read from ?key= or, preferably, #key= — a fragment never reaches a
   server and is not sent in Referer headers. */
(() => {
  'use strict';

  const app = document.getElementById('app');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };

  function readKey() {
    const frag = new URLSearchParams(location.hash.replace(/^#/, ''));
    return frag.get('key') || new URLSearchParams(location.search).get('key') || '';
  }

  function status(kind, title, detail) {
    app.replaceChildren(el(
      `<div class="state ${kind}">
         <p class="state-title">${esc(title)}</p>
         ${detail ? `<p class="state-detail">${detail}</p>` : ''}
       </div>`));
  }

  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function decrypt(blob, pass) {
    const material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(blob.kdf.salt), iterations: blob.kdf.iterations, hash: blob.kdf.hash },
      material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64(blob.iv) }, key, b64(blob.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  /* ---------- boot ---------- */

  async function boot() {
    const pass = readKey();
    if (!pass) {
      return status('locked', 'This plan is locked.',
        'Open it using the full link, which carries the key. Without it the page has nothing to show.');
    }
    status('loading', 'Unlocking…', '');

    let blob;
    try {
      const res = await fetch('data.enc.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      blob = await res.json();
    } catch {
      return status('error', 'Could not load the plan data.',
        'The encrypted payload did not come back from the server. Reload, or check the connection.');
    }

    try {
      window.PlanRenderer.mount(await decrypt(blob, pass), app);
    } catch {
      status('error', 'That key does not open this plan.',
        'The link may be truncated or out of date. Check it was copied whole, including everything after <code>?key=</code>.');
    }
  }

  boot();
  addEventListener('hashchange', boot);
})();
