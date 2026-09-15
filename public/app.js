const SIGNALS_URL =
  "https://raw.githubusercontent.com/tannerbro10-dot/linefoundry/main/public/public-signals.json";

const MARKET_DATA_URL =
  "https://raw.githubusercontent.com/tannerbro10-dot/linefoundry/main/market-data.json";

const WORKER_URL =
  "https://old-mouse-660a.tannerbro10.workers.dev/";

let signals = [];
let markets = [];
let marketResults = [];
let selectedConfidence = "all";
let selectedMarketType = "all";
let searchTerm = "";

document.addEventListener("DOMContentLoaded", () => {
  injectBoardStyles();
  bindNavigation();
  bindControls();
  loadBoard();
});

function injectBoardStyles() {
  if (document.getElementById("linefoundry-board-styles")) return;

  const style = document.createElement("style");
  style.id = "linefoundry-board-styles";

  style.textContent = `
    .lf-market-section {
      margin-top: 40px;
    }

    .lf-market-controls {
      display: flex;
      gap: 12px;
      align-items: center;
      margin: 20px 0 24px;
      flex-wrap: wrap;
    }

    .lf-market-search {
      flex: 1;
      min-width: 220px;
      padding: 12px 14px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 10px;
      background: rgba(255,255,255,.04);
      color: inherit;
      font: inherit;
    }

    .lf-market-filter {
      min-width: 170px;
      padding: 12px 14px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 10px;
      background: rgba(255,255,255,.04);
      color: inherit;
      font: inherit;
    }

    .lf-market-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }

    .lf-market-card {
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 16px;
      padding: 20px;
      background: rgba(255,255,255,.035);
      min-width: 0;
    }

    .lf-market-player {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -.02em;
    }

    .lf-market-meta {
      margin-top: 5px;
      font-size: 13px;
      opacity: .65;
    }

    .lf-market-name {
      margin-top: 18px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: .08em;
      opacity: .65;
      font-weight: 700;
    }

    .lf-market-line {
      font-size: 42px;
      line-height: 1;
      font-weight: 900;
      margin-top: 7px;
      letter-spacing: -.04em;
    }

    .lf-market-odds {
      display: flex;
      gap: 14px;
      margin-top: 10px;
      font-size: 14px;
      font-weight: 700;
    }

    .lf-market-best {
      margin-top: 13px;
      font-size: 12px;
      opacity: .7;
    }

    .lf-market-result {
      margin-top: 15px;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: .04em;
    }

    .lf-market-result.live {
      opacity: .9;
    }

    .lf-market-result.final {
      opacity: .9;
    }

    .lf-market-result.pending {
      opacity: .45;
    }

    .lf-market-details {
      display: inline-block;
      margin-top: 18px;
      font-size: 13px;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    .lf-empty {
      padding: 30px;
      border: 1px dashed rgba(255,255,255,.12);
      border-radius: 14px;
      opacity: .65;
      text-align: center;
    }

    .lf-week-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 16px 18px;
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 12px;
      background: rgba(255,255,255,.025);
      color: inherit;
      cursor: pointer;
      font: inherit;
      text-align: left;
      margin-top: 14px;
    }

    .lf-week-title {
      font-weight: 900;
    }

    .lf-week-summary {
      font-size: 12px;
      opacity: .6;
      margin-left: 12px;
    }

    .lf-week-body {
      padding-top: 8px;
    }

    .lf-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0,0,0,.72);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .lf-modal {
      width: min(760px, 100%);
      max-height: 90vh;
      overflow: auto;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,.12);
      background: #111;
      padding: 24px;
      box-shadow: 0 20px 80px rgba(0,0,0,.45);
    }

    .lf-modal-head {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
    }

    .lf-modal-close {
      border: 0;
      background: transparent;
      color: inherit;
      font-size: 26px;
      cursor: pointer;
    }

    .lf-book-row {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      padding: 13px 0;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .lf-modal-section {
      margin-top: 26px;
    }

    .lf-modal-section h4 {
      margin-bottom: 12px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      opacity: .6;
    }

    @media (max-width: 1100px) {
      .lf-market-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 700px) {
      .lf-market-grid {
        grid-template-columns: 1fr;
      }

      .lf-market-line {
        font-size: 36px;
      }
    }
  `;

  document.head.appendChild(style);
}

function bindNavigation() {
  document.querySelectorAll("[data-section]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = link.getAttribute("data-section");
      const element = document.getElementById(target);

      if (element) {
        event.preventDefault();
        element.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });
}

function bindControls() {
  const confidence = document.getElementById("confidenceFilter");

  if (confidence) {
    confidence.addEventListener("change", (event) => {
      selectedConfidence = event.target.value;
      renderSignals();
    });
  }

  const refresh = document.getElementById("refreshBoard");

  if (refresh) {
    refresh.addEventListener("click", async () => {
      await loadBoard(true);
    });
  }
}

async function loadBoard(showStatus = false) {
  try {
    if (showStatus) {
      setRefreshStatus("Refreshing LineFoundry data...");
    }

    const [signalsResponse, marketResponse, workerResponse] =
      await Promise.all([
        fetch(`${SIGNALS_URL}?t=${Date.now()}`),
        fetch(`${MARKET_DATA_URL}?t=${Date.now()}`),
        fetch(`${WORKER_URL}?t=${Date.now()}`),
      ]);

    if (!signalsResponse.ok) {
      throw new Error("Unable to load public signals.");
    }

    if (!marketResponse.ok) {
      throw new Error("Unable to load market data.");
    }

    const signalData = await signalsResponse.json();
    const marketData = await marketResponse.json();

    signals = Array.isArray(signalData)
      ? signalData
      : Array.isArray(signalData.signals)
      ? signalData.signals
      : [];

    markets = Array.isArray(marketData)
      ? marketData
      : Array.isArray(marketData.markets)
      ? marketData.markets
      : [];

    if (workerResponse.ok) {
      const workerData = await workerResponse.json();

      if (workerData && workerData.success) {
        signals = mergeWorkerSignalResults(signals, workerData);
        marketResults = Array.isArray(workerData.marketResults)
          ? workerData.marketResults
          : [];
      }
    }

    renderAll();
    populateMarketTypes();

    if (showStatus) {
      setRefreshStatus(
        `Updated ${new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}`
      );
    }
  } catch (error) {
    console.error("LineFoundry load error:", error);

    if (showStatus) {
      setRefreshStatus("Unable to refresh data.");
    }

    renderAll();
  }
}

function mergeWorkerSignalResults(baseSignals, workerData) {
  if (!Array.isArray(workerData.signals)) {
    return baseSignals;
  }

  const workerMap = new Map();

  workerData.signals.forEach((signal) => {
    const key = getSignalKey(signal);
    workerMap.set(key, signal);
  });

  return baseSignals.map((signal) => {
    const match = workerMap.get(getSignalKey(signal));

    if (!match) {
      return signal;
    }

    return {
      ...signal,
      ...match,
      result: match.result || signal.result,
      actual: match.actual ?? signal.actual,
      status: match.status || signal.status,
    };
  });
}

function getSignalKey(signal) {
  return [
    signal.week || "",
    signal.player || signal.playerName || "",
    signal.market || signal.marketType || "",
    signal.line ?? "",
    signal.side || signal.direction || "",
  ]
    .join("|")
    .toLowerCase();
}

function renderAll() {
  renderSignals();
  renderExperts();
  renderConsensus();
  renderResults();
  renderMarkets();
  bindMarketSearch();
  bindMarketDetails();
}

function renderSignals() {
  const container =
    document.getElementById("propCards") ||
    document.getElementById("signalCards") ||
    document.querySelector(".prop-cards");

  if (!container) return;

  const filtered = filterSignals();

  if (!filtered.length) {
    container.innerHTML =
      '<div class="lf-empty">No tracked signals match the current filters.</div>';
    return;
  }

  const grouped = groupSignalsByWeek(filtered);

  container.innerHTML = "";

  const weeks = Object.keys(grouped).sort(compareWeeks);

  weeks.forEach((week, index) => {
    const section = document.createElement("div");
    section.className = "lf-week-section";

    const stats = getWeekSignalStats(grouped[week]);

    const header = document.createElement("button");
    header.className = "lf-week-header";

    const isCurrent = isCurrentWeek(week);

    header.innerHTML = `
      <span>
        <span class="lf-week-title">${escapeHtml(week)}</span>
        <span class="lf-week-summary">
          ${stats.total} picks · ${stats.hits} hits · ${stats.misses} misses
        </span>
      </span>
      <span>${isCurrent ? "▾" : "▸"}</span>
    `;

    const body = document.createElement("div");
    body.className = "lf-week-body";
    body.style.display = isCurrent ? "block" : "none";

    header.addEventListener("click", () => {
      const open = body.style.display !== "none";
      body.style.display = open ? "none" : "block";

      const arrow = header.querySelector("span:last-child");
      if (arrow) {
        arrow.textContent = open ? "▸" : "▾";
      }
    });

    const grid = document.createElement("div");
    grid.className = "prop-grid";

    grouped[week].forEach((signal) => {
      grid.appendChild(createSignalCard(signal));
    });

    body.appendChild(grid);
    section.appendChild(header);
    section.appendChild(body);
    container.appendChild(section);
  });
}

function createSignalCard(signal) {
  const card = document.createElement("article");
  card.className = "prop-card";

  const player =
    signal.player ||
    signal.playerName ||
    signal.name ||
    "Unknown Player";

  const market =
    signal.market ||
    signal.marketType ||
    signal.stat ||
    "Player Prop";

  const side = String(
    signal.side || signal.direction || signal.pick || "OVER"
  ).toUpperCase();

  const line = signal.line ?? signal.threshold ?? "";

  const status = getSignalStatus(signal);
  const actual = getSignalActual(signal);

  card.innerHTML = `
    <div class="prop-card-top">
      <div>
        <div class="prop-player">${escapeHtml(player)}</div>
        <div class="prop-market">${escapeHtml(market)}</div>
      </div>
      <div class="prop-side">${escapeHtml(side)}</div>
    </div>

    <div class="prop-line">${escapeHtml(String(line))}</div>

    ${
      status
        ? `<div class="prop-result ${status.className}">
             ${escapeHtml(status.label)}
           </div>`
        : ""
    }

    ${
      actual !== null && actual !== undefined
        ? `<div class="prop-actual">${escapeHtml(formatActual(market, actual))}</div>`
        : ""
    }

    ${renderSignalConsensus(signal)}
  `;

  return card;
}

function renderSignalConsensus(signal) {
  const group = getConsensusGroupForSignal(signal);

  if (!group) return "";

  return `
    <div class="prop-consensus">
      <span>AGREE ${group.agree}</span>
      <span>·</span>
      <span>DISAGREE ${group.disagree}</span>
      <span>·</span>
      <span>EXPERTS ${group.total}</span>
    </div>
  `;
}

function getSignalStatus(signal) {
  const status = String(
    signal.status ||
      signal.result ||
      signal.settlement ||
      signal.outcome ||
      ""
  ).toUpperCase();

  if (status.includes("HIT") || status === "WIN") {
    return {
      label: "🟢 BET HIT",
      className: "hit",
    };
  }

  if (status.includes("MISS") || status === "LOSS") {
    return {
      label: "🔴 BET MISS",
      className: "miss",
    };
  }

  if (status === "LIVE") {
    return {
      label: "LIVE",
      className: "live",
    };
  }

  return null;
}

function getSignalActual(signal) {
  if (signal.actual !== undefined && signal.actual !== null) {
    return signal.actual;
  }

  if (
    signal.currentValue !== undefined &&
    signal.currentValue !== null
  ) {
    return signal.currentValue;
  }

  if (
    signal.result &&
    typeof signal.result === "object" &&
    signal.result.currentValue !== undefined
  ) {
    return signal.result.currentValue;
  }

  return null;
}

function formatActual(market, value) {
  const normalized = String(market || "").toLowerCase();

  if (
    normalized.includes("touchdown") ||
    normalized.includes("td")
  ) {
    return `${value} TD${Number(value) === 1 ? "" : "S"} ACTUAL`;
  }

  if (
    normalized.includes("yard") ||
    normalized.includes("attempt") ||
    normalized.includes("reception") ||
    normalized.includes("completion") ||
    normalized.includes("interception")
  ) {
    const label = normalized.includes("yard")
      ? "YARDS"
      : normalized.includes("attempt")
      ? "ATTEMPTS"
      : normalized.includes("reception")
      ? "RECEPTIONS"
      : normalized.includes("completion")
      ? "COMPLETIONS"
      : "INT";

    return `${value} ${label} ACTUAL`;
  }

  return `${value} ACTUAL`;
}

function filterSignals() {
  return signals.filter((signal) => {
    if (selectedConfidence !== "all") {
      const confidence = String(
        signal.confidence || signal.confidenceLevel || ""
      ).toLowerCase();

      if (confidence !== selectedConfidence.toLowerCase()) {
        return false;
      }
    }

    return true;
  });
}

function groupSignalsByWeek(items) {
  return items.reduce((groups, signal) => {
    const week = signal.week || "Week 1";

    if (!groups[week]) {
      groups[week] = [];
    }

    groups[week].push(signal);
    return groups;
  }, {});
}

function getWeekSignalStats(items) {
  let hits = 0;
  let misses = 0;

  items.forEach((signal) => {
    const status = getSignalStatus(signal);

    if (status?.className === "hit") hits++;
    if (status?.className === "miss") misses++;
  });

  return {
    total: items.length,
    hits,
    misses,
  };
}

function getConsensusGroupForSignal(signal) {
  const week = signal.week || "Week 1";

  const player = String(
    signal.player || signal.playerName || ""
  ).toLowerCase();

  const market = String(
    signal.market || signal.marketType || signal.stat || ""
  ).toLowerCase();

  const line = String(signal.line ?? "").toLowerCase();

  const related = signals.filter((item) => {
    const itemWeek = item.week || "Week 1";

    const itemPlayer = String(
      item.player || item.playerName || ""
    ).toLowerCase();

    const itemMarket = String(
      item.market || item.marketType || item.stat || ""
    ).toLowerCase();

    const itemLine = String(item.line ?? "").toLowerCase();

    return (
      itemWeek === week &&
      itemPlayer === player &&
      itemMarket === market &&
      itemLine === line
    );
  });

  if (!related.length) return null;

  let agree = 0;
  let disagree = 0;

  const direction = String(
    signal.side || signal.direction || signal.pick || ""
  ).toLowerCase();

  related.forEach((item) => {
    const itemDirection = String(
      item.side || item.direction || item.pick || ""
    ).toLowerCase();

    if (itemDirection === direction) {
      agree++;
    } else {
      disagree++;
    }
  });

  return {
    agree,
    disagree,
    total: related.length,
  };
}

function renderExperts() {
  const container =
    document.getElementById("expertCards") ||
    document.getElementById("expertsGrid") ||
    document.querySelector(".expert-grid");

  if (!container) return;

  const experts = buildExpertSummary();

  if (!experts.length) {
    container.innerHTML =
      '<div class="lf-empty">Expert tracking data will appear here as results accumulate.</div>';
    return;
  }

  container.innerHTML = "";

  experts.forEach((expert) => {
    const card = document.createElement("article");
    card.className = "expert-card";

    card.innerHTML = `
      <div class="expert-card-name">${escapeHtml(expert.name)}</div>
      <div class="expert-card-source">${escapeHtml(expert.source)}</div>
      <div class="expert-card-record">
        ${expert.hits}-${expert.misses}
      </div>
      <div class="expert-card-meta">
        ${expert.total} tracked picks
      </div>
    `;

    container.appendChild(card);
  });
}

function buildExpertSummary() {
  const map = new Map();

  signals.forEach((signal) => {
    const name =
      signal.analyst ||
      signal.expert ||
      signal.author ||
      signal.sourceName;

    if (!name) return;

    const key = String(name).toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        name,
        source: signal.source || signal.publication || "",
        hits: 0,
        misses: 0,
        total: 0,
      });
    }

    const item = map.get(key);
    const status = getSignalStatus(signal);

    item.total++;

    if (status?.className === "hit") item.hits++;
    if (status?.className === "miss") item.misses++;
  });

  return Array.from(map.values()).sort((a, b) => {
    if (b.hits !== a.hits) {
      return b.hits - a.hits;
    }

    return b.total - a.total;
  });
}

function renderConsensus() {
  const container =
    document.getElementById("consensusCards") ||
    document.getElementById("consensusGrid");

  if (!container) return;

  const groups = buildConsensusGroups();

  if (!groups.length) {
    container.innerHTML =
      '<div class="lf-empty">Consensus signals will appear here as analysts publish picks.</div>';
    return;
  }

  container.innerHTML = "";

  groups.forEach((group) => {
    const card = document.createElement("article");
    card.className = "consensus-card";

    card.innerHTML = `
      <div class="consensus-player">${escapeHtml(group.player)}</div>
      <div class="consensus-market">${escapeHtml(group.market)}</div>
      <div class="consensus-pick">
        ${escapeHtml(group.direction)} ${escapeHtml(String(group.line))}
      </div>
      <div class="consensus-count">
        AGREE ${group.agree} · DISAGREE ${group.disagree} · EXPERTS ${group.total}
      </div>
    `;

    container.appendChild(card);
  });
}

function buildConsensusGroups() {
  const map = new Map();

  signals.forEach((signal) => {
    const week = signal.week || "Week 1";

    const player =
      signal.player ||
      signal.playerName ||
      signal.name ||
      "";

    const market =
      signal.market ||
      signal.marketType ||
      signal.stat ||
      "";

    const line = signal.line ?? "";

    const direction = String(
      signal.side || signal.direction || signal.pick || ""
    ).toUpperCase();

    const key = [
      week,
      player,
      market,
      line,
    ]
      .join("|")
      .toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        week,
        player,
        market,
        line,
        direction,
        agree: 0,
        disagree: 0,
        total: 0,
      });
    }

    const group = map.get(key);
    group.total++;

    if (group.total === 1) {
      group.direction = direction;
      group.agree++;
    } else if (direction === group.direction) {
      group.agree++;
    } else {
      group.disagree++;
    }
  });

  return Array.from(map.values())
    .filter((group) => group.total >= 2)
    .sort((a, b) => b.total - a.total);
}

function renderResults() {
  const record =
    document.getElementById("resultsRecord") ||
    document.getElementById("publicRecord");

  if (!record) return;

  let hits = 0;
  let misses = 0;

  signals.forEach((signal) => {
    const status = getSignalStatus(signal);

    if (status?.className === "hit") hits++;
    if (status?.className === "miss") misses++;
  });

  const total = hits + misses;
  const percentage = total
    ? Math.round((hits / total) * 100)
    : 0;

  record.textContent = total
    ? `${hits}-${misses} · ${percentage}%`
    : "Results tracking is live";
}

function populateMarketTypes() {
  const select =
    document.getElementById("marketTypeFilter") ||
    document.getElementById("marketFilter");

  if (!select) return;

  const currentValue = select.value;

  const types = Array.from(
    new Set(
      markets
        .map((market) => {
          return (
            market?.market?.name ||
            market?.marketType ||
            market?.market?.statId ||
            ""
          );
        })
        .filter(Boolean)
    )
  ).sort();

  select.innerHTML = `<option value="all">All Markets</option>`;

  types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = prettifyMarketType(type);
    select.appendChild(option);
  });

  if (types.includes(currentValue)) {
    select.value = currentValue;
  }

  select.onchange = (event) => {
    selectedMarketType = event.target.value;
    renderMarkets();
  };
}

function prettifyMarketType(type) {
  const value = String(type || "");

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function bindMarketSearch() {
  const input =
    document.getElementById("marketSearch") ||
    document.getElementById("marketSearchInput");

  if (!input || input.dataset.bound === "true") return;

  input.dataset.bound = "true";

  input.addEventListener("input", (event) => {
    searchTerm = event.target.value.toLowerCase().trim();
    renderMarkets();
  });
}

function renderMarkets() {
  const container =
    document.getElementById("marketCards") ||
    document.getElementById("marketGrid") ||
    document.querySelector(".market-grid");

  if (!container) return;

  const filtered = markets.filter((market) => {
    const player = String(
      market?.player?.name ||
        market?.playerName ||
        ""
    ).toLowerCase();

    const marketName = String(
      market?.market?.name ||
        market?.marketType ||
        ""
    ).toLowerCase();

    const game = String(
      market?.game?.awayTeam || ""
    ).toLowerCase() +
      " " +
      String(
        market?.game?.homeTeam || ""
      ).toLowerCase();

    const type =
      market?.market?.name ||
      market?.marketType ||
      market?.market?.statId ||
      "";

    if (
      selectedMarketType !== "all" &&
      String(type).toLowerCase() !==
        String(selectedMarketType).toLowerCase()
    ) {
      return false;
    }

    if (!searchTerm) return true;

    return (
      player.includes(searchTerm) ||
      marketName.includes(searchTerm) ||
      game.includes(searchTerm)
    );
  });

  if (!filtered.length) {
    container.innerHTML =
      '<div class="lf-empty">No markets match your search.</div>';
    return;
  }

  container.innerHTML = "";

  filtered.forEach((market) => {
    container.appendChild(createMarketCard(market));
  });

  bindMarketDetails();
}

function createMarketCard(market) {
  const card = document.createElement("article");
  card.className = "lf-market-card";

  const player =
    market?.player?.name ||
    market?.playerName ||
    "Unknown Player";

  const team =
    market?.player?.teamId ||
    market?.team ||
    "";

  const away = market?.game?.awayTeam || "";
  const home = market?.game?.homeTeam || "";

  const opponent = getOpponentText(team, away, home);

  const marketName =
    market?.market?.name ||
    market?.marketType ||
    prettifyMarketType(
      market?.market?.statId || "Player Prop"
    );

  const isTouchdown = marketName
    .toLowerCase()
    .includes("touchdown");

  const over = market?.sides?.over || {};
  const under = market?.sides?.under || {};

  const yes = market?.sides?.yes || {};
  const no = market?.sides?.no || {};

  let mainLine = "";
  let oddsHtml = "";

  if (isTouchdown) {
    mainLine = "TD";

    oddsHtml = `
      <span>YES ${escapeHtml(formatOdds(yes.odds))}</span>
      <span>NO ${escapeHtml(formatOdds(no.odds))}</span>
    `;
  } else {
    const line = over.line ?? under.line ?? "";

    mainLine = line;

    oddsHtml = `
      <span>OVER ${escapeHtml(formatOdds(over.odds))}</span>
      <span>UNDER ${escapeHtml(formatOdds(under.odds))}</span>
    `;
  }

  const bestOverBook = over.bestBook || "";
  const bestUnderBook = under.bestBook || "";

  const result = getMarketResult(market);

  card.innerHTML = `
    <div class="lf-market-player">${escapeHtml(player)}</div>

    <div class="lf-market-meta">
      ${escapeHtml(teamName(team) || team)}
      ${
        opponent
          ? ` · ${escapeHtml(opponent)}`
          : ""
      }
    </div>

    <div class="lf-market-name">
      ${escapeHtml(marketName)}
    </div>

    <div class="lf-market-line">
      ${escapeHtml(String(mainLine))}
    </div>

    <div class="lf-market-odds">
      ${oddsHtml}
    </div>

    ${
      bestOverBook || bestUnderBook
        ? `
          <div class="lf-market-best">
            ${
              bestOverBook
                ? `Best Over: ${escapeHtml(prettifyBook(bestOverBook))}`
                : ""
            }
            ${
              bestOverBook && bestUnderBook
                ? " · "
                : ""
            }
            ${
              bestUnderBook
                ? `Best Under: ${escapeHtml(prettifyBook(bestUnderBook))}`
                : ""
            }
          </div>
        `
        : ""
    }

    ${renderMarketResult(result, isTouchdown)}

    <a href="#" class="lf-market-details" data-market-id="${escapeHtml(
      market.id || ""
    )}">
      View Market Details →
    </a>
  `;

  return card;
}

function getMarketResult(market) {
  if (!market) return null;

  const id = String(market.id || "");

  const direct = marketResults.find(
    (result) =>
      String(result.id || result.marketId || "") === id
  );

  if (direct) return direct;

  const eventId = String(market.eventId || "");
  const playerId = String(
    market.player?.playerId ||
      market.playerId ||
      ""
  );

  const statId = String(
    market.market?.statId ||
      market.statId ||
      ""
  );

  return (
    marketResults.find((result) => {
      return (
        String(result.eventId || "") === eventId &&
        String(
          result.playerId ||
            result.player?.playerId ||
            ""
        ) === playerId &&
        String(
          result.statId ||
            result.market?.statId ||
            ""
        ) === statId
      );
    }) || null
  );
}

function renderMarketResult(result, isTouchdown) {
  if (!result) {
    return `
      <div class="lf-market-result pending">
        PENDING
      </div>
    `;
  }

  const status = String(
    result.status ||
      result.resultStatus ||
      result.state ||
      ""
  ).toUpperCase();

  const currentValue =
    result.currentValue ??
    result.actual ??
    result.value ??
    null;

  if (
    status === "LIVE" ||
    status === "IN_PROGRESS" ||
    result.live === true
  ) {
    if (currentValue === null || currentValue === undefined) {
      return `
        <div class="lf-market-result live">
          LIVE
        </div>
      `;
    }

    return `
      <div class="lf-market-result live">
        LIVE · ${escapeHtml(
          formatLiveValue(currentValue, isTouchdown)
        )}
      </div>
    `;
  }

  if (
    status === "FINAL" ||
    status === "COMPLETED" ||
    status === "SETTLED"
  ) {
    if (currentValue === null || currentValue === undefined) {
      return `
        <div class="lf-market-result final">
          FINAL
        </div>
      `;
    }

    return `
      <div class="lf-market-result final">
        ${escapeHtml(
          formatActualValue(currentValue, isTouchdown)
        )}
      </div>
    `;
  }

  if (
    currentValue !== null &&
    currentValue !== undefined
  ) {
    return `
      <div class="lf-market-result final">
        ${escapeHtml(
          formatActualValue(currentValue, isTouchdown)
        )}
      </div>
    `;
  }

  return `
    <div class="lf-market-result pending">
      PENDING
    </div>
  `;
}

function formatLiveValue(value, isTouchdown) {
  if (isTouchdown) {
    return `${value} TD${Number(value) === 1 ? "" : "S"}`;
  }

  return `${value} ${inferMarketUnit(value)}`;
}

function formatActualValue(value, isTouchdown) {
  if (isTouchdown) {
    return `${value} TD${Number(value) === 1 ? "" : "S"} ACTUAL`;
  }

  return `${value} ${inferMarketUnit(value)} ACTUAL`;
}

function inferMarketUnit() {
  return "YARDS";
}

function bindMarketDetails() {
  document
    .querySelectorAll(".lf-market-details")
    .forEach((link) => {
      if (link.dataset.bound === "true") return;

      link.dataset.bound = "true";

      link.addEventListener("click", (event) => {
        event.preventDefault();

        const id = link.getAttribute("data-market-id");
        const market = markets.find(
          (item) => String(item.id) === String(id)
        );

        if (market) {
          openMarketDetails(market);
        }
      });
    });
}

function openMarketDetails(market) {
  const existing = document.querySelector(
    ".lf-modal-backdrop"
  );

  if (existing) existing.remove();

  const player =
    market?.player?.name ||
    market?.playerName ||
    "Unknown Player";

  const marketName =
    market?.market?.name ||
    market?.marketType ||
    "Player Prop";

  const over = market?.sides?.over || {};
  const under = market?.sides?.under || {};

  const modal = document.createElement("div");
  modal.className = "lf-modal-backdrop";

  modal.innerHTML = `
    <div class="lf-modal" role="dialog" aria-modal="true">
      <div class="lf-modal-head">
        <div>
          <div class="eyebrow">MARKET DETAILS</div>
          <h2>${escapeHtml(player)}</h2>
          <p class="muted">${escapeHtml(marketName)}</p>
        </div>

        <button class="lf-modal-close" aria-label="Close">
          ×
        </button>
      </div>

      <div class="lf-modal-section">
        <h4>Current Market</h4>

        <div class="lf-book-row">
          <strong>Over</strong>
          <span>
            ${escapeHtml(
              String(over.line ?? "")
            )}
            ·
            ${escapeHtml(
              formatOdds(over.odds)
            )}
          </span>
        </div>

        <div class="lf-book-row">
          <strong>Under</strong>
          <span>
            ${escapeHtml(
              String(under.line ?? "")
            )}
            ·
            ${escapeHtml(
              formatOdds(under.odds)
            )}
          </span>
        </div>
      </div>

      <div class="lf-modal-section">
        <h4>Sportsbook Prices</h4>

        ${renderSportsbookPrices(market)}
      </div>

      <div class="lf-modal-section">
        <h4>Line Movement</h4>

        ${renderLineMovement(market)}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal
    .querySelector(".lf-modal-close")
    .addEventListener("click", () => modal.remove());

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.remove();
    }
  });
}

function renderSportsbookPrices(market) {
  const books = new Map();

  const sides = [
    {
      side: "Over",
      data: market?.sides?.over,
    },
    {
      side: "Under",
      data: market?.sides?.under,
    },
  ];

  sides.forEach(({ side, data }) => {
    const sportsbooks = data?.sportsbooks || {};

    Object.entries(sportsbooks).forEach(
      ([book, values]) => {
        if (!books.has(book)) {
          books.set(book, {});
        }

        books.get(book)[side] = values;
      }
    );
  });

  if (!books.size) {
    return `
      <div class="muted">
        Sportsbook price detail is not available.
      </div>
    `;
  }

  return Array.from(books.entries())
    .map(([book, values]) => {
      return `
        <div class="lf-book-row">
          <strong>${escapeHtml(
            prettifyBook(book)
          )}</strong>

          <span>
            ${
              values.Over
                ? `O ${escapeHtml(
                    formatOdds(
                      values.Over.odds ??
                        values.Over.price
                    )
                  )}`
                : ""
            }

            ${
              values.Over && values.Under
                ? " · "
                : ""
            }

            ${
              values.Under
                ? `U ${escapeHtml(
                    formatOdds(
                      values.Under.odds ??
                        values.Under.price
                    )
                  )}`
                : ""
            }
          </span>
        </div>
      `;
    })
    .join("");
}

function renderLineMovement(market) {
  const over = market?.sides?.over || {};
  const under = market?.sides?.under || {};

  const opened =
    over.openingLine ??
    under.openingLine ??
    null;

  const current =
    over.line ??
    under.line ??
    null;

  if (opened === null && current === null) {
    return `
      <div class="muted">
        Line movement data is not available.
      </div>
    `;
  }

  let change = "";

  if (
    opened !== null &&
    current !== null
  ) {
    const difference =
      Number(current) - Number(opened);

    if (!Number.isNaN(difference)) {
      change =
        difference > 0
          ? `+${difference}`
          : String(difference);
    }
  }

  return `
    <div class="lf-book-row">
      <strong>Opened</strong>
      <span>${escapeHtml(
        String(opened ?? "—")
      )}</span>
    </div>

    <div class="lf-book-row">
      <strong>Current</strong>
      <span>${escapeHtml(
        String(current ?? "—")
      )}</span>
    </div>

    <div class="lf-book-row">
      <strong>Change</strong>
      <span>${escapeHtml(
        change || "—"
      )}</span>
    </div>
  `;
}

function getOpponentText(team, away, home) {
  const normalizedTeam = normalizeTeamName(team);

  const normalizedAway = normalizeTeamName(away);
  const normalizedHome = normalizeTeamName(home);

  if (
    normalizedTeam &&
    normalizedAway &&
    normalizedTeam === normalizedAway
  ) {
    return `@ ${home}`;
  }

  if (
    normalizedTeam &&
    normalizedHome &&
    normalizedTeam === normalizedHome
  ) {
    return `vs. ${away}`;
  }

  return "";
}

function normalizeTeamName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function teamName(value) {
  const map = {
    DENVER_BRONCOS_NFL: "Denver Broncos",
    KANSAS_CITY_CHIEFS_NFL: "Kansas City Chiefs",
    DETROIT_LIONS_NFL: "Detroit Lions",
    BUFFALO_BILLS_NFL: "Buffalo Bills",
  };

  return map[value] || value || "";
}

function prettifyBook(book) {
  const map = {
    draftkings: "DraftKings",
    fanduel: "FanDuel",
    betmgm: "BetMGM",
    caesars: "Caesars",
    bet365: "Bet365",
    espnbet: "ESPN BET",
    fanatics: "Fanatics",
    hardrock: "Hard Rock",
  };

  const key = String(book || "").toLowerCase();

  return (
    map[key] ||
    String(book || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      )
  );
}

function formatOdds(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const numeric = Number(value);

  if (!Number.isNaN(numeric)) {
    if (numeric > 0) {
      return `+${numeric}`;
    }

    return String(numeric);
  }

  return String(value);
}

function isCurrentWeek(week) {
  const number = parseInt(
    String(week).replace(/\D/g, ""),
    10
  );

  if (Number.isNaN(number)) return true;

  return number === getCurrentNFLWeek();
}

function getCurrentNFLWeek() {
  const now = new Date();

  const seasonStart = new Date(
    "2026-09-10T00:00:00-04:00"
  );

  const diff =
    now.getTime() - seasonStart.getTime();

  if (diff < 0) return 1;

  const days =
    diff / (1000 * 60 * 60 * 24);

  return Math.min(
    18,
    Math.max(
      1,
      Math.floor(days / 7) + 1
    )
  );
}

function compareWeeks(a, b) {
  const aNum =
    parseInt(String(a).replace(/\D/g, ""), 10) ||
    0;

  const bNum =
    parseInt(String(b).replace(/\D/g, ""), 10) ||
    0;

  return aNum - bNum;
}

function setRefreshStatus(text) {
  const element =
    document.getElementById("refreshStatus");

  if (element) {
    element.textContent = text;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
