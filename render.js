/* Shared renderer for the plan — used by the site (after decrypt) and the artifact
   (embedded data). Renders the whole page including the Assumptions checkboxes;
   toggling re-renders with the matching pre-computed variant. */
window.PlanRenderer = (() => {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };
  const PRIO = { 0: '0', 1: '+2', 2: '+4', 3: '+6+' };

  let DATA = null, MOUNT = null;
  const state = { a1: false, a2: true, a3: true, a4: true, a5: true };

  /* ---------- variant resolution ---------- */

  const key = () => `${state.a2 ? 1 : 0}${state.a3 ? 1 : 0}${state.a4 ? 1 : 0}${state.a5 ? 1 : 0}`;

  // code → [title, meta, warn, add] from the baseline spine plus variant-only courses
  function detailMap(d) {
    const m = {};
    d.spine.filter((s) => s.type === 'term').forEach((t) =>
      t.courses.forEach((c) => { m[c[0]] = [c[1], c[2], c[3], c[5]]; }));
    Object.entries(d.extraCourses || {}).forEach(([code, v]) => { m[code] = [v[0], v[1], v[2], 0]; });
    return m;
  }

  // Build the display spine (terms + interleaved milestones) for the current state.
  function viewSpine(d) {
    const milestones = d.spine.filter((s) => s.type === 'milestone');
    const baseTerms = d.spine.filter((s) => s.type === 'term');
    const k = key();
    let terms;
    if (k === '1111' || !d.variants || !d.variants[k]) {
      terms = baseTerms.map((t) => ({ name: t.name, no: t.no, mod: t.mod, tag: t.tag,
        courses: t.courses.map((c) => ({ code: c[0], title: c[1], meta: c[2], warn: c[3], ein: c[4], add: c[5], chip: c[6], sp: c[7] })) }));
    } else {
      const dm = detailMap(d);
      terms = d.variants[k].spine.map((t, i) => ({
        name: t.name, no: baseTerms[i].no, mod: baseTerms[i].mod, tag: baseTerms[i].tag,
        courses: t.courses.map((c) => {
          const det = dm[c[0]] || [c[0], '', 0, 0];
          return { code: c[0], title: det[0], meta: det[1], warn: det[2], ein: c[1], add: det[3], chip: c[2], sp: c[3] };
        }),
      }));
    }
    // milestones sit after H28 (A), V29 (B+C), V30 (D) — dates invariant across variants
    const out = [];
    terms.forEach((t, i) => {
      out.push({ type: 'term', t });
      if (i === 4) out.push({ type: 'ms', m: milestones[0] });
      if (i === 5) out.push({ type: 'ms', m: milestones[1] });
      if (i === 7) out.push({ type: 'ms', m: milestones[2] });
    });
    return out;
  }

  function viewLoads(d) {
    const k = key();
    if (k === '1111' || !d.variants || !d.variants[k]) return d.load.rows;
    return [d.load.rows[0], ...d.variants[k].loads.map(([n, a, b]) => [n, a, b, 0])];
  }

  function viewNotes(d) {
    const k = key();
    const notes = (k !== '1111' && d.variants && d.variants[k]) ? d.variants[k].notes.slice() : [];
    return { notes, a1: state.a1 ? d.a1note : null };
  }

  /* ---------- fragments ---------- */

  const courseRow = (c) => `
    <div class="course${c.add ? ' add' : ''}" data-sp="${c.sp}">
      <span class="prio p${c.chip}">${PRIO[c.chip]}</span>
      <span class="code">${esc(c.code)}</span>
      <span class="title-is">${esc(c.title)}</span>
      <span class="meta${c.warn ? ' warn' : ''}">${esc(c.meta)}</span>
      <span class="ein">${c.ein}</span>
    </div>`;

  const spGroup = (courses, n) => {
    const g = courses.filter((c) => c.sp === n);
    if (!g.length) return '';
    const ein = g.reduce((a, c) => a + c.ein, 0);
    return `<div class="spgroup"><span>Spönn ${n}${n === 1 || n === 2 ? ' · proposed' : ''}</span><span>${ein} ein</span></div>` +
           g.map(courseRow).join('');
  };

  const termBlock = (t) => {
    const ein = t.courses.reduce((a, c) => a + c.ein, 0);
    return `
    <article class="term${t.mod ? ' ' + t.mod : ''}">
      <div class="term-rail">
        <span class="term-no">${esc(t.no)}</span>
        <span class="term-name">${esc(t.name)}</span>
        <span class="term-ein">${ein} ein</span>
        ${t.tag ? `<span class="tag ${t.tag[0]}">${esc(t.tag[1])}</span>` : ''}
      </div>
      <div class="courses">${spGroup(t.courses, 1)}${spGroup(t.courses, 2)}</div>
    </article>`;
  };

  const msBlock = (m) => `
    <div class="milestone">
      <span class="ms-mark">Milestone</span>
      <span class="ms-text">${m.text}</span>
      <span class="ms-why">${esc(m.why)}</span>
    </div>`;

  const chainBlock = (c) => `
    <div class="chain">
      <span class="chain-name">${esc(c.name)}</span>
      <span class="chain-links">${c.links
        .map(([t, locked]) => `<span class="lk${locked ? ' locked' : ''}">${esc(t)}</span>`)
        .join('<span class="arrow">&rarr;</span>')}</span>
      <span class="chain-note">${esc(c.note)}</span>
    </div>`;

  const loadBar = (v, past) =>
    `<span class="load-track"><span class="load-fill${past ? ' past' : ''}" style="width:${(v / 20) * 100}%"></span></span><span class="load-val">${v}</span>`;
  const loadRow = ([label, a, b, past]) => `
    <div class="load-row">
      <span class="load-label">${esc(label)}</span>
      ${loadBar(a, past)}${loadBar(b, past)}
    </div>`;

  const checkAssume = (id) => {
    const on = state[id];
    return `
    <label class="check-assume">
      <input type="checkbox" ${on ? 'checked' : ''} data-assume="${id}">
      <span class="assume-state ${on ? 'yes' : 'no'}">Assumed: ${on ? 'YES' : 'NO'}</span>
      <span class="check-assume-hint">this report renders the ${on ? 'YES' : 'NO'} branch — toggle to switch</span>
    </label>`;
  };

  const assumeRow = (item) => {
    const on = state[item.id];
    return `
    <label class="assume-row" data-id="${item.id}">
      <input type="checkbox" ${on ? 'checked' : ''} data-assume="${item.id}">
      <span class="assume-q">${esc(item.q)}</span>
      <span class="assume-state ${on ? 'yes' : 'no'}">${on ? 'YES' : 'NO'}</span>
      <span class="assume-detail">${item.detail}</span>
    </label>`;
  };

  /* ---------- page ---------- */

  function page(d) {
    const spineItems = viewSpine(d);
    const loads = viewLoads(d);
    const vn = viewNotes(d);
    return `
      <header class="mast">
        <p class="eyebrow">${esc(d.eyebrow)}</p>
        <h1>${esc(d.title)}</h1>
        <p class="standfirst">${esc(d.standfirst)}</p>
        <dl class="facts">${d.facts
          .map(([k2, v]) => `<div class="fact"><dt>${esc(k2)}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </header>

      ${d.assumptions ? `
      <section class="assume">
        <h2>${esc(d.assumptions.heading)}</h2>
        <p class="sec-lede">${d.assumptions.lede}</p>
        <div class="assume-list">${d.assumptions.items.map(assumeRow).join('')}</div>
        <div class="assume-dates">${d.assumptions.datesNote}</div>
        ${(vn.notes.length || vn.a1) ? `<div class="variant-notes">
          ${vn.notes.map((n) => `<div class="variant-note">${n}</div>`).join('')}
          ${vn.a1 ? `<div class="variant-note a1">${vn.a1}</div>` : ''}
        </div>` : ''}
      </section>` : ''}

      <section>
        <h2>${esc(d.constraint.heading)}</h2>
        <p class="sec-lede">${d.constraint.lede}</p>
        <div class="chains">${d.constraint.chains.map(chainBlock).join('')}</div>
        <div class="callout">${d.constraint.callout}</div>
      </section>

      <section>
        <h2>Term by term</h2>
        ${d.spineNote ? `<p class="sec-lede">${d.spineNote}</p>` : ''}
        <div class="spine${state.a1 ? ' a1' : ''}">${spineItems
          .map((s) => (s.type === 'term' ? termBlock(s.t) : msBlock(s.m))).join('')}</div>
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
        <div class="load">
          <div class="load-head"><span></span><span>Spönn 1</span><span></span><span>Spönn 2</span><span></span></div>
          ${loads.map(loadRow).join('')}</div>
        <ul class="plain">${d.load.valves.map((v) => `<li>${v}</li>`).join('')}</ul>
      </section>

      ${d.contingency ? `
      <section>
        <h2>${esc(d.contingency.heading)}</h2>
        <p class="sec-lede">${d.contingency.lede}</p>
        <div class="scroll">
          <table>
            <thead><tr><th>If this happens</th><th>Vélstjórn C</th><th>Vélstjórn D</th><th>Why</th></tr></thead>
            <tbody>${d.contingency.rows.map(([t, c, dd, w]) => `
              <tr><td>${t}</td><td class="term-cell">${c}</td>
                  <td class="term-cell">${dd}</td><td>${w}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>` : ''}

      <section>
        <h2>${esc(d.checks.heading)}</h2>
        <ol class="checks">${d.checks.items.map((c) => {
          const html = c.html || c;
          return `<li>${html}${c.assume ? checkAssume(c.assume) : ''}</li>`;
        }).join('')}</ol>
      </section>

      <section>
        <h2>${esc(d.outside.heading)}</h2>
        <ul class="plain">${d.outside.items.map((o) => `<li>${o}</li>`).join('')}</ul>
      </section>

      <footer>${d.footer}</footer>`;
  }

  function render() {
    const y = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
    MOUNT.replaceChildren(el(page(DATA)));
    MOUNT.querySelectorAll('input[data-assume]').forEach((cb) => {
      cb.addEventListener('change', () => {
        state[cb.dataset.assume] = cb.checked;
        render();
      });
    });
    if (document.scrollingElement) document.scrollingElement.scrollTop = y;
  }

  function mount(data, mountEl) {
    DATA = data;
    MOUNT = mountEl;
    if (data.assumptions) data.assumptions.items.forEach((i) => { state[i.id] = !!i.def; });
    document.title = data.title;
    render();
  }

  return { mount };
})();
