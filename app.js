/* =====================================================
   DepChecker — app.js
   Checks npm and PyPI packages for outdated versions
   ===================================================== */

'use strict';

// ── EXAMPLE DATA ────────────────────────────────────────
const EXAMPLES = {
  npm: JSON.stringify({
    dependencies: {
      "react": "^17.0.2",
      "axios": "^0.21.1",
      "lodash": "^4.17.15",
      "express": "^4.17.1",
      "moment": "^2.29.1"
    },
    devDependencies: {
      "webpack": "^4.44.2",
      "babel-loader": "^8.1.0"
    }
  }, null, 2),

  pypi: `requests==2.25.0
flask==1.1.2
numpy==1.19.0
django==3.1.0
sqlalchemy==1.3.22
pillow==8.0.0
`
};

// ── HELPERS ──────────────────────────────────────────────

function semverDiff(current, latest) {
  if (!current || !latest) return null;
  const clean = v => v.replace(/^[\^~>=<\s]+/, '').split('-')[0];
  const c = clean(current).split('.').map(Number);
  const l = clean(latest).split('.').map(Number);
  if (isNaN(c[0]) || isNaN(l[0])) return null;
  if (l[0] > c[0]) return 'major';
  if (l[1] > c[1]) return 'minor';
  if (l[2] > (c[2] || 0)) return 'patch';
  return 'up-to-date';
}

function cleanVersion(v) {
  return v ? v.replace(/^[\^~>=<\s]+/, '') : v;
}

function statusBadge(diff) {
  if (!diff) return `<span class="badge badge-error">Error</span>`;
  if (diff === 'up-to-date') return `<span class="badge badge-up-to-date">&#10003; Up-to-date</span>`;
  if (diff === 'major') return `<span class="badge badge-outdated">&#9650; Major update</span>`;
  if (diff === 'minor') return `<span class="badge badge-outdated">&#9650; Minor update</span>`;
  if (diff === 'patch') return `<span class="badge badge-outdated">&#9650; Patch update</span>`;
  return `<span class="badge badge-error">Error</span>`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

// ── NPM FETCHER ─────────────────────────────────────────

async function fetchNpmVersion(pkg) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`npm: ${res.status}`);
  const data = await res.json();
  return data.version || null;
}

// ── PYPI FETCHER ─────────────────────────────────────────

async function fetchPypiVersion(pkg) {
  const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`);
  if (!res.ok) throw new Error(`PyPI: ${res.status}`);
  const data = await res.json();
  return data.info?.version || null;
}

// ── PARSERS ──────────────────────────────────────────────

function parsePackageJson(text) {
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error('Invalid JSON — please paste valid package.json content.'); }

  const deps = {};
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (json[section]) {
      for (const [name, ver] of Object.entries(json[section])) {
        deps[name] = { version: ver, section };
      }
    }
  }
  if (Object.keys(deps).length === 0) {
    throw new Error('No dependencies found in the provided package.json.');
  }
  return deps;
}

function parseRequirementsTxt(text) {
  const deps = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('-')) continue;
    // handle pkg==1.0, pkg>=1.0, pkg~=1.0, just "pkg"
    const match = line.match(/^([A-Za-z0-9_\-\.]+)\s*([=<>!~]{1,3})\s*([^\s,;]+)?/);
    if (match) {
      const name = match[1];
      const ver = match[3] || null;
      deps[name] = { version: ver };
    } else if (/^[A-Za-z0-9_\-\.]+$/.test(line)) {
      deps[line] = { version: null };
    }
  }
  if (Object.keys(deps).length === 0) {
    throw new Error('No packages found in the provided requirements.txt.');
  }
  return deps;
}

// ── CORE CHECK LOGIC ─────────────────────────────────────

async function checkPackages(deps, ecosystem) {
  const results = [];
  const CONCURRENCY = 8;
  const names = Object.keys(deps);

  for (let i = 0; i < names.length; i += CONCURRENCY) {
    const chunk = names.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map(async name => {
        const { version, section } = deps[name];
        const currentClean = cleanVersion(version);
        let latest = null;
        let error = null;
        try {
          latest = ecosystem === 'npm'
            ? await fetchNpmVersion(name)
            : await fetchPypiVersion(name);
        } catch (e) {
          error = e.message;
        }
        const diff = error ? null : semverDiff(currentClean, latest);
        return { name, current: version, currentClean, latest, diff, error, section };
      })
    );
    for (const s of settled) {
      if (s.status === 'fulfilled') results.push(s.value);
      else results.push({ name: '?', current: null, latest: null, diff: null, error: s.reason?.message });
    }
  }
  return results;
}

// ── RENDER ────────────────────────────────────────────────

function renderResults(results, ecosystem) {
  const total = results.length;
  const upToDate = results.filter(r => r.diff === 'up-to-date').length;
  const outdated = results.filter(r => r.diff && r.diff !== 'up-to-date').length;
  const errors = results.filter(r => !r.diff).length;

  // summary cards
  const summaryEl = document.getElementById('summary-cards');
  summaryEl.innerHTML = `
    <div class="summary-card total">
      <div class="count">${total}</div>
      <div class="label">Total Packages</div>
    </div>
    <div class="summary-card uptodate">
      <div class="count">${upToDate}</div>
      <div class="label">Up-to-date</div>
    </div>
    <div class="summary-card outdated">
      <div class="count">${outdated}</div>
      <div class="label">Outdated</div>
    </div>
    <div class="summary-card errors">
      <div class="count">${errors}</div>
      <div class="label">Errors / Not Found</div>
    </div>
  `;

  // meta
  document.getElementById('results-meta').textContent =
    `Checked ${total} package${total !== 1 ? 's' : ''} against ${ecosystem === 'npm' ? 'npm Registry' : 'PyPI'} • ${new Date().toLocaleTimeString()}`;

  // sort: errors last, then outdated (major > minor > patch), then up-to-date
  const order = { major: 0, minor: 1, patch: 2, 'up-to-date': 3, null: 4 };
  results.sort((a, b) => (order[a.diff] ?? 4) - (order[b.diff] ?? 4));

  // table rows
  const tbody = document.getElementById('results-body');
  tbody.innerHTML = '';

  for (const r of results) {
    const tr = document.createElement('tr');
    const updateCmd = buildUpdateCmd(r, ecosystem);
    const diffLabel = r.diff && r.diff !== 'up-to-date'
      ? `<span class="badge badge-${r.diff}" style="margin-left:6px; font-size:0.72rem;">${r.diff}</span>`
      : '';

    const notesHtml = r.error
      ? `<span style="color:var(--red);font-size:0.82rem;">${r.error}</span>`
      : r.diff === 'up-to-date'
        ? `<span style="color:var(--text-muted)">No update needed</span>`
        : `<code class="update-cmd" title="Click to copy" onclick="copyToClipboard(this.textContent)">${updateCmd}</code>`;

    tr.innerHTML = `
      <td>
        <span class="pkg-name">${r.name}</span>
        ${r.section ? `<span style="font-size:0.75rem;color:var(--text-muted);margin-left:6px;">${r.section}</span>` : ''}
      </td>
      <td><span class="version version-current">${r.currentClean || r.current || '—'}</span></td>
      <td><span class="version version-latest ${r.diff && r.diff !== 'up-to-date' ? 'is-outdated' : ''}">${r.latest || '—'}</span>${diffLabel}</td>
      <td>${statusBadge(r.diff)}</td>
      <td class="notes-cell">${notesHtml}</td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById('results-section').classList.remove('hidden');

  // store for export
  window._lastResults = results;
  window._lastEcosystem = ecosystem;
}

function buildUpdateCmd(r, ecosystem) {
  if (!r.latest || r.diff === 'up-to-date') return '';
  if (ecosystem === 'npm') return `npm install ${r.name}@${r.latest}`;
  return `pip install ${r.name}==${r.latest}`;
}

// ── EXPORT ────────────────────────────────────────────────

function exportJSON() {
  const data = (window._lastResults || []).map(r => ({
    package: r.name,
    current: r.currentClean || r.current,
    latest: r.latest,
    status: r.diff || 'error',
    section: r.section || null,
    updateCommand: buildUpdateCmd(r, window._lastEcosystem)
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'dependency-report.json');
}

function exportCSV() {
  const rows = [['Package', 'Current', 'Latest', 'Status', 'Update Command']];
  for (const r of (window._lastResults || [])) {
    rows.push([
      r.name,
      r.currentClean || r.current || '',
      r.latest || '',
      r.diff || 'error',
      buildUpdateCmd(r, window._lastEcosystem)
    ]);
  }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, 'dependency-report.csv');
}

function copyMarkdown() {
  const lines = ['| Package | Current | Latest | Status |', '|---------|---------|--------|--------|'];
  for (const r of (window._lastResults || [])) {
    lines.push(`| \`${r.name}\` | \`${r.currentClean || r.current || '—'}\` | \`${r.latest || '—'}\` | ${r.diff || 'error'} |`);
  }
  copyToClipboard(lines.join('\n'));
  const btn = document.getElementById('btn-copy-md');
  const orig = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = orig; }, 2000);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── MAIN CHECK HANDLER ───────────────────────────────────

async function handleCheck(ecosystem) {
  const inputId = ecosystem === 'npm' ? 'npm-input' : 'pypi-input';
  const btnId = ecosystem === 'npm' ? 'npm-check-btn' : 'pypi-check-btn';

  const text = document.getElementById(inputId).value.trim();
  const btn = document.getElementById(btnId);
  const errSection = document.getElementById('error-section');
  const resSection = document.getElementById('results-section');

  errSection.classList.add('hidden');
  resSection.classList.add('hidden');

  if (!text) {
    showError('Please paste your dependency file contents first.');
    return;
  }

  // loading state
  btn.disabled = true;
  btn.querySelector('.btn-text').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');

  try {
    let deps;
    if (ecosystem === 'npm') {
      deps = parsePackageJson(text);
    } else {
      deps = parseRequirementsTxt(text);
    }

    const results = await checkPackages(deps, ecosystem);
    renderResults(results, ecosystem);
  } catch (e) {
    showError(e.message);
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-text').classList.remove('hidden');
    btn.querySelector('.btn-spinner').classList.add('hidden');
  }
}

function showError(msg) {
  document.getElementById('error-message').textContent = msg;
  document.getElementById('error-section').classList.remove('hidden');
}

// ── INIT ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`panel-${tab}`).classList.add('active');
      document.getElementById('results-section').classList.add('hidden');
      document.getElementById('error-section').classList.add('hidden');
    });
  });

  // load examples
  document.querySelectorAll('.btn-load-example').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      target.value = EXAMPLES[btn.dataset.type];
    });
  });

  // check buttons
  document.getElementById('npm-check-btn').addEventListener('click', () => handleCheck('npm'));
  document.getElementById('pypi-check-btn').addEventListener('click', () => handleCheck('pypi'));

  // also allow Ctrl+Enter inside textarea
  document.querySelectorAll('.code-input').forEach(ta => {
    ta.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const panel = ta.closest('.tab-panel');
        const ecosystem = panel.id === 'panel-npm' ? 'npm' : 'pypi';
        handleCheck(ecosystem);
      }
    });
  });

  // export buttons
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-copy-md').addEventListener('click', copyMarkdown);
});

// expose for inline onclick
window.copyToClipboard = copyToClipboard;
