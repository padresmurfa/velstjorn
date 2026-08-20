#!/usr/bin/env node
// Builds the (unencrypted) artifact page from plan.css + render.js + plan-data.json.
//   node build-artifact.js ../plan/plan-data.json ../plan/velstjorn-plan.html
const fs = require('node:fs');
const [, , dataPath, outPath] = process.argv;
const css = fs.readFileSync('plan.css', 'utf8');
const render = fs.readFileSync('render.js', 'utf8');
const data = fs.readFileSync(dataPath, 'utf8');
JSON.parse(data); // fail loudly on malformed input
const title = JSON.parse(data).title;

fs.writeFileSync(outPath, `<meta charset="utf-8">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">

<style>
${css}
</style>

<div class="wrap" id="app"></div>

<script>
${render}
</script>
<script id="plan-data" type="application/json">
${data}
</script>
<script>
  PlanRenderer.mount(
    JSON.parse(document.getElementById('plan-data').textContent),
    document.getElementById('app'));
</script>
`);
console.log(`artifact built: ${outPath} (${fs.statSync(outPath).size} B)`);
