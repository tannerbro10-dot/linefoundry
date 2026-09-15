// ============================================================
// LINEFOUNDRY — MERGED APP.JS
// Expert Signals + Consensus + Live Results + The Market
// ============================================================

let board = null;
let experts = null;
let results = null;
let liveResults = {};
let markets = [];

const WORKER_URL =
  'https://old-mouse-660a.tannerbro10.workers.dev/';

let locked = JSON.parse(
  localStorage.getItem('lf_consensus_locked') || '[]'
);

const $ = s => document.querySelector(s);


// ============================================================
// STORAGE
// ============================================================

function save() {
  localStorage.setItem(
    'lf_consensus_locked',
    JSON.stringify(locked)
  );
}


// ============================================================
// CONSENSUS HELPERS
// ============================================================

function normalizeSide(side) {

  const value =
    String(side || '')
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


function consensusKey(signal) {

  return [
    String(
      signal.player ||
      signal.playerName ||
      ''
    )
      .trim()
      .toLowerCase(),

    String(
      signal.market ||
      ''
    )
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
    HEAVY: 'Heavy',
    STRONG: 'Strong',
    MODERATE: 'Moderate',
    EMERGING: 'Emerging',
    SINGLE: 'Single Source',
    SPLIT: 'Split'
  };

  return labels[strength] || strength;

}


// ============================================================
// BUILD CONSENSUS
// ============================================================

function buildConsensusProps(
  signals,
  sources
) {

  const groups = {};

  (signals || []).forEach(signal => {

    const key =
      consensusKey(signal);

    if (!groups[key]) {

      groups[key] = {
        player:
          signal.player ||
          signal.playerName ||
          'Unknown Player',

        market:
          signal.market ||
          'Unknown Market',

        week:
          signal.week ||
          null,

        signals: []
      };

    }

    groups[key].signals.push(signal);

  });


  return Object.values(groups).map(group => {

    const normalized =
      group.signals.map(signal => ({
        ...signal,
        normalizedSide:
          normalizeSide(
            signal.side ||
            signal.pick ||
            signal.selection
          )
      }));


    const over =
      normalized.filter(
        signal =>
          signal.normalizedSide === 'OVER'
      );

    const under =
      normalized.filter(
        signal =>
          signal.normalizedSide === 'UNDER'
      );


    const agree =
      Math.max(
        over.length,
        under.length
      );

    const disagree =
      Math.min(
        over.length,
        under.length
      );

    const total =
      normalized.length;


    let majoritySide =
      'SPLIT';

    if (
      over.length >
      under.length
    ) {
      majoritySide = 'OVER';
    }

    if (
      under.length >
      over.length
    ) {
      majoritySide = 'UNDER';
    }


    const percent =
      total
        ? Math.round(
            agree /
            total *
            100
          )
        : 0;


    const strength =
      consensusStrength(
        total,
        agree,
        disagree
      );


    const lines =
      normalized
        .map(signal => signal.line)
        .filter(
          value =>
            value !== null &&
            value !== undefined &&
            value !== ''
        )
        .map(Number)
        .filter(
          value =>
            Number.isFinite(value)
        );


    const lineMin =
      lines.length
        ? Math.min(...lines)
        : null;

    const lineMax =
      lines.length
        ? Math.max(...lines)
        : null;


    const analystDetails =
      normalized.map(signal => {

        const source =
          (sources || []).find(
            item =>
              item.id ===
              signal.sourceId
          );

        return {
          ...signal,
          source
        };

      });


    let rationale =
      `${agree} ${majoritySide} expert${
        agree === 1 ? '' : 's'
      }`;

    if (disagree) {

      rationale +=
        ` • ${disagree} opposing`;

    } else {

      rationale +=
        ' • No opposing pick found';

    }


    if (
      lineMin !== null &&
      lineMax !== null
    ) {

      if (
        lineMin === lineMax
      ) {

        rationale +=
          ` • Published line: ${lineMin}`;

      } else {

        rationale +=
          ` • Lines: ${lineMin}–${lineMax}`;

      }

    }


    return {

      ...group,

      id:
        normalized[0]?.id ||
        key,

      side:
        majoritySide,

      line:
        normalized[0]?.line ??
        null,

      agree,
      disagree,
      total,
      percent,
      strength,
      strengthLabel:
        consensusLabel(strength),

      analysts:
        analystDetails,

      lineMin,
      lineMax,

      consensusDisplay:
        `${percent}%`,

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
    <option value="ALL">All</option>
    <option value="HEAVY">Heavy</option>
    <option value="STRONG">Strong</option>
    <option value="MODERATE">Moderate</option>
    <option value="EMERGING">Emerging</option>
    <option value="SINGLE">Single Source</option>
    <option value="SPLIT">Split</option>
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
// RESULT HELPERS
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


function formatLiveResult(result) {

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

    return `HIT — ${formatNumber(
      result.currentValue
    )}`;

  }


  if (
    result.status ===
    'MISS'
  ) {

    return `MISS — ${formatNumber(
      result.currentValue
    )}`;

  }


  if (
    result.status ===
    'LIVE'
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


function getResult(id) {

  const live =
    liveResults[id];

  if (live) {

    return formatLiveResult(
      live
    );

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


function label(p) {

  return `${p.side} ${
    p.line == null
      ? 'TD'
      : p.line
  } ${p.market}`;

}


function liveStatus(p) {

  const details =
    getResultDetails(
      p.id
    );

  if (!details) {
    return '';
  }


  const status =
    details.status;


  if (
    status === 'HIT'
  ) {

    return `
      <div class="live-result hit">
        <strong>BET HIT</strong>
        <span>
          ${
            details.currentValue !==
            undefined
              ? `${formatNumber(
                  details.currentValue
                )} — Final result`
              : 'Final result'
          }
        </span>
      </div>
    `;

  }


  if (
    status === 'MISS'
  ) {

    return `
      <div class="live-result miss">
        <strong>BET MISS</strong>
        <span>
          ${
            details.currentValue !==
            undefined
              ? `${formatNumber(
                  details.currentValue
                )} — Final result`
              : 'Final result'
          }
        </span>
      </div>
    `;

  }


  if (
    status === 'LIVE'
  ) {

    const value =
      details.currentValue;

    const line =
      Number(
        details.line
      );


    const needed =
      Number.isFinite(line) &&
      Number.isFinite(
        Number(value)
      )
        ? Math.max(
            0,
            line -
              Number(value) +
              (
                p.side ===
                'UNDER'
                  ? 0
                  : 0
              )
          )
        : null;


    return `
      <div class="live-result live">
        <strong>
          LIVE${
            value !==
            undefined
              ? ` — ${formatNumber(
                  value
                )} YARDS`
              : ''
          }
        </strong>

        ${
          needed !== null
            ? `
              <span>
                ${
                  needed > 0
                    ? `${formatNumber(
                        needed
                      )} needed`
                    : 'Line reached'
                }
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
// LOCK HELPERS
// ============================================================

function isLocked(id) {

  return locked.includes(id);

}


function toggleLock(id) {

  if (
    isLocked(id)
  ) {

    locked =
      locked.filter(
        value =>
          value !== id
      );

  } else {

    locked.push(id);

  }

  save();
  render();

}


// ============================================================
// SOURCE HELPERS
// ============================================================

function sourceForSignal(
  signal
) {

  if (
    !signal
  ) {
    return null;
  }


  return (
    (board?.sources || [])
      .find(
        source =>
          source.id ===
          signal.sourceId
      ) ||
    null
  );

}


function sourceName(
  signal
) {

  const source =
    sourceForSignal(
      signal
    );

  return (
    source?.name ||
    signal.source ||
    signal.outlet ||
    'Public Source'
  );

}


function sourceOutlet(
  signal
) {

  const source =
    sourceForSignal(
      signal
    );

  return (
    source?.outlet ||
    signal.outlet ||
    ''
  );

}


// ============================================================
// CONSENSUS CARD
// ============================================================

function card(prop) {

  const side =
    prop.side ===
    'SPLIT'
      ? 'SPLIT'
      : prop.side;


  const lineText =
    prop.line == null
      ? 'Anytime TD'
      : prop.line;


  const status =
    liveStatus(prop);


  const lockedClass =
    isLocked(prop.id)
      ? ' locked'
      : '';


  const analystHtml =
    (prop.analysts || [])
      .map(signal => {

        const source =
          signal.source;

        const name =
          signal.analyst ||
          signal.analystName ||
          signal.author ||
          'Analyst';


        const outlet =
          source?.outlet ||
          signal.outlet ||
          'Public Source';


        const sideLabel =
          normalizeSide(
            signal.side ||
            signal.pick
          );


        const href =
          signal.url ||
          source?.url ||
          null;


        return `
          <div class="analyst-row">

            <div>
              <strong>
                ${escapeHtml(name)}
              </strong>

              <span>
                ${escapeHtml(
                  outlet
                )}
                —
                ${escapeHtml(
                  sideLabel
                )}
                ${
                  signal.line != null
                    ? ` ${escapeHtml(
                        String(
                          signal.line
                        )
                      )}`
                    : ''
                }
              </span>
            </div>

            ${
              href
                ? `
                  <a
                    href="${escapeAttr(
                      href
                    )}"
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
      .join('');


  return `
    <article
      class="prop-card${lockedClass}"
      data-id="${escapeAttr(
        prop.id
      )}"
    >

      <div class="prop-card-top">

        <span>
          NFL • ${
            escapeHtml(
              prop.week ||
              board?.week ||
              ''
            )
          }
        </span>

        <strong>
          ${prop.percent}%
        </strong>

      </div>


      <h3>
        ${escapeHtml(
          prop.player
        )}
        —
        ${escapeHtml(
          side
        )}
        ${
          prop.line != null
            ? ` ${escapeHtml(
                String(
                  prop.line
                )
              )}`
            : ''
        }
        ${escapeHtml(
          prop.market
        )}
      </h3>


      ${
        status
          ? status
          : ''
      }


      <div class="prop-metrics">

        <div>
          <b>
            ${prop.agree}
          </b>
          <span>
            Agree
          </span>
        </div>

        <div>
          <b>
            ${prop.disagree}
          </b>
          <span>
            Disagree
          </span>
        </div>

        <div>
          <b>
            ${prop.total}
          </b>
          <span>
            Experts
          </span>
        </div>

        <div>
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
          ${
            prop.agree
          }
          ${
            side
          }
          expert${
            prop.agree === 1
              ? ''
              : 's'
          }
        </strong>

        <span>
          ${
            prop.disagree
              ? `${prop.disagree} opposing`
              : 'No opposing pick found'
          }
        </span>

        <small>
          ${
            prop.strengthLabel
          } source signal
        </small>

      </div>


      ${
        analystHtml
          ? `
            <div class="analysts">
              ${analystHtml}
            </div>
          `
          : ''
      }


      <div class="rationale">
        ${escapeHtml(
          prop.rationale
        )}
      </div>


      <div class="prop-card-actions">

        <button
          type="button"
          class="secondary-btn lock-btn"
          data-lock-id="${escapeAttr(
            prop.id
          )}"
        >
          ${
            isLocked(prop.id)
              ? 'Locked'
              : 'Lock Pick'
          }
        </button>

      </div>

    </article>
  `;

}


// ============================================================
// ESCAPE HELPERS
// ============================================================

function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );

}


function escapeAttr(
  value
) {

  return escapeHtml(
    value
  );

}


// ============================================================
// RENDER EXPERT SIGNALS
// ============================================================

function renderProps() {

  const container =
    $('#propCards');

  if (!container) {
    return;
  }


  const filter =
    $('#confidenceFilter')
      ?.value ||
    'ALL';


  let props =
    board?.props ||
    [];


  if (
    filter !==
    'ALL'
  ) {

    props =
      props.filter(
        prop =>
          prop.strength ===
          filter
      );

  }


  if (!props.length) {

    container.innerHTML = `
      <div class="empty-state">
        <h3>
          No consensus signals found
        </h3>

        <p>
          Try another consensus-strength filter.
        </p>
      </div>
    `;

    return;

  }


  container.innerHTML =
    props
      .map(card)
      .join('');


  container
    .querySelectorAll(
      '[data-lock-id]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          toggleLock(
            button.dataset.lockId
          );

        }
      );

    });

}


// ============================================================
// RENDER EXPERT/SOURCE TABLES
// ============================================================

function renderExperts() {

  const rows =
    $('#expertRows');

  if (!rows) {
    return;
  }


  const list =
    Array.isArray(experts)
      ? experts
      : (
          experts?.analysts ||
          experts?.experts ||
          []
        );


  rows.innerHTML =
    list.map(expert => {

      const name =
        expert.name ||
        expert.analyst ||
        'Unknown';


      const outlet =
        expert.outlet ||
        expert.source ||
        '';


      const tracked =
        expert.tracked ??
        expert.picks ??
        0;


      const wins =
        expert.wins ??
        0;


      const losses =
        expert.losses ??
        0;


      const units =
        expert.units ??
        0;


      const roi =
        expert.roi ??
        null;


      return `
        <tr>

          <td>
            ${escapeHtml(
              name
            )}
          </td>

          <td>
            ${escapeHtml(
              outlet
            )}
          </td>

          <td>
            ${tracked}
          </td>

          <td>
            ${wins}-${losses}
          </td>

          <td>
            ${Number(
              units
            ).toFixed(2)}u
          </td>

          <td>
            ${
              roi == null
                ? '—'
                : `${roi}%`
            }
          </td>

          <td>
            ${
              expert.status ||
              'Tracked'
            }
          </td>

        </tr>
      `;

    }).join('');

}


function renderSources() {

  const rows =
    $('#sourceRows');

  if (!rows) {
    return;
  }


  const list =
    board?.sources ||
    [];


  rows.innerHTML =
    list.map(source => {

      return `
        <tr>

          <td>
            ${escapeHtml(
              source.name ||
              'Public Source'
            )}
          </td>

          <td>
            ${escapeHtml(
              source.outlet ||
              ''
            )}
          </td>

          <td>
            ${escapeHtml(
              source.evidence ||
              source.description ||
              'Published analyst opinion'
            )}
          </td>

          <td>
            ${escapeHtml(
              source.verification ||
              'Public'
            )}
          </td>

          <td>
            ${
              source.url
                ? `
                  <a
                    href="${escapeAttr(
                      source.url
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Source ↗
                  </a>
                `
                : '—'
            }
          </td>

        </tr>
      `;

    }).join('');

}


// ============================================================
// RENDER RECORD
// ============================================================

function renderRecord() {

  const wins =
    $('#wins');

  const losses =
    $('#losses');

  const units =
    $('#units');

  const roi =
    $('#roi');


  if (!results) {
    return;
  }


  const record =
    results.record ||
    results.summary ||
    results;


  if (wins) {

    wins.textContent =
      record.wins ??
      0;

  }


  if (losses) {

    losses.textContent =
      record.losses ??
      0;

  }


  if (units) {

    const value =
      Number(
        record.units ??
        0
      );


    units.textContent =
      `${value.toFixed(2)}u`;

  }


  if (roi) {

    const value =
      record.roi;


    roi.textContent =
      value == null
        ? '—'
        : `${value}%`;

  }

}


// ============================================================
// RENDER BOARD
// ============================================================

function render() {

  renderProps();
  renderExperts();
  renderSources();
  renderRecord();

  renderMarketSection();


  const signalCount =
    $('#signalCount2');

  const sourceCount =
    $('#sourceCount2');


  if (signalCount) {

    signalCount.textContent =
      board?.rawSignals?.length ||
      0;

  }


  if (sourceCount) {

    sourceCount.textContent =
      board?.sources?.length ||
      0;

  }


  const lastRefresh =
    $('#lastRefresh');

  if (lastRefresh) {

    const value =
      board?.liveUpdatedAt ||
      board?.refreshedAt;


    lastRefresh.textContent =
      value
        ? new Date(
            value
          ).toLocaleString()
        : '—';

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
      resultsData,
      marketData
    ] =
      await Promise.all([

        fetch(
          '/public-signals.json',
          {
            cache:
              'no-store'
          }
        ).then(
          response => {

            if (!response.ok) {

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
        ).then(
          response => {

            if (!response.ok) {

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
        ).then(
          response => {

            if (!response.ok) {

              throw new Error(
                'Could not load results-ledger.json'
              );

            }

            return response.json();

          }
        ),


        fetch(
          '/market-data.json',
          {
            cache:
              'no-store'
          }
        ).then(
          response => {

            if (!response.ok) {

              throw new Error(
                `Could not load market-data.json (${response.status})`
              );

            }

            return response.json();

          }
        ).catch(
          error => {

            console.warn(
              'Market data unavailable:',
              error
            );

            return [];

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
        new Date()
          .toISOString(),

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


    markets =
      Array.isArray(
        marketData
      )
        ? marketData
        : (
            marketData.markets ||
            marketData.data ||
            []
          );


    configureConsensusFilter();

    configureMarketControls();

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
    ).forEach(
      result => {

        if (result.id) {

          liveResults[
            result.id
          ] =
            result;

        }

      }
    );


    if (board) {

      board.liveUpdatedAt =
        data.updatedAt ||
        new Date()
          .toISOString();


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
// ============================================================
// THE MARKET — MERGED MARKET DATA MODULE
// ============================================================
// ============================================================

let marketSearchTerm = '';
let marketTypeFilter = 'ALL';
let marketTeamFilter = 'ALL';


// ============================================================
// MARKET HELPERS
// ============================================================

function marketSide(
  market,
  side
) {

  if (!market) {
    return null;
  }


  return (
    market.sides?.[side] ||
    market[side] ||
    null
  );

}


function marketLine(
  market
) {

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


  return (
    over?.line ??
    under?.line ??
    market.line ??
    null
  );

}


function marketOdds(
  market,
  side
) {

  const data =
    marketSide(
      market,
      side
    );


  return (
    data?.odds ??
    data?.price ??
    null
  );

}


function marketBestBook(
  market,
  side
) {

  const data =
    marketSide(
      market,
      side
    );


  return (
    data?.bestBook ??
    null
  );

}


function marketBestOdds(
  market,
  side
) {

  const data =
    marketSide(
      market,
      side
    );


  return (
    data?.bestBookOdds ??
    null
  );

}


function marketBestLine(
  market,
  side
) {

  const data =
    marketSide(
      market,
      side
    );


  return (
    data?.bestBookLine ??
    data?.line ??
    null
  );

}


function normalizeBookName(
  value
) {

  if (!value) {
    return '';
  }


  const names = {

    fanduel:
      'FanDuel',

    draftkings:
      'DraftKings',

    betmgm:
      'BetMGM',

    espnbet:
      'ESPN BET',

    betrivers:
      'BetRivers',

    caesars:
      'Caesars',

    bet365:
      'bet365',

    bovada:
      'Bovada',

    hardrockbet:
      'Hard Rock Bet',

    pinnacle:
      'Pinnacle',

    fanatics:
      'Fanatics',

    fliff:
      'Fliff'

  };


  const key =
    String(
      value
    )
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ''
      );


  return (
    names[key] ||
    String(value)
  );

}


function marketDisplayName(
  market
) {

  return (
    market?.market?.name ||
    market?.marketName ||
    market?.statName ||
    'Player Prop'
  );

}


function marketPlayerName(
  market
) {

  return (
    market?.player?.name ||
    market?.playerName ||
    'Unknown Player'
  );

}


function marketGameText(
  market
) {

  const away =
    market?.game?.awayTeam ||
    market?.awayTeam ||
    '';


  const home =
    market?.game?.homeTeam ||
    market?.homeTeam ||
    '';


  if (
    away &&
    home
  ) {

    return `${away} @ ${home}`;

  }


  return (
    market?.gameName ||
    'NFL'
  );

}


function marketTeamName(
  market
) {

  return (
    market?.player?.teamId ||
    market?.teamId ||
    ''
  );

}


function marketStatus(
  market
) {

  const result =
    findMarketLiveResult(
      market
    );


  if (!result) {
    return null;
  }


  if (
    result.status ===
    'LIVE'
  ) {

    return {
      type:
        'live',

      value:
        result.currentValue

    };

  }


  if (
    result.status ===
    'HIT'
  ) {

    return {
      type:
        'hit',

      value:
        result.currentValue

    };

  }


  if (
    result.status ===
    'MISS'
  ) {

    return {
      type:
        'miss',

      value:
        result.currentValue

    };

  }


  return null;

}


function findMarketLiveResult(
  market
) {

  const ids = [
    market?.id,
    market?.eventId,
    market?.player?.playerId
  ].filter(Boolean);


  for (
    const id of ids
  ) {

    if (
      liveResults[id]
    ) {

      return liveResults[id];

    }

  }


  const player =
    marketPlayerName(
      market
    )
      .toLowerCase();


  const stat =
    marketDisplayName(
      market
    )
      .toLowerCase();


  const found =
    Object.values(
      liveResults
    ).find(
      result => {

        const resultPlayer =
          String(
            result.player ||
            result.playerName ||
            ''
          )
            .toLowerCase();


        const resultMarket =
          String(
            result.market ||
            result.stat ||
            ''
          )
            .toLowerCase();


        return (
          resultPlayer ===
            player &&
          (
            !resultMarket ||
            resultMarket
              .includes(stat) ||
            stat.includes(
              resultMarket
            )
          )
        );

      }
    );


  return found ||
    null;

}


// ============================================================
// MARKET CONTROLS
// ============================================================

function configureMarketControls() {

  const section =
    $('#marketSection');

  if (!section) {
    return;
  }


  const search =
    $('#marketSearch');


  const type =
    $('#marketTypeFilter');


  const team =
    $('#marketTeamFilter');


  if (search) {

    search.value =
      marketSearchTerm;


    search.oninput =
      event => {

        marketSearchTerm =
          String(
            event.target.value ||
            ''
          )
            .trim()
            .toLowerCase();


        renderMarketCards();

      };

  }


  const marketTypes =
    [
      ...new Set(
        markets
          .map(
            market =>
              marketDisplayName(
                market
              )
          )
          .filter(Boolean)
      )
    ]
      .sort();


  if (type) {

    type.innerHTML =
      `
        <option value="ALL">
          All Markets
        </option>
      ` +
      marketTypes
        .map(
          name => `
            <option value="${escapeAttr(
              name
            )}">
              ${escapeHtml(
                name
              )}
            </option>
          `
        )
        .join('');


    type.value =
      marketTypeFilter;


    type.onchange =
      event => {

        marketTypeFilter =
          event.target.value ||
          'ALL';


        renderMarketCards();

      };

  }


  const teams =
    [
      ...new Set(
        markets
          .map(
            market =>
              marketTeamName(
                market
              )
          )
          .filter(Boolean)
      )
    ]
      .sort();


  if (team) {

    team.innerHTML =
      `
        <option value="ALL">
          Teams
        </option>
      ` +
      teams
        .map(
          value => `
            <option value="${escapeAttr(
              value
            )}">
              ${escapeHtml(
                prettyTeamName(
                  value
                )
              )}
            </option>
          `
        )
        .join('');


    team.value =
      marketTeamFilter;


    team.onchange =
      event => {

        marketTeamFilter =
          event.target.value ||
          'ALL';


        renderMarketCards();

      };

  }


  renderMarketCards();

}


function prettyTeamName(
  value
) {

  return String(
    value || ''
  )
    .replace(
      /_NFL$/i,
      ''
    )
    .replaceAll(
      '_',
      ' '
    )
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );

}


// ============================================================
// MARKET SECTION INJECTION
// ============================================================

function ensureMarketSection() {

  let section =
    $('#marketSection');


  if (section) {
    return section;
  }


  const propsSection =
    $('#props');


  if (!propsSection) {
    return null;
  }


  section =
    document.createElement(
      'section'
    );


  section.id =
    'marketSection';

  section.className =
    'section market-section';


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
          Current player prop markets
          and the best available prices.
        </p>

      </div>


      <div class="market-toolbar">

        <input
          id="marketSearch"
          type="search"
          placeholder="Search players or markets..."
          autocomplete="off"
        />


        <select
          id="marketTypeFilter"
        >
          <option value="ALL">
            All Markets
          </option>
        </select>


        <select
          id="marketTeamFilter"
        >
          <option value="ALL">
            Teams
          </option>
        </select>

      </div>

    </div>


    <div id="marketCards"></div>

  `;


  propsSection
    .insertAdjacentElement(
      'afterend',
      section
    );


  return section;

}


// ============================================================
// MARKET CARD
// ============================================================

function marketCard(
  market
) {

  const player =
    marketPlayerName(
      market
    );


  const matchup =
    marketGameText(
      market
    );


  const name =
    marketDisplayName(
      market
    );


  const line =
    marketLine(
      market
    );


  const overOdds =
    marketOdds(
      market,
      'over'
    );


  const underOdds =
    marketOdds(
      market,
      'under'
    );


  const bestOverBook =
    normalizeBookName(
      marketBestBook(
        market,
        'over'
      )
    );


  const bestUnderBook =
    normalizeBookName(
      marketBestBook(
        market,
        'under'
      )
    );


  const bestOverOdds =
    marketBestOdds(
      market,
      'over'
    );


  const bestUnderOdds =
    marketBestOdds(
      market,
      'under'
    );


  const status =
    marketStatus(
      market
    );


  const eventId =
    market.eventId ||
    market.id ||
    '';


  let statusHtml =
    '';


  if (status) {

    const label =
      status.type ===
      'live'
        ? 'LIVE'
        : status.type ===
          'hit'
          ? 'BET HIT'
          : 'BET MISS';


    statusHtml = `
      <div class="market-live ${status.type}">

        <strong>
          ${label}
          ${
            status.value !==
            undefined
              ? ` · ${escapeHtml(
                  formatNumber(
                    status.value
                  )
                )}`
              : ''
          }
        </strong>

      </div>
    `;

  }


  return `

    <article
      class="market-card"
      data-market-id="${escapeAttr(
        eventId
      )}"
    >

      <div class="market-card-top">

        <div>

          <h3>
            ${escapeHtml(
              player
            )}
          </h3>

          <p>
            ${escapeHtml(
              matchup
            )}
          </p>

        </div>

      </div>


      <div class="market-category">

        ${escapeHtml(
          name
        )}

      </div>


      <div class="market-line">

        <strong>
          ${
            line == null
              ? '—'
              : escapeHtml(
                  String(line)
                )
          }
        </strong>

      </div>


      <div class="market-odds">

        <span class="over">
          OVER
          ${
            overOdds
              ? ` ${escapeHtml(
                  String(
                    overOdds
                  )
                )}`
              : ''
          }
        </span>

        <span class="under">
          UNDER
          ${
            underOdds
              ? ` ${escapeHtml(
                  String(
                    underOdds
                  )
                )}`
              : ''
          }
        </span>

      </div>


      ${statusHtml}


      <div class="market-best">

        <div>

          <span>
            Best Over
          </span>

          <strong>
            ${
              bestOverBook
                ? escapeHtml(
                    bestOverBook
                  )
                : '—'
            }

            ${
              bestOverOdds
                ? ` ${escapeHtml(
                    String(
                      bestOverOdds
                    )
                  )}`
                : ''
            }
          </strong>

        </div>


        <div>

          <span>
            Best Under
          </span>

          <strong>
            ${
              bestUnderBook
                ? escapeHtml(
                    bestUnderBook
                  )
                : '—'
            }

            ${
              bestUnderOdds
                ? ` ${escapeHtml(
                    String(
                      bestUnderOdds
                    )
                  )}`
                : ''
            }
          </strong>

        </div>

      </div>


      <button
        type="button"
        class="market-details-btn"
        data-market-details="${escapeAttr(
          eventId
        )}"
      >
        View Market Details →
      </button>

    </article>

  `;

}


// ============================================================
// FILTER MARKET DATA
// ============================================================

function filteredMarkets() {

  return markets.filter(
    market => {

      const player =
        marketPlayerName(
          market
        );


      const name =
        marketDisplayName(
          market
        );


      const matchup =
        marketGameText(
          market
        );


      const team =
        marketTeamName(
          market
        );


      const searchText =
        [
          player,
          name,
          matchup,
          team
        ]
          .join(' ')
          .toLowerCase();


      if (
        marketSearchTerm &&
        !searchText.includes(
          marketSearchTerm
        )
      ) {

        return false;

      }


      if (
        marketTypeFilter !==
        'ALL' &&
        name !==
        marketTypeFilter
      ) {

        return false;

      }


      if (
        marketTeamFilter !==
        'ALL' &&
        team !==
        marketTeamFilter
      ) {

        return false;

      }


      return true;

    }
  );

}


// ============================================================
// MARKET RENDER
// ============================================================

function renderMarketCards() {

  const section =
    ensureMarketSection();


  if (!section) {
    return;
  }


  const cards =
    $('#marketCards');


  if (!cards) {
    return;
  }


  const list =
    filteredMarkets();


  if (!list.length) {

    cards.innerHTML = `
      <div class="empty-state">

        <h3>
          No markets found
        </h3>

        <p>
          Try a different player,
          market or team.
        </p>

      </div>
    `;

    return;

  }


  const groups = {};


  list.forEach(
    market => {

      const week =
        market.week ||
        'Week 1';


      if (!groups[week]) {

        groups[week] =
          [];

      }


      groups[week].push(
        market
      );

    }
  );


  cards.innerHTML =
    Object.entries(
      groups
    )
      .map(
        ([
          week,
          weekMarkets
        ]) => {

          const liveCount =
            weekMarkets.filter(
              market =>
                marketStatus(
                  market
                )?.type ===
                'live'
            ).length;


          return `

            <div
              class="market-week"
              data-week="${escapeAttr(
                week
              )}"
            >

              <div class="market-week-head">

                <div>

                  <strong>
                    ${escapeHtml(
                      week
                    )}
                  </strong>

                  <span class="market-state">
                    ${
                      week ===
                      (
                        board?.week ||
                        'Week 1'
                      )
                        ? 'CURRENT'
                        : 'UPCOMING'
                    }
                  </span>

                </div>


                <span>

                  ${
                    weekMarkets.length
                  }
                  markets

                  ${
                    liveCount
                      ? ` • ${liveCount} live`
                      : ''
                  }

                </span>

              </div>


              <div class="market-grid">

                ${
                  weekMarkets
                    .map(
                      marketCard
                    )
                    .join('')
                }

              </div>

            </div>

          `;

        }
      )
      .join('');


  cards
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
                    item.id ||
                    item.eventId ||
                    ''
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
// MARKET DETAILS MODAL
// ============================================================

function openMarketDetails(
  market
) {

  let modal =
    $('#marketDetailsModal');


  if (!modal) {

    modal =
      document.createElement(
        'div'
      );


    modal.id =
      'marketDetailsModal';


    modal.className =
      'modal';


    modal.innerHTML = `

      <div class="modal-backdrop"></div>

      <div
        class="modal-panel market-details-panel"
        role="dialog"
        aria-modal="true"
      >

        <button
          type="button"
          class="modal-close"
          id="closeMarketDetails"
          aria-label="Close"
        >
          ×
        </button>


        <div
          id="marketDetailsContent"
        ></div>

      </div>

    `;


    document.body
      .appendChild(
        modal
      );


    $('#closeMarketDetails')
      ?.addEventListener(
        'click',
        closeMarketDetails
      );


    modal
      .querySelector(
        '.modal-backdrop'
      )
      ?.addEventListener(
        'click',
        closeMarketDetails
      );

  }


  const content =
    $('#marketDetailsContent');


  if (!content) {
    return;
  }


  const player =
    marketPlayerName(
      market
    );


  const matchup =
    marketGameText(
      market
    );


  const name =
    marketDisplayName(
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


  const sportsbooks = {
    ...(over?.sportsbooks || {}),
    ...(under?.sportsbooks || {})
  };


  const books =
    Object.values(
      sportsbooks
    );


  content.innerHTML = `

    <p class="eyebrow">
      MARKET DETAILS
    </p>


    <h2>
      ${escapeHtml(
        player
      )}
    </h2>


    <p class="muted">
      ${escapeHtml(
        matchup
      )}
    </p>


    <div class="market-detail-summary">

      <div>
        <span>
          Market
        </span>

        <strong>
          ${escapeHtml(
            name
          )}
        </strong>
      </div>


      <div>
        <span>
          Current Line
        </span>

        <strong>
          ${
            marketLine(
              market
            ) ??
            '—'
          }
        </strong>
      </div>


      <div>
        <span>
          Over
        </span>

        <strong>
          ${
            marketOdds(
              market,
              'over'
            ) ||
            '—'
          }
        </strong>
      </div>


      <div>
        <span>
          Under
        </span>

        <strong>
          ${
            marketOdds(
              market,
              'under'
            ) ||
            '—'
          }
        </strong>
      </div>

    </div>


    <h3>
      Available Prices
    </h3>


    <div class="market-books">

      ${
        books.length
          ? books
              .map(
                book => `

                  <div class="market-book-row">

                    <strong>
                      ${escapeHtml(
                        normalizeBookName(
                          book.name ||
                          book.book ||
                          ''
                        )
                      )}
                    </strong>

                    <span>
                      ${
                        book.line ??
                        '—'
                      }
                    </span>

                    <span>
                      ${
                        book.odds ??
                        '—'
                      }
                    </span>

                  </div>

                `
              )
              .join('')
          : `
              <p class="muted">
                No individual sportsbook
                prices are currently available.
              </p>
            `
      }

    </div>

  `;


  modal.classList.add(
    'open'
  );


  modal.setAttribute(
    'aria-hidden',
    'false'
  );

}


function closeMarketDetails() {

  const modal =
    $('#marketDetailsModal');


  if (!modal) {
    return;
  }


  modal.classList.remove(
    'open'
  );


  modal.setAttribute(
    'aria-hidden',
    'true'
  );

}


// ============================================================
// MARKET DATA REFRESH
// ============================================================

async function loadMarkets() {

  try {

    const response =
      await fetch(
        '/market-data.json?_=' +
        Date.now(),
        {
          cache:
            'no-store'
        }
      );


    if (!response.ok) {

      throw new Error(
        `Could not load market-data.json (${response.status})`
      );

    }


    const data =
      await response.json();


    markets =
      Array.isArray(data)
        ? data
        : (
            data.markets ||
            data.data ||
            []
          );


    configureMarketControls();

    renderMarketSection();

  }

  catch (error) {

    console.error(
      'LineFoundry market data failed:',
      error
    );


    const cards =
      $('#marketCards');


    if (cards) {

      cards.innerHTML = `
        <div class="empty-state">

          <h3>
            Market data unavailable
          </h3>

          <p>
            The Expert Signals board
            is still available.
          </p>

        </div>
      `;

    }

  }

}


// ============================================================
// MARKET SECTION RENDER
// ============================================================

function renderMarketSection() {

  ensureMarketSection();

  configureMarketControls();

}


// ============================================================
// MARKET AUTO REFRESH
// ============================================================

setInterval(
  loadMarkets,
  60000
);


// ============================================================
// EVENT LISTENERS
// ============================================================

$('#confidenceFilter')
  ?.addEventListener(
    'change',
    render
  );


$('#refreshBoard')
  ?.addEventListener(
    'click',
    () => {

      load();

    }
  );


$('#howItWorks')
  ?.addEventListener(
    'click',
    () =>
      $('#howModal')
        ?.setAttribute(
          'aria-hidden',
          'false'
        )
  );


$('#closeHow')
  ?.addEventListener(
    'click',
    () =>
      $('#howModal')
        ?.setAttribute(
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
        ?.setAttribute(
          'aria-hidden',
          'true'
        )
  );


// ============================================================
// INITIAL LOAD
// ============================================================

load();


// Also independently load the Market.
// This means a market-data problem cannot
// prevent Expert Signals from loading.
setTimeout(
  loadMarkets,
  1000
);


// Also trigger live results independently shortly
// after page load.
setTimeout(
  loadLiveResults,
  1500
);
