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
// CONSENSUS ENGINE
// ============================================================

function normalizeSide(side) {
  const value = String(side || '').toUpperCase();

  if (value === 'YES' || value === 'OVER') {
    return 'OVER';
  }

  if (value === 'NO' || value === 'UNDER') {
    return 'UNDER';
  }

  return value;
}


function consensusKey(signal) {
  return `${String(
    signal.player || ''
  ).trim().toLowerCase()}::${String(
    signal.market || ''
  ).trim().toLowerCase()}`;
}


function consensusStrength(
  agreeCount,
  disagreeCount
) {
  const total =
    agreeCount + disagreeCount;

  if (total <= 1) {
    return 'SINGLE';
  }

  if (agreeCount === disagreeCount) {
    return 'SPLIT';
  }

  if (total === 2) {
    return 'EMERGING';
  }

  if (total <= 4) {
    return 'MODERATE';
  }

  if (total <= 6) {
    return 'STRONG';
  }

  return 'HEAVY';
}


function consensusLabel(value) {
  const labels = {
    SINGLE: 'Single Source',
    EMERGING: 'Emerging Consensus',
    MODERATE: 'Moderate Consensus',
    STRONG: 'Strong Consensus',
    HEAVY: 'Heavy Consensus',
    SPLIT: 'Split'
  };

  return labels[value] || 'Single Source';
}


function buildConsensusProps(
  signals,
  sources
) {
  const groups = new Map();

  (signals || []).forEach(signal => {
    const key =
      consensusKey(signal);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(signal);
  });

  return Array.from(
    groups.values()
  ).map(group => {

    const directions = {
      OVER: [],
      UNDER: []
    };

    group.forEach(signal => {
      const direction =
        normalizeSide(signal.side);

      if (!directions[direction]) {
        directions[direction] = [];
      }

      directions[direction].push(signal);
    });

    const overCount =
      directions.OVER?.length || 0;

    const underCount =
      directions.UNDER?.length || 0;

    const total =
      group.length;

    const majorityDirection =
      overCount > underCount
        ? 'OVER'
        : underCount > overCount
          ? 'UNDER'
          : normalizeSide(
              group[0]?.side
            );

    const agreeCount =
      majorityDirection === 'OVER'
        ? overCount
        : underCount;

    const disagreeCount =
      total - agreeCount;

    const majorityGroup =
      group.filter(
        signal =>
          normalizeSide(
            signal.side
          ) === majorityDirection
      );

    const representative =
      majorityGroup[0] ||
      group[0];

    const analysts =
      group.map(signal => {

        const source =
          (sources || []).find(
            item =>
              item.id ===
              signal.sourceId
          );

        return {
          name: signal.analyst,
          sourceId: signal.sourceId,
          note: signal.note,
          url: source?.url,
          outlet: source?.outlet,
          side: normalizeSide(
            signal.side
          ),
          line: signal.line,
          signalId: signal.id
        };
      });

    const lines =
      majorityGroup
        .map(
          signal =>
            Number(signal.line)
        )
        .filter(
          Number.isFinite
        )
        .sort(
          (a, b) => a - b
        );

    const lineLow =
      lines.length
        ? lines[0]
        : null;

    const lineHigh =
      lines.length
        ? lines[lines.length - 1]
        : null;

    const strength =
      consensusStrength(
        agreeCount,
        disagreeCount
      );

    return {
      id: representative.id,

      player:
        representative.player,

      market:
        representative.market,

      side:
        representative.side,

      line:
        representative.line,

      analyst:
        representative.analyst,

      analystCount:
        total,

      consensusScore:
        null,

      consensusPercent:
        total
          ? Math.round(
              (agreeCount / total) *
                100
            )
          : 0,

      consensusDisplay:
        disagreeCount > 0
          ? `${agreeCount}/${total} ${majorityDirection}`
          : `${agreeCount} ${majorityDirection}`,

      agreeCount,

      disagreeCount,

      overCount,

      underCount,

      consensusDirection:
        majorityDirection,

      consensusStrength:
        strength,

      consensusStrengthLabel:
        consensusLabel(
          strength
        ),

      hasDisagreement:
        disagreeCount > 0,

      lineLow,

      lineHigh,

      analysts,

      rationale:
        representative.note
    };
  });
}


function configureConsensusFilter() {
  const filter =
    $('#confidenceFilter');

  if (!filter) {
    return;
  }

  if (filter.parentElement) {
    const firstTextNode =
      Array.from(
        filter.parentElement.childNodes
      ).find(
        node =>
          node.nodeType ===
          Node.TEXT_NODE
      );

    if (firstTextNode) {
      firstTextNode.textContent =
        'Consensus Strength ';
    }
  }

  filter.innerHTML = `
    <option value="ALL">
      All
    </option>

    <option value="HEAVY">
      Heavy
    </option>

    <option value="STRONG">
      Strong
    </option>

    <option value="MODERATE">
      Moderate
    </option>

    <option value="EMERGING">
      Emerging
    </option>

    <option value="SINGLE">
      Single Source
    </option>

    <option value="SPLIT">
      Split
    </option>
  `;
}


// ============================================================
// CONSENSUS STYLES
// ============================================================

function installConsensusStyles() {
  if (
    $('#linefoundryConsensusStyles')
  ) {
    return;
  }

  const style =
    document.createElement(
      'style'
    );

  style.id =
    'linefoundryConsensusStyles';

  style.textContent = `
    .consensus-summary {
      margin: 12px 0 4px;
      padding: 12px 13px;
      border: 1px solid #1b2a35;
      border-radius: 11px;
      background: rgba(125,242,178,.045);
    }

    .consensus-summary strong {
      display: block;
      font-size: 12px;
      color: #f4f7fb;
    }

    .consensus-summary span,
    .consensus-summary small {
      display: block;
      margin-top: 4px;
      color: #8e9aaa;
      font-size: 10px;
    }

    .consensus-summary small {
      color: #718094;
    }
  `;

  document.head.appendChild(
    style
  );
}


// ============================================================
// LOAD LINEFOUNDRY DATA
// ============================================================

async function load() {
  try {

    const [
      signalsData,
      expertsData,
      resultsData
    ] = await Promise.all([

      fetch(
        '/public-signals.json'
      ).then(r => {

        if (!r.ok) {
          throw new Error(
            'Could not load public-signals.json'
          );
        }

        return r.json();
      }),

      fetch(
        '/analyst-profiles.json'
      ).then(r => {

        if (!r.ok) {
          throw new Error(
            'Could not load analyst-profiles.json'
          );
        }

        return r.json();
      }),

      fetch(
        '/results-ledger.json'
      ).then(r => {

        if (!r.ok) {
          throw new Error(
            'Could not load results-ledger.json'
          );
        }

        return r.json();
      })

    ]);

    const d =
      signalsData;

    board = {
      mode:
        'public-consensus',

      week:
        d.week,

      season:
        d.season,

      refreshedAt:
        new Date().toISOString(),

      sources:
        d.sources || [],

      props:
        buildConsensusProps(
          d.signals || [],
          d.sources || []
        )
    };

    experts =
      expertsData;

    results =
      resultsData;

    render();

    await loadLiveResults();

  } catch (err) {

    console.error(
      'LineFoundry data load failed:',
      err
    );

    if ($('#propCards')) {

      $('#propCards').innerHTML = `
        <div class="empty-state">
          <h3>
            Unable to load LineFoundry data
          </h3>

          <p>
            Please refresh the page and try again.
          </p>
        </div>
      `;
    }
  }
}


// ============================================================
// LOAD LIVE ESPN RESULTS
// FROM CLOUDFLARE WORKER
// ============================================================

async function loadLiveResults() {
  try {

    const response =
      await fetch(
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

    const data =
      await response.json();

    if (!data.success) {

      throw new Error(
        data.error ||
        'Worker returned an error'
      );
    }

    liveResults = {};

    (
      data.results || []
    ).forEach(result => {

      if (result.id) {

        liveResults[
          result.id
        ] = result;
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

  const live =
    liveResults[id];

  if (live) {

    return formatLiveResult(
      live
    );
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
    (results.picks || [])
      .find(
        p => p.id === id
      );

  return (
    pick?.result ||
    '—'
  );
}


// ============================================================
// FORMAT LIVE RESULT
// ============================================================

function formatLiveResult(
  result
) {

  if (
    result.status ===
    'GAME_NOT_FOUND'
  ) {

    return 'Not Available';
  }

  if (
    result.status ===
    'MARKET_NOT_FOUND'
  ) {

    return 'Not Available';
  }

  if (
    result.status ===
    'ERROR'
  ) {

    return 'Not Available';
  }

  if (
    result.market ===
    'Anytime TD'
  ) {

    if (
      result.status ===
      'HIT'
    ) {
      return 'HIT';
    }

    if (
      result.status ===
      'MISS'
    ) {
      return 'MISS';
    }

    if (
      result.status ===
      'LIVE'
    ) {
      return 'LIVE';
    }

    return 'PENDING';
  }

  if (
    result.status ===
    'HIT'
  ) {

    return `HIT — ${
      formatNumber(
        result.currentValue
      )
    }`;
  }

  if (
    result.status ===
    'MISS'
  ) {

    return `MISS — ${
      formatNumber(
        result.currentValue
      )
    }`;
  }

  if (
    result.status ===
    'LIVE'
  ) {

    return `LIVE — ${
      formatNumber(
        result.currentValue
      )
    }`;
  }

  return (
    result.status ||
    'PENDING'
  );
}


// ============================================================
// RESULT DETAILS
// ============================================================

function getResultDetails(id) {

  const live =
    liveResults[id];

  if (!live) {
    return null;
  }

  if (
    live.status ===
      'GAME_NOT_FOUND' ||
    live.status ===
      'MARKET_NOT_FOUND' ||
    live.status ===
      'ERROR'
  ) {

    return null;
  }

  return live;
}


// ============================================================
// FORMAT NUMBER
// ============================================================

function formatNumber(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return '—';
  }

  return Number.isInteger(
    Number(value)
  )

    ? String(value)

    : Number(value).toFixed(
        1
      );
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

  const live =
    getResultDetails(p.id);

  if (!live) {

    return {
      value: '—',
      status:
        'Waiting for live data'
    };
  }

  if (
    live.status ===
    'HIT'
  ) {

    return {
      value:
        formatNumber(
          live.currentValue
        ),

      status:
        'BET HIT'
    };
  }

  if (
    live.status ===
    'MISS'
  ) {

    return {
      value:
        formatNumber(
          live.currentValue
        ),

      status:
        'BET MISS'
    };
  }

  if (
    live.status ===
    'LIVE'
  ) {

    return {
      value:
        formatNumber(
          live.currentValue
        ),

      status:
        'LIVE'
    };
  }

  if (
    live.status ===
    'MARKET_NOT_FOUND'
  ) {

    return {
      value: '—',
      status:
        'Market unavailable'
    };
  }

  if (
    live.status ===
    'GAME_NOT_FOUND'
  ) {

    return {
      value: '—',
      status:
        'Game unavailable'
    };
  }

  return {
    value: '—',
    status:
      live.status ||
      'Waiting for live data'
  };
}


// ============================================================
// LIVE STATUS DISPLAY
// ============================================================

function liveStatus(p) {

  const live =
    getResultDetails(p.id);

  if (!live) {

    return `
      <div class="live-stat">

        <strong>
          Live Result: —
        </strong>

        <span>
          Waiting for live data
        </span>

      </div>
    `;
  }

  if (
    p.market ===
    'Anytime TD'
  ) {

    if (
      live.status ===
      'HIT'
    ) {

      return `
        <div class="live-stat">

          <strong>
            Live Result: BET HIT
          </strong>

          <span>
            Touchdown recorded
          </span>

        </div>
      `;
    }

    if (
      live.status ===
      'MISS'
    ) {

      return `
        <div class="live-stat">

          <strong>
            Live Result: BET MISS
          </strong>

          <span>
            No touchdown recorded
          </span>

        </div>
      `;
    }

    if (
      live.status ===
      'LIVE'
    ) {

      return `
        <div class="live-stat">

          <strong>
            Live Result: LIVE
          </strong>

          <span>
            Game in progress
          </span>

        </div>
      `;
    }

    return `
      <div class="live-stat">

        <strong>
          Live Result: —
        </strong>

        <span>
          ${
            live.status ||
            'Waiting for live data'
          }
        </span>

      </div>
    `;
  }

  if (
    live.status ===
    'HIT'
  ) {

    return `
      <div class="live-stat">

        <strong>
          Live Result:
          ${
            formatNumber(
              live.currentValue
            )
          }
          — BET HIT
        </strong>

        <span>
          Line:
          ${
            formatNumber(
              live.line
            )
          }
        </span>

      </div>
    `;
  }

  if (
    live.status ===
    'MISS'
  ) {

    return `
      <div class="live-stat">

        <strong>
          Live Result:
          ${
            formatNumber(
              live.currentValue
            )
          }
          — BET MISS
        </strong>

        <span>
          Line:
          ${
            formatNumber(
              live.line
            )
          }
        </span>

      </div>
    `;
  }

  if (
    live.status ===
    'LIVE'
  ) {

    const needed =
      live.remaining;

    return `
      <div class="live-stat">

        <strong>
          Live Result:
          ${
            formatNumber(
              live.currentValue
            )
          }
          — LIVE
        </strong>

        <span>

          ${
            needed !== null &&
            needed !== undefined

              ? `${
                  formatNumber(
                    needed
                  )
                } needed`

              : 'Game in progress'
          }

        </span>

      </div>
    `;
  }

  return `
    <div class="live-stat">

      <strong>
        Live Result: —
      </strong>

      <span>
        ${
          live.status ||
          'Waiting for live data'
        }
      </span>

    </div>
  `;
}


// ============================================================
// PROP CARD
// ============================================================

function card(p) {

  const lockedPick =
    locked.includes(p.id);

  return `
    <article
      class="prop ${
        lockedPick
          ? 'locked'
          : ''
      }"
    >

      <div class="prop-top">

        <div class="game">
          NFL • WEEK
          ${board.week}
        </div>

        <div class="grade">
          ${p.consensusDisplay}
        </div>

      </div>


      <h3>
        ${
          p.player
        } —

        ${
          p.consensusDirection
        }

        ${
          p.line == null
            ? ''
            : p.line
        }

        ${
          p.market
        }
      </h3>


      ${
        liveStatus(p)
      }


      <div class="metrics">

        <div class="metric">

          <b>
            ${p.agreeCount}
          </b>

          <span>
            Agree
          </span>

        </div>


        <div class="metric">

          <b>
            ${p.disagreeCount}
          </b>

          <span>
            Disagree
          </span>

        </div>


        <div class="metric">

          <b>
            ${p.analystCount}
          </b>

          <span>
            Experts
          </span>

        </div>


        <div class="metric">

          <b>
            ${
              p.consensusStrengthLabel
            }
          </b>

          <span>
            Strength
          </span>

        </div>

      </div>


      <div class="consensus-summary">

        <strong>
          ${
            p.agreeCount
          }

          ${
            p.consensusDirection
          }

          expert${
            p.agreeCount === 1
              ? ''
              : 's'
          }
        </strong>


        <span>

          ${
            p.disagreeCount > 0

              ? `${
                  p.disagreeCount
                }

                ${
                  p.consensusDirection ===
                  'OVER'
                    ? 'UNDER'
                    : 'OVER'
                }

                expert${
                  p.disagreeCount === 1
                    ? ''
                    : 's'
                }

                •
                ${
                  p.consensusPercent
                }%
                direction consensus`

              : 'No opposing pick found'
          }

        </span>


        ${
          p.lineLow !== null &&
          p.lineHigh !== null

            ? `
              <small>

                ${
                  p.lineLow ===
                  p.lineHigh

                    ? `Line:
                       ${
                         formatNumber(
                           p.lineLow
                         )
                       }`

                    : `Majority line range:
                       ${
                         formatNumber(
                           p.lineLow
                         )
                       }
                       –
                       ${
                         formatNumber(
                           p.lineHigh
                         )
                       }`
                }

              </small>
            `

            : ''
        }

      </div>


      <div class="analyst-list">

        ${
          p.analysts
            .map(a => `

              <div>

                <strong>
                  ${a.name}
                </strong>

                <span>
                  ${
                    a.outlet || ''
                  }

                  •

                  ${
                    a.side
                  }

                  ${
                    a.line == null
                      ? ''
                      : a.line
                  }
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

            `)
            .join('')
        }

      </div>


      <p class="why">
        ${p.rationale}
      </p>


      <div class="card-actions">

        <span
          class="lock-status"
        >

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
        p.consensusStrength ===
          filter
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
      board?.sources?.length ||
      0;
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
              ${
                Math.round(
                  (s.quality || 0) *
                  100
                )
              }/100
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
    experts?.experts ||
    [];


  if ($('#expertRows')) {

    $('#expertRows').innerHTML =
      es
        .map(e => {

          const t =
            e.tracked ||
            {};

          const wl =
            `${t.wins || 0}-${
              t.losses || 0
            }`;

          const roi =
            e.roi == null

              ? '—'

              : `${
                  (
                    e.roi *
                    100
                  ).toFixed(1)
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
                ${
                  (
                    t.units || 0
                  ).toFixed(2)
                }u
              </td>

              <td>
                ${roi}
              </td>

              <td>

                <span
                  class="status ${
                    status.toLowerCase()
                  }"
                >

                  ${status}

                </span>

              </td>

            </tr>

          `;

        })
        .join('');
  }


  const r =
    experts?.record ||
    {};


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
            r.roi *
            100
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

installConsensusStyles();

configureConsensusFilter();

load();


// Trigger the live Worker independently
// 1.5 seconds after page load.

setTimeout(
  loadLiveResults,
  1500
);
