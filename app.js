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

  /* ---------- rendering ---------- */

  const courseRow = ([code, title, meta, warn, ein, add]) => `
    <div class="course${add ? ' add' : ''}">
      <span class="code">${esc(code)}</span>
      <span class="title-is">${esc(title)}</span>
      <span class="meta${warn ? ' warn' : ''}">${esc(meta)}</span>
      <span class="ein">${ein}</span>
    </div>`;

  const term = (t) => `
    <article class="term${t.mod ? ' ' + t.mod : ''}">
      <div class="term-rail">
        <span class="term-no">${esc(t.no)}</span>
        <span class="term-name">${esc(t.name)}</span>
        <span class="term-ein">${esc(t.ein)}</span>
        ${t.tag ? `<span class="tag ${t.tag[0]}">${esc(t.tag[1])}</span>` : ''}
      </div>
      <div class="courses">${t.courses.map(courseRow).join('')}</div>
    </article>`;

  const milestone = (m) => `
    <div class="milestone">
      <span class="ms-mark">Milestone</span>
      <span class="ms-text">${m.text}</span>
      <span class="ms-why">${esc(m.why)}</span>
    </div>`;

  const chain = (c) => `
    <div class="chain">
      <span class="chain-name">${esc(c.name)}</span>
      <span class="chain-links">${c.links
        .map(([t, locked]) => `<span class="lk${locked ? ' locked' : ''}">${esc(t)}</span>`)
        .join('<span class="arrow">&rarr;</span>')}</span>
      <span class="chain-note">${esc(c.note)}</span>
    </div>`;

  const loadRow = ([label, val, past]) => `
    <div class="load-row">
      <span class="load-label">${esc(label)}</span>
      <span class="load-track"><span class="load-fill${past ? ' past' : ''}" style="width:${(val / 40) * 100}%"></span></span>
      <span class="load-val">${val}</span>
    </div>`;

  function render(d) {
    document.title = d.title;
    app.replaceChildren(el(`
      <header class="mast">
        <p class="eyebrow">${esc(d.eyebrow)}</p>
        <h1>${esc(d.title)}</h1>
        <p class="standfirst">${esc(d.standfirst)}</p>
        <dl class="facts">${d.facts
          .map(([k, v]) => `<div class="fact"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </header>

      <section>
        <h2>${esc(d.constraint.heading)}</h2>
        <p class="sec-lede">${d.constraint.lede}</p>
        <div class="chains">${d.constraint.chains.map(chain).join('')}</div>
        <div class="callout">${d.constraint.callout}</div>
      </section>

      <section>
        <h2>Term by term</h2>
        <div class="spine">${d.spine
          .map((s) => (s.type === 'term' ? term(s) : milestone(s))).join('')}</div>
      </section>

      <section>
        <h2>${esc(d.milestoneTable.heading)}</h2>
        <div class="scroll">
          <table>
            <thead><tr><th>Milestone</th><th>Rights</th><th>Term</th><th>Gated by</th></tr></thead>
            <tbody>${d.milestoneTable.rows.map(([a, b, c, e]) => `
              <tr><td class="term-cell">${a}</td><td>${b}</td>
                  <td class="term-cell">${c}</td><td class="mono">${e}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="sec-lede">${d.milestoneTable.note}</p>
      </section>

      <section>
        <h2>${esc(d.load.heading)}</h2>
        <p class="sec-lede">${d.load.lede}</p>
        <div class="load">${d.load.rows.map(loadRow).join('')}</div>
        <ul class="plain">${d.load.valves.map((v) => `<li>${v}</li>`).join('')}</ul>
      </section>

      <section>
        <h2>${esc(d.checks.heading)}</h2>
        <ol class="checks">${d.checks.items.map((c) => `<li>${c}</li>`).join('')}</ol>
      </section>

      <section>
        <h2>${esc(d.outside.heading)}</h2>
        <ul class="plain">${d.outside.items.map((o) => `<li>${o}</li>`).join('')}</ul>
      </section>

      <footer>${d.footer}</footer>`));
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
      render(await decrypt(blob, pass));
    } catch {
      status('error', 'That key does not open this plan.',
        'The link may be truncated or out of date. Check it was copied whole, including everything after <code>?key=</code>.');
    }
  }

  boot();
  addEventListener('hashchange', boot);
})();
