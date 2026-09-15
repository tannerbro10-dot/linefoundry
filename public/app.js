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

const filterState = {
  confidence: 'ALL',
  expertTeams: [],
  marketTeams: [],
  marketType: 'ALL',
  marketSearch: ''
};

const $ = s => document.querySelector(s);


// ============================================================
// NFL TEAMS
// ============================================================

const NFL_TEAMS = [
  'Arizona Cardinals',
  'Atlanta Falcons',
  'Baltimore Ravens',
  'Buffalo Bills',
  'Carolina Panthers',
  'Chicago Bears',
  'Cincinnati Bengals',
  'Cleveland Browns',
  'Dallas Cowboys',
  'Denver Broncos',
  'Detroit Lions',
  'Green Bay Packers',
  'Houston Texans',
  'Indianapolis Colts',
  'Jacksonville Jaguars',
  'Kansas City Chiefs',
  'Las Vegas Raiders',
  'Los Angeles Chargers',
  'Los Angeles Rams',
  'Miami Dolphins',
  'Minnesota Vikings',
  'New England Patriots',
  'New Orleans Saints',
  'New York Giants',
  'New York Jets',
  'Philadelphia Eagles',
  'Pittsburgh Steelers',
  'San Francisco 49ers',
  'Seattle Seahawks',
  'Tampa Bay Buccaneers',
  'Tennessee Titans',
  'Washington Commanders'
];


// ============================================================
// TEAM HELPERS
// ============================================================

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function teamKey(value) {
  return normalizeText(value);
}

function teamName(value) {
  const map = {
    ARIZONA_CARDINALS_NFL: 'Arizona Cardinals',
    ATLANTA_FALCONS_NFL: 'Atlanta Falcons',
    BALTIMORE_RAVENS_NFL: 'Baltimore Ravens',
    BUFFALO_BILLS_NFL: 'Buffalo Bills',
    CAROLINA_PANTHERS_NFL: 'Carolina Panthers',
    CHICAGO_BEARS_NFL: 'Chicago Bears',
    CINCINNATI_BENGALS_NFL: 'Cincinnati Bengals',
    CLEVELAND_BROWNS_NFL: 'Cleveland Browns',
    DALLAS_COWBOYS_NFL: 'Dallas Cowboys',
    DENVER_BRONCOS_NFL: 'Denver Broncos',
    DETROIT_LIONS_NFL: 'Detroit Lions',
    GREEN_BAY_PACKERS_NFL: 'Green Bay Packers',
    HOUSTON_TEXANS_NFL: 'Houston Texans',
    INDIANAPOLIS_COLTS_NFL: 'Indianapolis Colts',
    JACKSONVILLE_JAGUARS_NFL: 'Jacksonville Jaguars',
    KANSAS_CITY_CHIEFS_NFL: 'Kansas City Chiefs',
    LAS_VEGAS_RAIDERS_NFL: 'Las Vegas Raiders',
    LOS_ANGELES_CHARGERS_NFL: 'Los Angeles Chargers',
    LOS_ANGELES_RAMS_NFL: 'Los Angeles Rams',
    MIAMI_DOLPHINS_NFL: 'Miami Dolphins',
    MINNESOTA_VIKINGS_NFL: 'Minnesota Vikings',
    NEW_ENGLAND_PATRIOTS_NFL: 'New England Patriots',
    NEW_ORLEANS_SAINTS_NFL: 'New Orleans Saints',
    NEW_YORK_GIANTS_NFL: 'New York Giants',
    NEW_YORK_JETS_NFL: 'New York Jets',
    PHILADELPHIA_EAGLES_NFL: 'Philadelphia Eagles',
    PITTSBURGH_STEELERS_NFL: 'Pittsburgh Steelers',
    SAN_FRANCISCO_49ERS_NFL: 'San Francisco 49ers',
    SEATTLE_SEAHAWKS_NFL: 'Seattle Seahawks',
    TAMPA_BAY_BUCCANEERS_NFL: 'Tampa Bay Buccaneers',
    TENNESSEE_TITANS_NFL: 'Tennessee Titans',
    WASHINGTON_COMMANDERS_NFL: 'Washington Commanders'
  };

  return map[value] || value || '';
}

function selectedTeamMatch(team, selected) {
  if (!selected.length) {
    return true;
  }

  return selected.includes(
    teamKey(team)
  );
}

function getPlayerTeam(player) {
  const found = marketData.find(
    market =>
      normalizeText(
        market?.player?.name
      ) === normalizeText(player)
  );

  return teamName(
    found?.player?.teamId || ''
  );
}


// ============================================================
// GENERAL HELPERS
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
    return '—';
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
  const match =
    String(value ?? '').match(/\d+/);

  return match
    ? Number(match[0])
    : 1;
}


// ============================================================
// CURRENT NFL WEEK
// ============================================================

function currentWeek() {
  /*
   * Week 1 stays current through Monday Night Football.
   * Week 2 becomes current after the Monday night window.
   */

  const now = new Date();

  const week1Cutoff =
    new Date(
      '2026-09-15T04:00:00Z'
    );

  return now < week1Cutoff
    ? 1
    : 2;
}


// ============================================================
// LOAD DATA
// ============================================================

async function load() {

  try {

    const [
      signalsResponse,
      expertsResponse,
      resultsResponse,
      marketResponse
    ] = await Promise.all([

      fetch(
        `${SIGNALS_URL}?_=${Date.now()}`,
        {
          cache: 'no-store'
        }
      ),

      fetch(
        `${EXPERTS_URL}?_=${Date.now()}`,
        {
          cache: 'no-store'
        }
      ),

      fetch(
        `${RESULTS_URL}?_=${Date.now()}`,
        {
          cache: 'no-store'
        }
      ),

      fetch(
        `${MARKET_DATA_URL}?_=${Date.now()}`,
        {
          cache: 'no-store'
        }
      )

    ]);


    if (!signalsResponse.ok) {
      throw new Error(
        'Could not load public-signals.json'
      );
    }

    if (!expertsResponse.ok) {
      throw new Error(
        'Could not load analyst-profiles.json'
      );
    }

    if (!resultsResponse.ok) {
      throw new Error(
        'Could not load results-ledger.json'
      );
    }


    const signalsData =
      await signalsResponse.json();

    experts =
      await expertsResponse.json();

    results =
      await resultsResponse.json();


    if (marketResponse.ok) {

      const marketJson =
        await marketResponse.json();

      marketData =
        Array.isArray(marketJson)
          ? marketJson
          : marketJson?.markets || [];

    } else {

      marketData = [];

    }


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
        signalsData.sources || [],

      rawSignals:
        signalsData.signals || [],

      props:
        buildConsensusProps(
          signalsData.signals || [],
          signalsData.sources || []
        )

    };


    configureExpertFilters();

    ensureMarketSection();

    configureMarketFilters();

    populateMarketTypes();

    render();

    await loadLiveResults();

  }

  catch (err) {

    console.error(
      'LineFoundry data load failed:',
      err
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
// CONSENSUS ENGINE
// ============================================================

function buildConsensusProps(
  signals,
  sources
) {

  const groups =
    new Map();


  signals.forEach(
    signal => {

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


      if (
        !player ||
        !market
      ) {
        return;
      }


      /*
       * Important:
       *
       * Consensus is one bet.
       * Multiple experts agreeing are
       * counted as experts, not multiple bets.
       *
       * Group by:
       * PLAYER + MARKET + WEEK
       */

      const key =
        `${player.toLowerCase()}|${market.toLowerCase()}|${week}`;


      if (
        !groups.has(key)
      ) {

        groups.set(
          key,
          []
        );

      }


      groups
        .get(key)
        .push(signal);

    }
  );


  return Array.from(
    groups.values()
  ).map(
    group => {

      const first =
        group[0];


      const over =
        group.filter(
          signal =>
            normalizeText(
              signal.side
            ) === 'over'
        );


      const under =
        group.filter(
          signal =>
            normalizeText(
              signal.side
            ) === 'under'
        );


      const yes =
        group.filter(
          signal =>
            normalizeText(
              signal.side
            ) === 'yes'
        );


      let majoritySide =
        'YES';


      if (
        over.length ||
        under.length
      ) {

        majoritySide =
          over.length >=
          under.length
            ? 'OVER'
            : 'UNDER';

      }


      const majoritySignals =
        majoritySide === 'OVER'
          ? over
          : majoritySide === 'UNDER'
            ? under
            : yes;


      const agree =
        majoritySignals.length;


      const disagree =
        majoritySide === 'OVER'
          ? under.length
          : majoritySide === 'UNDER'
            ? over.length
            : 0;


      const total =
        group.length;


      const percent =
        total
          ? Math.round(
              (agree / total) *
              100
            )
          : 0;


      const lines =
        group
          .map(
            signal =>
              signal.line
          )
          .filter(
            value =>
              value !== null &&
              value !== undefined
          )
          .map(Number)
          .filter(
            Number.isFinite
          );


      const uniqueLines =
        [
          ...new Set(lines)
        ]
          .sort(
            (a,b) =>
              a-b
          );


      let line = null;
      let lineDisplay = '';


      if (
        uniqueLines.length === 1
      ) {

        line =
          uniqueLines[0];

        lineDisplay =
          formatNumber(line);

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

        line =
          uniqueLines[
            Math.floor(
              uniqueLines.length / 2
            )
          ];

      }


      const analysts =
        group.map(
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
                '',

              sourceId:
                signal.sourceId ||
                ''

            };

          }
        );


      let confidence =
        'EARLY';


      if (
        total === 1
      ) {

        confidence =
          'EARLY';

      }

      else if (
        disagree > 0
      ) {

        confidence =
          'MODERATE';

      }

      else if (
        percent >= 75
      ) {

        confidence =
          'HIGH';

      }

      else {

        confidence =
          'MEDIUM';

      }


      const team =
        getPlayerTeam(
          first.player
        );


      return {

        id:
          `CONS-${group
            .map(
              signal =>
                signal.id ||
                `${signal.player}-${signal.market}`
            )
            .join('-')}`,

        player:
          first.player,

        market:
          first.market,

        side:
          majoritySide,

        line,

        lineDisplay,

        analyst:
          majoritySignals[0]?.analyst ||
          first.analyst,

        analysts,

        analystCount:
          total,

        experts:
          total,

        agree,

        disagree,

        percent,

        consensusScore:
          percent,

        consensusDisplay:
          total === 1
            ? 'EARLY'
            : `${percent}%`,

        consensusStrength:
          disagree > 0
            ? 'SPLIT'
            : percent >= 75
              ? 'HEAVY'
              : percent >= 60
                ? 'STRONG'
                : total === 1
                  ? 'SINGLE'
                  : 'EMERGING',

        confidence,

        rationale:
          total === 1
            ? `1 ${majoritySide} expert • No opposing pick found • Single-source signal.`
            : `${agree} ${majoritySide} expert${agree === 1 ? '' : 's'} • ${disagree} opposing expert${disagree === 1 ? '' : 's'} • ${percent}% direction consensus.`,

        week:
          normalizeWeek(
            first.week ??
            board?.week ??
            1
          ),

        weeks: [
          normalizeWeek(
            first.week ??
            board?.week ??
            1
          )
        ],

        team

      };

    }
  );

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


    (
      data.results ||
      []
    ).forEach(
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


    (
      data.marketResults ||
      []
    ).forEach(
      result => {

        const id =
          result.id ||
          result.marketId;


        if (id) {

          marketResults[
            id
          ] = result;

        }

      }
    );


    if (board) {

      board.liveUpdatedAt =
        data.updatedAt ||
        new Date().toISOString();

    }


    render();


    console.log(
      'LineFoundry live data updated:',
      data
    );

  }

  catch (err) {

    console.error(
      'LineFoundry live data failed:',
      err
    );

  }

}


setInterval(
  loadLiveResults,
  60000
);


// ============================================================
// EXPERT RESULTS
// ============================================================

function getSignalsForProp(prop) {

  return (
    board?.rawSignals ||
    []
  ).filter(
    signal => {

      const week =
        normalizeWeek(
          signal.week ??
          board?.week ??
          1
        );


      return (

        week ===
        Number(
          prop.week
        )

        &&

        normalizeText(
          signal.player
        ) ===
        normalizeText(
          prop.player
        )

        &&

        normalizeText(
          signal.market
        ) ===
        normalizeText(
          prop.market
        )

      );

    }
  );

}


function getResult(prop) {

  const matching =
    getSignalsForProp(
      prop
    );


  for (
    const signal of matching
  ) {

    const live =
      liveResults[
        signal.id
      ];


    if (!live) {
      continue;
    }


    if (
      live.status ===
      'HIT'
    ) {

      return 'HIT';

    }


    if (
      live.status ===
      'MISS'
    ) {

      return 'MISS';

    }


    if (
      live.status ===
      'LIVE'
    ) {

      return 'LIVE';

    }

  }


  return 'PENDING';

}


function getResultDetails(prop) {

  const matching =
    getSignalsForProp(
      prop
    );


  for (
    const signal of matching
  ) {

    if (
      liveResults[
        signal.id
      ]
    ) {

      return liveResults[
        signal.id
      ];

    }

  }


  return null;

}


// ============================================================
// EXPERT LIVE DISPLAY
// ============================================================

function liveStatus(prop) {

  const live =
    getResultDetails(
      prop
    );


  if (!live) {
    return '';
  }


  if (
    prop.market ===
    'Anytime TD'
  ) {

    if (
      live.status ===
      'HIT'
    ) {

      return `

        <div class="live-stat">

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
      live.status ===
      'MISS'
    ) {

      return `

        <div class="live-stat">

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
      live.status ===
      'LIVE'
    ) {

      return `

        <div class="live-stat">

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


  if (
    live.status ===
    'HIT'
  ) {

    return `

      <div class="live-stat">

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
    live.status ===
    'MISS'
  ) {

    return `

      <div class="live-stat">

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
    live.status ===
    'LIVE'
  ) {

    return `

      <div class="live-stat">

        <strong>
          LIVE —
          ${formatNumber(
            live.currentValue
          )}
          yards
        </strong>

        ${
          live.remaining !== null &&
          live.remaining !== undefined
            ? `
              <span>
                ${formatNumber(
                  live.remaining
                )}
                needed
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
// EXPERT FILTER UI
// ============================================================

function configureExpertFilters() {

  const confidence =
    $('#confidenceFilter');


  if (!confidence) {
    return;
  }


  confidence.value =
    filterState.confidence;


  confidence.onchange =
    event => {

      filterState.confidence =
        event.target.value;

      render();

    };


  const toolbar =
    confidence.closest(
      '.toolbar'
    );


  if (!toolbar) {
    return;
  }


  if (
    !$('#expertTeamFilter')
  ) {

    const wrapper =
      document.createElement(
        'div'
      );

    wrapper.id =
      'expertTeamFilter';

    wrapper.className =
      'lf-multi-wrap';

    toolbar.appendChild(
      wrapper
    );

  }


  renderTeamDropdown(
    'expertTeamFilter',
    filterState.expertTeams,
    teams => {

      filterState.expertTeams =
        teams;

      render();

    }
  );

}


// ============================================================
// MULTI-SELECT TEAM DROPDOWN
// ============================================================

function renderTeamDropdown(
  containerId,
  selected,
  onChange
) {

  const container =
    document.getElementById(
      containerId
    );


  if (!container) {
    return;
  }


  const selectedSet =
    new Set(
      selected
    );


  container.innerHTML = `

    <details class="lf-team-details">

      <summary class="lf-team-summary">

        ${
          selected.length
            ? `Teams (${selected.length})`
            : 'Teams'
        }

        <span>
          ▾
        </span>

      </summary>


      <div class="lf-team-menu">

        <div class="lf-team-menu-top">

          <strong>
            Select teams
          </strong>

          <button
            type="button"
            class="lf-team-clear"
          >
            Clear
          </button>

        </div>


        <div class="lf-team-options">

          ${NFL_TEAMS.map(
            team => `

              <label class="lf-team-option">

                <input
                  type="checkbox"
                  value="${escapeHtml(
                    teamKey(team)
                  )}"
                  ${
                    selectedSet.has(
                      teamKey(team)
                    )
                      ? 'checked'
                      : ''
                  }
                />

                <span>
                  ${escapeHtml(
                    team
                  )}
                </span>

              </label>

            `
          ).join('')}

        </div>

      </div>

    </details>

  `;


  container
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(
      input => {

        input.addEventListener(
          'change',
          () => {

            const values =
              [
                ...container.querySelectorAll(
                  'input:checked'
                )
              ]
                .map(
                  item =>
                    item.value
                );


            onChange(
              values
            );

          }
        );

      }
    );


  container
    .querySelector(
      '.lf-team-clear'
    )
    ?.addEventListener(
      'click',
      event => {

        event.preventDefault();

        onChange([]);

      }
    );

}


// ============================================================
// EXPERT CARD
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
      class="
        prop
        ${lockedPick ? 'locked' : ''}
      "
    >

      <div class="prop-top">

        <div class="game">

          NFL • WEEK
          ${prop.week}

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
          prop.line !==
            null &&
          prop.line !==
            undefined
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

                •
                No opposing pick found

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
// EXPERT WEEK SUMMARY
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
    hits +
    misses;


  const percentage =
    settled
      ? Math.round(
          (hits / settled) *
          100
        )
      : null;


  return `

    <span class="lf-week-summary">

      ${props.length}
      picks

      •
      ${hits}
      hits

      •
      ${misses}
      misses

      •
      ${live}
      live

      •
      ${pending}
      pending

      ${
        percentage !==
        null
          ? ` • ${percentage}%`
          : ''
      }

    </span>

  `;

}


// ============================================================
// EXPERT WEEK SECTION
// ============================================================

function weekSection(
  week,
  props,
  expanded
) {

  const status =
    Number(week) ===
    currentWeek()

      ? 'CURRENT'

      : props.some(
          prop =>
            getResult(prop) ===
              'LIVE' ||
            getResult(prop) ===
              'PENDING'
        )

        ? 'IN PROGRESS'

        : 'COMPLETE';


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

          <span
            class="lf-week-status"
          >
            ${status}
          </span>

          ${weekSummary(
            props
          )}

        </div>

      </summary>


      <div
        class="cards lf-week-cards"
      >

        ${props
          .map(card)
          .join('')}

      </div>

    </details>

  `;

}


// ============================================================
// EXPERT RENDER
// ============================================================

function renderExpertBoard() {

  const container =
    $('#propCards');


  if (!container) {
    return;
  }


  const allProps =
    board?.props || [];


  const filtered =
    allProps.filter(
      prop => {

        if (
          filterState.confidence !==
            'ALL' &&
          prop.confidence !==
            filterState.confidence
        ) {

          return false;

        }


        return selectedTeamMatch(
          prop.team,
          filterState.expertTeams
        );

      }
    );


  if (!filtered.length) {

    container.innerHTML = `

      <div class="lf-empty">

        <h3>
          No picks match your filters
        </h3>

        <p>
          Try another confidence level
          or team.
        </p>

      </div>

    `;

    return;
  }


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
      .sort(
        (a,b) =>
          a-b
      );


  container.innerHTML =
    weeks
      .map(
        week => {

          const props =
            filtered.filter(
              prop =>
                Number(
                  prop.week
                ) ===
                Number(week)
            );


          return weekSection(
            week,
            props,
            Number(week) ===
            currentWeek()
          );

        }
      )
      .join('');

}


// ============================================================
// MARKET SECTION
// ============================================================

function ensureMarketSection() {

  if (
    !marketData.length ||
    $('#lfMarketSection')
  ) {
    return;
  }


  const propsSection =
    $('#props');


  if (!propsSection) {
    return;
  }


  const section =
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


      <div
        id="marketTeamFilter"
        class="lf-multi-wrap"
      ></div>

    </div>


    <div
      id="lfMarketGrid"
    ></div>

  `;


  propsSection.after(
    section
  );


  $('#lfMarketSearch')
    ?.addEventListener(
      'input',
      event => {

        filterState.marketSearch =
          event.target.value;

        renderMarkets();

      }
    );


  $('#lfMarketType')
    ?.addEventListener(
      'change',
      event => {

        filterState.marketType =
          event.target.value;

        renderMarkets();

      }
    );


  configureMarketFilters();

  populateMarketTypes();

  renderMarkets();

}


// ============================================================
// MARKET FILTERS
// ============================================================

function configureMarketFilters() {

  renderTeamDropdown(
    'marketTeamFilter',
    filterState.marketTeams,
    teams => {

      filterState.marketTeams =
        teams;

      renderMarkets();

    }
  );

}


// ============================================================
// MARKET TYPES
// ============================================================

function populateMarketTypes() {

  const select =
    $('#lfMarketType');


  if (!select) {
    return;
  }


  const current =
    filterState.marketType;


  const types =
    [
      ...new Set(
        marketData
          .map(
            market =>
              market?.market?.name
          )
          .filter(Boolean)
      )
    ]
      .sort();


  select.innerHTML = `

    <option value="ALL">
      All Markets
    </option>

    ${types
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
      .join('')}

  `;


  if (
    types.includes(
      current
    )
  ) {

    select.value =
      current;

  } else {

    select.value =
      'ALL';

    filterState.marketType =
      'ALL';

  }

}


// ============================================================
// MARKET HELPERS
// ============================================================

function isAnytimeTDMarket(
  market
) {

  return normalizeText(
    market?.market?.name
  )
    .includes(
      'anytime touchdown'
    );

}


function marketTeam(
  market
) {

  return teamName(
    market?.player?.teamId ||
    ''
  );

}


function marketGameLabel(
  market
) {

  const away =
    market?.game?.awayTeam ||
    '';

  const home =
    market?.game?.homeTeam ||
    '';


  return away && home
    ? `${away} @ ${home}`
    : 'NFL';

}


function marketUnit(
  market
) {

  const name =
    normalizeText(
      market?.market?.name
    );


  if (
    name.includes(
      'attempt'
    )
  ) {

    return 'ATTEMPTS';

  }


  if (
    name.includes(
      'reception'
    )
  ) {

    return 'RECEPTIONS';

  }


  if (
    name.includes(
      'completion'
    )
  ) {

    return 'COMPLETIONS';

  }


  if (
    name.includes(
      'interception'
    )
  ) {

    return 'INT';

  }


  return 'YARDS';

}


function marketResult(
  market
) {

  return (
    marketResults[
      market.id
    ] ||
    null
  );

}


function marketResultDisplay(
  market,
  result
) {

  if (!result) {

    return {
      text: 'PENDING',
      pending: true
    };

  }


  const td =
    isAnytimeTDMarket(
      market
    );


  if (
    result.status ===
    'LIVE'
  ) {

    if (
      result.currentValue ===
        null ||
      result.currentValue ===
        undefined
    ) {

      return {
        text: 'LIVE',
        pending: false
      };

    }


    return {

      text:
        td

          ? `LIVE · ${formatNumber(
              result.currentValue
            )} TD`

          : `LIVE · ${formatNumber(
              result.currentValue
            )} ${marketUnit(
              market
            )}`,

      pending: false

    };

  }


  if (
    result.status ===
      'HIT' ||
    result.status ===
      'MISS'
  ) {

    const value =
      result.currentValue ??
      result.actual ??
      0;


    return {

      text:
        td

          ? `${formatNumber(
              value
            )} TD ACTUAL`

          : `${formatNumber(
              value
            )} ${marketUnit(
              market
            )} ACTUAL`,

      pending: false

    };

  }


  return {

    text: 'PENDING',

    pending: true

  };

}


function bestBookLabel(
  side
) {

  if (!side) {
    return '—';
  }


  if (
    side.bestBook
  ) {

    return `${prettifyBook(
      side.bestBook
    )} ${
      side.bestBookOdds ||
      ''
    }`.trim();

  }


  return '—';

}


function prettifyBook(
  book
) {

  const map = {

    draftkings:
      'DraftKings',

    fanduel:
      'FanDuel',

    betmgm:
      'BetMGM',

    caesars:
      'Caesars',

    espnbet:
      'ESPN BET',

    bet365:
      'Bet365',

    fanatics:
      'Fanatics',

    hardrock:
      'Hard Rock',

    bovada:
      'Bovada'

  };


  return (
    map[
      normalizeText(
        book
      )
    ] ||
    book ||
    'Book'
  );

}


// ============================================================
// MARKET CARD
// ============================================================

function marketCard(
  market
) {

  const td =
    isAnytimeTDMarket(
      market
    );


  const over =
    market?.sides?.over ||
    {};

  const under =
    market?.sides?.under ||
    {};

  const yes =
    market?.sides?.yes ||
    {};

  const no =
    market?.sides?.no ||
    {};


  const result =
    marketResult(
      market
    );


  const display =
    marketResultDisplay(
      market,
      result
    );


  return `

    <article
      class="lf-market-card"
    >

      <div
        class="lf-market-player"
      >
        ${escapeHtml(
          market?.player?.name ||
          'Unknown Player'
        )}
      </div>


      <div
        class="lf-market-game"
      >
        ${escapeHtml(
          marketGameLabel(
            market
          )
        )}
      </div>


      <div
        class="lf-market-type"
      >
        ${escapeHtml(
          market?.market?.name ||
          'Player Prop'
        )}
      </div>


      <div
        class="lf-market-main"
      >

        <div>

          <div
            class="lf-market-line"
          >
            ${
              td
                ? 'TD'
                : escapeHtml(
                    formatNumber(
                      over.line ??
                      under.line
                    )
                  )
            }
          </div>


          <div
            class="lf-market-odds"
          >

            ${
              td

                ? `

                  <span class="over">

                    YES
                    ${escapeHtml(
                      yes.odds ||
                      '—'
                    )}

                  </span>


                  <span class="under">

                    NO
                    ${escapeHtml(
                      no.odds ||
                      '—'
                    )}

                  </span>

                `

                : `

                  <span class="over">

                    OVER
                    ${escapeHtml(
                      over.odds ||
                      '—'
                    )}

                  </span>


                  <span class="under">

                    UNDER
                    ${escapeHtml(
                      under.odds ||
                      '—'
                    )}

                  </span>

                `
            }

          </div>

        </div>


        <div
          class="
            lf-market-result
            ${
              display.pending
                ? 'pending'
                : ''
            }
          "
        >

          ${escapeHtml(
            display.text
          )}

        </div>

      </div>


      ${
        td
          ? ''

          : `

            <div
              class="lf-market-best"
            >

              Best Over:
              <strong>
                ${escapeHtml(
                  bestBookLabel(
                    over
                  )
                )}
              </strong>

            </div>


            <div
              class="lf-market-best"
            >

              Best Under:
              <strong>
                ${escapeHtml(
                  bestBookLabel(
                    under
                  )
                )}
              </strong>

            </div>

          `
      }


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
// MARKET WEEK SECTION
// ============================================================

function marketWeekSection(
  week,
  markets,
  expanded
) {

  const status =
    Number(week) ===
    currentWeek()

      ? 'CURRENT'

      : markets.some(
          market => {

            const result =
              marketResult(
                market
              );

            return (
              !result ||
              result.status ===
                'LIVE'
            );

          }
        )

        ? 'UPCOMING'

        : 'COMPLETE';


  const liveCount =
    markets.filter(
      market =>
        marketResult(
          market
        )?.status ===
        'LIVE'
    ).length;


  return `

    <details
      class="
        lf-week-section
        lf-market-week
      "
      data-market-week="${week}"
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
            ${status}
          </span>

          <span
            class="lf-week-summary"
          >

            ${markets.length}
            markets

            ${
              liveCount
                ? ` • ${liveCount} live`
                : ''
            }

          </span>

        </div>

      </summary>


      <div
        class="lf-market-grid"
      >

        ${markets
          .map(
            marketCard
          )
          .join('')}

      </div>

    </details>

  `;

}


// ============================================================
// RENDER MARKETS
// ============================================================

function renderMarkets() {

  const grid =
    $('#lfMarketGrid');


  if (!grid) {
    return;
  }


  const search =
    normalizeText(
      filterState.marketSearch
    );


  const type =
    normalizeText(
      filterState.marketType
    );


  const filtered =
    marketData.filter(
      market => {

        const player =
          normalizeText(
            market?.player?.name
          );


        const marketName =
          normalizeText(
            market?.market?.name
          );


        const game =
          normalizeText(
            marketGameLabel(
              market
            )
          );


        const team =
          marketTeam(
            market
          );


        const searchMatch =
          !search ||
          player.includes(
            search
          ) ||
          marketName.includes(
            search
          ) ||
          game.includes(
            search
          );


        const typeMatch =
          type === 'all' ||
          marketName ===
          type;


        const teamMatch =
          selectedTeamMatch(
            team,
            filterState.marketTeams
          );


        return (
          searchMatch &&
          typeMatch &&
          teamMatch
        );

      }
    );


  if (!filtered.length) {

    grid.innerHTML = `

      <div class="lf-empty">

        <h3>
          No markets found
        </h3>

        <p>
          Try another player,
          market or team.
        </p>

      </div>

    `;

    return;

  }


  const weeks =
    [
      ...new Set(
        filtered.map(
          market =>
            normalizeWeek(
              market.week
            )
        )
      )
    ]
      .sort(
        (a,b) =>
          a-b
      );


  grid.innerHTML =
    weeks
      .map(
        week => {

          const markets =
            filtered.filter(
              market =>
                normalizeWeek(
                  market.week
                ) ===
                Number(week)
            );


          return marketWeekSection(
            week,
            markets,
            Number(week) ===
            currentWeek()
          );

        }
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
// MARKET DETAILS
// ============================================================

function openMarketDetails(
  marketId
) {

  const market =
    marketData.find(
      item =>
        String(item.id) ===
        String(marketId)
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
    marketResult(
      market
    );


  const display =
    marketResultDisplay(
      market,
      result
    );


  const over =
    market?.sides?.over ||
    {};

  const under =
    market?.sides?.under ||
    {};


  const books =
    new Map();


  Object.entries(
    over.sportsbooks ||
    {}
  )
    .forEach(
      ([name, book]) => {

        if (
          !books.has(
            name
          )
        ) {

          books.set(
            name,
            {}
          );

        }

        books.get(
          name
        ).over = book;

      }
    );


  Object.entries(
    under.sportsbooks ||
    {}
  )
    .forEach(
      ([name, book]) => {

        if (
          !books.has(
            name
          )
        ) {

          books.set(
            name,
            {}
          );

        }

        books.get(
          name
        ).under = book;

      }
    );


  const bookRows =
    Array.from(
      books.entries()
    )
      .map(
        ([name, book]) => `

          <div
            class="lf-book-row"
          >

            <strong>
              ${escapeHtml(
                prettifyBook(
                  name
                )
              )}
            </strong>

            <span>
              O
              ${escapeHtml(
                book.over?.odds ||
                '—'
              )}
            </span>

            <span>
              U
              ${escapeHtml(
                book.under?.odds ||
                '—'
              )}
            </span>

          </div>

        `
      )
      .join('');


  const opened =
    over.openingLine ??
    under.openingLine ??
    '—';


  const current =
    over.line ??
    under.line ??
    '—';


  const closing =
    over.closingLine ??
    under.closingLine ??
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


      <p class="eyebrow">
        MARKET DETAILS
      </p>


      <h2>
        ${escapeHtml(
          market?.player?.name ||
          ''
        )}
      </h2>


      <div
        class="market-subtitle"
      >

        ${escapeHtml(
          marketGameLabel(
            market
          )
        )}

        ·

        ${escapeHtml(
          market?.market?.name ||
          'Player Prop'
        )}

      </div>


      <div
        class="lf-detail-section"
      >

        <h3>
          CURRENT MARKET
        </h3>


        <div
          class="lf-market-line"
        >

          ${
            isAnytimeTDMarket(
              market
            )

              ? 'TD'

              : escapeHtml(
                  formatNumber(
                    over.line ??
                    under.line
                  )
                )
          }

        </div>


        <div
          class="lf-market-odds"
        >

          ${
            isAnytimeTDMarket(
              market
            )

              ? `

                <span class="over">
                  YES
                  ${escapeHtml(
                    market?.sides?.yes?.odds ||
                    '—'
                  )}
                </span>

                <span class="under">
                  NO
                  ${escapeHtml(
                    market?.sides?.no?.odds ||
                    '—'
                  )}
                </span>

              `

              : `

                <span class="over">
                  OVER
                  ${escapeHtml(
                    over.odds ||
                    '—'
                  )}
                </span>

                <span class="under">
                  UNDER
                  ${escapeHtml(
                    under.odds ||
                    '—'
                  )}
                </span>

              `
          }

        </div>


        <div
          class="
            lf-market-result
            ${
              display.pending
                ? 'pending'
                : ''
            }
          "
        >

          ${escapeHtml(
            display.text
          )}

        </div>

      </div>


      <div
        class="lf-detail-section"
      >

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


      <div
        class="lf-detail-section"
      >

        <h3>
          LINE MOVEMENT
        </h3>


        <div
          class="lf-movement"
        >

          <div>

            <b>
              ${escapeHtml(
                String(opened)
              )}
            </b>

            <span>
              Opened
            </span>

          </div>


          <div>

            <b>
              ${escapeHtml(
                String(current)
              )}
            </b>

            <span>
              Current
            </span>

          </div>


          <div>

            <b>
              ${escapeHtml(
                String(closing)
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
      element => {

        element.addEventListener(
          'click',
          closeMarketDetails
        );

      }
    );

}


function closeMarketDetails() {

  $('#lfMarketModal')
    ?.classList.remove(
      'open'
    );

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

  if (!$('#expertRows')) {
    return;
  }


  const expertList =
    experts?.experts ||
    [];


  $('#expertRows')
    .innerHTML =
      expertList
        .map(
          expert => {

            const tracked =
              expert.tracked ||
              {};


            const picks =
              tracked.picks ||
              0;


            const wins =
              tracked.wins ||
              0;


            const losses =
              tracked.losses ||
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
// MAIN RENDER
// ============================================================

function render() {

  if (!board) {
    return;
  }


  renderExpertBoard();


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
      board.props?.length ||
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


  renderSources();

  renderExperts();

  renderRecord();

  ensureMarketSection();

  renderMarkets();

}


// ============================================================
// CSS
// ============================================================

function injectBoardStyles() {

  if (
    $('#linefoundryBoardStyles')
  ) {
    return;
  }


  const style =
    document.createElement(
      'style'
    );


  style.id =
    'linefoundryBoardStyles';


  style.textContent = `

    /* ========================================================
       EXPERT BOARD
       ======================================================== */

 #propCards {
  width: 100%;
  max-width: none;
}

  #propCards .cards {
  width: 100%;
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0,1fr));
  gap: 15px;
}

#propCards .cards {
  width: 100%;
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0,1fr));
  gap: 15px;
}

#propCards .lf-week-section {
  width: 100%;
  max-width: none;
}

    .lf-week-section > summary {
      list-style: none;
      cursor: pointer;
      padding: 16px 18px;
      background:
        rgba(17,23,34,.78);
      border-bottom:
        1px solid rgba(255,255,255,.05);
    }


    .lf-week-section > summary::-webkit-details-marker {
      display: none;
    }


    .lf-week-heading {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }


    .lf-week-heading::before {
      content: '⌃';
      color: var(--green);
      font-weight: 900;
      font-size: 14px;
    }


    .lf-week-section:not([open])
      .lf-week-heading::before {
      content: '⌄';
    }


    .lf-week-heading strong {
      font:
        700 14px
        'Space Grotesk';
      letter-spacing: .04em;
    }


    .lf-week-status {
      padding: 4px 8px;
      border-radius: 999px;
      background:
        rgba(125,242,178,.10);
      color: var(--green);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .08em;
    }


    .lf-week-summary {
      margin-left: auto;
      color: #718094;
      font-size: 10px;
    }


    .lf-week-cards {
      padding: 15px;
    }


    .live-stat {
      margin:
        12px 0 14px;
      padding:
        11px 13px;
      border-radius: 9px;
      border:
        1px solid
        rgba(125,242,178,.14);
      background:
        rgba(125,242,178,.055);
    }


    .live-stat strong {
      display: block;
      color: var(--green);
      font-size: 11px;
      font-weight: 900;
    }


    .live-stat span {
      display: block;
      margin-top: 3px;
      color: #718094;
      font-size: 10px;
    }


    /* ========================================================
       TEAM FILTER
       ======================================================== */

    .lf-multi-wrap {
      position: relative;
      min-width: 150px;
    }


    .lf-team-details {
      position: relative;
    }


    .lf-team-summary {
      min-width: 150px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 0 12px;
      border:
        1px solid
        var(--line);
      border-radius: 10px;
      background: #0b1017;
      color: #eaf0f5;
      cursor: pointer;
      list-style: none;
      font-size: 12px;
      font-weight: 700;
    }


    .lf-team-summary::-webkit-details-marker {
      display: none;
    }


    .lf-team-menu {
      position: absolute;
      z-index: 200;
      top: calc(100% + 7px);
      right: 0;
      width: 285px;
      max-height: 390px;
      overflow: auto;
      padding: 11px;
      border:
        1px solid
        #2a3746;
      border-radius: 12px;
      background: #0d141d;
      box-shadow:
        0 20px 55px
        rgba(0,0,0,.45);
    }


    .lf-team-menu-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 9px;
      margin-bottom: 7px;
      border-bottom:
        1px solid
        #1b2633;
    }


    .lf-team-menu-top strong {
      font-size: 11px;
    }


    .lf-team-clear {
      border: 0;
      background: transparent;
      color: var(--green);
      padding: 3px 6px;
      font-size: 10px;
    }


    .lf-team-options {
      display: grid;
      gap: 2px;
    }


    .lf-team-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 5px;
      border-radius: 7px;
      color: #aeb9c5;
      font-size: 11px;
      cursor: pointer;
    }


    .lf-team-option:hover {
      background:
        rgba(255,255,255,.04);
      color: #fff;
    }


    .lf-team-option input {
      accent-color:
        var(--green);
    }


    /* ========================================================
       MARKET
       ======================================================== */

    #lfMarketSection {
      margin-top: 55px;
    }


    .lf-market-toolbar {
      display: flex;
      gap: 8px;
      align-items: center;
      margin:
        18px 0 14px;
    }


    .lf-market-toolbar input,
    .lf-market-toolbar select {
      height: 38px;
      border-radius: 10px;
      border:
        1px solid
        var(--line);
      background: #0b1017;
      color: #eaf0f5;
      padding: 0 12px;
      font: inherit;
      font-size: 12px;
      outline: none;
    }


    .lf-market-toolbar input {
      flex: 1;
    }


    .lf-market-toolbar select {
      min-width: 155px;
    }


    #lfMarketGrid {
      width: 100%;
    }


    .lf-market-week .lf-market-grid {
      display: grid;
      grid-template-columns:
        repeat(3, minmax(0,1fr));
      gap: 15px;
      padding: 15px;
    }


    .lf-market-card {
      min-width: 0;
      padding: 17px;
      border:
        1px solid
        var(--line);
      border-radius: 14px;
      background:
        linear-gradient(
          180deg,
          #111823,
          #0c1118
        );
    }


    .lf-market-player {
      font:
        700 16px
        'Space Grotesk';
      color: #f4f7fb;
    }


    .lf-market-game {
      margin-top: 3px;
      color: #718094;
      font-size: 9px;
    }


    .lf-market-type {
      margin-top: 15px;
      color: #718094;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .12em;
      font-weight: 800;
    }


    .lf-market-main {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 12px;
      margin-top: 5px;
    }


    .lf-market-line {
      color: #f4f7fb;
      font:
        700 32px
        'Space Grotesk';
      line-height: 1;
    }


    .lf-market-odds {
      display: flex;
      gap: 10px;
      margin-top: 7px;
      font-size: 10px;
      font-weight: 800;
    }


    .lf-market-odds .over {
      color: var(--green);
    }


    .lf-market-odds .under {
      color: var(--red);
    }


    .lf-market-result {
      min-width: 115px;
      padding: 9px 10px;
      border-radius: 8px;
      background:
        rgba(125,242,178,.07);
      border:
        1px solid
        rgba(125,242,178,.14);
      color: var(--green);
      font-size: 9px;
      font-weight: 900;
      text-align: center;
    }


    .lf-market-result.pending {
      color: #718094;
      background:
        rgba(255,255,255,.025);
      border-color:
        #1b2430;
    }


    .lf-market-best {
      margin-top: 9px;
      color: #718094;
      font-size: 9px;
    }


    .lf-market-best strong {
      color: #aeb9c5;
    }


    .lf-market-details {
      display: inline-block;
      margin-top: 13px;
      color: var(--green);
      font-size: 10px;
      font-weight: 800;
      text-decoration: none;
    }


    /* ========================================================
       MODAL
       ======================================================== */

    .lf-market-modal {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: none;
    }


    .lf-market-modal.open {
      display: block;
    }


    .lf-market-backdrop {
      position: absolute;
      inset: 0;
      background:
        rgba(0,0,0,.72);
      backdrop-filter:
        blur(7px);
    }


    .lf-market-panel {
      position: relative;
      width:
        min(
          720px,
          calc(100% - 28px)
        );
      max-height: 86vh;
      overflow: auto;
      margin: 7vh auto;
      padding: 27px;
      border:
        1px solid
        #2a3746;
      border-radius: 18px;
      background: #0d141d;
      box-shadow:
        0 30px 100px
        rgba(0,0,0,.55);
    }


    .lf-market-close {
      position: absolute;
      top: 12px;
      right: 14px;
      border: 0;
      background: transparent;
      color: #93a1b1;
      font-size: 27px;
      cursor: pointer;
    }


    .lf-market-panel h2 {
      margin: 0;
      font:
        700 28px
        'Space Grotesk';
    }


    .market-subtitle {
      margin-top: 4px;
      color: #718094;
      font-size: 11px;
    }


    .lf-detail-section {
      margin-top: 24px;
    }


    .lf-detail-section h3 {
      margin: 0 0 10px;
      color: var(--green);
      font-size: 9px;
      letter-spacing: .13em;
    }


    .lf-book-row {
      display: grid;
      grid-template-columns:
        1.2fr 1fr 1fr;
      gap: 10px;
      padding: 10px 0;
      border-bottom:
        1px solid
        #1a232f;
      color: #8e9aaa;
      font-size: 11px;
    }


    .lf-book-row strong {
      color: #eaf0f5;
    }


    .lf-movement {
      display: grid;
      grid-template-columns:
        repeat(3,1fr);
      gap: 8px;
    }


    .lf-movement div {
      padding: 13px;
      border:
        1px solid
        #1a232f;
      border-radius: 10px;
      background: #090e14;
    }


    .lf-movement b {
      display: block;
      color: #eaf0f5;
      font:
        700 16px
        'Space Grotesk';
    }


    .lf-movement span {
      color: #718094;
      font-size: 9px;
    }


    @media(max-width:1000px) {

      #propCards .cards,
      .lf-market-week .lf-market-grid {
        grid-template-columns:
          repeat(2,minmax(0,1fr));
      }

    }


    @media(max-width:760px) {

      #propCards .cards,
      .lf-market-week .lf-market-grid {
        grid-template-columns: 1fr;
      }


      .lf-market-toolbar {
        flex-wrap: wrap;
      }


      .lf-market-toolbar input {
        min-width: 100%;
      }


      .lf-week-summary {
        width: 100%;
        margin-left: 0;
      }


      .lf-market-main {
        flex-direction: column;
        align-items: start;
      }


      .lf-team-menu {
        left: 0;
        right: auto;
        width:
          min(
            285px,
            calc(100vw - 44px)
          );
      }


      .lf-book-row,
      .lf-movement {
        grid-template-columns: 1fr;
      }

    }

  `;


  document.head.appendChild(
    style
  );

}


// ============================================================
// INITIALIZATION
// ============================================================

injectBoardStyles();

load();

setTimeout(
  loadLiveResults,
  1500
);


// ============================================================
// HOW IT WORKS
// ============================================================

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
