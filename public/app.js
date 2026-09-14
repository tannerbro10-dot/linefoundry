let board = null;
let experts = null;
let results = null;
let liveResults = {};

const WORKER_URL =
  'https://old-mouse-660a.tannerbro10.workers.dev/';

let locked = JSON.parse(
  localStorage.getItem('lf_consensus_locked') || '[]'
);

const $ = selector =>
  document.querySelector(selector);


/* ============================================================
   STORAGE
============================================================ */

function save() {
  localStorage.setItem(
    'lf_consensus_locked',
    JSON.stringify(locked)
  );
}


/* ============================================================
   CONSENSUS HELPERS
============================================================ */

function normalizeSide(side) {
  const value = String(side || '')
    .trim()
    .toUpperCase();

  if (
    value === 'YES' ||
    value === 'OVER' ||
    value === 'O'
  ) {
    return 'OVER';
  }

  if (
    value === 'NO' ||
    value === 'UNDER' ||
    value === 'U'
  ) {
    return 'UNDER';
  }

  return value;
}


function consensusKey(signal) {
  return [
    String(signal.player || '')
      .trim()
      .toLowerCase(),
    String(signal.market || '')
      .trim()
      .toLowerCase()
  ].join('|');
}


function consensusStrength(
  total,
  agree,
  disagree
) {
  if (total <= 1) {
    return 'SINGLE';
  }

  if (agree === disagree) {
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


function consensusLabel(strength) {
  switch (strength) {
    case 'HEAVY':
      return 'Heavy';

    case 'STRONG':
      return 'Strong';

    case 'MODERATE':
      return 'Moderate';

    case 'EMERGING':
      return 'Emerging';

    case 'SPLIT':
      return 'Split';

    case 'SINGLE':
    default:
      return 'Single Source';
  }
}


function buildConsensusProps(
  signals,
  sources
) {
  const groups = new Map();

  (signals || []).forEach(signal => {
    const key = consensusKey(signal);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(signal);
  });

  return Array.from(groups.values()).map(group => {
    const first = group[0];

    const normalized = group.map(signal => ({
      ...signal,
      normalizedSide:
        normalizeSide(signal.side)
    }));

    const overSignals =
      normalized.filter(
        signal =>
          signal.normalizedSide === 'OVER'
      );

    const underSignals =
      normalized.filter(
        signal =>
          signal.normalizedSide === 'UNDER'
      );

    const unknownSignals =
      normalized.filter(
        signal =>
          signal.normalizedSide !== 'OVER' &&
          signal.normalizedSide !== 'UNDER'
      );

    let majoritySide = normalizeSide(
      first.side
    );

    let agreeCount = 1;
    let disagreeCount = 0;

    if (
      overSignals.length >
      underSignals.length
    ) {
      majoritySide = 'OVER';
      agreeCount = overSignals.length;
      disagreeCount = underSignals.length;
    } else if (
      underSignals.length >
      overSignals.length
    ) {
      majoritySide = 'UNDER';
      agreeCount = underSignals.length;
      disagreeCount = overSignals.length;
    } else if (
      overSignals.length ===
        underSignals.length &&
      overSignals.length > 0
    ) {
      majoritySide =
        normalizeSide(first.side);

      agreeCount =
        normalized.filter(
          signal =>
            signal.normalizedSide ===
            majoritySide
        ).length;

      disagreeCount =
        normalized.filter(
          signal =>
            signal.normalizedSide !==
            majoritySide
        ).length;
    } else {
      majoritySide =
        normalizeSide(first.side);

      agreeCount = normalized.length;
      disagreeCount = 0;
    }

    const total =
      normalized.length;

    const strength =
      consensusStrength(
        total,
        agreeCount,
        disagreeCount
      );

    const majoritySignals =
      normalized.filter(
        signal =>
          signal.normalizedSide ===
          majoritySide
      );

    const lineValues =
      majoritySignals
        .map(signal => signal.line)
        .filter(
          line =>
            line !== null &&
            line !== undefined &&
            line !== ''
        )
        .map(Number)
        .filter(Number.isFinite);

    let line = first.line;

    let lineRange = null;

    if (lineValues.length > 0) {
      const minLine =
        Math.min(...lineValues);

      const maxLine =
        Math.max(...lineValues);

      line = minLine;

      if (minLine !== maxLine) {
        lineRange =
          `${formatNumber(minLine)}–${formatNumber(maxLine)}`;
      }
    }

    const analysts =
      normalized.map(signal => {
        const source =
          (sources || []).find(
            source =>
              source.id === signal.sourceId
          );

        return {
          name:
            signal.analyst ||
            'Unknown analyst',

          sourceId:
            signal.sourceId,

          note:
            signal.note || '',

          url:
            source?.url,

          outlet:
            source?.outlet ||
            source?.name ||
            '',

          side:
            normalizeSide(signal.side),

          line:
            signal.line
        };
      });

    const consensusDisplay =
      disagreeCount === 0
        ? `${agreeCount} ${majoritySide}`
        : `${agreeCount}/${total} ${majoritySide}`;

    let rationale = '';

    if (total === 1) {
      rationale =
        'One tracked expert currently supports this direction. No opposing pick found.';
    } else if (disagreeCount === 0) {
      rationale =
        `${agreeCount} independent experts currently agree on this direction.`;
    } else {
      rationale =
        `${agreeCount} experts support ${majoritySide} while ${disagreeCount} support the opposite direction.`;
    }

    if (unknownSignals.length > 0) {
      rationale +=
        ` ${unknownSignals.length} signal${unknownSignals.length === 1 ? '' : 's'} could not be assigned to an over/under direction.`;
    }

    return {
      id:
        majoritySignals[0]?.id ||
        first.id,

      player:
        first.player,

      market:
        first.market,

      side:
        majoritySide,

      line,

      lineRange,

      analyst:
        majoritySignals[0]?.analyst ||
        first.analyst,

      analystCount:
        total,

      agreeCount,

      disagreeCount,

      totalSources:
        total,

      consensusDisplay,

      consensusStrength:
        strength,

      consensusLabel:
        consensusLabel(strength),

      analysts,

      rationale,

      sourceIds:
        normalized.map(
          signal => signal.sourceId
        )
    };
  });
}


/* ============================================================
   CONSENSUS FILTER
============================================================ */

function configureConsensusFilter() {
  const filter =
    $('#confidenceFilter');

  if (!filter) {
    return;
  }

  const currentValue =
    filter.value;

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

  filter.value =
    currentValue || 'ALL';

  const label =
    filter.closest('label');

  if (label) {
    const textNodes =
      Array.from(label.childNodes);

    textNodes.forEach(node => {
      if (
        node.nodeType ===
        Node.TEXT_NODE
      ) {
        node.textContent =
          'Consensus Strength';
      }
    });
  }
}


/* ============================================================
   CONSENSUS STYLES
============================================================ */

function installConsensusStyles() {
  if ($('#lfConsensusStyles')) {
    return;
  }

  const style =
    document.createElement('style');

  style.id =
    'lfConsensusStyles';

  style.textContent = `
    .consensus-summary {
      margin: 12px 0 14px;
      padding: 13px 15px;
      border: 1px solid #27313e;
      border-radius: 12px;
      background: #0a0f16;
    }

    .consensus-summary strong {
      display: block;
      color: #f2f5f8;
      font-size: 13px;
      line-height: 1.45;
    }

    .consensus-summary span {
      display: block;
      margin-top: 4px;
      color: #8e9aaa;
      font-size: 12px;
      line-height: 1.45;
    }

    .consensus-summary.heavy,
    .consensus-summary.strong {
      border-color: rgba(125,242,178,.25);
    }

    .consensus-summary.heavy strong,
    .consensus-summary.strong strong {
      color: #7df2b2;
    }

    .consensus-summary.split {
      border-color: rgba(255,193,93,.25);
    }

    .consensus-summary.split strong {
      color: #ffc15d;
    }

    .consensus-direction {
      font-weight: 800;
      letter-spacing: .02em;
    }

    .analyst-side {
      font-size: 11px;
      font-weight: 800;
      margin-left: 6px;
      color: #7df2b2;
    }

    .analyst-side.under {
      color: #ff9a9a;
    }
  `;

  document.head.appendChild(style);
}


/* ============================================================
   LOAD LINEFOUNDRY DATA
============================================================ */

async function load() {
  try {
    const [
      signalsResponse,
      expertsResponse,
      resultsResponse
    ] = await Promise.all([
      fetch(
        '/public-signals.json?_=' +
          Date.now(),
        {
          cache: 'no-store'
        }
      ),

      fetch(
        '/analyst-profiles.json?_=' +
          Date.now(),
        {
          cache: 'no-store'
        }
      ),

      fetch(
        '/results-ledger.json?_=' +
          Date.now(),
        {
          cache: 'no-store'
        }
      )
    ]);

    if (!signalsResponse.ok) {
      throw new Error(
        `public-signals.json returned ${signalsResponse.status}`
      );
    }

    if (!expertsResponse.ok) {
      throw new Error(
        `analyst-profiles.json returned ${expertsResponse.status}`
      );
    }

    if (!resultsResponse.ok) {
      throw new Error(
        `results-ledger.json returned ${resultsResponse.status}`
      );
    }

    const signalsData =
      await signalsResponse.json();

    const expertsData =
      await expertsResponse.json();

    const resultsData =
      await resultsResponse.json();

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

      liveUpdatedAt:
        null,

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

    configureConsensusFilter();
    installConsensusStyles();

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


/* ============================================================
   LOAD LIVE RESULTS FROM CLOUDFLARE WORKER
============================================================ */

async function loadLiveResults() {
  try {
    const response =
      await fetch(
        `${WORKER_URL}?_=${Date.now()}`,
        {
          method: 'GET',
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

    (data.results || [])
      .forEach(result => {
        if (result.id) {
          liveResults[result.id] =
            result;
        }
      });

    if (board) {
      board.liveUpdatedAt =
        data.updatedAt ||
        new Date().toISOString();
    }

    render();

    console.log(
      'LineFoundry live results updated:',
      data
    );

  } catch (err) {
    console.error(
      'LineFoundry live data failed:',
      err
    );

    /*
      Worker failure should never
      break the static board.
    */
  }
}


/* ============================================================
   AUTOMATIC LIVE REFRESH
============================================================ */

setInterval(
  loadLiveResults,
  60000
);


/* ============================================================
   GET RESULT
============================================================ */

function getResult(id) {
  const live =
    liveResults[id];

  if (live) {
    return formatLiveResult(live);
  }

  if (!results) {
    return 'PENDING';
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
    'PENDING'
  );
}


/* ============================================================
   FORMAT LIVE RESULT
============================================================ */

function formatLiveResult(result) {
  if (!result) {
    return 'PENDING';
  }

  if (
    result.status ===
      'GAME_NOT_FOUND' ||
    result.status ===
      'MARKET_NOT_FOUND' ||
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
      result.status === 'HIT'
    ) {
      return 'HIT';
    }

    if (
      result.status === 'MISS'
    ) {
      return 'MISS';
    }

    if (
      result.status === 'LIVE'
    ) {
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

  return (
    result.status ||
    'PENDING'
  );
}


/* ============================================================
   RESULT DETAILS
============================================================ */

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


/* ============================================================
   FORMAT NUMBER
============================================================ */

function formatNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return '—';
  }

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);
}


/* ============================================================
   PROP LABEL
============================================================ */

function label(p) {
  const side =
    p.side === 'OVER'
      ? 'OVER'
      : p.side === 'UNDER'
        ? 'UNDER'
        : p.side;

  if (
    p.line === null ||
    p.line === undefined
  ) {
    if (
      p.market === 'Anytime TD'
    ) {
      return `${side} Anytime TD`;
    }

    return `${side} ${p.market}`;
  }

  return `${side} ${formatNumber(
    p.line
  )} ${p.market}`;
}


/* ============================================================
   LIVE STATUS DISPLAY
============================================================ */

function liveStatus(p) {
  const live =
    getResultDetails(p.id);

  if (!live) {
    return '';
  }

  /* Anytime TD */

  if (
    p.market ===
    'Anytime TD'
  ) {
    if (
      live.status === 'HIT'
    ) {
      return `
        <div class="live-stat hit">
          <strong>
            BET HIT
          </strong>

          <span>
            Touchdown recorded
          </span>
        </div>
      `;
    }

    if (
      live.status === 'MISS'
    ) {
      return `
        <div class="live-stat miss">
          <strong>
            BET MISS
          </strong>

          <span>
            No touchdown recorded
          </span>
        </div>
      `;
    }

    if (
      live.status === 'LIVE'
    ) {
      return `
        <div class="live-stat pending">
          <strong>
            LIVE
          </strong>

          <span>
            Game in progress
          </span>
        </div>
      `;
    }

    return '';
  }


  /* Statistical markets */

  if (
    live.status === 'HIT'
  ) {
    return `
      <div class="live-stat hit">
        <strong>
          ${formatNumber(
            live.currentValue
          )}
          — BET HIT
        </strong>

        <span>
          Final result
        </span>
      </div>
    `;
  }


  if (
    live.status === 'MISS'
  ) {
    return `
      <div class="live-stat miss">
        <strong>
          ${formatNumber(
            live.currentValue
          )}
          — BET MISS
        </strong>

        <span>
          Final result
        </span>
      </div>
    `;
  }


  if (
    live.status === 'LIVE'
  ) {
    const needed =
      live.remaining;

    if (
      needed !== null &&
      needed !== undefined
    ) {
      return `
        <div class="live-stat pending">
          <strong>
            LIVE —
            ${formatNumber(
              live.currentValue
            )}
          </strong>

          <span>
            ${formatNumber(
              needed
            )}
            needed
          </span>
        </div>
      `;
    }

    return `
      <div class="live-stat pending">
        <strong>
          LIVE —
          ${formatNumber(
            live.currentValue
          )}
        </strong>
      </div>
    `;
  }

  return '';
}


/* ============================================================
   PROP CARD
============================================================ */

function card(p) {
  const lockedPick =
    locked.includes(p.id);

  const result =
    getResult(p.id);

  const strengthClass =
    String(
      p.consensusStrength ||
        'single'
    ).toLowerCase();

  const disagreementText =
    p.disagreeCount > 0
      ? `${p.agreeCount} ${p.side} experts • ${p.disagreeCount} opposing`
      : `${p.agreeCount} ${p.side} expert${p.agreeCount === 1 ? '' : 's'} • No opposing pick found`;

  const directionPercent =
    p.totalSources > 0
      ? Math.round(
          (
            p.agreeCount /
            p.totalSources
          ) * 100
        )
      : 0;

  const lineText =
    p.lineRange
      ? `Referenced lines: ${p.lineRange}`
      : p.line !== null &&
          p.line !== undefined
        ? `Referenced line: ${formatNumber(p.line)}`
        : 'Anytime touchdown market';

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
          ${p.consensusDisplay}
        </div>

      </div>


      <h3>
        ${p.player} —
        ${label(p)}
      </h3>


      ${liveStatus(p)}


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
            ${p.totalSources}
          </b>

          <span>
            Experts
          </span>
        </div>


        <div class="metric">
          <b>
            ${p.consensusLabel}
          </b>

          <span>
            Strength
          </span>
        </div>

      </div>


      <div class="consensus-summary ${strengthClass}">

        <strong>
          ${disagreementText}
        </strong>

        <span>
          ${directionPercent}% direction consensus
          •
          ${lineText}
        </span>

      </div>


      <div class="analyst-list">

        ${p.analysts
          .map(a => {
            const side =
              normalizeSide(
                a.side
              );

            const sideClass =
              side === 'UNDER'
                ? 'under'
                : '';

            const line =
              a.line !== null &&
              a.line !== undefined
                ? ` ${formatNumber(
                    a.line
                  )}`
                : '';

            return `
              <div>

                <strong>
                  ${a.name}
                </strong>

                <span>
                  ${a.outlet || ''}
                </span>

                <span
                  class="analyst-side ${sideClass}"
                >
                  ${side}${line}
                </span>

                ${
                  a.url
                    ? `
                      <a
                        href="${a.url}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Source ↗
                      </a>
                    `
                    : ''
                }

              </div>
            `;
          })
          .join('')}

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


        ${
          lockedPick
            ? ''
            : `
              <button
                class="secondary-btn"
                onclick="lockPick('${p.id}')"
              >
                Lock Pick
              </button>
            `
        }

      </div>

    </article>
  `;
}


/* ============================================================
   LOCK PICK
============================================================ */

window.lockPick =
  function(id) {
    if (
      locked.includes(id)
    ) {
      return;
    }

    locked.push(id);

    save();

    render();
  };


/* ============================================================
   RENDER
============================================================ */

function render() {
  const props =
    board?.props || [];

  const filter =
    $('#confidenceFilter')
      ?.value ||
    'ALL';

  const filteredProps =
    props.filter(p => {
      if (
        filter === 'ALL'
      ) {
        return true;
      }

      return (
        p.consensusStrength ===
        filter
      );
    });


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


  if ($('#sourceCount2')) {
    $('#sourceCount2').textContent =
      board?.sources?.length ||
      0;
  }


  if ($('#signalCount')) {
    $('#signalCount').textContent =
      props.length;
  }


  if ($('#signalCount2')) {
    $('#signalCount2').textContent =
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


  /* ----------------------------------------------------------
     SOURCE TABLE
  ---------------------------------------------------------- */

  if ($('#sourceRows')) {
    $('#sourceRows').innerHTML =
      (board?.sources || [])
        .map(source => `
          <tr>

            <td>
              <strong>
                ${source.analyst || ''}
              </strong>
            </td>

            <td>
              ${source.outlet || ''}
            </td>

            <td>
              ${Math.round(
                (source.quality || 0) *
                100
              )}/100
            </td>

            <td>
              ${source.verification || ''}
            </td>

            <td>
              ${
                source.url
                  ? `
                    <a
                      href="${source.url}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open source ↗
                    </a>
                  `
                  : ''
              }
            </td>

          </tr>
        `)
        .join('');
  }


  /* ----------------------------------------------------------
     EXPERT TABLE
  ---------------------------------------------------------- */

  const expertList =
    experts?.experts || [];

  if ($('#expertRows')) {
    $('#expertRows').innerHTML =
      expertList
        .map(expert => {
          const tracked =
            expert.tracked ||
            {};

          const wl =
            `${tracked.wins || 0}-${tracked.losses || 0}`;

          const roi =
            expert.roi == null
              ? '—'
              : `${(
                  expert.roi * 100
                ).toFixed(1)}%`;

          const status =
            tracked.picks >= 50
              ? 'RANKED'
              : tracked.picks > 0
                ? 'TRACKING'
                : 'NEW';

          return `
            <tr>

              <td>
                <strong>
                  ${expert.name || ''}
                </strong>
              </td>

              <td>
                ${expert.outlet || ''}
              </td>

              <td>
                ${tracked.picks || 0}
              </td>

              <td>
                ${wl}
              </td>

              <td>
                ${(tracked.units || 0)
                  .toFixed(2)}u
              </td>

              <td>
                ${roi}
              </td>

              <td>
                <span
                  class="status ${status.toLowerCase()}"
                >
                  ${status}
                </span>
              </td>

            </tr>
          `;
        })
        .join('');
  }


  /* ----------------------------------------------------------
     OVERALL RECORD
  ---------------------------------------------------------- */

  const record =
    experts?.record ||
    {};

  if ($('#wins')) {
    $('#wins').textContent =
      record.wins || 0;
  }

  if ($('#losses')) {
    $('#losses').textContent =
      record.losses || 0;
  }

  if ($('#units')) {
    $('#units').textContent =
      `${Number(
        record.units || 0
      ).toFixed(2)}u`;
  }

  if ($('#roi')) {
    $('#roi').textContent =
      record.roi == null
        ? '—'
        : `${(
            record.roi * 100
          ).toFixed(1)}%`;
  }
}


/* ============================================================
   EVENTS
============================================================ */

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
    () => {
      $('#howModal')
        ?.setAttribute(
          'aria-hidden',
          'false'
        );
    }
  );


$('#closeHow')
  ?.addEventListener(
    'click',
    () => {
      $('#howModal')
        ?.setAttribute(
          'aria-hidden',
          'true'
        );
    }
  );


document
  .querySelector(
    '.modal-backdrop'
  )
  ?.addEventListener(
    'click',
    () => {
      $('#howModal')
        ?.setAttribute(
          'aria-hidden',
          'true'
        );
    }
  );


/* ============================================================
   INITIAL LOAD
============================================================ */

installConsensusStyles();

load();
