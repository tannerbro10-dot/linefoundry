const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const PUBLIC_SIGNALS = path.join(
  __dirname,
  "..",
  "public",
  "public-signals.json"
);

const EXTRACTOR = path.join(
  __dirname,
  "expert-prop-extractor.js"
);

const CURRENT_WEEK = 3;
const CURRENT_SEASON = 2026;

const ESPN_SCOREBOARD_URL =
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${CURRENT_WEEK}&seasontype=2&limit=100`;

let PLAYER_INDEX = [];
const SEARCH_QUERIES = [
  `NFL Week ${CURRENT_WEEK} ${CURRENT_SEASON} player prop expert picks`,
  `NFL Week ${CURRENT_WEEK} ${CURRENT_SEASON} receiving rushing passing prop picks`,
  `NFL Week ${CURRENT_WEEK} ${CURRENT_SEASON} anytime touchdown prop expert picks`
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2) + "\n"
  );
}

function combinedText(article) {
  return [
    article.url,
    article.title,
    article.description,
    article.text,
    ...(article.highlights || [])
  ]
    .map(value => String(value || "").toLowerCase())
    .join(" ");
}

function isValidArticle(article) {
  const text = combinedText(article);

  if (!text.includes("nfl")) {
    return false;
  }

  if (
    /\b(cfl|college football|ncaa|mlb|baseball|nba|nhl|ncaaf)\b/i.test(text)
  ) {
    return false;
  }

  if (
    /\b(nfl draft|mock draft|draft prospects|futures|promo|promotion|bonus)\b/i.test(text)
  ) {
    return false;
  }

  const weekPattern =
    new RegExp(`\\bweek\\s*${CURRENT_WEEK}\\b`, "i");

  if (!weekPattern.test(text)) {
    return false;
  }

  if (
    !/\b(prop|props|player prop|player props|prop bet|prop bets|over|under)\b/i.test(text)
  ) {
    return false;
  }

  return true;
}

async function tinyFishSearch(query) {
  const response = await fetch(
    `https://api.search.tinyfish.ai?query=${encodeURIComponent(query)}`,
    {
      method: "GET",
      headers: {
        "X-API-Key": process.env.TINYFISH_API_KEY,
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `TinyFish search failed (${response.status}) for: ${query}`
    );
  }

  const data = await response.json();

  return Array.isArray(data.results)
    ? data.results
    : [];
}

async function fetchArticle(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 LineFoundry Expert Publisher",
      "Accept":
        "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Article request failed (${response.status})`
    );
  }

  const html = await response.text();

  const titleMatch = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  const title = titleMatch
    ? titleMatch[1]
        .replace(/\s+/g, " ")
        .trim()
    : "";

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();

  return {
    url,
    title,
    description: "",
    text,
    highlights: []
  };
}

function cleanPlayerName(player) {
  let value = String(player || "").trim();

   value = value
  .replace(
    /^(via\s+)?(?:FanDuel|DraftKings|BetMGM|Caesars|BetRivers|ESPN BET)\s+/i,
    ""
  )
  .replace(
    /^(best\s+odds|odds|projection\s+edge|player\s+props?|prop\s+bets?|bets\s+card|card\s+includes)\s+/i,
  ""
  )
    .split(/\.\s+/)
    .pop()
    .trim();

  value = value.replace(
  /\s+(Texans|Bengals|Ravens|Steelers|Browns|Bills|Dolphins|Patriots|Jets|Colts|Jaguars|Titans|Broncos|Chiefs|Raiders|Chargers|Cowboys|Giants|Eagles|Commanders|Bears|Lions|Packers|Vikings|Falcons|Panthers|Saints|Buccaneers|Cardinals|Rams|49ers|Seahawks)\s*$/i,
  ""
);

  return value.replace(/\s+/g, " ").trim();
}

async function loadPlayerIndex() {
  const response = await fetch(
    ESPN_SCOREBOARD_URL,
    {
      headers: {
        "Accept": "application/json",
        "User-Agent": "LineFoundry/1.0"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `ESPN scoreboard failed (${response.status})`
    );
  }

  const data = await response.json();

  const events =
    data?.events ||
    data?.content?.sbData?.events ||
    [];

  const teamIds = new Set();

  for (const event of events) {
    for (const competitor of event?.competitions?.[0]?.competitors || []) {
      const teamId =
        competitor?.team?.id;

      if (teamId) {
        teamIds.add(String(teamId));
      }
    }
  }

  const rosters = await Promise.all(
    [...teamIds].map(async teamId => {
      const rosterResponse = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`,
        {
          headers: {
            "Accept": "application/json",
            "User-Agent": "LineFoundry/1.0"
          }
        }
      );

      if (!rosterResponse.ok) {
        return [];
      }

      const roster =
        await rosterResponse.json();

      const players = [];

      for (const group of roster.athletes || []) {
        for (const athlete of group.items || []) {
          if (!athlete?.fullName) {
            continue;
          }

          players.push({
            name: athlete.fullName,
            teamId,
            position:
              athlete.position?.abbreviation ||
              ""
          });
        }
      }

      return players;
    })
  );

  PLAYER_INDEX =
    rosters.flat();

  return PLAYER_INDEX;
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function marketPositions(market) {
  switch (market) {
    case "Passing Yards":
    case "Passing Attempts":
    case "Completions":
    case "Interceptions":
      return ["QB"];

    case "Receiving Yards":
    case "Receptions":
      return ["WR", "TE", "RB", "FB"];

    case "Rushing Yards":
    case "Rushing Attempts":
      return ["RB", "QB", "WR", "TE", "FB"];

    default:
      return [];
  }
}

function resolvePlayerName(rawPlayer, market) {
  const raw =
    String(rawPlayer || "").trim();

  if (!raw) {
    return null;
  }

  const exact =
    PLAYER_INDEX.find(
      player =>
        normalizeName(player.name) ===
        normalizeName(raw)
    );

  if (exact) {
    return exact.name;
  }

  const matchup =
    raw.match(
      /^(.+?)\s+vs\.?\s+(.+?)\s+([A-Z][A-Za-z.'-]+)$/i
    );

  if (!matchup) {
    return raw;
  }

  const surname =
    matchup[3];

  const positions =
    marketPositions(market);

  const candidates =
    PLAYER_INDEX.filter(player => {
      const lastName =
        player.name
          .split(/\s+/)
          .pop();

      if (
        normalizeName(lastName) !==
        normalizeName(surname)
      ) {
        return false;
      }

      if (
        positions.length &&
        !positions.includes(player.position)
      ) {
        return false;
      }

      return true;
    });

  if (candidates.length === 1) {
    return candidates[0].name;
  }

  return null;
}

async function convertPropToSignal(prop, article) {
  if (!prop || !prop.player || !prop.market) {
    return null;
  }

  if (
    !["OVER", "UNDER", "YES", "NO"].includes(
      String(prop.side || "").toUpperCase()
    )
  ) {
    return null;
  }

const cleanedPlayer =
  cleanPlayerName(prop.player);

const player =
  resolvePlayerName(
    cleanedPlayer,
    prop.market
  );

  if (
    player.length < 5 ||
    player.length > 40 ||
    !/^[A-Za-zÀ-ÿ.'’-]+(?:\s+[A-Za-zÀ-ÿ.'’-]+){1,3}$/.test(player)
  ) {
    return null;
  }

  return {
    id: [
      player,
      prop.market,
      prop.side,
      prop.line ?? "any",
      article.url,
      `w${CURRENT_WEEK}`
    ]
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120),

    player,

    market: prop.market,

    side: String(prop.side).toUpperCase(),

    line:
      prop.line === undefined
        ? null
        : prop.line,

    analyst:
      prop.analyst ||
      "Expert Analyst",

    sourceId: "tinyfish-expert",

    week: CURRENT_WEEK,

    note:
      prop.note ||
      `Week ${CURRENT_WEEK} expert prop discovered by TinyFish.`,

    url: article.url
  };
}

function publishSignals(signals) {
  const publicData = readJson(PUBLIC_SIGNALS);

  const existingSignals =
    Array.isArray(publicData.signals)
      ? publicData.signals
      : [];

  const historicalSignals =
    existingSignals.filter(
      signal =>
        Number(signal.week || 1) !== CURRENT_WEEK
    );

const seen = new Set();

const weekSignals = signals.filter(signal => {
  const key = [
    signal.url,
    signal.player,
    signal.market,
    signal.side,
    signal.line ?? "any"
  ]
    .join("|")
    .toLowerCase();

  if (seen.has(key)) {
    return false;
  }

  seen.add(key);
  return true;
});

  const updated = {
    ...publicData,

    refreshedAt:
      new Date().toISOString(),

    signals: [
      ...historicalSignals,
      ...weekSignals
    ]
  };

  writeJson(
    PUBLIC_SIGNALS,
    updated
  );

  return updated;
}

async function main() {
  if (!process.env.TINYFISH_API_KEY) {
    throw new Error(
      "TINYFISH_API_KEY is not configured."
    );
  }

  await loadPlayerIndex();

  const discovered = [];

  for (const query of SEARCH_QUERIES) {
    console.log(`TinyFish search: ${query}`);

    try {
      const results =
        await tinyFishSearch(query);

      for (const result of results) {
        if (!result?.url) {
          continue;
        }

        discovered.push({
          url: result.url,
          title: result.title || "",
          description:
            result.snippet || "",
          highlights:
            result.snippet
              ? [result.snippet]
              : []
        });
      }
    } catch (error) {
      console.log(
        error.message
      );
    }
  }

  const uniqueArticles =
    Array.from(
      new Map(
        discovered.map(article => [
          article.url,
          article
        ])
      ).values()
    );

  console.log(
    `TinyFish discovered ${uniqueArticles.length} unique articles.`
  );

  const candidateArticles =
    uniqueArticles.filter(
      isValidArticle
    );

  console.log(
    `${candidateArticles.length} articles passed Week ${CURRENT_WEEK} NFL prop filters.`
  );

  const signals = [];
  const failures = [];

  for (const candidate of candidateArticles) {
    try {
      console.log(
        `Fetching article: ${candidate.url}`
      );

      const article =
        await fetchArticle(
          candidate.url
        );

      const tempFile = path.join(
        os.tmpdir(),
        `linefoundry-tinyfish-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.json`
      );

      try {
        fs.writeFileSync(
          tempFile,
          JSON.stringify(
            article,
            null,
            2
          )
        );

        const raw =
          execFileSync(
            "node",
            [
              EXTRACTOR,
              tempFile
            ],
            {
              encoding: "utf8",
              maxBuffer:
                10 * 1024 * 1024
            }
          );

        const result =
          JSON.parse(raw);

        if (
          result &&
          Array.isArray(result.props)
        ) {
          for (const prop of result.props) {
         const signal =
  await convertPropToSignal(prop, article);

            if (signal) {
              signals.push(signal);
            }
          }
        }
      } finally {
        try {
          fs.unlinkSync(
            tempFile
          );
        } catch {}
      }
    } catch (error) {
      failures.push({
        url: candidate.url,
        error: error.message
      });
    }
  }

  const publicData =
    publishSignals(signals);

  console.log(
    JSON.stringify(
      {
        success: true,
        week: CURRENT_WEEK,
        season: CURRENT_SEASON,
        searches:
          SEARCH_QUERIES.length,
        discoveredArticles:
          uniqueArticles.length,
        candidateArticles:
          candidateArticles.length,
        signals:
          signals.length,
        publicSignals:
          publicData.signals.length,
        failures:
          failures.length
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error(
    error.message
  );

  process.exit(1);
});
