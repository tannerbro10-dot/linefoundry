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
// BASIC HELPERS
// ============================================================

function normalizeSide(side) {
  const value = String(side || '')
    .trim()
    .toUpperCase();

  if (
    value === 'YES' ||
    value === 'OVER'
  ) {
    return 'OVER';
  }

  if (
    value === 'NO' ||
    value === 'UNDER'
  ) {
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
// UI STYLES
// ============================================================

function injectBoardStyles() {
  if ($('#lfBoardStyles')) {
    return;
  }

  const style =
    document.createElement('style');

  style.id = 'lfBoardStyles';

  style.textContent = `

    /* ========================================================
       BOARD WIDTH
       ======================================================== */

    #props {
      width: 100%;
    }

    #props .section-head {
      width: 100%;
      margin-bottom: 22px;
    }

    #props .section-head > .toolbar {
      display: none !important;
    }

    #propCards {
      width: 100%;
      display: block;
    }


    /* ========================================================
       SEARCH + FILTER BAR
       ======================================================== */

    .lf-controls {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0 0 24px;
      position: relative;
      z-index: 20;
    }

    .lf-search-wrap {
      position: relative;
      flex: 1 1 auto;
      min-width: 280px;
    }

    .lf-search-icon {
      position: absolute;
      left: 17px;
      top: 50%;
      transform: translateY(-50%);
      width: 17px;
      height: 17px;
      color: #748295;
      pointer-events: none;
    }

    .lf-search {
      width: 100%;
      height: 50px;
      border-radius: 15px !important;
      border: 1px solid #263140 !important;
      background:
        linear-gradient(
          180deg,
          rgba(17,24,35,.96),
          rgba(10,15,22,.96)
        ) !important;
      color: #f4f7fb !important;
      padding: 0 18px 0 48px !important;
      font-size: 14px !important;
      outline: none;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.025),
        0 8px 25px rgba(0,0,0,.12);
      transition:
        border-color .2s ease,
        box-shadow .2s ease,
        background .2s ease;
    }

    .lf-search::placeholder {
      color: #68778a;
    }

    .lf-search:focus {
      border-color: rgba(125,242,178,.42) !important;
      background:
        linear-gradient(
          180deg,
          rgba(18,27,38,.98),
          rgba(10,16,23,.98)
        ) !important;
      box-shadow:
        0 0 0 3px rgba(125,242,178,.07),
        0 10px 30px rgba(0,0,0,.18);
    }


    /* ========================================================
       COMBINED FILTER
       ======================================================== */

    .lf-filter-wrap {
      position: relative;
      flex: 0 0 auto;
    }

    .lf-filter-button {
      height: 50px;
      min-width: 138px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      border-radius: 15px !important;
      border: 1px solid #263140 !important;
      background:
        linear-gradient(
          180deg,
          #111823,
          #0b1017
        ) !important;
      color: #eaf0f5 !important;
      padding: 0 16px !important;
      font-size: 13px !important;
      font-weight: 800 !important;
      cursor: pointer;
      transition:
        border-color .2s ease,
        background .2s ease;
    }

    .lf-filter-button:hover,
    .lf-filter-button.active {
      border-color: rgba(125,242,178,.38) !important;
      background:
        linear-gradient(
          180deg,
          #15201f,
          #0d1517
        ) !important;
    }

    .lf-filter-button svg {
      width: 16px;
      height: 16px;
    }

    .lf-filter-count {
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: rgba(125,242,178,.12);
      color: var(--green);
      font-size: 10px;
      font-weight: 900;
    }


    /* ========================================================
       FILTER PANEL
       ======================================================== */

    .lf-filter-panel {
      position: absolute;
      right: 0;
      top: calc(100% + 10px);
      width: 340px;
      max-width: calc(100vw - 32px);
      background:
        linear-gradient(
          180deg,
          #111923,
          #0b1017
        );
      border: 1px solid #2a3544;
      border-radius: 18px;
      padding: 8px;
      box-shadow:
        0 25px 70px rgba(0,0,0,.48),
        0 0 0 1px rgba(255,255,255,.015);
      display: none;
      z-index: 100;
    }

    .lf-filter-panel.open {
      display: block;
      animation:
        lfFilterIn .15s ease-out;
    }

    @keyframes lfFilterIn {
      from {
        opacity: 0;
        transform: translateY(-5px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .lf-filter-section {
      border-bottom: 1px solid #1c2632;
    }

    .lf-filter-section:last-child {
      border-bottom: 0;
    }

    .lf-filter-section-title {
      width: 100%;
      min-height: 45px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: transparent;
      border: 0;
      border-radius: 10px;
      color: #dbe4ec;
      padding: 0 10px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .lf-filter-section-title:hover {
      background: rgba(255,255,255,.025);
    }

    .lf-filter-chevron {
      color: #6f7e8f;
      transition: transform .15s ease;
    }

    .lf-filter-section.expanded
      .lf-filter-chevron {
      transform: rotate(180deg);
    }

    .lf-filter-options {
      display: none;
      padding: 0 7px 9px;
    }

    .lf-filter-section.expanded
      .lf-filter-options {
      display: grid;
      gap: 3px;
    }

    .lf-filter-option {
      width: 100%;
      min-height: 38px;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: #aeb9c5;
      text-align: left;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .lf-filter-option:hover {
      background: rgba(255,255,255,.035);
      color: #fff;
    }

    .lf-filter-option.selected {
      background: rgba(125,242,178,.08);
      color: var(--green);
    }

    .lf-filter-option-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      border: 1px solid #526172;
      flex: 0 0 auto;
    }

    .lf-filter-option.selected
      .lf-filter-option-dot {
      border-color: var(--green);
      background: var(--green);
      box-shadow:
        0 0 0 3px rgba(125,242,178,.08);
    }

    .lf-filter-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 10px 7px 5px;
    }

    .lf-filter-active-label {
      color: #718094;
      font-size: 10px;
    }

    .lf-filter-clear {
      border: 0 !important;
      background: transparent !important;
      color: var(--green) !important;
      padding: 7px 9px !important;
      font-size: 10px !important;
      font-weight: 900 !important;
      text-transform: uppercase;
      letter-spacing: .08em;
      cursor: pointer;
    }

    .lf-filter-clear:hover {
      background: rgba(125,242,178,.06) !important;
    }


    /* ========================================================
       WEEK SECTIONS
       ======================================================== */

    .lf-week-section {
      width: 100%;
      margin-bottom: 18px;
      border: 1px solid #1d2734;
      border-radius: 18px;
      background: rgba(8,12,17,.34);
      overflow: visible;
    }

    .lf-week-section > summary {
      list-style: none;
      cursor: pointer;
      padding: 18px 20px;
      border-radius: 18px;
      user-select: none;
    }

    .lf-week-section > summary::-webkit-details-marker {
      display: none;
    }

    .lf-week-section > summary:hover {
      background: rgba(255,255,255,.015);
    }

    .lf-week-heading {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .lf-week-heading strong {
      color: #fff;
      font: 700 18px/1 'Space Grotesk', sans-serif;
      letter-spacing: -.02em;
    }

    .lf-week-status {
      padding: 5px 8px;
      border-radius: 7px;
      background: rgba(125,242,178,.08);
      color: var(--green);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .1em;
    }

    .lf-week-summary {
      color: #718094;
      font-size: 11px;
      font-weight: 600;
    }

    .lf-week-cards {
      padding: 0 18px 18px;
      display: grid !important;
      grid-template-columns:
        repeat(3, minmax(0, 1fr));
      gap: 16px;
    }


    /* ========================================================
       CARDS
       ======================================================== */

    .lf-week-cards .prop {
      min-width: 0;
      width: 100%;
      padding: 19px;
    }

    .lf-week-cards .prop h3 {
      line-height: 1.25;
    }

    .lf-week-cards .live-stat {
      margin: 13px 0;
    }

    .actual-stat {
      display: block;
      margin-top: 5px;
      color: #aeb9c5;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
    }

    .consensus-over {
      color: var(--green);
    }

    .consensus-under {
      color: #ff9a9a;
    }


    /* ========================================================
       EMPTY STATE
       ======================================================== */

    .lf-empty {
      width: 100%;
      padding: 55px 25px;
      text-align: center;
      border: 1px dashed #273241;
      border-radius: 18px;
      background: rgba(10,15,22,.45);
    }

    .lf-empty h3 {
      margin: 0 0 7px;
      font: 700 20px 'Space Grotesk';
    }

    .lf-empty p {
      margin: 0;
      color: #718094;
      font-size: 12px;
    }


    /* ========================================================
       RESPONSIVE
       ======================================================== */

    @media (max-width: 1050px) {
      .lf-week-cards {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 700px) {
      .lf-controls {
        align-items: stretch;
      }

      .lf-search-wrap {
        min-width: 0;
      }

      .lf-filter-button {
        min-width: 112px;
      }

      .lf-week-cards {
        grid-template-columns: 1fr;
        padding: 0 12px 12px;
      }

      .lf-week-section > summary {
        padding: 15px;
      }
    }

    @media (max-width: 500px) {
      .lf-controls {
        flex-direction: column;
      }

      .lf-filter-wrap {
        width: 100%;
      }

      .lf-filter-button {
        width: 100%;
      }

      .lf-filter-panel {
        width: 100%;
        left: 0;
        right: auto;
      }
    }

  `;

  document.head.appendChild(style);
}


// ============================================================
// CONSENSUS ENGINE
// ============================================================

function consensusKey(signal) {
  return [
    normalizeText(signal.player),
    normalizeText(signal.market),
    getSignalWeek(signal)
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

  (board?.rawSignals || [])
    .forEach(signal => {
      const week =
        getSignalWeek(signal);

      if (Number.isFinite(week)) {
        weeks.add(week);
      }
    });

  if (
    board?.week !== null &&
    board?.week !== undefined
  ) {
    weeks.add(
      Number(board.week)
    );
  }

  return [...weeks]
    .sort((a, b) => a - b);
}


function currentWeek() {
  const weeks =
    getAvailableWeeks();

  if (!weeks.length) {
    return Number(
      board?.week || 1
    );
  }

  return Math.max(...weeks);
}


// ============================================================
// BUILD CONSENSUS PROPS
// ============================================================

function buildConsensusProps(
  signals,
  sources
) {
  const groups = new Map();

  signals.forEach(signal => {
    const key =
      consensusKey(signal);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups
      .get(key)
      .push(signal);
  });

  return Array
    .from(groups.values())
    .map(group => {

      const first =
        group[0];

      const overSignals =
        group.filter(
          signal =>
            normalizeSide(
              signal.side
            ) === 'OVER'
        );

      const underSignals =
        group.filter(
          signal =>
            normalizeSide(
              signal.side
            ) === 'UNDER'
        );

      const over =
        overSignals.length;

      const under =
        underSignals.length;

      const total =
        group.length;

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
          normalizeSide(
            first.side
          );

        agree = over;
        disagree = under;
      }

      const percent =
        total > 0
          ? Math.round(
              (agree / total) *
              100
            )
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
                item.id ===
                signal.sourceId
            );

          return {
            name:
              signal.analyst,

            outlet:
              source?.outlet || '',

            sourceId:
              signal.sourceId,

            url:
              source?.url || '',

            note:
              signal.note || '',

            side:
              normalizeSide(
                signal.side
              ),

            line:
              signal.line,

            week:
              getSignalWeek(
                signal
              ),

            signalId:
              signal.id
          };
        });

      const majoritySignals =
        group.filter(
          signal =>
            normalizeSide(
              signal.side
            ) === majoritySide
        );

      const majorityLines =
        majoritySignals
          .map(
            signal =>
              signal.line
          )
          .filter(
            line =>
              line !== null &&
              line !== undefined &&
              line !== ''
          )
          .map(Number)
          .filter(
            Number.isFinite
          );

      const allLines =
        group
          .map(
            signal =>
              signal.line
          )
          .filter(
            line =>
              line !== null &&
              line !== undefined &&
              line !== ''
          )
          .map(Number)
          .filter(
            Number.isFinite
          );

      const uniqueLines =
        [
          ...new Set(
            allLines
          )
        ].sort(
          (a, b) => a - b
        );

      const line =
        majorityLines.length
          ? majorityLines[0]
          : first.line;

      let lineDisplay = '';

      if (
        uniqueLines.length === 1
      ) {
        lineDisplay =
          String(
            uniqueLines[0]
          );
      }
      else if (
        uniqueLines.length > 1
      ) {
        lineDisplay =
          `${uniqueLines[0]}–${uniqueLines[uniqueLines.length - 1]}`;
      }

      let rationale;

      if (total === 1) {
        rationale =
          'One tracked source currently supports this direction; treat it as an early signal until more sources agree.';
      }
      else if (
        over === under
      ) {
        rationale =
          `${over} OVER expert${over === 1 ? '' : 's'} and ${under} UNDER expert${under === 1 ? '' : 's'} — the sources are split.`;
      }
      else {
        rationale =
          `${agree} ${majoritySide} expert${agree === 1 ? '' : 's'} • ${disagree} opposing expert${disagree === 1 ? '' : 's'} • ${percent}% direction consensus.`;
      }

      const weeks =
        [
          ...new Set(
            group.map(
              signal =>
                getSignalWeek(
                  signal
                )
            )
          )
        ].sort(
          (a, b) => a - b
        );

      return {

        id:
          `CONS-${group
            .map(
              signal =>
                signal.id
            )
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
            ? `1/1 ${majoritySide}`
            : `${agree}/${total} ${majoritySide}`,

        confidence:
          consensusLabel(
            strength
          ),

        rationale:
          rationale,

        weeks:
          weeks,

        week:
          weeks.length
            ? weeks[0]
            : Number(
                board?.week || 1
              )
      };
    });
}


// ============================================================
// FILTER STATE
// ============================================================

const filterState = {
  week: 'ALL',
  market: 'ALL',
  outcome: 'ALL',
  consensus: 'ALL',
  player: ''
};


// ============================================================
// FILTER UI
// ============================================================

function createFilterUI() {
  const cards =
    $('#propCards');

  if (!cards) {
    return;
  }

  /*
   * Remove the old Confidence toolbar.
   */
  const oldToolbar =
    document.querySelector(
      '#props .section-head .toolbar'
    );

  if (oldToolbar) {
    oldToolbar.remove();
  }

  /*
   * Remove any previous generated controls.
   */
  $('#lfControls')
    ?.remove();

  const controls =
    document.createElement('div');

  controls.id =
    'lfControls';

  controls.className =
    'lf-controls';

  controls.innerHTML = `

    <div class="lf-search-wrap">

      <svg
        class="lf-search-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle
          cx="11"
          cy="11"
          r="7"
        ></circle>

        <path
          d="m20 20-3.5-3.5"
        ></path>
      </svg>

      <input
        id="lfPlayerSearch"
        class="lf-search"
        type="search"
        placeholder="Search players, props..."
        autocomplete="off"
        aria-label="Search players and props"
      />

    </div>


    <div class="lf-filter-wrap">

      <button
        id="lfFilterButton"
        class="lf-filter-button"
        type="button"
        aria-expanded="false"
      >

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line
            x1="4"
            y1="6"
            x2="20"
            y2="6"
          ></line>

          <line
            x1="7"
            y1="12"
            x2="20"
            y2="12"
          ></line>

          <line
            x1="10"
            y1="18"
            x2="20"
            y2="18"
          ></line>
        </svg>

        <span>
          Filters
        </span>

        <span
          id="lfFilterCount"
          class="lf-filter-count"
          style="display:none"
        >
          0
        </span>

      </button>


      <div
        id="lfFilterPanel"
        class="lf-filter-panel"
        aria-hidden="true"
      ></div>

    </div>

  `;

  /*
   * Insert directly above the cards.
   */
  cards.parentNode.insertBefore(
    controls,
    cards
  );

  $('#lfPlayerSearch')
    ?.addEventListener(
      'input',
      event => {
        filterState.player =
          event.target.value;

        render();
      }
    );

  $('#lfFilterButton')
    ?.addEventListener(
      'click',
      event => {
        event.stopPropagation();

        toggleFilterPanel();
      }
    );

  document.addEventListener(
    'click',
    closeFilterOnOutsideClick
  );

  renderFilterPanel();
}


function toggleFilterPanel() {
  const panel =
    $('#lfFilterPanel');

  const button =
    $('#lfFilterButton');

  if (!panel || !button) {
    return;
  }

  const open =
    panel.classList.toggle(
      'open'
    );

  button.classList.toggle(
    'active',
    open
  );

  button.setAttribute(
    'aria-expanded',
    open
      ? 'true'
      : 'false'
  );

  panel.setAttribute(
    'aria-hidden',
    open
      ? 'false'
      : 'true'
  );
}


function closeFilterOnOutsideClick(
  event
) {
  const wrapper =
    document.querySelector(
      '.lf-filter-wrap'
    );

  if (
    wrapper &&
    !wrapper.contains(
      event.target
    )
  ) {
    const panel =
      $('#lfFilterPanel');

    const button =
      $('#lfFilterButton');

    panel?.classList.remove(
      'open'
    );

    button?.classList.remove(
      'active'
    );

    button?.setAttribute(
      'aria-expanded',
      'false'
    );
  }
}


function renderFilterPanel() {
  const panel =
    $('#lfFilterPanel');

  if (!panel) {
    return;
  }

  const weeks =
    getAvailableWeeks();

  const markets =
    [
      ...new Set(
        (board?.props || [])
          .map(
            prop =>
              prop.market
          )
          .filter(Boolean)
      )
    ].sort(
      (a, b) =>
        String(a).localeCompare(
          String(b)
        )
    );

  panel.innerHTML = `

    ${filterSection(
      'week',
      'Week',
      [
        {
          value: 'ALL',
          label: 'All Weeks'
        },
        ...weeks.map(
          week => ({
            value:
              String(week),
            label:
              `Week ${week}`
          })
        )
      ],
      filterState.week
    )}


    ${filterSection(
      'market',
      'Market',
      [
        {
          value: 'ALL',
          label: 'All Markets'
        },
        ...markets.map(
          market => ({
            value:
              market,
            label:
              market
          })
        )
      ],
      filterState.market
    )}


    ${filterSection(
      'outcome',
      'Outcome',
      [
        {
          value: 'ALL',
          label: 'All Outcomes'
        },
        {
          value: 'PENDING',
          label: 'Pending / Live'
        },
        {
          value: 'HIT',
          label: 'Bet Hit'
        },
        {
          value: 'MISS',
          label: 'Bet Miss'
        }
      ],
      filterState.outcome
    )}


    ${filterSection(
      'consensus',
      'Consensus',
      [
        {
          value: 'ALL',
          label: 'All Consensus'
        },
        {
          value: '2',
          label: '2+ Experts'
        },
        {
          value: '3',
          label: '3+ Experts'
        },
        {
          value: '4',
          label: '4+ Experts'
        }
      ],
      filterState.consensus
    )}


    <div class="lf-filter-footer">

      <span
        id="lfFilterActiveLabel"
        class="lf-filter-active-label"
      >
        No filters applied
      </span>

      <button
        id="lfFilterClear"
        class="lf-filter-clear"
        type="button"
      >
        Clear Filters
      </button>

    </div>

  `;

  /*
   * Open the first section by default.
   */
  panel
    .querySelector(
      '.lf-filter-section'
    )
    ?.classList.add(
      'expanded'
    );

  panel
    .querySelectorAll(
      '.lf-filter-section-title'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const section =
            button.closest(
              '.lf-filter-section'
            );

          section?.classList.toggle(
            'expanded'
          );

        }
      );

    });

  panel
    .querySelectorAll(
      '.lf-filter-option'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const type =
            button.dataset.filterType;

          const value =
            button.dataset.value;

          filterState[type] =
            value;

          renderFilterPanel();

          render();

        }
      );

    });

  $('#lfFilterClear')
    ?.addEventListener(
      'click',
      () => {

        filterState.week =
          'ALL';

        filterState.market =
          'ALL';

        filterState.outcome =
          'ALL';

        filterState.consensus =
          'ALL';

        renderFilterPanel();

        render();

      }
    );

  updateFilterCount();
}


function filterSection(
  type,
  title,
  options,
  selected
) {
  const hasFilter =
    selected !== 'ALL';

  return `

    <div
      class="lf-filter-section ${
        hasFilter
          ? 'expanded'
          : ''
      }"
    >

      <button
        class="lf-filter-section-title"
        type="button"
      >

        <span>
          ${escapeHtml(title)}
        </span>

        <svg
          class="lf-filter-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline
            points="6 9 12 15 18 9"
          ></polyline>
        </svg>

      </button>


      <div class="lf-filter-options">

        ${options
          .map(option => `

            <button
              class="
                lf-filter-option
                ${
                  String(
                    selected
                  ) ===
                  String(
                    option.value
                  )
                    ? 'selected'
                    : ''
                }
              "
              type="button"
              data-filter-type="${escapeHtml(type)}"
              data-value="${escapeHtml(option.value)}"
            >

              <span
                class="lf-filter-option-dot"
              ></span>

              <span>
                ${escapeHtml(
                  option.label
                )}
              </span>

            </button>

          `)
          .join('')}

      </div>

    </div>

  `;
}


function updateFilterCount() {
  const count =
    [
      filterState.week !== 'ALL',
      filterState.market !== 'ALL',
      filterState.outcome !== 'ALL',
      filterState.consensus !== 'ALL'
    ]
      .filter(Boolean)
      .length;

  const badge =
    $('#lfFilterCount');

  if (badge) {

    badge.textContent =
      count;

    badge.style.display =
      count
        ? 'inline-flex'
        : 'none';

  }

  const label =
    $('#lfFilterActiveLabel');

  if (label) {

    label.textContent =
      count === 0
        ? 'No filters applied'
        : `${count} filter${count === 1 ? '' : 's'} active`;

  }
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
        )
          .then(response => {

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
        )
          .then(response => {

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
        )
          .then(response => {

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


    injectBoardStyles();

    createFilterUI();

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
// LIVE ESPN RESULTS
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
// RESULT LOOKUP
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
        normalizeText(
          signal.player
        ) !==
        normalizeText(
          prop.player
        )
      ) {
        return false;
      }


      if (
        normalizeText(
          signal.market
        ) !==
        normalizeText(
          prop.market
        )
      ) {
        return false;
      }


      if (
        getSignalWeek(
          signal
        ) !==
        Number(prop.week)
      ) {
        return false;
      }


      if (
        !analystIds.has(
          signal.sourceId
        )
      ) {
        return false;
      }


      return true;

    })
    .map(
      signal =>
        signal.id
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
    return 'HIT';
  }


  if (
    misses.length &&
    !hits.length
  ) {
    return 'MISS';
  }


  if (live) {
    return 'LIVE';
  }


  if (
    hits.length ||
    misses.length
  ) {
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

    result.currentValue,

    result.yards,

    result.total

  ];


  for (
    const value of possibleValues
  ) {

    if (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      Number.isFinite(
        Number(value)
      )
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
      .map(
        extractActualValue
      )
      .filter(
        value =>
          value !== null &&
          value !== undefined
      );


  if (!values.length) {
    return null;
  }


  return values[0];

}


function marketActualLabel(
  market
) {

  const value =
    normalizeText(market);


  if (
    value.includes(
      'receiving'
    ) ||
    value.includes(
      'rushing'
    ) ||
    value.includes(
      'passing'
    )
  ) {
    return 'YARDS ACTUAL';
  }


  if (
    value.includes(
      'reception'
    )
  ) {
    return 'RECEPTIONS ACTUAL';
  }


  if (
    value.includes(
      'attempt'
    )
  ) {
    return 'ATTEMPTS ACTUAL';
  }


  if (
    value.includes(
      'interception'
    )
  ) {
    return 'INTERCEPTIONS ACTUAL';
  }


  if (
    value.includes(
      'touchdown'
    )
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


  if (
    result === 'HIT'
  ) {

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
                ${marketActualLabel(
                  prop.market
                )}
              </span>
            `
            : ''
        }

      </div>

    `;

  }


  if (
    result === 'MISS'
  ) {

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
                ${marketActualLabel(
                  prop.market
                )}
              </span>
            `
            : ''
        }

      </div>

    `;

  }


  if (
    result === 'LIVE'
  ) {

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
                ${marketActualLabel(
                  prop.market
                )}
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

function propMatchesFilters(
  prop
) {

  const playerSearch =
    normalizeText(
      filterState.player
    );


  if (
    playerSearch &&
    !normalizeText(
      `${prop.player} ${prop.market} ${prop.side}`
    ).includes(
      playerSearch
    )
  ) {
    return false;
  }


  if (
    filterState.week !==
    'ALL'
  ) {

    if (
      !prop.weeks.includes(
        Number(
          filterState.week
        )
      )
    ) {
      return false;
    }

  }


  if (
    filterState.market !==
    'ALL'
  ) {

    if (
      String(
        prop.market
      ) !==
      String(
        filterState.market
      )
    ) {
      return false;
    }

  }


  const outcome =
    getResult(prop);


  if (
    filterState.outcome ===
    'HIT'
  ) {

    if (
      outcome !== 'HIT'
    ) {
      return false;
    }

  }


  if (
    filterState.outcome ===
    'MISS'
  ) {

    if (
      outcome !== 'MISS'
    ) {
      return false;
    }

  }


  if (
    filterState.outcome ===
    'PENDING'
  ) {

    if (
      outcome !== 'PENDING' &&
      outcome !== 'LIVE'
    ) {
      return false;
    }

  }


  if (
    filterState.consensus !==
    'ALL'
  ) {

    const minimum =
      Number(
        filterState.consensus
      );

    if (
      prop.experts <
      minimum
    ) {
      return false;
    }

  }


  return true;

}


// ============================================================
// SORT
// ============================================================

function sortProps(
  props
) {

  return [...props]
    .sort(
      (a, b) => {

        /*
         * Most experts first.
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
         * Strongest consensus second.
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
         * Alphabetical tiebreaker.
         */
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


// ============================================================
// CARD
// ============================================================

function card(prop) {

  const lockedPick =
    locked.includes(
      prop.id
    );


  const sideClass =
    prop.side === 'UNDER'
      ? 'consensus-under'
      : 'consensus-over';


  const analysts =
    prop.analysts
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
                  prop.side ===
                  'OVER'
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
                  prop.lineDisplay
                    .includes('–')
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


  updateFilterCount();


  const allProps =
    board.props || [];


  const filteredProps =
    allProps.filter(
      prop =>
        propMatchesFilters(
          prop
        )
    );


  const sorted =
    sortProps(
      filteredProps
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

    if (!sorted.length) {

      container.innerHTML = `

        <div class="lf-empty">

          <h3>
            No picks match your filters
          </h3>

          <p>
            Try changing your search or filters.
          </p>

        </div>

      `;

    }
    else {

      const sections =
        weeks
          .map(
            week => {

              const weekProps =
                sorted.filter(
                  prop =>
                    prop.weeks.includes(
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
      board?.sources?.length ||
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


  $('#sourceRows')
    .innerHTML =
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
    experts?.experts || [];


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
// OVERALL RECORD
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
