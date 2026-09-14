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


// ============================================================
// SAVE
// ============================================================

function save() {
  localStorage.setItem(
    'lf_consensus_locked',
    JSON.stringify(locked)
  );
}


// ============================================================
// HELPERS
// ============================================================

function normalizeSide(side) {
  const value = String(side || '')
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


function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}


function formatNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);
}


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// ============================================================
// CONSENSUS ENGINE
// ============================================================

function consensusKey(signal) {
  return [
    normalizeText(signal.player),
    normalizeText(signal.market)
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
// WEEK HELPERS
// ============================================================

function getSignalWeek(signal) {
  if (
    signal.week !== null &&
    signal.week !== undefined &&
    signal.week !== ''
  ) {
    return Number(signal.week);
  }

  return Number(board?.week || 1);
}


function getAvailableWeeks() {
  const weeks = new Set();

  (board?.rawSignals || []).forEach(signal => {
    const week = getSignalWeek(signal);

    if (Number.isFinite(week)) {
      weeks.add(week);
    }
  });

  if (
    board?.week !== null &&
    board?.week !== undefined
  ) {
    weeks.add(Number(board.week));
  }

  return [...weeks].sort((a, b) => a - b);
}


function currentWeek() {
  const weeks = getAvailableWeeks();

  if (!weeks.length) {
    return Number(board?.week || 1);
  }

  return Math.max(...weeks);
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

    const percent =
      total > 0
        ? Math.round((agree / total) * 100)
        : 0;

    const strength =
      consensusStrength(
        total,
        agree,
        disagree
      );

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
          line: signal.line,
          week: getSignalWeek(signal),
          signalId: signal.id
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
            line !== undefined &&
            line !== ''
        )
        .map(Number)
        .filter(Number.isFinite);

    const allLines =
      group
        .map(signal => signal.line)
        .filter(
          line =>
            line !== null &&
            line !== undefined &&
            line !== ''
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

    const weeks =
      [...new Set(
        group.map(signal => getSignalWeek(signal))
      )].sort((a, b) => a - b);

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
        total === 1
          ? `1 ${majoritySide}`
          : `${agree}/${total} ${majoritySide}`,

      confidence:
        consensusLabel(strength),

      rationale:
        rationale,

      weeks:
        weeks,

      week:
        weeks.length
          ? weeks[0]
          : Number(board?.week || 1)
    };
  });
}


// ============================================================
// FILTER UI
// ============================================================

function ensureFilterUI() {
  const cards =
    $('#propCards');

  if (!cards) {
    return;
  }

  let container =
    $('#lfFilters');

  if (!container) {
    container =
      document.createElement('div');

    container.id = 'lfFilters';

    cards.parentNode.insertBefore(
      container,
      cards
    );
  }

  container.innerHTML = `
    <div class="lf-filter-row">

      <div class="lf-filter">
        <label for="lfPlayerSearch">
          Player
        </label>

        <input
          id="lfPlayerSearch"
          type="search"
          placeholder="Search player..."
          autocomplete="off"
        />
      </div>

      <div class="lf-filter">
        <label for="lfWeekFilter">
          Week
        </label>

        <select id="lfWeekFilter">
          <option value="ALL">
            All Weeks
          </option>
        </select>
      </div>

      <div class="lf-filter">
        <label for="lfMarketFilter">
          Market
        </label>

        <select id="lfMarketFilter">
          <option value="ALL">
            All Markets
          </option>
        </select>
      </div>

      <div class="lf-filter">
        <label for="lfOutcomeFilter">
          Outcome
        </label>

        <select id="lfOutcomeFilter">
          <option value="ALL">
            All Outcomes
          </option>
          <option value="PENDING">
            Pending / Live
          </option>
          <option value="HIT">
            Bet Hit
          </option>
          <option value="MISS">
            Bet Miss
          </option>
        </select>
      </div>

      <div class="lf-filter">
        <label for="lfConsensusFilter">
          Consensus
        </label>

        <select id="lfConsensusFilter">
          <option value="ALL">
            All Consensus
          </option>
          <option value="2">
            2+ Experts
          </option>
          <option value="3">
            3+ Experts
          </option>
          <option value="4">
            4+ Experts
          </option>
        </select>
      </div>

      <button
        type="button"
        id="lfClearFilters"
        class="lf-clear-filters"
      >
        Clear
      </button>

    </div>
  `;

  populateFilterOptions();

  $('#lfPlayerSearch')
    ?.addEventListener(
      'input',
      render
    );

  $('#lfWeekFilter')
    ?.addEventListener(
      'change',
      render
    );

  $('#lfMarketFilter')
    ?.addEventListener(
      'change',
      render
    );

  $('#lfOutcomeFilter')
    ?.addEventListener(
      'change',
      render
    );

  $('#lfConsensusFilter')
    ?.addEventListener(
      'change',
      render
    );

  $('#lfClearFilters')
    ?.addEventListener(
      'click',
      () => {
        if ($('#lfPlayerSearch')) {
          $('#lfPlayerSearch').value = '';
        }

        if ($('#lfWeekFilter')) {
          $('#lfWeekFilter').value = 'ALL';
        }

        if ($('#lfMarketFilter')) {
          $('#lfMarketFilter').value = 'ALL';
        }

        if ($('#lfOutcomeFilter')) {
          $('#lfOutcomeFilter').value = 'ALL';
        }

        if ($('#lfConsensusFilter')) {
          $('#lfConsensusFilter').value = 'ALL';
        }

        render();
      }
    );
}


function populateFilterOptions() {
  const weekFilter =
    $('#lfWeekFilter');

  const marketFilter =
    $('#lfMarketFilter');

  if (!weekFilter || !marketFilter) {
    return;
  }

  const currentWeekNumber =
    currentWeek();

  const weeks =
    getAvailableWeeks();

  weekFilter.innerHTML = `
    <option value="ALL">
      All Weeks
    </option>

    ${weeks
      .map(week => `
        <option value="${week}">
          Week ${week}
        </option>
      `)
      .join('')}
  `;

  if (weeks.includes(currentWeekNumber)) {
    weekFilter.value =
      String(currentWeekNumber);
  }

  const markets =
    [...new Set(
      (board?.props || [])
        .map(prop => prop.market)
        .filter(Boolean)
    )]
      .sort(
        (a, b) =>
          String(a).localeCompare(
            String(b)
          )
      );

  marketFilter.innerHTML = `
    <option value="ALL">
      All Markets
    </option>

    ${markets
      .map(market => `
        <option value="${escapeHtml(market)}">
          ${escapeHtml(market)}
        </option>
      `)
      .join('')}
  `;
}


function configureLegacyConfidenceFilter() {
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

  const label =
    parent?.querySelector('label');

  if (label) {
    label.textContent =
      'Consensus Strength';
  }

  filter.addEventListener(
    'change',
    render
  );
}


// ============================================================
// LOAD DATA
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

    ensureFilterUI();

    configureLegacyConfidenceFilter();

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

  const analystIds =
    new Set(
      prop.analysts
        .map(
          analyst =>
            analyst.sourceId
        )
        .filter(Boolean)
    );

  return board.rawSignals
    .filter(signal => {
      if (
        normalizeText(signal.player) !==
        normalizeText(prop.player)
      ) {
        return false;
      }

      if (
        normalizeText(signal.market) !==
        normalizeText(prop.market)
      ) {
        return false;
      }

      if (
        !analystIds.has(signal.sourceId)
      ) {
        return false;
      }

      return true;
    })
    .map(signal => signal.id);
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

  if (hits.length && !misses.length) {
    return 'HIT';
  }

  if (misses.length && !hits.length) {
    return 'MISS';
  }

  if (live) {
    return 'LIVE';
  }

  if (hits.length || misses.length) {
    return 'LIVE';
  }

  return 'PENDING';
}


// ============================================================
// ACTUAL STAT
// ============================================================

function extractActualValue(result) {
  if (!result) {
    return null;
  }

  const possibleValues = [
    result.actual,
    result.actualValue,
    result.value,
    result.stat,
    result.playerStat,
    result.finalStat,
    result.currentStat,
    result.yards,
    result.total
  ];

  for (const value of possibleValues) {
    if (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  return null;
}


function getActualValue(prop) {
  const matches =
    getLiveMatches(prop);

  if (!matches.length) {
    return null;
  }

  const values =
    matches
      .map(extractActualValue)
      .filter(
        value =>
          value !== null &&
          value !== undefined
      );

  if (!values.length) {
    return null;
  }

  /*
   * Consensus picks represent one underlying player prop.
   * When multiple analysts have the same prop, they should
   * display the same actual player statistic rather than
   * showing a count of results.
   */
  return values[0];
}


function marketActualLabel(market) {
  const value =
    normalizeText(market);

  if (
    value.includes('receiving') ||
    value.includes('rushing') ||
    value.includes('passing')
  ) {
    return 'YARDS ACTUAL';
  }

  if (
    value.includes('reception')
  ) {
    return 'RECEPTIONS ACTUAL';
  }

  if (
    value.includes('attempt')
  ) {
    return 'ATTEMPTS ACTUAL';
  }

  if (
    value.includes('interception')
  ) {
    return 'INTERCEPTIONS ACTUAL';
  }

  if (
    value.includes('touchdown')
  ) {
    return 'TOUCHDOWNS ACTUAL';
  }

  return 'ACTUAL';
}


// ============================================================
// RESULT DISPLAY
// ============================================================

function liveStatus(prop) {
  const result =
    getResult(prop);

  const actual =
    getActualValue(prop);

  if (result === 'HIT') {
    return `
      <div class="live-stat hit">
        <strong>
          BET HIT
        </strong>

        ${
          actual !== null
            ? `
              <span class="actual-stat">
                ${formatNumber(actual)}
                ${marketActualLabel(prop.market)}
              </span>
            `
            : ''
        }
      </div>
    `;
  }

  if (result === 'MISS') {
    return `
      <div class="live-stat miss">
        <strong>
          BET MISS
        </strong>

        ${
          actual !== null
            ? `
              <span class="actual-stat">
                ${formatNumber(actual)}
                ${marketActualLabel(prop.market)}
              </span>
            `
            : ''
        }
      </div>
    `;
  }

  if (result === 'LIVE') {
    return `
      <div class="live-stat pending">
        <strong>
          LIVE
        </strong>

        ${
          actual !== null
            ? `
              <span class="actual-stat">
                ${formatNumber(actual)}
                ${marketActualLabel(prop.market)}
              </span>
            `
            : ''
        }
      </div>
    `;
  }

  return `
    <div class="live-stat pending">
      <strong>
        PENDING
      </strong>
    </div>
  `;
}


// ============================================================
// FILTER LOGIC
// ============================================================

function propMatchesFilters(prop) {
  const playerSearch =
    normalizeText(
      $('#lfPlayerSearch')?.value
    );

  const weekFilter =
    $('#lfWeekFilter')?.value ||
    'ALL';

  const marketFilter =
    $('#lfMarketFilter')?.value ||
    'ALL';

  const outcomeFilter =
    $('#lfOutcomeFilter')?.value ||
    'ALL';

  const consensusFilter =
    $('#lfConsensusFilter')?.value ||
    'ALL';

  const legacyFilter =
    $('#confidenceFilter')?.value ||
    'ALL';

  if (
    playerSearch &&
    !normalizeText(prop.player)
      .includes(playerSearch)
  ) {
    return false;
  }

  if (
    marketFilter !== 'ALL' &&
    String(prop.market) !==
      String(marketFilter)
  ) {
    return false;
  }

  if (weekFilter !== 'ALL') {
    const week =
      Number(weekFilter);

    if (
      !prop.weeks.includes(week)
    ) {
      return false;
    }
  }

  const outcome =
    getResult(prop);

  if (outcomeFilter === 'HIT') {
    if (outcome !== 'HIT') {
      return false;
    }
  }

  if (outcomeFilter === 'MISS') {
    if (outcome !== 'MISS') {
      return false;
    }
  }

  if (outcomeFilter === 'PENDING') {
    if (
      outcome !== 'PENDING' &&
      outcome !== 'LIVE'
    ) {
      return false;
    }
  }

  if (consensusFilter !== 'ALL') {
    const minimum =
      Number(consensusFilter);

    if (
      prop.experts < minimum
    ) {
      return false;
    }
  }

  if (
    legacyFilter !== 'ALL' &&
    prop.consensusStrength !==
      legacyFilter
  ) {
    return false;
  }

  return true;
}


// ============================================================
// SORT
// ============================================================

function sortProps(props) {
  return [...props].sort(
    (a, b) => {

      /*
       * Primary:
       * most experts first
       */
      if (
        b.experts !==
        a.experts
      ) {
        return (
          b.experts -
          a.experts
        );
      }

      /*
       * Secondary:
       * strongest direction consensus
       */
      if (
        b.percent !==
        a.percent
      ) {
        return (
          b.percent -
          a.percent
        );
      }

      /*
       * Tertiary:
       * player name
       */
      return String(a.player)
        .localeCompare(
          String(b.player)
        );
    }
  );
}


// ============================================================
// CARD
// ============================================================

function card(prop) {
  const lockedPick =
    locked.includes(prop.id);

  const sideClass =
    prop.side === 'UNDER'
      ? 'consensus-under'
      : 'consensus-over';

  const analysts =
    prop.analysts
      .map(analyst => `
        <div class="analyst-source">

          <strong>
            ${escapeHtml(
              analyst.name
            )}
          </strong>

          <span>
            ${escapeHtml(
              analyst.outlet || ''
            )}
            —
            ${escapeHtml(
              analyst.side || ''
            )}

            ${
              analyst.line !== null &&
              analyst.line !== undefined
                ? `
                  ${formatNumber(
                    analyst.line
                  )}
                `
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
      `)
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
          NFL • WEEK ${prop.week}
        </div>

        <div class="grade">
          ${escapeHtml(
            prop.consensusDisplay
          )}
        </div>

      </div>


      <h3>

        ${escapeHtml(
          prop.player
        )}

        —

        <span
          class="${sideClass}"
        >
          ${escapeHtml(
            prop.side
          )}
        </span>

        ${
          prop.line !== null &&
          prop.line !== undefined
            ? `
              ${formatNumber(
                prop.line
              )}
            `
            : ''
        }

        ${escapeHtml(
          prop.market
        )}

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
            ${prop.percent}%
          </b>

          <span>
            Consensus
          </span>

        </div>

      </div>


      <div class="consensus-summary">

        <strong>

          ${prop.agree}

          ${escapeHtml(
            prop.side
          )}

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
                ${escapeHtml(
                  prop.lineDisplay
                )}
              `
              : ''
          }

        </span>

      </div>


      <div class="analyst-list">

        ${analysts}

      </div>


      <p class="why">

        ${escapeHtml(
          prop.rationale
        )}

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
// WEEK SUMMARY
// ============================================================

function weekSummary(props) {
  const hits =
    props.filter(
      prop =>
        getResult(prop) === 'HIT'
    ).length;

  const misses =
    props.filter(
      prop =>
        getResult(prop) === 'MISS'
    ).length;

  const live =
    props.filter(
      prop =>
        getResult(prop) === 'LIVE'
    ).length;

  const pending =
    props.filter(
      prop =>
        getResult(prop) === 'PENDING'
    ).length;

  const settled =
    hits + misses;

  const percentage =
    settled > 0
      ? Math.round(
          (hits / settled) * 100
        )
      : null;

  return `
    <span class="lf-week-summary">

      ${props.length}
      pick${props.length === 1 ? '' : 's'}

      ${
        settled
          ? ` • ${hits} hit${hits === 1 ? '' : 's'}`
          : ''
      }

      ${
        misses
          ? ` • ${misses} miss${misses === 1 ? '' : 'es'}`
          : ''
      }

      ${
        live
          ? ` • ${live} live`
          : ''
      }

      ${
        pending
          ? ` • ${pending} pending`
          : ''
      }

      ${
        percentage !== null
          ? ` • ${percentage}%`
          : ''
      }

    </span>
  `;
}


// ============================================================
// WEEK SECTION
// ============================================================

function weekSection(
  week,
  props,
  expanded
) {
  const sorted =
    sortProps(props);

  const status =
    Number(week) ===
    currentWeek()
      ? 'CURRENT'
      : (
        props.some(
          prop =>
            getResult(prop) ===
            'PENDING' ||
            getResult(prop) ===
            'LIVE'
        )
          ? 'IN PROGRESS'
          : 'COMPLETE'
      );

  return `
    <details
      class="lf-week-section"
      data-week="${week}"
      ${expanded ? 'open' : ''}
    >

      <summary>

        <div class="lf-week-heading">

          <strong>
            WEEK ${week}
          </strong>

          <span class="lf-week-status">
            ${status}
          </span>

          ${weekSummary(props)}

        </div>

      </summary>


      <div class="cards lf-week-cards">

        ${sorted
          .map(card)
          .join('')}

      </div>

    </details>
  `;
}


// ============================================================
// RENDER
// ============================================================

function render() {
  if (!board) {
    return;
  }

  ensureFilterUI();

  const allProps =
    board.props || [];

  const filteredProps =
    allProps.filter(
      prop =>
        propMatchesFilters(prop)
    );

  const sorted =
    sortProps(filteredProps);

  /*
   * Determine which weeks should be displayed.
   *
   * If the Week filter is set to a specific week,
   * only that week is rendered.
   *
   * Otherwise all available weeks are grouped.
   */
  const weekFilter =
    $('#lfWeekFilter')?.value ||
    'ALL';

  let weeks =
    getAvailableWeeks();

  if (weekFilter !== 'ALL') {
    weeks =
      weeks.filter(
        week =>
          String(week) ===
          String(weekFilter)
      );
  }

  const container =
    $('#propCards');

  if (container) {

    if (!sorted.length) {
      container.innerHTML = `
        <div class="empty-state">

          <h3>
            No picks match your filters
          </h3>

          <p>
            Try clearing a filter or searching for another player.
          </p>

        </div>
      `;
    }
    else {

      const sections =
        weeks
          .map(week => {

            const weekProps =
              sorted.filter(
                prop =>
                  prop.weeks.includes(
                    Number(week)
                  )
              );

            if (!weekProps.length) {
              return '';
            }

            /*
             * Current week is open by default.
             * If the user explicitly selected a week,
             * that selected week opens.
             */
            const expanded =
              weekFilter !== 'ALL'
                ? true
                : Number(week) ===
                  currentWeek();

            return weekSection(
              week,
              weekProps,
              expanded
            );
          })
          .filter(Boolean)
          .join('');

      container.innerHTML =
        sections;
    }
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
      allProps.length;
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


  renderSources();

  renderExperts();

  renderRecord();
}


// ============================================================
// SOURCE TABLE
// ============================================================

function renderSources() {
  if (!$('#sourceRows')) {
    return;
  }

  $('#sourceRows').innerHTML =
    (board?.sources || [])
      .map(source => `
        <tr>

          <td>
            <strong>
              ${escapeHtml(
                source.analyst
              )}
            </strong>
          </td>

          <td>
            ${escapeHtml(
              source.outlet
            )}
          </td>

          <td>
            ${Math.round(
              (source.quality || 0) *
              100
            )}/100
          </td>

          <td>
            ${escapeHtml(
              source.verification
            )}
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


// ============================================================
// EXPERT TABLE
// ============================================================

function renderExperts() {
  const expertList =
    experts?.experts || [];

  if (!$('#expertRows')) {
    return;
  }

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
                ${escapeHtml(
                  expert.name
                )}
              </strong>
            </td>

            <td>
              ${escapeHtml(
                expert.outlet
              )}
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


// ============================================================
// OVERALL RECORD
// ============================================================

function renderRecord() {
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
