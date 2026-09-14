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
  const value =
    String(side || '')
      .trim()
      .toUpperCase();

  if (value === 'YES' || value === 'OVER') {
    return 'OVER';
  }

  if (value === 'NO' || value === 'UNDER') {
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
  const labels = {
    HEAVY: 'HEAVY',
    STRONG: 'STRONG',
    MODERATE: 'MODERATE',
    EMERGING: 'EMERGING',
    SINGLE: 'SINGLE SOURCE',
    SPLIT: 'SPLIT'
  };

  return labels[strength] || strength;
}


// ============================================================
// BUILD CONSENSUS CARDS
// ============================================================

function buildConsensusProps(
  signals,
  sources
) {
  const groups = new Map();

  signals.forEach(signal => {
    const key = consensusKey(signal);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(signal);
  });

  return Array.from(groups.values()).map(group => {

    const first = group[0];

    const overSignals =
      group.filter(
        signal =>
          normalizeSide(signal.side) === 'OVER'
      );

    const underSignals =
      group.filter(
        signal =>
          normalizeSide(signal.side) === 'UNDER'
      );

    const over = overSignals.length;
    const under = underSignals.length;

    const total = group.length;

    let majoritySide;
    let agree;
    let disagree;

    if (over > under) {
      majoritySide = 'OVER';
      agree = over;
      disagree = under;
    }
    else if (under > over) {
      majoritySide = 'UNDER';
      agree = under;
      disagree = over;
    }
    else {
      majoritySide =
        normalizeSide(first.side);

      agree = over;
      disagree = under;
    }

    const strength =
      consensusStrength(
        total,
        agree,
        disagree
      );

    const percent =
      total > 0
        ? Math.round(
            (agree / total) * 100
          )
        : 0;

    const analysts =
      group.map(signal => {

        const source =
          sources.find(
            item =>
              item.id === signal.sourceId
          );

        return {
          name: signal.analyst,
          outlet: source?.outlet || '',
          sourceId: signal.sourceId,
          url: source?.url || '',
          note: signal.note || '',
          side: normalizeSide(signal.side),
          line: signal.line
        };
      });

    const majoritySignals =
      group.filter(
        signal =>
          normalizeSide(signal.side) ===
          majoritySide
      );

    const majorityLines =
      majoritySignals
        .map(signal => signal.line)
        .filter(
          line =>
            line !== null &&
            line !== undefined
        )
        .map(Number)
        .filter(Number.isFinite);

    const allLines =
      group
        .map(signal => signal.line)
        .filter(
          line =>
            line !== null &&
            line !== undefined
        )
        .map(Number)
        .filter(Number.isFinite);

    const uniqueLines =
      [...new Set(allLines)]
        .sort((a, b) => a - b);

    let line =
      majorityLines.length
        ? majorityLines[0]
        : first.line;

    let lineDisplay = '';

    if (uniqueLines.length === 1) {
      lineDisplay =
        String(uniqueLines[0]);
    }
    else if (uniqueLines.length > 1) {
      lineDisplay =
        `${uniqueLines[0]}–${uniqueLines[uniqueLines.length - 1]}`;
    }

    let consensusDisplay;

    if (total === 1) {
      consensusDisplay =
        `1 ${majoritySide}`;
    }
    else {
      consensusDisplay =
        `${agree}/${total} ${majoritySide}`;
    }

    let rationale;

    if (total === 1) {

      rationale =
        'One tracked source currently supports this direction; treat it as an early signal until more sources agree.';

    }
    else if (over === under) {

      rationale =
        `${over} OVER expert${over === 1 ? '' : 's'} and ${under} UNDER expert${under === 1 ? '' : 's'} — the sources are split.`;

    }
    else {

      rationale =
        `${agree} ${majoritySide} expert${agree === 1 ? '' : 's'} • ${disagree} opposing expert${disagree === 1 ? '' : 's'} • ${percent}% direction consensus.`;

    }

    return {

      id:
        `CONS-${group
          .map(signal => signal.id)
          .join('-')}`,

      player:
        first.player,

      market:
        first.market,

      side:
        majoritySide,

      line:
        line,

      lineDisplay:
        lineDisplay,

      analyst:
        majoritySignals[0]?.analyst ||
        first.analyst,

      analysts:
        analysts,

      analystCount:
        total,

      experts:
        total,

      agree:
        agree,

      disagree:
        disagree,

      percent:
        percent,

      consensusScore:
        percent,

      consensusStrength:
        strength,

      consensusDisplay:
        consensusDisplay,

      confidence:
        consensusLabel(strength),

      rationale:
        rationale
    };
  });
}


// ============================================================
// CONSENSUS FILTER
// ============================================================

function configureConsensusFilter() {

  const filter =
    $('#confidenceFilter');

  if (!filter) {
    return;
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

  const parent =
    filter.parentElement;

  if (!parent) {
    return;
  }

  const label =
    parent.querySelector('label');

  if (label) {
    label.textContent =
      'Consensus Strength';
  }
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
    ] =
      await Promise.all([

        fetch(
          '/public-signals.json',
          {
            cache: 'no-store'
          }
        ).then(response => {

          if (!response.ok) {
            throw new Error(
              'Could not load public-signals.json'
            );
          }

          return response.json();
        }),

        fetch(
          '/analyst-profiles.json',
          {
            cache: 'no-store'
          }
        ).then(response => {

          if (!response.ok) {
            throw new Error(
              'Could not load analyst-profiles.json'
            );
          }

          return response.json();
        }),

        fetch(
          '/results-ledger.json',
          {
            cache: 'no-store'
          }
        ).then(response => {

          if (!response.ok) {
            throw new Error(
              'Could not load results-ledger.json'
            );
          }

          return response.json();
        })

      ]);

    const signals =
      signalsData.signals || [];

    const sources =
      signalsData.sources || [];

    board = {

      mode:
        'public-consensus',

      week:
        signalsData.week,

      season:
        signalsData.season,

      refreshedAt:
        new Date().toISOString(),

      sources:
        sources,

      rawSignals:
        signals,

      props:
        buildConsensusProps(
          signals,
          sources
        )
    };

    experts =
      expertsData;

    results =
      resultsData;

    configureConsensusFilter();

    render();

    await loadLiveResults();

  }
  catch (error) {

    console.error(
      'LineFoundry data load failed:',
      error
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

      render();
    }

    console.log(
      'LineFoundry live results updated:',
      data
    );

  }
  catch (error) {

    console.error(
      'LineFoundry live data failed:',
      error
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
// RESULT HELPERS
// ============================================================

function getSignalIdsForProp(prop) {

  if (!board?.rawSignals) {
    return [];
  }

  return board.rawSignals
    .filter(signal => {

      if (
        signal.player !== prop.player
      ) {
        return false;
      }

      if (
        signal.market !== prop.market
      ) {
        return false;
      }

      return prop.analysts.some(
        analyst =>
          analyst.sourceId ===
          signal.sourceId
      );
    })
    .map(
      signal => signal.id
    );
}


function getLiveMatches(prop) {

  return getSignalIdsForProp(prop)
    .map(
      id =>
        liveResults[id]
    )
    .filter(Boolean);
}


function getResult(prop) {

  const matches =
    getLiveMatches(prop);

  if (!matches.length) {
    return 'PENDING';
  }

  const hits =
    matches.filter(
      result =>
        result.status === 'HIT'
    ).length;

  const misses =
    matches.filter(
      result =>
        result.status === 'MISS'
    ).length;

  if (
    hits &&
    !misses
  ) {
    return 'HIT';
  }

  if (
    misses &&
    !hits
  ) {
    return 'MISS';
  }

  if (
    hits ||
    misses
  ) {
    return `${hits} HIT • ${misses} MISS`;
  }

  return 'LIVE';
}


function getResultDetails(prop) {

  const matches =
    getLiveMatches(prop);

  if (!matches.length) {
    return null;
  }

  return matches;
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

  return Number.isInteger(
    Number(value)
  )
    ? String(value)
    : Number(value).toFixed(1);
}


// ============================================================
// LIVE STATUS
// ============================================================

function liveStatus(prop) {

  const matches =
    getResultDetails(prop);

  if (!matches?.length) {
    return '';
  }

  const hits =
    matches.filter(
      result =>
        result.status === 'HIT'
    );

  const misses =
    matches.filter(
      result =>
        result.status === 'MISS'
    );

  const live =
    matches.find(
      result =>
        result.status === 'LIVE'
    );

  if (
    hits.length &&
    !misses.length
  ) {

    return `
      <div class="live-stat hit">
        <strong>
          ${hits.length}
          BET${hits.length === 1 ? '' : 'S'}
          HIT
        </strong>
      </div>
    `;
  }

  if (
    misses.length &&
    !hits.length
  ) {

    return `
      <div class="live-stat miss">
        <strong>
          ${misses.length}
          BET${misses.length === 1 ? '' : 'S'}
          MISS
        </strong>
      </div>
    `;
  }

  if (live) {

    return `
      <div class="live-stat pending">
        <strong>
          LIVE
        </strong>
      </div>
    `;
  }

  return `
    <div class="live-stat pending">
      <strong>
        ${hits.length} HIT •
        ${misses.length} MISS
      </strong>
    </div>
  `;
}


// ============================================================
// CARD
// ============================================================

function card(prop) {

  const lockedPick =
    locked.includes(prop.id);

  const result =
    getResult(prop);

  const sideClass =
    prop.side === 'UNDER'
      ? 'consensus-under'
      : 'consensus-over';

  const analysts =
    prop.analysts
      .map(analyst => {

        return `
          <div>

            <strong>
              ${analyst.name}
            </strong>

            <span>
              ${analyst.outlet || ''}
              —
              ${analyst.side || ''}
              ${
                analyst.line !== null &&
                analyst.line !== undefined
                  ? ` ${analyst.line}`
                  : ''
              }
            </span>

            ${
              analyst.url
                ? `
                  <a
                    href="${analyst.url}"
                    target="_blank"
                    rel="noopener"
                  >
                    Source ↗
                  </a>
                `
                : ''
            }

          </div>
        `;

      })
      .join('');

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
          NFL • WEEK ${board.week}
        </div>

        <div class="grade">
          ${prop.consensusDisplay}
        </div>

      </div>


      <h3>

        ${prop.player}

        —

        <span
          class="${sideClass}"
        >
          ${prop.side}
        </span>

        ${
          prop.line !== null &&
          prop.line !== undefined
            ? ` ${prop.line}`
            : ''
        }

        ${prop.market}

      </h3>


      ${liveStatus(prop)}


      <div class="metrics">

        <div class="metric">

          <b>
            ${prop.agree}
          </b>

          <span>
            Agree
          </span>

        </div>


        <div class="metric">

          <b>
            ${prop.disagree}
          </b>

          <span>
            Disagree
          </span>

        </div>


        <div class="metric">

          <b>
            ${prop.experts}
          </b>

          <span>
            Experts
          </span>

        </div>


        <div class="metric">

          <b>
            ${consensusLabel(
              prop.consensusStrength
            )}
          </b>

          <span>
            Strength
          </span>

        </div>

      </div>


      <div class="consensus-summary">

        <strong>

          ${prop.agree}

          ${prop.side}

          expert${prop.agree === 1 ? '' : 's'}

          ${
            prop.disagree > 0
              ? `
                •
                ${prop.disagree}
                ${
                  prop.side === 'OVER'
                    ? 'UNDER'
                    : 'OVER'
                }
                expert${
                  prop.disagree === 1
                    ? ''
                    : 's'
                }
              `
              : `
                • No opposing pick found
              `
          }

        </strong>


        <span>

          ${
            prop.experts === 1
              ? 'Single-source signal'
              : `${prop.percent}% direction consensus`
          }

          ${
            prop.lineDisplay
              ? `
                • Published line${
                  prop.lineDisplay.includes('–')
                    ? ' range'
                    : ''
                }:
                ${prop.lineDisplay}
              `
              : ''
          }

        </span>

      </div>


      <div class="analyst-list">

        ${analysts}

      </div>


      <p class="why">

        ${prop.rationale}

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
    props.filter(prop => {

      return (
        filter === 'ALL' ||
        prop.consensusStrength ===
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
        .map(source => `

          <tr>

            <td>
              <strong>
                ${source.analyst}
              </strong>
            </td>

            <td>
              ${source.outlet}
            </td>

            <td>
              ${Math.round(
                (source.quality || 0) *
                100
              )}/100
            </td>

            <td>
              ${source.verification}
            </td>

            <td>

              ${
                source.url
                  ? `
                    <a
                      href="${source.url}"
                      target="_blank"
                      rel="noopener"
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


  const expertList =
    experts?.experts || [];


  if ($('#expertRows')) {

    $('#expertRows').innerHTML =

      expertList
        .map(expert => {

          const tracked =
            expert.tracked || {};

          const wins =
            tracked.wins || 0;

          const losses =
            tracked.losses || 0;

          const picks =
            tracked.picks || 0;

          const units =
            Number(
              tracked.units || 0
            );

          const roi =
            expert.roi == null
              ? '—'
              : `${(
                  expert.roi * 100
                ).toFixed(1)}%`;

          const status =
            picks >= 50
              ? 'RANKED'
              : picks > 0
                ? 'TRACKING'
                : 'NEW';

          return `

            <tr>

              <td>
                <strong>
                  ${expert.name}
                </strong>
              </td>

              <td>
                ${expert.outlet}
              </td>

              <td>
                ${picks}
              </td>

              <td>
                ${wins}-${losses}
              </td>

              <td>
                ${units.toFixed(2)}u
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


  const record =
    experts?.record || {};


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


// ============================================================
// INITIAL LOAD
// ============================================================

load();

setTimeout(
  loadLiveResults,
  1500
);
