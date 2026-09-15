let board = null;
let experts = null;
let results = null;
let marketData = null;
let liveResults = {};

const WORKER_URL =
  'https://old-mouse-660a.tannerbro10.workers.dev/';

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

function save() {
  localStorage.setItem(
    'lf_consensus_locked',
    JSON.stringify(locked)
  );
}

function escapeHtml(value) {
  return String(value ?? '')
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
    return '';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);
}

function formatOdds(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const text = String(value);

  if (
    text.startsWith('-') ||
    text.startsWith('+')
  ) {
    return text;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return text;
  }

  return number > 0
    ? `+${number}`
    : String(number);
}

function currentWeek() {
  const now = new Date();

  const seasonStart =
    new Date('2026-09-06T13:00:00Z');

  const diff =
    now.getTime() -
    seasonStart.getTime();

  if (diff < 0) {
    return 1;
  }

  const week =
    Math.floor(
      diff /
      (7 * 24 * 60 * 60 * 1000)
    ) + 1;

  return Math.min(
    Math.max(week, 1),
    18
  );
}


// ============================================================
// STYLES
// ============================================================

function injectBoardStyles() {
  if ($('#linefoundry-board-styles')) {
    return;
  }

  const style =
    document.createElement('style');

  style.id =
    'linefoundry-board-styles';

  style.textContent = `

    /* ========================================================
       EXPERT BOARD WIDTH FIX
       ======================================================== */

    #props #propCards {
      display: block !important;
      width: 100% !important;
      max-width: none !important;
    }

    #props .lf-week-section {
      display: block !important;
      width: 100% !important;
      max-width: none !important;
    }

    #props .lf-week-cards {
      width: 100% !important;
      max-width: none !important;
      display: grid !important;
      grid-template-columns:
        repeat(3, minmax(0, 1fr)) !important;
      gap: 15px !important;
    }

    /* ========================================================
       MARKET GRID
       ======================================================== */

    .lf-market-wrap {
      width: 100%;
      margin-top: 30px;
    }

    .lf-market-header {
      margin-bottom: 18px;
    }

    .lf-market-header .eyebrow {
      margin-bottom: 8px;
    }

    .lf-market-header h2 {
      margin: 0;
      font: 700 32px 'Space Grotesk';
      letter-spacing: -.035em;
    }

    .lf-market-header p {
      margin: 6px 0 0;
    }

    .lf-market-grid {
      display: grid;
      width: 100%;
      grid-template-columns:
        repeat(4, minmax(0, 1fr));
      gap: 14px;
    }

    .lf-market-card {
      position: relative;
      min-width: 0;
      padding: 17px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 16px;
      background:
        linear-gradient(
          180deg,
          rgba(255,255,255,.045),
          rgba(255,255,255,.02)
        );
      box-shadow:
        0 8px 24px rgba(0,0,0,.12);
      transition:
        transform .16s ease,
        border-color .16s ease,
        box-shadow .16s ease;
    }

    .lf-market-card:hover {
      transform: translateY(-2px);
      border-color: rgba(255,255,255,.16);
      box-shadow:
        0 12px 30px rgba(0,0,0,.18);
    }

    .lf-market-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 13px;
    }

    .lf-market-player {
      min-width: 0;
    }

    .lf-market-player strong {
      display: block;
      font-size: 15px;
      line-height: 1.2;
      font-weight: 750;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .lf-market-game {
      display: block;
      margin-top: 4px;
      color: rgba(255,255,255,.52);
      font-size: 11px;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .lf-market-week {
      flex: 0 0 auto;
      padding: 4px 7px;
      border-radius: 7px;
      background: rgba(255,255,255,.07);
      color: rgba(255,255,255,.68);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .05em;
    }

    .lf-market-type {
      margin-bottom: 7px;
      color: rgba(255,255,255,.58);
      font-size: 11px;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: .055em;
    }

    .lf-market-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 45px;
      padding: 8px 0;
    }

    .lf-market-line-number {
      font-size: 28px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: -.04em;
    }

    .lf-market-sides {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      font-size: 10px;
      font-weight: 650;
    }

    .lf-market-side {
      white-space: nowrap;
    }

    .lf-market-side b {
      margin-left: 3px;
      color: rgba(255,255,255,.86);
    }

    .lf-market-divider {
      height: 1px;
      margin: 8px 0 10px;
      background: rgba(255,255,255,.07);
    }

    .lf-market-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .lf-market-best {
      min-width: 0;
      color: rgba(255,255,255,.5);
      font-size: 10px;
      line-height: 1.3;
    }

    .lf-market-best strong {
      color: rgba(255,255,255,.76);
      font-weight: 700;
    }

    .lf-market-details {
      flex: 0 0 auto;
      border: 0;
      padding: 0;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 10px;
      font-weight: 750;
      cursor: pointer;
      white-space: nowrap;
    }

    .lf-market-details:hover {
      text-decoration: underline;
    }

    /* ========================================================
       MARKET CONTROLS
       ======================================================== */

    .lf-market-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .lf-market-search {
      flex: 1;
      min-width: 0;
      height: 44px;
      padding: 0 15px;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 12px;
      outline: none;
      background: rgba(255,255,255,.035);
      color: inherit;
      font: inherit;
    }

    .lf-market-search::placeholder {
      color: rgba(255,255,255,.4);
    }

    .lf-market-filter {
      height: 44px;
      padding: 0 14px;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 12px;
      background: rgba(255,255,255,.035);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    /* ========================================================
       MARKET DETAILS MODAL
       ======================================================== */

    .lf-market-modal {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(0,0,0,.68);
      backdrop-filter: blur(7px);
    }

    .lf-market-modal[hidden] {
      display: none;
    }

    .lf-market-modal-box {
      width: min(680px, 100%);
      max-height: 90vh;
      overflow: auto;
      padding: 24px;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 20px;
      background: #111;
      box-shadow: 0 24px 70px rgba(0,0,0,.4);
    }

    .lf-market-modal-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 20px;
    }

    .lf-market-modal-head h3 {
      margin: 0;
      font-size: 22px;
    }

    .lf-market-modal-sub {
      margin-top: 5px;
      color: rgba(255,255,255,.52);
      font-size: 12px;
    }

    .lf-market-close {
      border: 0;
      background: none;
      color: inherit;
      font-size: 22px;
      cursor: pointer;
    }

    .lf-market-detail-section {
      margin-top: 20px;
    }

    .lf-market-detail-section h4 {
      margin: 0 0 10px;
      font-size: 11px;
      letter-spacing: .07em;
      text-transform: uppercase;
      color: rgba(255,255,255,.48);
    }

    .lf-market-book {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 10px;
      align-items: center;
      padding: 9px 0;
      border-bottom: 1px solid rgba(255,255,255,.06);
      font-size: 12px;
    }

    .lf-market-book-name {
      font-weight: 700;
    }

    .lf-market-book span {
      color: rgba(255,255,255,.7);
    }

    .lf-alt-lines {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .lf-alt-line {
      padding: 6px 8px;
      border-radius: 7px;
      background: rgba(255,255,255,.06);
      font-size: 11px;
    }

    .lf-market-empty {
      padding: 30px;
      border: 1px dashed rgba(255,255,255,.12);
      border-radius: 14px;
      text-align: center;
      color: rgba(255,255,255,.5);
    }

    /* ========================================================
       WEEK SECTIONS
       ======================================================== */

    .lf-week-section {
      margin-bottom: 24px;
    }

    .lf-week-section > summary {
      list-style: none;
      cursor: pointer;
      user-select: none;
      margin-bottom: 14px;
    }

    .lf-week-section > summary::-webkit-details-marker {
      display: none;
    }

    .lf-week-heading {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 9px;
      padding: 12px 14px;
      border: 1px solid rgba(255,255,255,.07);
      border-radius: 12px;
      background: rgba(255,255,255,.025);
    }

    .lf-week-status {
      padding: 3px 7px;
      border-radius: 6px;
      background: rgba(255,255,255,.06);
      font-size: 9px;
      font-weight: 750;
      letter-spacing: .06em;
    }

    .lf-week-summary {
      color: rgba(255,255,255,.46);
      font-size: 11px;
    }

    .lf-empty {
      padding: 35px;
      text-align: center;
      border: 1px dashed rgba(255,255,255,.1);
      border-radius: 14px;
    }

    @media (max-width: 1100px) {

      #props .lf-week-cards {
        grid-template-columns:
          repeat(2, minmax(0, 1fr)) !important;
      }

      .lf-market-grid {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }

    }

    @media (max-width: 650px) {

      #props .lf-week-cards {
        grid-template-columns: 1fr !important;
      }

      .lf-market-grid {
        grid-template-columns: 1fr;
      }

      .lf-market-controls {
        flex-direction: column;
        align-items: stretch;
      }

      .lf-market-search,
      .lf-market-filter {
        width: 100%;
      }

    }

  `;

  document.head.appendChild(style);
}


// ============================================================
// CONSENSUS BUILD
// ============================================================

function buildConsensusProps(
  signals,
  sources
) {
  const groups = new Map();

  (signals || []).forEach(
    signal => {

      const week =
        Number(
          signal.week || 1
        );

      const key = [
        signal.player,
        signal.market,
        week
      ]
        .join('|')
        .toLowerCase();

      if (!groups.has(key)) {

        groups.set(
          key,
          {
            player:
              signal.player,

            market:
              signal.market,

            week,

            signals: []
          }
        );

      }

      groups
        .get(key)
        .signals
        .push(signal);

    }
  );

  return Array.from(
    groups.values()
  )
    .map(group => {

      const signalsForProp =
        group.signals;

      const over =
        signalsForProp.filter(
          signal =>
            String(
              signal.side
            ).toUpperCase() ===
            'OVER'
        );

      const under =
        signalsForProp.filter(
          signal =>
            String(
              signal.side
            ).toUpperCase() ===
            'UNDER'
        );

      const yes =
        signalsForProp.filter(
          signal =>
            String(
              signal.side
            ).toUpperCase() ===
            'YES'
        );

      const total =
        signalsForProp.length;

      const primary =
        over.length >= under.length
          ? (
              over[0] ||
              yes[0] ||
              signalsForProp[0]
            )
          : under[0];

      const primarySide =
        String(
          primary?.side ||
          'OVER'
        ).toUpperCase();

      const agree =
        primarySide === 'UNDER'
          ? under.length
          : primarySide === 'YES'
            ? yes.length
            : over.length;

      const opposing =
        primarySide === 'UNDER'
          ? over.length
          : primarySide === 'YES'
            ? 0
            : under.length;

      const percent =
        total > 0
          ? Math.round(
              (agree / total) *
              100
            )
          : 0;

      const sourceMap =
        Object.fromEntries(
          (sources || []).map(
            source => [
              source.id,
              source
            ]
          )
        );

      const analysts =
        signalsForProp.map(
          signal => {

            const source =
              sourceMap[
                signal.sourceId
              ] || {};

            return {

              name:
                signal.analyst ||
                source.analyst ||
                'Unknown analyst',

              outlet:
                source.outlet ||
                '',

              side:
                signal.side ||
                '',

              line:
                signal.line,

              url:
                source.url ||
                signal.url ||
                ''

            };

          }
        );

      const lines =
        signalsForProp
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
        [
          ...new Set(lines)
        ].sort(
          (a, b) =>
            a - b
        );

      let lineDisplay = '';

      if (
        uniqueLines.length === 1
      ) {

        lineDisplay =
          formatNumber(
            uniqueLines[0]
          );

      }
      else if (
        uniqueLines.length > 1
      ) {

        lineDisplay =
          `${formatNumber(
            uniqueLines[0]
          )}–${formatNumber(
            uniqueLines[
              uniqueLines.length - 1
            ]
          )}`;

      }

      return {

        id:
          signalsForProp[0]?.id ||
          `${group.player}-${group.market}-${group.week}`,

        player:
          group.player,

        market:
          group.market,

        side:
          primary?.side ||
          'OVER',

        line:
          primary?.line ??
          null,

        week:
          group.week,

        weeks:
          [group.week],

        agree,

        disagree:
          opposing,

        experts:
          total,

        percent,

        lineDisplay,

        consensusDisplay:
          `${percent}%`,

        confidence:
          percent >= 75
            ? 'STRONG'
            : percent >= 60
              ? 'LEAN'
              : 'EARLY',

        analysts,

        rationale:
          `${agree} ${
            primary?.side ||
            'OVER'
          } expert${
            agree === 1
              ? ''
              : 's'
          } tracked for this market.`

      };

    });
}


// ============================================================
// RESULTS
// ============================================================

function resultForSignal(
  prop
) {
  if (!prop) {
    return null;
  }

  return (
    liveResults[prop.id] ||
    null
  );
}

function getResult(prop) {

  const result =
    resultForSignal(prop);

  if (!result) {
    return 'PENDING';
  }

  const status =
    String(
      result.result ||
      result.status ||
      ''
    ).toUpperCase();

  if (
    status === 'HIT' ||
    status === 'WIN'
  ) {
    return 'HIT';
  }

  if (
    status === 'MISS' ||
    status === 'LOSS'
  ) {
    return 'MISS';
  }

  if (
    status === 'LIVE' ||
    status === 'IN_PROGRESS'
  ) {
    return 'LIVE';
  }

  return 'PENDING';
}

function getActualValue(
  prop
) {
  const result =
    resultForSignal(prop);

  if (!result) {
    return null;
  }

  const candidates = [
    result.actual,
    result.actualValue,
    result.value,
    result.stat,
    result.playerStat,
    result.finalStat,
    result.currentStat,
    result.currentValue,
    result.yards,
    result.total
  ];

  for (
    const value of candidates
  ) {

    if (
      value !== null &&
      value !== undefined &&
      value !== ''
    ) {
      return value;
    }

  }

  return null;
}

function actualLabel(
  prop
) {
  const market =
    String(
      prop?.market ||
      ''
    ).toLowerCase();

  if (
    market.includes(
      'receiv'
    ) ||
    market.includes(
      'rushing'
    ) ||
    market.includes(
      'passing'
    )
  ) {
    return 'YARDS ACTUAL';
  }

  if (
    market.includes(
      'reception'
    )
  ) {
    return 'RECEPTIONS ACTUAL';
  }

  if (
    market.includes(
      'attempt'
    )
  ) {
    return 'ATTEMPTS ACTUAL';
  }

  if (
    market.includes(
      'interception'
    )
  ) {
    return 'INTERCEPTIONS ACTUAL';
  }

  if (
    market.includes(
      'touchdown'
    ) ||
    market.includes(
      'anytime'
    )
  ) {
    return 'TOUCHDOWNS ACTUAL';
  }

  return 'ACTUAL';
}

function liveStatus(
  prop
) {
  const status =
    getResult(prop);

  const actual =
    getActualValue(prop);

  if (
    status === 'HIT' ||
    status === 'MISS'
  ) {

    return `
      <div
        class="
          lf-result
          ${status.toLowerCase()}
        "
      >

        <strong>
          ${
            status === 'HIT'
              ? '🟢 BET HIT'
              : '🔴 BET MISS'
          }
        </strong>

        ${
          actual !== null
            ? `
              <span>
                ${escapeHtml(
                  formatNumber(
                    actual
                  )
                )}
                ${actualLabel(
                  prop
                )}
              </span>
            `
            : ''
        }

      </div>
    `;

  }

  if (
    status === 'LIVE'
  ) {

    return `
      <div
        class="lf-result live"
      >

        <strong>
          🔴 LIVE
        </strong>

        ${
          actual !== null
            ? `
              <span>
                ${escapeHtml(
                  formatNumber(
                    actual
                  )
                )}
                ${actualLabel(
                  prop
                )}
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

function sortProps(
  props
) {
  const order = {
    HIT: 0,
    LIVE: 1,
    PENDING: 2,
    MISS: 3
  };

  return [
    ...props
  ].sort(
    (a, b) => {

      const aOrder =
        order[
          getResult(a)
        ] ?? 2;

      const bOrder =
        order[
          getResult(b)
        ] ?? 2;

      if (
        aOrder !==
        bOrder
      ) {
        return (
          aOrder -
          bOrder
        );
      }

      return String(
        a.player
      ).localeCompare(
        String(
          b.player
        )
      );

    }
  );
}

function card(
  prop
) {
  const lockedPick =
    locked.includes(
      prop.id
    );

  const analysts =
    (
      prop.analysts ||
      []
    )
      .map(
        analyst => `
          <div
            class="analyst-source"
          >

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

              —

              ${escapeHtml(
                analyst.side ||
                ''
              )}

              ${
                analyst.line !==
                  null &&
                analyst.line !==
                  undefined
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
      class="
        prop
        ${
          lockedPick
            ? 'locked'
            : ''
        }
      "
    >

      <div
        class="prop-top"
      >

        <div
          class="game"
        >
          NFL • WEEK
          ${prop.week}
        </div>

        <div
          class="grade"
        >
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

        ${escapeHtml(
          prop.side
        )}

        ${
          prop.line !==
            null &&
          prop.line !==
            undefined
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

      ${liveStatus(
        prop
      )}

      <div
        class="metrics"
      >

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

      <div
        class="consensus-summary"
      >

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
            prop.disagree >
            0
              ? `
                •
                ${prop.disagree}
                ${
                  prop.side ===
                  'OVER'
                    ? 'UNDER'
                    : 'OVER'
                }
                expert${
                  prop.disagree ===
                  1
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
            prop.experts ===
            1
              ? 'Single-source signal'
              : `${prop.percent}% direction consensus`
          }

          ${
            prop.lineDisplay
              ? `
                • Published line:
                ${escapeHtml(
                  prop.lineDisplay
                )}
              `
              : ''
          }

        </span>

      </div>

      <div
        class="analyst-list"
      >

        ${analysts}

      </div>

      <p
        class="why"
      >
        ${escapeHtml(
          prop.rationale
        )}
      </p>

      <div
        class="card-actions"
      >

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
// WEEK SUMMARY
// ============================================================

function weekSummary(
  props
) {
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
    <span
      class="lf-week-summary"
    >

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
  return `
    <details
      class="lf-week-section"
      data-week="${week}"
      ${expanded ? 'open' : ''}
    >

      <summary>

        <div
          class="lf-week-heading"
        >

          <strong>
            WEEK ${week}
          </strong>

          <span
            class="lf-week-status"
          >
            ${
              Number(week) ===
              currentWeek()
                ? 'CURRENT'
                : (
                    props.some(
                      prop =>
                        getResult(
                          prop
                        ) ===
                          'PENDING' ||
                        getResult(
                          prop
                        ) ===
                          'LIVE'
                    )
                      ? 'IN PROGRESS'
                      : 'COMPLETE'
                  )
            }
          </span>

          ${weekSummary(
            props
          )}

        </div>

      </summary>

      <div
        class="
          cards
          lf-week-cards
        "
      >

        ${
          sortProps(
            props
          )
            .map(card)
            .join('')
        }

      </div>

    </details>
  `;
}


// ============================================================
// FILTERS
// ============================================================

const filterState = {
  search: '',
  week: 'ALL',
  market: 'ALL',
  outcome: 'ALL',
  consensus: 'ALL'
};

function getAvailableWeeks() {
  const weeks =
    (
      board?.props ||
      []
    )
      .flatMap(
        prop =>
          prop.weeks ||
          [prop.week]
      )
      .filter(Boolean)
      .map(Number);

  return [
    ...new Set(weeks)
  ].sort(
    (a, b) =>
      b - a
  );
}

function propMatchesFilters(
  prop
) {
  const search =
    filterState.search
      .trim()
      .toLowerCase();

  if (search) {

    const haystack =
      [
        prop.player,
        prop.market,
        prop.side,
        prop.line,
        ...(
          prop.analysts ||
          []
        ).map(
          analyst =>
            `${analyst.name} ${analyst.outlet}`
        )
      ]
        .join(' ')
        .toLowerCase();

    if (
      !haystack.includes(
        search
      )
    ) {
      return false;
    }
  }

  if (
    filterState.week !==
    'ALL'
  ) {

    const weeks =
      prop.weeks ||
      [prop.week];

    if (
      !weeks
        .map(String)
        .includes(
          String(
            filterState.week
          )
        )
    ) {
      return false;
    }
  }

  if (
    filterState.market !==
    'ALL' &&
    prop.market !==
      filterState.market
  ) {
    return false;
  }

  if (
    filterState.outcome !==
    'ALL' &&
    getResult(prop) !==
      filterState.outcome
  ) {
    return false;
  }

  if (
    filterState.consensus !==
    'ALL'
  ) {

    const percent =
      Number(
        prop.percent ||
        0
      );

    if (
      filterState.consensus ===
        'STRONG' &&
      percent < 75
    ) {
      return false;
    }

    if (
      filterState.consensus ===
        'LEAN' &&
      (
        percent < 60 ||
        percent >= 75
      )
    ) {
      return false;
    }

    if (
      filterState.consensus ===
        'EARLY' &&
      percent >= 60
    ) {
      return false;
    }

  }

  return true;
}

function updateFilterCount() {
  const button =
    $('#lfFilterButton');

  if (!button) {
    return;
  }

  let count = 0;

  if (
    filterState.week !==
    'ALL'
  ) count++;

  if (
    filterState.market !==
    'ALL'
  ) count++;

  if (
    filterState.outcome !==
    'ALL'
  ) count++;

  if (
    filterState.consensus !==
    'ALL'
  ) count++;

  button.textContent =
    count > 0
      ? `Filters (${count})`
      : 'Filters';
}


// ============================================================
// MARKET DATA
// ============================================================

async function loadMarketData() {

  try {

    const response =
      await fetch(
        `${MARKET_DATA_URL}?_=${Date.now()}`,
        {
          cache: 'no-store'
        }
      );

    if (!response.ok) {
      throw new Error(
        `Market data returned ${response.status}`
      );
    }

    marketData =
      await response.json();

    populateMarketTypes();

    renderMarkets();

    console.log(
      'LineFoundry market data loaded:',
      marketData
    );

  }
  catch (error) {

    console.error(
      'LineFoundry market data failed:',
      error
    );

    const container =
      $('#marketCards');

    if (container) {

      container.innerHTML = `
        <div
          class="lf-market-empty"
        >
          Market data is temporarily
          unavailable.
        </div>
      `;

    }

  }
}


// ============================================================
// MARKET HELPERS
// ============================================================

function marketWeek(
  market
) {
  const value =
    market?.week ??
    market?.event?.week;

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const match =
    String(value)
      .match(/\d+/);

  return match
    ? Number(match[0])
    : null;
}

function marketPlayerName(
  market
) {
  return (
    market?.player?.name ||
    'Unknown Player'
  );
}

function marketName(
  market
) {
  return (
    market?.market?.name ||
    'Player Prop'
  );
}

function marketLine(
  market
) {
  return (
    market?.sides?.over?.line ??
    market?.sides?.under?.line ??
    null
  );
}

function marketSide(
  market,
  side
) {
  return (
    market?.sides?.[
      side
    ] ||
    null
  );
}

function bestBook(
  market,
  side
) {
  const value =
    marketSide(
      market,
      side
    );

  return (
    value?.bestBook ||
    null
  );
}

function gameDescription(
  market
) {
  const game =
    market?.game ||
    {};

  if (
    game.awayTeam &&
    game.homeTeam
  ) {
    return `
      ${game.awayTeam}
      @
      ${game.homeTeam}
    `;
  }

  return '';
}

function marketType(
  market
) {
  return (
    market?.market?.marketType ||
    ''
  );
}


// ============================================================
// MARKET CARD
// ============================================================

function marketCard(
  market,
  index
) {
  const player =
    marketPlayerName(
      market
    );

  const name =
    marketName(
      market
    );

  const line =
    marketLine(
      market
    );

  const over =
    marketSide(
      market,
      'over'
    );

  const under =
    marketSide(
      market,
      'under'
    );

  const yes =
    marketSide(
      market,
      'yes'
    );

  const no =
    marketSide(
      market,
      'no'
    );

  const week =
    marketWeek(
      market
    );

  const game =
    gameDescription(
      market
    )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  const type =
    marketType(
      market
    );

  const isYesNo =
    type ===
    'yes_no';

  const best =
    isYesNo
      ? bestBook(
          market,
          'yes'
        )
      : (
          bestBook(
            market,
            'over'
          ) ||
          bestBook(
            market,
            'under'
          )
        );

  const id =
    market.id ||
    `market-${index}`;

  return `
    <article
      class="lf-market-card"
    >

      <div
        class="lf-market-top"
      >

        <div
          class="lf-market-player"
        >

          <strong>
            ${escapeHtml(
              player
            )}
          </strong>

          <span
            class="lf-market-game"
          >
            ${escapeHtml(
              game
            )}
          </span>

        </div>

        ${
          week
            ? `
              <span
                class="lf-market-week"
              >
                W${week}
              </span>
            `
            : ''
        }

      </div>

      <div
        class="lf-market-type"
      >
        ${escapeHtml(
          name
        )}
      </div>

      <div
        class="lf-market-line"
      >

        <span
          class="
            lf-market-line-number
          "
        >
          ${
            isYesNo
              ? 'YES'
              : formatNumber(
                  line
                )
          }
        </span>

        <div
          class="lf-market-sides"
        >

          ${
            isYesNo
              ? `
                <span
                  class="lf-market-side"
                >
                  YES
                  <b>
                    ${formatOdds(
                      yes?.odds
                    )}
                  </b>
                </span>

                ${
                  no
                    ? `
                      <span
                        class="lf-market-side"
                      >
                        NO
                        <b>
                          ${formatOdds(
                            no?.odds
                          )}
                        </b>
                      </span>
                    `
                    : ''
                }
              `
              : `
                <span
                  class="lf-market-side"
                >
                  OVER
                  <b>
                    ${formatOdds(
                      over?.odds
                    )}
                  </b>
                </span>

                <span
                  class="lf-market-side"
                >
                  UNDER
                  <b>
                    ${formatOdds(
                      under?.odds
                    )}
                  </b>
                </span>
              `
          }

        </div>

      </div>

      <div
        class="lf-market-divider"
      ></div>

      <div
        class="lf-market-bottom"
      >

        <span
          class="lf-market-best"
        >
          Best Price:
          <strong>
            ${escapeHtml(
              best ||
              '—'
            )}
          </strong>
        </span>

        <button
          class="lf-market-details"
          type="button"
          data-market-details="${escapeHtml(
            id
          )}"
        >
          Details →
        </button>

      </div>

    </article>
  `;
}


// ============================================================
// MARKET DETAILS
// ============================================================

function bookmakerRows(
  market
) {
  const bookmakers =
    market?.sides?.over?.sportsbooks ||
    market?.sides?.yes?.sportsbooks ||
    {};

  const rows =
    Object.entries(
      bookmakers
    )
      .map(
        ([key, book]) => {

          return `
            <div
              class="lf-market-book"
            >

              <strong
                class="
                  lf-market-book-name
                "
              >
                ${escapeHtml(
                  book?.name ||
                  key
                )}
              </strong>

              <span>
                ${formatNumber(
                  book?.line
                )}
              </span>

              <span>
                ${formatOdds(
                  book?.odds
                )}
              </span>

            </div>
          `;

        }
      )
      .join('');

  return (
    rows ||
    `
      <div
        class="lf-market-empty"
      >
        Bookmaker detail is not
        available for this market.
      </div>
    `
  );
}

function alternateLines(
  market
) {
  const lines =
    market?.sides?.over?.alternateLines ||
    market?.sides?.under?.alternateLines ||
    [];

  if (
    !Array.isArray(lines) ||
    !lines.length
  ) {
    return `
      <div
        class="lf-market-empty"
      >
        No alternate lines available.
      </div>
    `;
  }

  const unique =
    [
      ...new Set(
        lines
          .map(
            line =>
              line?.line
          )
          .filter(
            line =>
              line !== null &&
              line !== undefined
          )
          .map(String)
      )
    ];

  return `
    <div
      class="lf-alt-lines"
    >

      ${unique
        .map(
          line => `
            <span
              class="lf-alt-line"
            >
              ${escapeHtml(
                line
              )}
            </span>
          `
        )
        .join('')}

    </div>
  `;
}

function openMarketDetails(
  market
) {
  const existing =
    $('#lfMarketModal');

  if (existing) {
    existing.remove();
  }

  const player =
    marketPlayerName(
      market
    );

  const name =
    marketName(
      market
    );

  const line =
    marketLine(
      market
    );

  const over =
    marketSide(
      market,
      'over'
    );

  const under =
    marketSide(
      market,
      'under'
    );

  const modal =
    document.createElement(
      'div'
    );

  modal.id =
    'lfMarketModal';

  modal.className =
    'lf-market-modal';

  modal.innerHTML = `
    <div
      class="lf-market-modal-box"
      role="dialog"
      aria-modal="true"
    >

      <div
        class="lf-market-modal-head"
      >

        <div>

          <h3>
            ${escapeHtml(
              player
            )}
          </h3>

          <div
            class="lf-market-modal-sub"
          >
            ${escapeHtml(
              name
            )}

            ${
              line !== null
                ? `
                  ·
                  ${formatNumber(
                    line
                  )}
                `
                : ''
            }

          </div>

        </div>

        <button
          class="lf-market-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>

      <div
        class="
          lf-market-detail-section
        "
      >

        <h4>
          Current Market
        </h4>

        <div
          class="lf-market-book"
        >

          <strong
            class="
              lf-market-book-name
            "
          >
            Best Over
          </strong>

          <span>
            ${formatNumber(
              over?.line ??
              line
            )}
          </span>

          <span>
            ${formatOdds(
              over?.odds
            )}
          </span>

        </div>

        <div
          class="lf-market-book"
        >

          <strong
            class="
              lf-market-book-name
            "
          >
            Best Under
          </strong>

          <span>
            ${formatNumber(
              under?.line ??
              line
            )}
          </span>

          <span>
            ${formatOdds(
              under?.odds
            )}
          </span>

        </div>

      </div>

      <div
        class="
          lf-market-detail-section
        "
      >

        <h4>
          Sportsbook Prices
        </h4>

        ${bookmakerRows(
          market
        )}

      </div>

      <div
        class="
          lf-market-detail-section
        "
      >

        <h4>
          Alternate Lines
        </h4>

        ${alternateLines(
          market
        )}

      </div>

      <div
        class="
          lf-market-detail-section
        "
      >

        <h4>
          Line Movement
        </h4>

        <div
          class="lf-market-book"
        >

          <strong
            class="
              lf-market-book-name
            "
          >
            Open
          </strong>

          <span>
            ${formatNumber(
              market?.sides?.over?.openingLine ??
              market?.sides?.under?.openingLine ??
              '—'
            )}
          </span>

          <span>
            ${formatOdds(
              market?.sides?.over?.openingOdds ??
              market?.sides?.under?.openingOdds
            )}
          </span>

        </div>

        <div
          class="lf-market-book"
        >

          <strong
            class="
              lf-market-book-name
            "
          >
            Current
          </strong>

          <span>
            ${formatNumber(
              line
            )}
          </span>

          <span>
            ${formatOdds(
              over?.odds ??
              under?.odds
            )}
          </span>

        </div>

      </div>

    </div>
  `;

  document.body.appendChild(
    modal
  );

  modal
    .querySelector(
      '.lf-market-close'
    )
    ?.addEventListener(
      'click',
      () =>
        modal.remove()
    );

  modal.addEventListener(
    'click',
    event => {

      if (
        event.target ===
        modal
      ) {
        modal.remove();
      }

    }
  );
}


// ============================================================
// MARKET RENDER
// ============================================================

function renderMarkets() {

  const container =
    $('#marketCards');

  if (!container) {
    return;
  }

  const markets =
    marketData?.markets ||
    [];

  const search =
    $('#lfMarketSearch')
      ?.value
      ?.trim()
      .toLowerCase() ||
    '';

  const selectedMarket =
    $('#lfMarketType')
      ?.value ||
    'ALL';

  const filtered =
    markets.filter(
      market => {

        const player =
          marketPlayerName(
            market
          );

        const name =
          marketName(
            market
          );

        const game =
          gameDescription(
            market
          );

        const haystack =
          `${player} ${name} ${game}`
            .toLowerCase();

        if (
          search &&
          !haystack.includes(
            search
          )
        ) {
          return false;
        }

        if (
          selectedMarket !==
            'ALL' &&
          name !==
            selectedMarket
        ) {
          return false;
        }

        return true;
      }
    );

  if (!filtered.length) {

    container.innerHTML = `
      <div
        class="lf-market-empty"
      >
        No markets match your search.
      </div>
    `;

    return;
  }

  container.innerHTML =
    filtered
      .map(
        marketCard
      )
      .join('');

  container
    .querySelectorAll(
      '[data-market-details]'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            const id =
              button.dataset
                .marketDetails;

            const market =
              markets.find(
                item =>
                  String(
                    item.id
                  ) ===
                  String(id)
              );

            if (market) {
              openMarketDetails(
                market
              );
            }

          }
        );

      }
    );
}


// ============================================================
// MARKET UI
// ============================================================

function configureMarketUI() {

  const section =
    $('#nfl');

  if (!section) {
    return;
  }

  if (
    $('#marketCards')
  ) {
    return;
  }

  const wrapper =
    document.createElement(
      'div'
    );

  wrapper.className =
    'lf-market-wrap';

  wrapper.innerHTML = `

    <div
      class="lf-market-header"
    >

      <p class="eyebrow">
        NFL PROPS
      </p>

      <h2>
        The Market
      </h2>

      <p class="muted">
        Current player prop markets
        and the best available prices.
      </p>

    </div>

    <div
      class="lf-market-controls"
    >

      <input
        id="lfMarketSearch"
        class="lf-market-search"
        type="search"
        placeholder="Search players, props..."
        aria-label="Search NFL player props"
      >

      <select
        id="lfMarketType"
        class="lf-market-filter"
        aria-label="Filter market type"
      >

        <option value="ALL">
          All Markets
        </option>

      </select>

    </div>

    <div
      id="marketCards"
      class="lf-market-grid"
    ></div>

  `;

  section.appendChild(
    wrapper
  );

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
}

function populateMarketTypes() {

  const select =
    $('#lfMarketType');

  if (!select) {
    return;
  }

  const names =
    [
      ...new Set(
        (
          marketData?.markets ||
          []
        )
          .map(
            market =>
              marketName(
                market
              )
          )
          .filter(Boolean)
      )
    ].sort();

  select.innerHTML = `

    <option value="ALL">
      All Markets
    </option>

    ${names
      .map(
        name => `
          <option
            value="${escapeHtml(
              name
            )}"
          >
            ${escapeHtml(
              name
            )}
          </option>
        `
      )
      .join('')}

  `;
}


// ============================================================
// MAIN RENDER
// ============================================================

function render() {

  if (!board) {
    return;
  }

  updateFilterCount();

  const allProps =
    board.props ||
    [];

  const filteredProps =
    allProps.filter(
      prop =>
        propMatchesFilters(
          prop
        )
    );

  const selectedWeek =
    filterState.week;

  let weeks =
    getAvailableWeeks();

  if (
    selectedWeek !==
    'ALL'
  ) {

    weeks =
      weeks.filter(
        week =>
          String(week) ===
          String(
            selectedWeek
          )
      );

  }

  const container =
    $('#propCards');

  if (container) {

    if (
      !filteredProps.length
    ) {

      container.innerHTML = `
        <div
          class="lf-empty"
        >

          <h3>
            No picks match your filters
          </h3>

          <p>
            Try changing your search
            or filters.
          </p>

        </div>
      `;

    }
    else {

      const sorted =
        sortProps(
          filteredProps
        );

      const sections =
        weeks
          .map(
            week => {

              const weekProps =
                sorted.filter(
                  prop =>
                    (
                      prop.weeks ||
                      [prop.week]
                    ).includes(
                      Number(week)
                    )
                );

              if (
                !weekProps.length
              ) {
                return '';
              }

              const expanded =
                selectedWeek !==
                  'ALL'
                  ? true
                  : Number(week) ===
                    currentWeek();

              return weekSection(
                week,
                weekProps,
                expanded
              );

            }
          )
          .filter(Boolean)
          .join('');

      container.innerHTML =
        sections;

    }

  }

  if ($('#pickCount')) {
    $('#pickCount')
      .textContent =
      locked.length;
  }

  if ($('#sourceCount')) {
    $('#sourceCount')
      .textContent =
      board.sources?.length ||
      0;
  }

  if ($('#signalCount')) {
    $('#signalCount')
      .textContent =
      allProps.length;
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

  $('#sourceRows')
    .innerHTML =
      (
        board?.sources ||
        []
      )
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
                  (
                    source.quality ||
                    0
                  ) *
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

  const expertList =
    experts?.experts ||
    [];

  if (!$('#expertRows')) {
    return;
  }

  $('#expertRows')
    .innerHTML =
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
// LOAD
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
            cache:
              'no-store'
          }
        )
          .then(
            response => {

              if (
                !response.ok
              ) {
                throw new Error(
                  'Could not load public-signals.json'
                );
              }

              return response.json();

            }
          ),

        fetch(
          '/analyst-profiles.json',
          {
            cache:
              'no-store'
          }
        )
          .then(
            response => {

              if (
                !response.ok
              ) {
                throw new Error(
                  'Could not load analyst-profiles.json'
                );
              }

              return response.json();

            }
          ),

        fetch(
          '/results-ledger.json',
          {
            cache:
              'no-store'
          }
        )
          .then(
            response => {

              if (
                !response.ok
              ) {
                throw new Error(
                  'Could not load results-ledger.json'
                );
              }

              return response.json();

            }
          )

      ]);

    const signals =
      signalsData.signals ||
      [];

    const sources =
      signalsData.sources ||
      [];

    board = {

      mode:
        'public-consensus',

      week:
        signalsData.week,

      season:
        signalsData.season,

      refreshedAt:
        new Date().toISOString(),

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

    render();

    await loadLiveResults();

  }
  catch (error) {

    console.error(
      'LineFoundry data load failed:',
      error
    );

    if (
      $('#propCards')
    ) {

      $('#propCards')
        .innerHTML = `
          <div
            class="empty-state"
          >

            <h3>
              Unable to load
              LineFoundry data
            </h3>

            <p>
              Please refresh the page
              and try again.
            </p>

          </div>
        `;

    }

  }

}


// ============================================================
// LIVE RESULTS
// ============================================================

async function loadLiveResults() {

  try {

    const response =
      await fetch(
        `${WORKER_URL}?_=${Date.now()}`,
        {
          cache:
            'no-store'
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
      data.results ||
      []
    )
      .forEach(
        result => {

          if (
            result.id
          ) {

            liveResults[
              result.id
            ] = result;

          }

        }
      );

    if (board) {

      board.liveUpdatedAt =
        data.updatedAt ||
        new Date().toISOString();

      render();

    }

  }
  catch (error) {

    console.error(
      'LineFoundry live data failed:',
      error
    );

  }

}


// ============================================================
// CONSENSUS FILTER UI
// ============================================================

function configureConsensusFilter() {

  const oldToolbar =
    document.querySelector(
      '#props .toolbar'
    );

  if (
    oldToolbar
  ) {
    oldToolbar.style.display =
      'none';
  }

  const propHead =
    document.querySelector(
      '#props .section-head'
    );

  if (
    !propHead ||
    $('#lfConsensusControls')
  ) {
    return;
  }

  const controls =
    document.createElement(
      'div'
    );

  controls.id =
    'lfConsensusControls';

  controls.style.cssText =
    `
      display:flex;
      gap:10px;
      align-items:center;
      margin-top:18px;
      flex-wrap:wrap;
    `;

  controls.innerHTML = `

    <input
      id="lfConsensusSearch"
      type="search"
      placeholder="Search players, props..."
      style="
        flex:1;
        min-width:220px;
        height:50px;
        padding:0 16px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.1);
        background:rgba(255,255,255,.035);
        color:inherit;
        font:inherit;
        outline:none;
      "
    >

    <button
      id="lfFilterButton"
      class="secondary-btn"
      type="button"
      style="
        height:50px;
        border-radius:999px;
      "
    >
      Filters
    </button>

  `;

  propHead.appendChild(
    controls
  );

  const panel =
    document.createElement(
      'div'
    );

  panel.id =
    'lfFilterPanel';

  panel.hidden =
    true;

  panel.style.cssText =
    `
      margin-top:12px;
      padding:16px;
      border:1px solid rgba(255,255,255,.08);
      border-radius:14px;
      background:rgba(255,255,255,.025);
    `;

  panel.innerHTML = `

    <div
      style="
        display:grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap:10px;
      "
    >

      <select
        id="lfWeekFilter"
        class="secondary-btn"
      >
        <option value="ALL">
          All Weeks
        </option>
      </select>

      <select
        id="lfMarketFilter"
        class="secondary-btn"
      >
        <option value="ALL">
          All Markets
        </option>
      </select>

      <select
        id="lfOutcomeFilter"
        class="secondary-btn"
      >

        <option value="ALL">
          All Results
        </option>

        <option value="HIT">
          Bet Hit
        </option>

        <option value="MISS">
          Bet Miss
        </option>

        <option value="LIVE">
          Live
        </option>

        <option value="PENDING">
          Pending
        </option>

      </select>

      <select
        id="lfConsensusFilter"
        class="secondary-btn"
      >

        <option value="ALL">
          All Consensus
        </option>

        <option value="STRONG">
          Strong 75%+
        </option>

        <option value="LEAN">
          Lean 60–74%
        </option>

        <option value="EARLY">
          Early <60%
        </option>

      </select>

    </div>

  `;

  propHead.appendChild(
    panel
  );

  $('#lfConsensusSearch')
    ?.addEventListener(
      'input',
      event => {

        filterState.search =
          event.target.value;

        render();

      }
    );

  $('#lfFilterButton')
    ?.addEventListener(
      'click',
      () => {

        panel.hidden =
          !panel.hidden;

      }
    );

  $('#lfWeekFilter')
    ?.addEventListener(
      'change',
      event => {

        filterState.week =
          event.target.value;

        render();

      }
    );

  $('#lfMarketFilter')
    ?.addEventListener(
      'change',
      event => {

        filterState.market =
          event.target.value;

        render();

      }
    );

  $('#lfOutcomeFilter')
    ?.addEventListener(
      'change',
      event => {

        filterState.outcome =
          event.target.value;

        render();

      }
    );

  $('#lfConsensusFilter')
    ?.addEventListener(
      'change',
      event => {

        filterState.consensus =
          event.target.value;

        render();

      }
    );

}


// ============================================================
// POPULATE CONSENSUS FILTERS
// ============================================================

function populateConsensusFilters() {

  const weekSelect =
    $('#lfWeekFilter');

  const marketSelect =
    $('#lfMarketFilter');

  if (
    weekSelect &&
    board
  ) {

    const weeks =
      getAvailableWeeks();

    weekSelect.innerHTML = `

      <option value="ALL">
        All Weeks
      </option>

      ${weeks
        .map(
          week => `
            <option
              value="${week}"
            >
              Week ${week}
            </option>
          `
        )
        .join('')}

    `;

  }

  if (
    marketSelect &&
    board
  ) {

    const markets =
      [
        ...new Set(
          (
            board.props ||
            []
          )
            .map(
              prop =>
                prop.market
            )
            .filter(Boolean)
        )
      ].sort();

    marketSelect.innerHTML = `

      <option value="ALL">
        All Markets
      </option>

      ${markets
        .map(
          market => `
            <option
              value="${escapeHtml(
                market
              )}"
            >
              ${escapeHtml(
                market
              )}
            </option>
          `
        )
        .join('')}

    `;

  }

}


// ============================================================
// EVENTS / INITIALIZATION
// ============================================================

injectBoardStyles();

configureMarketUI();

configureConsensusFilter();

$('#refreshBoard')
  ?.addEventListener(
    'click',
    async () => {

      await load();

      await loadMarketData();

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
// START
// ============================================================

load()
  .then(
    () => {

      populateConsensusFilters();

    }
  );

loadMarketData();

setInterval(
  loadLiveResults,
  60000
);
