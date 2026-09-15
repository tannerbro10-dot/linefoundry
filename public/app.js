// ============================================================
// LINEFOUNDRY APP
// ============================================================

let board = null;
let experts = null;
let results = null;

let liveResults = {};
let marketData = [];
let marketResults = {};

const WORKER_URL =
  'https://old-mouse-660a.tannerbro10.workers.dev/';

const SIGNALS_URL =
  '/public-signals.json';

const EXPERTS_URL =
  '/analyst-profiles.json';

const RESULTS_URL =
  '/results-ledger.json';

const MARKET_DATA_URL =
  'https://raw.githubusercontent.com/tannerbro10-dot/linefoundry/main/market-data.json';

let locked = JSON.parse(
  localStorage.getItem('lf_consensus_locked') || '[]'
);

const $ = selector =>
  document.querySelector(selector);


// ============================================================
// BASIC HELPERS
// ============================================================

function escapeHtml(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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


function save() {
  localStorage.setItem(
    'lf_consensus_locked',
    JSON.stringify(locked)
  );
}


function normalizeWeek(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return 1;
  }

  const match =
    String(value).match(/\d+/);

  return match
    ? Number(match[0])
    : Number(value) || 1;
}


function currentWeek() {
  // Week 1 remains current through Monday Night Football.
  const now = new Date();

  const kickoff =
    new Date(
      '2026-09-15T00:15:00Z'
    );

  if (now <= kickoff) {
    return 1;
  }

  return 2;
}


// ============================================================
// CSS SAFETY NET
// ============================================================
// This restores the original .prop/.cards styling even if
// an older stylesheet is cached or missing the newer rules.
// ============================================================

function injectBoardStyles() {

  if ($('#linefoundryBoardStyles')) {
    return;
  }

  const style =
    document.createElement('style');

  style.id =
    'linefoundryBoardStyles';

  style.textContent = `

    /* =========================
       EXPERT BOARD
       ========================= */

    #propCards {
      width: 100%;
    }

    .lf-week-section {
      width: 100%;
      margin: 0 0 22px;
      border: 1px solid rgba(120,150,175,.20);
      border-radius: 14px;
      background: rgba(10,16,22,.55);
      overflow: hidden;
    }

    .lf-week-section > summary {
      list-style: none;
      cursor: pointer;
      padding: 20px 22px;
      background: rgba(17,25,34,.78);
      border-bottom: 1px solid rgba(120,150,175,.12);
    }

    .lf-week-section > summary::-webkit-details-marker {
      display: none;
    }

    .lf-week-heading {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .lf-week-heading strong {
      font-size: 19px;
      letter-spacing: .04em;
    }

    .lf-week-status {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .10em;
      padding: 5px 9px;
      border-radius: 999px;
      background: rgba(109,240,177,.10);
      color: #75efb4;
    }

    /* EXPERT BOARD — FULL WIDTH */
#propCards,
#propCards .lf-week-section,
#propCards .lf-week-cards,
#propCards .cards {
  width: 100%;
  max-width: none;
  box-sizing: border-box;
}

#propCards .cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

#propCards .prop {
  width: 100%;
  max-width: none;
  box-sizing: border-box;
}

    .lf-week-summary {
      margin-left: auto;
      color: #8193a7;
      font-size: 12px;
    }

  .lf-week-cards {
  padding: 22px;
}
   .cards {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

    .prop {
      min-width: 0;
      padding: 22px;
      border-radius: 14px;
      border: 1px solid rgba(120,150,175,.20);
      background:
        linear-gradient(
          145deg,
          rgba(18,28,38,.96),
          rgba(9,15,21,.96)
        );
      box-shadow:
        0 14px 35px rgba(0,0,0,.18);
    }

    .prop:hover {
      border-color:
        rgba(117,239,180,.32);
    }

    .prop.locked {
      border-color:
        rgba(117,239,180,.28);
    }

    .prop-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 15px;
    }

    .prop-top .game {
      color: #7f91a4;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .10em;
    }

    .grade {
      color: #75efb4;
      font-size: 11px;
      font-weight: 800;
    }

    .prop h3 {
      margin: 0 0 15px;
      font-size: 21px;
      line-height: 1.25;
      color: #f3f7fb;
    }

    .consensus-over {
      color: #75efb4;
    }

    .consensus-under {
      color: #ff9c9c;
    }

    .metrics {
      display: grid;
      grid-template-columns:
        repeat(4, minmax(0,1fr));
      gap: 8px;
      margin: 16px 0;
    }

    .metric {
      padding: 11px 8px;
      text-align: center;
      border-radius: 9px;
      background: rgba(255,255,255,.035);
      border: 1px solid rgba(255,255,255,.055);
    }

    .metric b {
      display: block;
      color: #eef5fb;
      font-size: 15px;
      margin-bottom: 4px;
    }

    .metric span {
      display: block;
      color: #73879b;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    .consensus-summary {
      padding: 13px 15px;
      margin: 14px 0;
      border-radius: 10px;
      background: rgba(117,239,180,.055);
      border: 1px solid rgba(117,239,180,.10);
    }

    .consensus-summary strong {
      display: block;
      color: #dce8f1;
      font-size: 13px;
      margin-bottom: 5px;
    }

    .consensus-summary span {
      color: #8093a7;
      font-size: 11px;
    }

    .analyst-list {
      display: grid;
      gap: 8px;
      margin-top: 15px;
    }

    .analyst-source {
      display: grid;
      grid-template-columns:
        minmax(120px,auto)
        1fr
        auto;
      align-items: center;
      gap: 8px;
      padding: 10px 11px;
      border-radius: 8px;
      background: rgba(255,255,255,.025);
    }

    .analyst-source strong {
      color: #e9f1f7;
      font-size: 12px;
    }

    .analyst-source span {
      color: #75899d;
      font-size: 11px;
    }

    .analyst-source a {
      color: #75efb4;
      font-size: 10px;
      text-decoration: none;
      white-space: nowrap;
    }

    .why {
      color: #8497aa;
      font-size: 12px;
      line-height: 1.55;
      margin: 16px 0;
    }

    .card-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,.055);
    }

    .lock-status {
      color: #7e91a5;
      font-size: 11px;
    }

    .live-stat {
      margin: 10px 0 15px;
      padding: 13px 15px;
      border-radius: 9px;
      background: rgba(117,239,180,.07);
      border: 1px solid rgba(117,239,180,.15);
    }

    .live-stat strong {
      display: block;
      color: #75efb4;
      font-size: 13px;
    }

    .live-stat span {
      display: block;
      margin-top: 4px;
      color: #7f92a5;
      font-size: 11px;
    }

    .lf-empty {
      grid-column: 1 / -1;
      padding: 45px;
      text-align: center;
      border: 1px dashed rgba(120,150,175,.25);
      border-radius: 14px;
      color: #7f92a5;
    }

    /* =========================
       MARKET
       ========================= */

    #lfMarketSection {
      margin-top: 75px;
    }

    .lf-market-toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin: 22px 0;
    }

    .lf-market-toolbar input,
    .lf-market-toolbar select {
      min-height: 42px;
      border-radius: 9px;
      border: 1px solid rgba(120,150,175,.20);
      background: rgba(13,20,27,.9);
      color: #eaf1f6;
      padding: 0 13px;
      outline: none;
    }

    .lf-market-toolbar input {
      flex: 1;
    }

    .lf-market-grid {
      display: grid;
      grid-template-columns:
        repeat(3, minmax(0,1fr));
      gap: 16px;
    }

    .lf-market-card {
      padding: 20px;
      border-radius: 13px;
      border: 1px solid rgba(120,150,175,.18);
      background:
        linear-gradient(
          145deg,
          rgba(17,26,35,.95),
          rgba(9,15,21,.95)
        );
    }

    .lf-market-card:hover {
      border-color:
        rgba(117,239,180,.30);
    }

    .lf-market-player {
      color: #f2f7fb;
      font-size: 16px;
      font-weight: 800;
      margin-bottom: 5px;
    }

    .lf-market-game {
      color: #74879a;
      font-size: 10px;
      margin-bottom: 17px;
    }

    .lf-market-type {
      color: #8ea1b3;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .10em;
      font-weight: 800;
    }

    .lf-market-line {
      margin: 6px 0 8px;
      color: #f5f9fc;
      font-size: 34px;
      line-height: 1;
      font-weight: 800;
    }

    .lf-market-odds {
      display: flex;
      gap: 15px;
      color: #b9c8d5;
      font-size: 12px;
    }

    .lf-market-odds .over {
      color: #75efb4;
    }

    .lf-market-odds .under {
      color: #ff9c9c;
    }

    .lf-market-best {
      margin-top: 16px;
      color: #7f92a5;
      font-size: 10px;
    }

    .lf-market-result {
      margin-top: 13px;
      padding: 10px 11px;
      border-radius: 8px;
      background: rgba(117,239,180,.055);
      color: #75efb4;
      font-size: 11px;
      font-weight: 800;
    }

    .lf-market-result.pending {
      color: #7f92a5;
      background: rgba(255,255,255,.035);
    }

    .lf-market-details {
      display: inline-block;
      margin-top: 16px;
      color: #75efb4;
      font-size: 11px;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    /* =========================
       MARKET MODAL
       ========================= */

    .lf-market-modal {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 25px;
    }

    .lf-market-modal.open {
      display: flex;
    }

    .lf-market-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,.72);
      backdrop-filter: blur(5px);
    }

    .lf-market-panel {
      position: relative;
      width: min(760px, 100%);
      max-height: 85vh;
      overflow-y: auto;
      padding: 28px;
      border-radius: 16px;
      border: 1px solid rgba(120,150,175,.25);
      background: #0c141c;
      box-shadow: 0 25px 80px rgba(0,0,0,.55);
    }

    .lf-market-close {
      position: absolute;
      top: 16px;
      right: 18px;
      border: 0;
      background: transparent;
      color: #8da0b2;
      font-size: 25px;
      cursor: pointer;
    }

    .lf-market-panel h2 {
      margin: 0 0 6px;
    }

    .lf-market-panel .market-subtitle {
      color: #7f92a5;
      font-size: 12px;
      margin-bottom: 24px;
    }

    .lf-detail-section {
      margin-top: 24px;
    }

    .lf-detail-section h3 {
      color: #75efb4;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .10em;
      margin-bottom: 10px;
    }

    .lf-book-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      padding: 11px 0;
      border-bottom: 1px solid rgba(255,255,255,.055);
      font-size: 12px;
    }

    .lf-book-row strong {
      color: #eaf1f6;
    }

    .lf-book-row span {
      color: #8b9eaf;
    }

    .lf-movement {
      display: grid;
      grid-template-columns:
        repeat(3,1fr);
      gap: 10px;
    }

    .lf-movement div {
      padding: 13px;
      border-radius: 9px;
      background: rgba(255,255,255,.035);
    }

    .lf-movement b {
      display: block;
      color: #edf4f8;
      margin-bottom: 4px;
    }

    .lf-movement span {
      color: #7d90a3;
      font-size: 11px;
    }

    @media (max-width: 1000px) {
      .lf-market-grid {
        grid-template-columns:
          repeat(2,minmax(0,1fr));
      }
    }

    @media (max-width: 760px) {
      .cards,
      .lf-market-grid {
        grid-template-columns: 1fr;
      }

      .metrics {
        grid-template-columns:
          repeat(2,minmax(0,1fr));
      }

      .lf-market-toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .lf-week-summary {
        width: 100%;
        margin-left: 0;
      }

      .analyst-source {
        grid-template-columns: 1fr;
      }

      .lf-book-row,
      .lf-movement {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}


// ============================================================
// LOAD CORE DATA
// ============================================================

async function load() {

  injectBoardStyles();

  try {

    const [
      signalsResponse,
      expertsResponse,
      resultsResponse,
      marketResponse
    ] = await Promise.all([

      fetch(
        `${SIGNALS_URL}?_=${Date.now()}`,
        { cache: 'no-store' }
      ),

      fetch(
        `${EXPERTS_URL}?_=${Date.now()}`,
        { cache: 'no-store' }
      ),

      fetch(
        `${RESULTS_URL}?_=${Date.now()}`,
        { cache: 'no-store' }
      ),

      fetch(
        `${MARKET_DATA_URL}?_=${Date.now()}`,
        { cache: 'no-store' }
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

    let marketJson = null;

    if (marketResponse.ok) {
      marketJson =
        await marketResponse.json();
    }


    experts =
      expertsData;

    results =
      resultsData;

    marketData =
      marketJson?.markets ||
      [];


    board = {
      mode: 'public-consensus',

      season:
        signalsData.season ||
        2026,

      week:
        signalsData.week ||
        1,

      refreshedAt:
        new Date().toISOString(),

      sources:
        signalsData.sources ||
        [],

      rawSignals:
        signalsData.signals ||
        [],

      props:
        buildConsensusProps(
          signalsData.signals || [],
          signalsData.sources || []
        )
    };


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
        <div class="lf-empty">
          <h3>Unable to load LineFoundry data</h3>
          <p>Please refresh the page and try again.</p>
        </div>
      `;
    }
  }
}


// ============================================================
// CONSENSUS ENGINE
// ============================================================

function buildConsensusProps(
  signals,
  sources
) {

  const groups = new Map();


  signals.forEach(signal => {

    const week =
      normalizeWeek(
        signal.week ??
        signal.seasonWeek ??
        board?.week ??
        1
      );

    const player =
      String(
        signal.player || ''
      ).trim();

    const market =
      String(
        signal.market || ''
      ).trim();

    if (!player || !market) {
      return;
    }


    // Important:
    // Consensus is grouped by PLAYER + MARKET + WEEK.
    // Line is intentionally NOT part of the grouping key.

    const key =
      `${player.toLowerCase()}|${market.toLowerCase()}|${week}`;


    if (!groups.has(key)) {
      groups.set(
        key,
        {
          player,
          market,
          week,
          signals: []
        }
      );
    }


    groups
      .get(key)
      .signals
      .push(signal);
  });


  return Array.from(
    groups.values()
  ).map(group => {

    const over =
      group.signals.filter(
        signal =>
          String(signal.side)
            .toUpperCase() ===
          'OVER'
      );

    const under =
      group.signals.filter(
        signal =>
          String(signal.side)
            .toUpperCase() ===
          'UNDER'
      );

    const yes =
      group.signals.filter(
        signal =>
          String(signal.side)
            .toUpperCase() ===
          'YES'
      );

    let direction =
      'YES';

    if (over.length || under.length) {

      direction =
        over.length >= under.length
          ? 'OVER'
          : 'UNDER';
    }


    const agree =
      direction === 'OVER'
        ? over.length
        : direction === 'UNDER'
          ? under.length
          : yes.length;


    const disagree =
      direction === 'OVER'
        ? under.length
        : direction === 'UNDER'
          ? over.length
          : 0;


    const expertsCount =
      group.signals.length;


    const percent =
      expertsCount
        ? Math.round(
            (agree / expertsCount) *
            100
          )
        : 0;


    const lines =
      group.signals
        .map(
          signal =>
            signal.line
        )
        .filter(
          line =>
            line !== null &&
            line !== undefined
        )
        .map(Number)
        .filter(
          Number.isFinite
        );


    const uniqueLines =
      [...new Set(lines)]
        .sort(
          (a,b) => a-b
        );


    let line = null;
    let lineDisplay = '';


    if (uniqueLines.length === 1) {

      line =
        uniqueLines[0];

      lineDisplay =
        formatNumber(line);

    }
    else if (uniqueLines.length > 1) {

      lineDisplay =
        `${formatNumber(
          uniqueLines[0]
        )}–${formatNumber(
          uniqueLines[
            uniqueLines.length - 1
          ]
        )}`;

      // Use the median published line
      // when multiple analysts cited
      // slightly different lines.
      line =
        uniqueLines[
          Math.floor(
            uniqueLines.length / 2
          )
        ];
    }


    const analystList =
      group.signals.map(
        signal => {

          const source =
            sources.find(
              item =>
                item.id ===
                signal.sourceId
            );


          return {
            name:
              signal.analyst ||
              'Unknown analyst',

            outlet:
              source?.outlet ||
              signal.outlet ||
              '',

            side:
              signal.side ||
              '',

            line:
              signal.line ??
              null,

            url:
              source?.url ||
              signal.url ||
              '',

            note:
              signal.note ||
              ''
          };
        }
      );


    const consensusDisplay =
      expertsCount === 1
        ? 'EARLY'
        : `${percent}%`;


    return {

      id:
        `${group.player}-${group.market}-${group.week}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g,'-'),

      player:
        group.player,

      market:
        group.market,

      side:
        direction,

      line,

      lineDisplay,

      week:
        group.week,

      weeks:
        [group.week],

      agree,

      disagree,

      experts:
        expertsCount,

      percent,

      analystCount:
        expertsCount,

      consensusScore:
        percent,

      consensusDisplay,

      consensusStrength:
        percent >= 75
          ? 'HIGH'
          : percent >= 60
            ? 'MEDIUM'
            : 'EARLY',

      confidence:
        percent >= 75
          ? 'HIGH'
          : percent >= 60
            ? 'MEDIUM'
            : 'EARLY',

      analysts:
        analystList,

      rationale:
        expertsCount === 1
          ? 'One tracked source currently supports this direction; treat as an early signal until more sources agree.'
          : `${percent}% of tracked analysts support this direction.`,

      sourceIds:
        [
          ...new Set(
            group.signals
              .map(
                signal =>
                  signal.sourceId
              )
              .filter(Boolean)
          )
        ]
    };
  });
}


// ============================================================
// LIVE WORKER
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
    marketResults = {};


    (data.results || [])
      .forEach(result => {

        if (!result.id) {
          return;
        }

        liveResults[result.id] =
          result;

        // Market results use the same
        // result IDs as market-data.json.
        marketResults[result.id] =
          result;
      });


    if (board) {

      board.liveUpdatedAt =
        data.updatedAt ||
        new Date().toISOString();
    }


    render();

  }
  catch (error) {

    console.error(
      'LineFoundry live data failed:',
      error
    );
  }
}


// Refresh ESPN/Worker every 60 seconds.
setInterval(
  loadLiveResults,
  60000
);


// ============================================================
// EXPERT RESULT HELPERS
// ============================================================

function getResult(prop) {

  if (!prop) {
    return 'PENDING';
  }


  // Expert result IDs may not exactly
  // match the consensus ID, so first
  // check the raw signals that make up
  // this consensus.

  const matching =
    (board?.rawSignals || [])
      .filter(signal => {

        const signalWeek =
          normalizeWeek(
            signal.week ??
            board?.week ??
            1
          );

        return (
          String(signal.player)
            .toLowerCase() ===
          String(prop.player)
            .toLowerCase()
          &&
          String(signal.market)
            .toLowerCase() ===
          String(prop.market)
            .toLowerCase()
          &&
          signalWeek ===
          Number(prop.week)
        );
      });


  for (const signal of matching) {

    const live =
      liveResults[signal.id];

    if (live) {

      if (
        live.status === 'HIT'
      ) {
        return 'HIT';
      }

      if (
        live.status === 'MISS'
      ) {
        return 'MISS';
      }

      if (
        live.status === 'LIVE'
      ) {
        return 'LIVE';
      }
    }
  }


  return 'PENDING';
}


// ============================================================
// EXPERT LIVE DISPLAY
// ============================================================

function liveStatus(prop) {

  const matching =
    (board?.rawSignals || [])
      .filter(signal => {

        const signalWeek =
          normalizeWeek(
            signal.week ??
            board?.week ??
            1
          );

        return (
          String(signal.player)
            .toLowerCase() ===
          String(prop.player)
            .toLowerCase()
          &&
          String(signal.market)
            .toLowerCase() ===
          String(prop.market)
            .toLowerCase()
          &&
          signalWeek ===
          Number(prop.week)
        );
      });


  const live =
    matching
      .map(
        signal =>
          liveResults[signal.id]
      )
      .find(Boolean);


  if (!live) {
    return '';
  }


  // Anytime TD
  if (
    String(prop.market)
      .toLowerCase()
      .includes('anytime td')
  ) {

    if (
      live.status === 'HIT'
    ) {

      return `
        <div class="live-stat">
          <strong>BET HIT</strong>
          <span>Touchdown recorded</span>
        </div>
      `;
    }


    if (
      live.status === 'MISS'
    ) {

      return `
        <div class="live-stat">
          <strong>BET MISS</strong>
          <span>No touchdown recorded</span>
        </div>
      `;
    }


    if (
      live.status === 'LIVE'
    ) {

      return `
        <div class="live-stat">
          <strong>LIVE</strong>
          <span>Game in progress</span>
        </div>
      `;
    }


    return '';
  }


  if (
    live.status === 'HIT'
  ) {

    return `
      <div class="live-stat">
        <strong>
          ${formatNumber(
            live.currentValue
          )} — BET HIT
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
      <div class="live-stat">
        <strong>
          ${formatNumber(
            live.currentValue
          )} — BET MISS
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

    return `
      <div class="live-stat">
        <strong>
          LIVE —
          ${formatNumber(
            live.currentValue
          )}
        </strong>

        ${
          live.remaining !== null &&
          live.remaining !== undefined
            ? `
              <span>
                ${formatNumber(
                  live.remaining
                )} needed
              </span>
            `
            : ''
        }
      </div>
    `;
  }


  return '';
}


// ============================================================
// EXPERT CARD
// ============================================================

function card(prop) {

  const sideClass =
    prop.side === 'UNDER'
      ? 'consensus-under'
      : 'consensus-over';


  const lockedPick =
    locked.includes(prop.id);


  const analysts =
    (prop.analysts || [])
      .map(
        analyst => `
          <div class="analyst-source">

            <strong>
              ${escapeHtml(
                analyst.name
              )}
            </strong>

            <span>
              ${escapeHtml(
                analyst.outlet ||
                ''
              )}

              ${
                analyst.side
                  ? ` — ${escapeHtml(
                      analyst.side
                    )}`
                  : ''
              }

              ${
                analyst.line !== null &&
                analyst.line !== undefined
                  ? ` ${formatNumber(
                      analyst.line
                    )}`
                  : ''
              }
            </span>

            ${
              analyst.url
                ? `
                  <a
                    href="${escapeHtml(
                      analyst.url
                    )}"
                    target="_blank"
                    rel="noopener"
                  >
                    Source ↗
                  </a>
                `
                : ''
            }

          </div>
        `
      )
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
            ? ` ${formatNumber(
                prop.line
              )}`
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

          expert${
            prop.agree === 1
              ? ''
              : 's'
          }

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
        getResult(prop) ===
        'HIT'
    ).length;


  const misses =
    props.filter(
      prop =>
        getResult(prop) ===
        'MISS'
    ).length;


  const live =
    props.filter(
      prop =>
        getResult(prop) ===
        'LIVE'
    ).length;


  const pending =
    props.filter(
      prop =>
        getResult(prop) ===
        'PENDING'
    ).length;


  const settled =
    hits + misses;


  const percentage =
    settled > 0
      ? Math.round(
          (hits / settled) *
          100
        )
      : null;


  return `

    <span class="lf-week-summary">

      ${props.length}
      pick${
        props.length === 1
          ? ''
          : 's'
      }

      ${
        settled
          ? ` • ${hits} hit${
              hits === 1
                ? ''
                : 's'
            }`
          : ''
      }

      ${
        misses
          ? ` • ${misses} miss${
              misses === 1
                ? ''
                : 'es'
            }`
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
    [...props].sort(
      (a,b) =>
        b.percent -
        a.percent
    );


  const status =
    Number(week) ===
    currentWeek()
      ? 'CURRENT'
      : (
        props.some(
          prop => {

            const result =
              getResult(prop);

            return (
              result === 'PENDING' ||
              result === 'LIVE'
            );
          }
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
// MARKET HELPERS
// ============================================================

function marketTypeName(market) {

  return (
    market?.market?.name ||
    'Player Prop'
  );
}


function isAnytimeTDMarket(market) {

  return (
    String(
      market?.market?.name || ''
    )
      .toLowerCase()
      .includes('anytime touchdown')
    ||
    String(
      market?.market?.statId || ''
    )
      .toLowerCase()
      .includes('touchdown')
    &&
    String(
      market?.market?.betType || ''
    )
      .toLowerCase() === 'yn'
  );
}


function getMarketLine(market) {

  if (
    isAnytimeTDMarket(market)
  ) {
    return 'TD';
  }


  const over =
    market?.sides?.over;

  const under =
    market?.sides?.under;


  const line =
    over?.line ??
    under?.line ??
    null;


  return formatNumber(line);
}


function getMarketResult(market) {

  const result =
    marketResults[
      market.id
    ];


  if (!result) {
    return null;
  }


  return result;
}


function formatMarketResult(
  market,
  result
) {

  if (!result) {

    return {
      text: 'PENDING',
      pending: true
    };
  }


  const status =
    result.status;


  // Anytime TD
  if (
    isAnytimeTDMarket(market)
  ) {

    if (
      status === 'HIT'
    ) {

      return {
        text: '1 TD ACTUAL',
        pending: false
      };
    }


    if (
      status === 'MISS'
    ) {

      return {
        text: '0 TD ACTUAL',
        pending: false
      };
    }


    if (
      status === 'LIVE'
    ) {

      if (
        result.currentValue !==
        null &&
        result.currentValue !==
        undefined
      ) {

        return {
          text:
            `LIVE · ${formatNumber(
              result.currentValue
            )} TD`,
          pending: false
        };
      }


      return {
        text: 'LIVE',
        pending: false
      };
    }


    return {
      text: 'PENDING',
      pending: true
    };
  }


  const value =
    formatNumber(
      result.currentValue
    );


  if (
    status === 'LIVE'
  ) {

    return {
      text:
        `LIVE · ${value} ${
          String(
            marketTypeName(market)
          )
            .toLowerCase()
            .includes('attempt')
            ? 'ATTEMPTS'
            : 'YARDS'
        }`,
      pending: false
    };
  }


  if (
    status === 'HIT' ||
    status === 'MISS'
  ) {

    return {
      text:
        `${value} ${
          String(
            marketTypeName(market)
          )
            .toLowerCase()
            .includes('attempt')
            ? 'ATTEMPTS ACTUAL'
            : 'YARDS ACTUAL'
        }`,
      pending: false
    };
  }


  return {
    text: 'PENDING',
    pending: true
  };
}


function bestBook(
  side
) {

  if (!side) {
    return '—';
  }


  if (
    side.bestBook &&
    side.bestBookOdds
  ) {

    return `
      ${escapeHtml(
        String(
          side.bestBook
        )
          .replace(
            /^./,
            letter =>
              letter.toUpperCase()
          )
      )}

      ${escapeHtml(
        side.bestBookOdds
      )}
    `;
  }


  const books =
    Object.values(
      side.sportsbooks ||
      {}
    )
      .filter(
        book =>
          book &&
          (
            book.available === true ||
            book.odds
          )
      );


  if (!books.length) {
    return '—';
  }


  const first =
    books[0];


  return `
    ${escapeHtml(
      String(
        first.name ||
        'Book'
      )
    )}

    ${
      first.odds
        ? escapeHtml(
            first.odds
          )
        : ''
    }
  `;
}


function gameLabel(
  market
) {

  const game =
    market?.game || {};


  const away =
    game.awayTeam ||
    '';

  const home =
    game.homeTeam ||
    '';


  if (!away && !home) {
    return 'NFL';
  }


  return `${away} @ ${home}`;
}


// ============================================================
// MARKET CARD
// ============================================================

function marketCard(
  market
) {

  const result =
    getMarketResult(
      market
    );


  const formatted =
    formatMarketResult(
      market,
      result
    );


  const td =
    isAnytimeTDMarket(
      market
    );


  return `

    <article
      class="lf-market-card"
    >

      <div class="lf-market-player">
        ${escapeHtml(
          market?.player?.name ||
          'Unknown Player'
        )}
      </div>

      <div class="lf-market-game">
        ${escapeHtml(
          gameLabel(market)
        )}
      </div>


      <div class="lf-market-type">
        ${escapeHtml(
          marketTypeName(
            market
          )
        )}
      </div>


      <div class="lf-market-line">
        ${
          td
            ? 'TD'
            : escapeHtml(
                getMarketLine(
                  market
                )
              )
        }
      </div>


      ${
        td
          ? `
            <div class="lf-market-odds">

              <span class="over">
                YES ${
                  market?.sides?.yes?.odds ||
                  market?.sides?.yes?.bestBookOdds ||
                  '—'
                }
              </span>

              <span class="under">
                NO ${
                  market?.sides?.no?.odds ||
                  market?.sides?.no?.bestBookOdds ||
                  '—'
                }
              </span>

            </div>
          `
          : `
            <div class="lf-market-odds">

              <span class="over">
                OVER ${
                  market?.sides?.over?.odds ||
                  market?.sides?.over?.bestBookOdds ||
                  '—'
                }
              </span>

              <span class="under">
                UNDER ${
                  market?.sides?.under?.odds ||
                  market?.sides?.under?.bestBookOdds ||
                  '—'
                }
              </span>

            </div>
          `
      }


      ${
        td
          ? ''
          : `
            <div class="lf-market-best">
              Best Over:
              <strong>
                ${bestBook(
                  market?.sides?.over
                )}
              </strong>
            </div>

            <div class="lf-market-best">
              Best Under:
              <strong>
                ${bestBook(
                  market?.sides?.under
                )}
              </strong>
            </div>
          `
      }


      <div
        class="
          lf-market-result
          ${
            formatted.pending
              ? 'pending'
              : ''
          }
        "
      >
        ${escapeHtml(
          formatted.text
        )}
      </div>


      <a
        href="#"
        class="lf-market-details"
        data-market-id="${escapeHtml(
          market.id
        )}"
      >
        View Market Details →
      </a>

    </article>

  `;
}


// ============================================================
// MARKET DETAILS
// ============================================================

function openMarketDetails(
  marketId
) {

  const market =
    marketData.find(
      item =>
        item.id ===
        marketId
    );


  if (!market) {
    return;
  }


  let modal =
    $('#lfMarketModal');


  if (!modal) {

    modal =
      document.createElement(
        'div'
      );

    modal.id =
      'lfMarketModal';

    modal.className =
      'lf-market-modal';

    document.body.appendChild(
      modal
    );
  }


  const result =
    getMarketResult(
      market
    );


  const over =
    market?.sides?.over;

  const under =
    market?.sides?.under;


  const books =
    new Map();


  [
    ...(Object.entries(
      over?.sportsbooks ||
      {}
    ).map(
      ([name, book]) =>
        ({
          name,
          over: book
        })
    )),

    ...(Object.entries(
      under?.sportsbooks ||
      {}
    ).map(
      ([name, book]) =>
        ({
          name,
          under: book
        })
    ))
  ]
    .forEach(item => {

      if (
        !books.has(
          item.name
        )
      ) {

        books.set(
          item.name,
          {}
        );
      }


      Object.assign(
        books.get(
          item.name
        ),
        item
      );
    });


  const bookRows =
    Array.from(
      books.entries()
    )
      .map(
        ([name, book]) => {

          const overOdds =
            book.over?.odds ||
            '—';

          const underOdds =
            book.under?.odds ||
            '—';

          const overLine =
            book.over?.line ??
            '—';

          const underLine =
            book.under?.line ??
            '—';


          return `

            <div class="lf-book-row">

              <strong>
                ${escapeHtml(
                  name
                )}
              </strong>

              <span>
                OVER
                ${escapeHtml(
                  String(
                    overLine
                  )
                )}
                ${
                  overOdds !== '—'
                    ? ` ${escapeHtml(
                        overOdds
                      )}`
                    : ''
                }
              </span>

              <span>
                UNDER
                ${escapeHtml(
                  String(
                    underLine
                  )
                )}
                ${
                  underOdds !== '—'
                    ? ` ${escapeHtml(
                        underOdds
                      )}`
                    : ''
                }
              </span>

            </div>

          `;
        }
      )
      .join('');


  const resultText =
    result
      ? formatMarketResult(
          market,
          result
        ).text
      : 'PENDING';


  const opened =
    over?.openingLine ??
    under?.openingLine ??
    '—';


  const current =
    over?.line ??
    under?.line ??
    '—';


  const closing =
    over?.closingLine ??
    under?.closingLine ??
    '—';


  modal.innerHTML = `

    <div
      class="lf-market-backdrop"
      data-market-close="1"
    ></div>

    <div
      class="lf-market-panel"
      role="dialog"
      aria-modal="true"
    >

      <button
        class="lf-market-close"
        data-market-close="1"
        aria-label="Close"
      >
        ×
      </button>


      <div class="eyebrow">
        MARKET DETAILS
      </div>

      <h2>
        ${escapeHtml(
          market?.player?.name ||
          ''
        )}
      </h2>

      <div class="market-subtitle">
        ${escapeHtml(
          gameLabel(market)
        )}
        ·
        ${escapeHtml(
          marketTypeName(
            market
          )
        )}
      </div>


      <div class="lf-detail-section">

        <h3>
          CURRENT MARKET
        </h3>

        <div class="lf-market-line">
          ${
            isAnytimeTDMarket(
              market
            )
              ? 'TD'
              : escapeHtml(
                  getMarketLine(
                    market
                  )
                )
          }
        </div>

        <div class="lf-market-odds">

          ${
            isAnytimeTDMarket(
              market
            )
              ? `
                <span class="over">
                  YES ${
                    market?.sides?.yes?.odds ||
                    '—'
                  }
                </span>

                <span class="under">
                  NO ${
                    market?.sides?.no?.odds ||
                    '—'
                  }
                </span>
              `
              : `
                <span class="over">
                  OVER ${
                    over?.odds ||
                    over?.bestBookOdds ||
                    '—'
                  }
                </span>

                <span class="under">
                  UNDER ${
                    under?.odds ||
                    under?.bestBookOdds ||
                    '—'
                  }
                </span>
              `
          }

        </div>


        <div
          class="
            lf-market-result
            ${
              result
                ? ''
                : 'pending'
            }
          "
          style="margin-top:15px"
        >
          ${escapeHtml(
            resultText
          )}
        </div>

      </div>


      <div class="lf-detail-section">

        <h3>
          SPORTSBOOK PRICES
        </h3>

        ${
          bookRows ||
          `
            <div class="muted">
              No sportsbook prices available.
            </div>
          `
        }

      </div>


      <div class="lf-detail-section">

        <h3>
          LINE MOVEMENT
        </h3>

        <div class="lf-movement">

          <div>
            <b>
              ${escapeHtml(
                String(
                  opened
                )
              )}
            </b>
            <span>
              Opened
            </span>
          </div>

          <div>
            <b>
              ${escapeHtml(
                String(
                  current
                )
              )}
            </b>
            <span>
              Current
            </span>
          </div>

          <div>
            <b>
              ${escapeHtml(
                String(
                  closing
                )
              )}
            </b>
            <span>
              Closing
            </span>
          </div>

        </div>

      </div>

    </div>

  `;


  modal.classList.add(
    'open'
  );


  modal
    .querySelectorAll(
      '[data-market-close]'
    )
    .forEach(
      element =>
        element.addEventListener(
          'click',
          closeMarketDetails
        )
    );
}


function closeMarketDetails() {

  const modal =
    $('#lfMarketModal');


  if (modal) {

    modal.classList.remove(
      'open'
    );
  }
}


// ============================================================
// MARKET SECTION
// ============================================================

function ensureMarketSection() {

  if (
    !marketData.length
  ) {
    return;
  }


  let section =
    $('#lfMarketSection');


  if (section) {
    return;
  }


  const propsSection =
    $('#props');


  if (!propsSection) {
    return;
  }


  section =
    document.createElement(
      'section'
    );

  section.id =
    'lfMarketSection';

  section.className =
    'section-block';


  section.innerHTML = `

    <div class="section-head">

      <div>

        <p class="eyebrow">
          NFL PROPS
        </p>

        <h2>
          The Market
        </h2>

        <p class="muted">
          Current player prop markets and the best available prices.
        </p>

      </div>

    </div>


    <div class="lf-market-toolbar">

      <input
        id="lfMarketSearch"
        type="search"
        placeholder="Search players or markets..."
        autocomplete="off"
      />

      <select
        id="lfMarketType"
      >
        <option value="ALL">
          All Markets
        </option>
      </select>

    </div>


    <div
      id="lfMarketGrid"
      class="lf-market-grid"
    ></div>

  `;


  propsSection.after(
    section
  );


  populateMarketTypes();


  $('#lfMarketSearch')
    ?.addEventListener(
      'input',
      renderMarkets
    );


  $('#lfMarketType')
    ?.addEventListener(
      'change',
      renderMarkets
    );


  renderMarkets();
}


function populateMarketTypes() {

  const select =
    $('#lfMarketType');


  if (!select) {
    return;
  }


  const types =
    [
      ...new Set(
        marketData
          .map(
            market =>
              marketTypeName(
                market
              )
          )
          .filter(Boolean)
      )
    ]
      .sort();


  select.innerHTML =
    `
      <option value="ALL">
        All Markets
      </option>

      ${
        types
          .map(
            type => `
              <option
                value="${escapeHtml(
                  type
                )}"
              >
                ${escapeHtml(
                  type
                )}
              </option>
            `
          )
          .join('')
      }
    `;
}


function renderMarkets() {

  ensureMarketSection();


  const grid =
    $('#lfMarketGrid');


  if (!grid) {
    return;
  }


  const search =
    (
      $('#lfMarketSearch')
        ?.value ||
      ''
    )
      .trim()
      .toLowerCase();


  const type =
    $('#lfMarketType')
      ?.value ||
    'ALL';


  const filtered =
    marketData
      .filter(
        market => {

          const player =
            String(
              market?.player?.name ||
              ''
            )
              .toLowerCase();

          const marketName =
            String(
              marketTypeName(
                market
              )
            )
              .toLowerCase();

          const game =
            String(
              gameLabel(
                market
              )
            )
              .toLowerCase();


          const matchesSearch =
            !search ||
            player.includes(search) ||
            marketName.includes(search) ||
            game.includes(search);


          const matchesType =
            type === 'ALL' ||
            marketName ===
            type.toLowerCase();


          return (
            matchesSearch &&
            matchesType
          );
        }
      )
      .slice(0, 300);


  if (!filtered.length) {

    grid.innerHTML = `

      <div class="lf-empty">

        <h3>
          No markets found
        </h3>

        <p>
          Try another player or market.
        </p>

      </div>

    `;

    return;
  }


  grid.innerHTML =
    filtered
      .map(
        marketCard
      )
      .join('');


  grid
    .querySelectorAll(
      '.lf-market-details'
    )
    .forEach(
      link => {

        link.addEventListener(
          'click',
          event => {

            event.preventDefault();

            openMarketDetails(
              link.dataset.marketId
            );
          }
        );
      }
    );
}


// ============================================================
// SOURCES
// ============================================================

function renderSources() {

  const container =
    $('#sourceRows');


  if (!container) {
    return;
  }


  container.innerHTML =
    (board?.sources || [])
      .map(
        source => `

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
                source.verification ||
                ''
              )}
            </td>

            <td>

              ${
                source.url
                  ? `
                    <a
                      href="${escapeHtml(
                        source.url
                      )}"
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

        `
      )
      .join('');
}


// ============================================================
// EXPERT TABLE
// ============================================================

function renderExperts() {

  const container =
    $('#expertRows');


  if (!container) {
    return;
  }


  const expertList =
    experts?.experts ||
    [];


  container.innerHTML =
    expertList
      .map(
        expert => {

          const tracked =
            expert.tracked ||
            {};

          const wins =
            tracked.wins ||
            0;

          const losses =
            tracked.losses ||
            0;

          const picks =
            tracked.picks ||
            0;

          const units =
            Number(
              tracked.units ||
              0
            );

          const roi =
            expert.roi == null
              ? '—'
              : `${(
                  expert.roi *
                  100
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
                  expert.outlet ||
                  ''
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
                  class="
                    status
                    ${status.toLowerCase()}
                  "
                >
                  ${status}
                </span>
              </td>

            </tr>

          `;
        }
      )
      .join('');
}


// ============================================================
// RECORD
// ============================================================

function renderRecord() {

  const record =
    experts?.record ||
    {};


  if ($('#wins')) {

    $('#wins')
      .textContent =
      record.wins ||
      0;
  }


  if ($('#losses')) {

    $('#losses')
      .textContent =
      record.losses ||
      0;
  }


  if ($('#units')) {

    $('#units')
      .textContent =
      `${Number(
        record.units ||
        0
      ).toFixed(2)}u`;
  }


  if ($('#roi')) {

    $('#roi')
      .textContent =
      record.roi == null
        ? '—'
        : `${(
            record.roi *
            100
          ).toFixed(1)}%`;
  }
}


// ============================================================
// MAIN RENDER
// ============================================================

function render() {

  if (!board) {
    return;
  }


  const allProps =
    board.props ||
    [];


  const filter =
    $('#confidenceFilter')
      ?.value ||
    'ALL';


  const filtered =
    allProps.filter(
      prop => {

        if (
          filter === 'ALL'
        ) {
          return true;
        }

        return (
          prop.confidence ===
          filter
        );
      }
    );


  const weeks =
    [
      ...new Set(
        filtered.map(
          prop =>
            Number(
              prop.week
            )
        )
      )
    ]
      .filter(
        Number.isFinite
      )
      .sort(
        (a,b) => a-b
      );


  const selectedCurrentWeek =
    currentWeek();


  const container =
    $('#propCards');


  if (container) {

    if (!filtered.length) {

      container.innerHTML = `

        <div class="lf-empty">

          <h3>
            No picks match your filters
          </h3>

          <p>
            Try changing your confidence filter.
          </p>

        </div>

      `;

    }
    else {

      container.innerHTML =
        weeks
          .map(
            week => {

              const weekProps =
                filtered.filter(
                  prop =>
                    Number(
                      prop.week
                    ) ===
                    Number(week)
                );


              return weekSection(
                week,
                weekProps,
                Number(week) ===
                selectedCurrentWeek
              );
            }
          )
          .join('');
    }
  }


  // Top stats

  if ($('#signalCount')) {

    $('#signalCount')
      .textContent =
      allProps.length;
  }


  if ($('#sourceCount')) {

    $('#sourceCount')
      .textContent =
      board.sources?.length ||
      0;
  }


  if ($('#lastRefresh')) {

    $('#lastRefresh')
      .textContent =
      board.liveUpdatedAt
        ? new Date(
            board.liveUpdatedAt
          ).toLocaleString()
        : board.refreshedAt
          ? new Date(
              board.refreshedAt
            ).toLocaleString()
          : 'not run';
  }


  // These IDs existed in earlier
  // versions of the board.

  if ($('#signalCount2')) {

    $('#signalCount2')
      .textContent =
      allProps.length;
  }


  if ($('#sourceCount2')) {

    $('#sourceCount2')
      .textContent =
      board.sources?.length ||
      0;
  }


  if ($('#pickCount')) {

    $('#pickCount')
      .textContent =
      locked.length;
  }


  renderSources();

  renderExperts();

  renderRecord();

  ensureMarketSection();

  renderMarkets();
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


document
  .addEventListener(
    'keydown',
    event => {

      if (
        event.key ===
        'Escape'
      ) {

        closeMarketDetails();

        $('#howModal')
          ?.setAttribute(
            'aria-hidden',
            'true'
          );
      }
    }
  );


// ============================================================
// INITIAL LOAD
// ============================================================

injectBoardStyles();

load();

setTimeout(
  loadLiveResults,
  1500
);
