let board = null;
let experts = null;
let results = null;
let liveResults = {};

const WORKER_URL =
  'https://old-mouse-660a.tannerbro10.workers.dev/';

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


// ============================================================
// LOAD LINEFOUNDRY DATA
// ============================================================

async function load() {
  try {
    const [signalsData, expertsData, resultsData] =
      await Promise.all([
        fetch('/public-signals.json').then(r => {
          if (!r.ok) {
            throw new Error(
              'Could not load public-signals.json'
            );
          }

          return r.json();
        }),

        fetch('/analyst-profiles.json').then(r => {
          if (!r.ok) {
            throw new Error(
              'Could not load analyst-profiles.json'
            );
          }

          return r.json();
        }),

        fetch('/results-ledger.json').then(r => {
          if (!r.ok) {
            throw new Error(
              'Could not load results-ledger.json'
            );
          }

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
        const source =
          (d.sources || []).find(
            x => x.id === s.sourceId
          );

        return {
          id: s.id,
          player: s.player,
          market: s.market,
          side: s.side,
          line: s.line,
          analyst: s.analyst,
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

    // Immediately get live ESPN data.
    await loadLiveResults();

  } catch (err) {
    console.error(
      'LineFoundry data load failed:',
      err
    );

    if ($('#propCards')) {
      $('#propCards').innerHTML = `
        <div class="empty-state">
          <h3>Unable to load LineFoundry data</h3>
          <p>Please refresh the page and try again.</p>
        </div>
      `;
    }
  }
}


// ============================================================
// LOAD LIVE ESPN RESULTS FROM CLOUDFLARE WORKER
// ============================================================

async function loadLiveResults() {
  try {
    const response = await fetch(
      `${WORKER_URL}?_=${Date.now()}`,
      {
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(
        `Worker returned ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(
        data.error || 'Worker returned an error'
      );
    }

    liveResults = {};

    (data.results || []).forEach(result => {
      if (result.id) {
        liveResults[result.id] = result;
      }
    });

    if (board) {
      board.liveUpdatedAt =
        data.updatedAt ||
        new Date().toISOString();

      render();
    }

    console.log(
      'LineFoundry live results updated:',
      data
    );

  } catch (err) {
    console.error(
      'LineFoundry live data failed:',
      err
    );
  }
}


// ============================================================
// AUTOMATIC LIVE REFRESH
// ============================================================

setInterval(
  loadLiveResults,
  60000
);


// ============================================================
// GET RESULT
// ============================================================

function getResult(id) {
  const live = liveResults[id];

  if (live) {
    return formatLiveResult(live);
  }

  if (!results) {
    return '—';
  }

  if (
    results.results &&
    results.results[id]
  ) {
    return results.results[id];
  }

  const pick =
    (results.picks || []).find(
      p => p.id === id
    );

  return pick?.result || '—';
}


// ============================================================
// FORMAT LIVE RESULT
// ============================================================

function formatLiveResult(result) {

  if (
    result.status === 'GAME_NOT_FOUND'
  ) {
    return 'Not Available';
  }

  if (
    result.status === 'MARKET_NOT_FOUND'
  ) {
    return 'Not Available';
  }

  if (
    result.status === 'ERROR'
  ) {
    return 'Not Available';
  }

  if (
    result.market === 'Anytime TD'
  ) {
    if (result.status === 'HIT') {
      return 'HIT';
    }

    if (result.status === 'MISS') {
      return 'MISS';
    }

    if (result.status === 'LIVE') {
      return 'LIVE';
    }

    return 'PENDING';
  }

  if (
    result.status === 'HIT'
  ) {
    return `HIT — ${formatNumber(
      result.currentValue
    )}`;
  }

  if (
    result.status === 'MISS'
  ) {
    return `MISS — ${formatNumber(
      result.currentValue
    )}`;
  }

  if (
    result.status === 'LIVE'
  ) {
    return `LIVE — ${formatNumber(
      result.currentValue
    )}`;
  }

  return result.status || 'PENDING';
}


// ============================================================
// RESULT DETAILS
// ============================================================

function getResultDetails(id) {
  const live = liveResults[id];

  if (!live) {
    return null;
  }

  if (
    live.status === 'GAME_NOT_FOUND' ||
    live.status === 'MARKET_NOT_FOUND' ||
    live.status === 'ERROR'
  ) {
    return null;
  }

  return live;
}


// ============================================================
// FORMAT NUMBER
// ============================================================

function formatNumber(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  return Number.isInteger(Number(value))
    ? String(value)
    : Number(value).toFixed(1);
}


// ============================================================
// LABEL
// ============================================================

function label(p) {
  return `${p.side} ${
    p.line == null
      ? 'TD'
      : p.line
  } ${p.market}`;
}


// ============================================================
// LIVE FIELD
// ============================================================

function liveField(p) {
  const live = getResultDetails(p.id);

  if (!live) {
    return {
      value: '—',
      status: 'Waiting for live data'
    };
  }

  if (live.status === 'HIT') {
    return {
      value: formatNumber(live.currentValue),
      status: 'BET HIT'
    };
  }

  if (live.status === 'MISS') {
    return {
      value: formatNumber(live.currentValue),
      status: 'BET MISS'
    };
  }

  if (live.status === 'LIVE') {
    return {
      value: formatNumber(live.currentValue),
      status: 'LIVE'
    };
  }

  if (live.status === 'MARKET_NOT_FOUND') {
    return {
      value: '—',
      status: 'Market unavailable'
    };
  }

  if (live.status === 'GAME_NOT_FOUND') {
    return {
      value: '—',
      status: 'Game unavailable'
    };
  }

  return {
    value: '—',
    status: live.status || 'Waiting for live data'
  };
}


// ============================================================
// LIVE STATUS DISPLAY
// ============================================================

function liveStatus(p) {
  const live = getResultDetails(p.id);

  // ALWAYS show the live-data field.
  // If no live data exists yet, show a clear placeholder.
  if (!live) {
    return `
      <div class="live-stat">
        <strong>Live Result: —</strong>
        <span>Waiting for live data</span>
      </div>
    `;
  }

  // Anytime TD
  if (p.market === 'Anytime TD') {

    if (live.status === 'HIT') {
      return `
        <div class="live-stat">
          <strong>Live Result: BET HIT</strong>
          <span>Touchdown recorded</span>
        </div>
      `;
    }

    if (live.status === 'MISS') {
      return `
        <div class="live-stat">
          <strong>Live Result: BET MISS</strong>
          <span>No touchdown recorded</span>
        </div>
      `;
    }

    if (live.status === 'LIVE') {
      return `
        <div class="live-stat">
          <strong>Live Result: LIVE</strong>
          <span>Game in progress</span>
        </div>
      `;
    }

    return `
      <div class="live-stat">
        <strong>Live Result: —</strong>
        <span>${live.status || 'Waiting for live data'}</span>
      </div>
    `;
  }

  // Normal statistical markets
  if (live.status === 'HIT') {
    return `
      <div class="live-stat">
        <strong>
          Live Result: ${formatNumber(live.currentValue)} — BET HIT
        </strong>
        <span>Line: ${formatNumber(live.line)}</span>
      </div>
    `;
  }

  if (live.status === 'MISS') {
    return `
      <div class="live-stat">
        <strong>
          Live Result: ${formatNumber(live.currentValue)} — BET MISS
        </strong>
        <span>Line: ${formatNumber(live.line)}</span>
      </div>
    `;
  }

  if (live.status === 'LIVE') {
    const needed = live.remaining;

    return `
      <div class="live-stat">
        <strong>
          Live Result: ${formatNumber(live.currentValue)} — LIVE
        </strong>
        <span>
          ${
            needed !== null && needed !== undefined
              ? `${formatNumber(needed)} needed`
              : 'Game in progress'
          }
        </span>
      </div>
    `;
  }

  return `
    <div class="live-stat">
      <strong>Live Result: —</strong>
      <span>${live.status || 'Waiting for live data'}</span>
    </div>
  `;
}


// ============================================================
// PROP CARD
// ============================================================

function card(p) {
  const lockedPick =
    locked.includes(p.id);

  const result =
    getResult(p.id);

  const live =
    getResultDetails(p.id);

  const liveFieldData =
    liveField(p);

  return `
    <article class="prop ${
      lockedPick
        ? 'locked'
        : ''
    }">

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

      <div class="live-stat">
        <strong>
          Live Result: ${liveFieldData.value}
        </strong>

        <span>
          ${liveFieldData.status}
        </span>
      </div>

      ${
        liveStatus(p)
      }

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
          <b>${result}</b>
          <span>Result</span>
        </div>

      </div>

      <div class="analyst-list">

        ${p.analysts.map(a => `
          <div>

            <strong>
              ${a.name}
            </strong>

            <span>
              ${a.outlet || ''}
            </span>

            ${
              a.url
                ? `
                  <a
                    href="${a.url}"
                    target="_blank"
                    rel="noopener"
                  >
                    Source ↗
                  </a>
                `
                : ''
            }

          </div>
        `).join('')}

      </div>

      <p class="why">
        ${p.rationale}
      </p>

      <div class="card-actions">

        <span class="lock-status">
          ${
            lockedPick
              ? '🔒 Locked'
              : '🟢 Open'
          }
        </span>

      </div>

    </article>
  `;
}


// ============================================================
// RENDER
// ============================================================

function render() {
  const props =
    board?.props || [];

  const filter =
    $('#confidenceFilter')?.value ||
    'ALL';

  const filteredProps =
    props.filter(
      p =>
        filter === 'ALL' ||
        p.confidence === filter
    );

  if ($('#propCards')) {
    $('#propCards').innerHTML =
      filteredProps
        .map(card)
        .join('');
  }

  if ($('#pickCount')) {
    $('#pickCount').textContent =
      locked.length;
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
      board?.liveUpdatedAt
        ? new Date(
            board.liveUpdatedAt
          ).toLocaleString()
        : board?.refreshedAt
          ? new Date(
              board.refreshedAt
            ).toLocaleString()
          : 'not run';
  }

  if ($('#sourceRows')) {
    $('#sourceRows').innerHTML =
      (board?.sources || [])
        .map(s => `
          <tr>

            <td>
              <strong>
                ${s.analyst}
              </strong>
            </td>

            <td>
              ${s.outlet}
            </td>

            <td>
              ${Math.round(
                (s.quality || 0) * 100
              )}/100
            </td>

            <td>
              ${s.verification}
            </td>

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
        `)
        .join('');
  }

  const es =
    experts?.experts || [];

  if ($('#expertRows')) {
    $('#expertRows').innerHTML =
      es.map(e => {

        const t =
          e.tracked || {};

        const wl =
          `${t.wins || 0}-${
            t.losses || 0
          }`;

        const roi =
          e.roi == null
            ? '—'
            : `${
                (e.roi * 100)
                  .toFixed(1)
              }%`;

        const status =
          t.picks >= 50
            ? 'RANKED'
            : t.picks > 0
              ? 'TRACKING'
              : 'NEW';

        return `
          <tr>

            <td>
              <strong>
                ${e.name}
              </strong>
            </td>

            <td>
              ${e.outlet}
            </td>

            <td>
              ${t.picks || 0}
            </td>

            <td>
              ${wl}
            </td>

            <td>
              ${(t.units || 0)
                .toFixed(2)}u
            </td>

            <td>
              ${roi}
            </td>

            <td>

              <span class="status ${
                status.toLowerCase()
              }">

                ${status}

              </span>

            </td>

          </tr>
        `;

      }).join('');
  }

  const r =
    experts?.record || {};

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
      `${Number(
        r.units || 0
      ).toFixed(2)}u`;
  }

  if ($('#roi')) {
    $('#roi').textContent =
      r.roi == null
        ? '—'
        : `${(
            r.roi * 100
          ).toFixed(1)}%`;
  }
}


// ============================================================
// EVENTS
// ============================================================

$('#confidenceFilter')
  ?.addEventListener(
    'change',
    render
  );

$('#refreshBoard')
  ?.addEventListener(
    'click',
    async () => {
      await load();
    }
  );

$('#howItWorks')
  ?.addEventListener(
    'click',
    () =>
      $('#howModal')
        .setAttribute(
          'aria-hidden',
          'false'
        )
  );

$('#closeHow')
  ?.addEventListener(
    'click',
    () =>
      $('#howModal')
        .setAttribute(
          'aria-hidden',
          'true'
        )
  );

document
  .querySelector(
    '.modal-backdrop'
  )
  ?.addEventListener(
    'click',
    () =>
      $('#howModal')
        .setAttribute(
          'aria-hidden',
          'true'
        )
  );


// ============================================================
// INITIAL LOAD
// ============================================================

load();

// Trigger the live Worker independently 1.5 seconds
// after page load.

setTimeout(
  loadLiveResults,
  1500
);
