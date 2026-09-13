let board = null;
let experts = null;
let results = null;

let locked = JSON.parse(
  localStorage.getItem('lf_consensus_locked') || '[]'
);

const $ = s => document.querySelector(s);

function save() {
  localStorage.setItem(
    'lf_consensus_locked',
    JSON.stringify(locked)
  );
}

async function load() {
  try {
    const [signalsData, expertsData, resultsData] = await Promise.all([
      fetch('/public-signals.json').then(r => {
        if (!r.ok) throw new Error('Could not load public-signals.json');
        return r.json();
      }),

      fetch('/analyst-profiles.json').then(r => {
        if (!r.ok) throw new Error('Could not load analyst-profiles.json');
        return r.json();
      }),

      fetch('/results-ledger.json').then(r => {
        if (!r.ok) throw new Error('Could not load results-ledger.json');
        return r.json();
      })
    ]);

    const d = signalsData;

    board = {
      mode: 'public-consensus',
      week: d.week,
      season: d.season,
      refreshedAt: new Date().toISOString(),
      sources: d.sources || [],

      props: (d.signals || []).map(s => {
        const source = (d.sources || []).find(
          x => x.id === s.sourceId
        );

        return {
          id: s.id,
          player: s.player,
          market: s.market,
          side: s.side,
          line: s.line,
          analystCount: 1,
          consensusScore: 71,
          confidence: 'EARLY',

          analysts: [{
            name: s.analyst,
            sourceId: s.sourceId,
            note: s.note,
            url: source?.url,
            outlet: source?.outlet
          }],

          rationale: s.note
        };
      })
    };

    experts = expertsData;
    results = resultsData;

    render();

  } catch (err) {
    console.error('LineFoundry data load failed:', err);

    const propCards = $('#propCards');

    if (propCards) {
      propCards.innerHTML = `
        <div class="empty-state">
          <h3>Unable to load LineFoundry data</h3>
          <p>Please refresh the page and try again.</p>
        </div>
      `;
    }
  }
}

function label(p) {
  return `${p.side} ${p.line == null ? 'TD' : p.line} ${p.market}`;
}

function card(p) {
  const lockedPick = locked.includes(p.id);

  return `
    <article class="prop ${lockedPick ? 'locked' : ''}">
      <div class="prop-top">
        <div class="game">
          NFL • WEEK ${board.week}
        </div>

        <div class="grade">
          ${p.consensusScore}/100
        </div>
      </div>

      <h3>
        ${p.player} — ${label(p)}
      </h3>

      <div class="metrics">
        <div class="metric">
          <b>${p.analystCount}</b>
          <span>Sources</span>
        </div>

        <div class="metric">
          <b>${p.confidence}</b>
          <span>Confidence</span>
        </div>

        <div class="metric">
          <b>${p.consensusScore}</b>
          <span>Consensus</span>
        </div>

        <div class="metric">
          <b>${lockedPick ? 'LOCKED' : 'OPEN'}</b>
          <span>Status</span>
        </div>
      </div>

      <div class="analyst-list">
        ${p.analysts.map(a => `
          <div>
            <strong>${a.name}</strong>
            <span>${a.outlet || ''}</span>

            ${
              a.url
                ? `<a href="${a.url}" target="_blank" rel="noopener">
                     Source ↗
                   </a>`
                : ''
            }
          </div>
        `).join('')}
      </div>

      <p class="why">
        ${p.rationale}
      </p>

      <div class="card-actions">
        <button onclick="lockPick('${p.id}')">
          ${lockedPick ? '🔒 Locked' : 'Lock consensus'}
        </button>
      </div>
    </article>
  `;
}

window.lockPick = id => {
  if (!locked.includes(id)) {
    locked.push(id);
    save();
    render();
  }
};

function render() {
  const props = board?.props || [];

  const filter =
    $('#confidenceFilter')?.value || 'ALL';

  const filteredProps = props.filter(
    p => filter === 'ALL' || p.confidence === filter
  );

  if ($('#propCards')) {
    $('#propCards').innerHTML =
      filteredProps.map(card).join('');
  }

  if ($('#pickCount')) {
    $('#pickCount').textContent = locked.length;
  }

  if ($('#sourceCount')) {
    $('#sourceCount').textContent =
      board?.sources?.length || 0;
  }

  if ($('#signalCount')) {
    $('#signalCount').textContent =
      props.length;
  }

  if ($('#lastRefresh')) {
    $('#lastRefresh').textContent =
      board?.refreshedAt
        ? new Date(board.refreshedAt).toLocaleString()
        : 'not run';
  }

  if ($('#sourceRows')) {
    $('#sourceRows').innerHTML =
      (board?.sources || []).map(s => `
        <tr>
          <td>
            <strong>${s.analyst}</strong>
          </td>

          <td>${s.outlet}</td>

          <td>
            ${Math.round((s.quality || 0) * 100)}/100
          </td>

          <td>${s.verification}</td>

          <td>
            <a
              href="${s.url}"
              target="_blank"
              rel="noopener"
            >
              Open source ↗
            </a>
          </td>
        </tr>
      `).join('');
  }

  const es = experts?.experts || [];

  if ($('#expertRows')) {
    $('#expertRows').innerHTML =
      es.map(e => {
        const t = e.tracked || {};

        const wl =
          `${t.wins || 0}-${t.losses || 0}`;

        const roi =
          e.roi == null
            ? '—'
            : `${(e.roi * 100).toFixed(1)}%`;

        const status =
          t.picks >= 50
            ? 'RANKED'
            : t.picks > 0
              ? 'TRACKING'
              : 'NEW';

        return `
          <tr>
            <td>
              <strong>${e.name}</strong>
            </td>

            <td>${e.outlet}</td>

            <td>${t.picks || 0}</td>

            <td>${wl}</td>

            <td>${(t.units || 0).toFixed(2)}u</td>

            <td>${roi}</td>

            <td>
              <span class="status ${status.toLowerCase()}">
                ${status}
              </span>
            </td>
          </tr>
        `;
      }).join('');
  }

  const r = experts?.record || {};

  if ($('#wins')) {
    $('#wins').textContent =
      r.wins || 0;
  }

  if ($('#losses')) {
    $('#losses').textContent =
      r.losses || 0;
  }

  if ($('#units')) {
    $('#units').textContent =
      `${Number(r.units || 0).toFixed(2)}u`;
  }

  if ($('#roi')) {
    $('#roi').textContent =
      r.roi == null
        ? '—'
        : `${(r.roi * 100).toFixed(1)}%`;
  }
}

$('#confidenceFilter')?.addEventListener(
  'change',
  render
);

$('#refreshBoard')?.addEventListener(
  'click',
  load
);

$('#howItWorks')?.addEventListener(
  'click',
  () =>
    $('#howModal').setAttribute(
      'aria-hidden',
      'false'
    )
);

$('#closeHow')?.addEventListener(
  'click',
  () =>
    $('#howModal').setAttribute(
      'aria-hidden',
      'true'
    )
);

document
  .querySelector('.modal-backdrop')
  ?.addEventListener(
    'click',
    () =>
      $('#howModal').setAttribute(
        'aria-hidden',
        'true'
      )
  );

load();
