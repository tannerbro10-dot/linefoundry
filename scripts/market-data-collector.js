/**
 * LineFoundry Market Data Collector
 *
 * MVP:
 * - NFL only
 * - Full-game player props only
 * - No alternate lines
 * - No quarter/half markets
 * - No defensive/kicking/punting/fantasy markets
 *
 * Output:
 * - market-data.json
 *
 * API:
 * - SportsGameOdds v2
 */

const fs = require("fs");

const API_URL =
  "https://api.sportsgameodds.com/v2/events";

const API_KEY =
  process.env.SPORTSGAMEODDS_API_KEY;


// ============================================================
// CONFIGURATION
// ============================================================

const ALLOWED_MARKETS = new Set([

  "passing_yards",

  "passing_attempts",

  "passing_completions",

  "passing_interceptions",

  "passing_touchdowns",

  "rushing_yards",

  "rushing_attempts",

  "rushing_touchdowns",

  "receiving_yards",

  "receiving_receptions",

  "receiving_targets",

  "receiving_touchdowns",

  "rushing+receiving_yards",

  "receiving_longestReception",

  "rushing_longestRush",

  "touchdowns"

]);


// ============================================================
// REQUEST
// ============================================================

async function fetchEvents(cursor = null) {

  const params =
    new URLSearchParams({

      leagueID:
        "NFL",

      oddsAvailable:
        "true",

      includeAltLines:
        "false",

      limit:
        "10"

    });

  if (process.env.TEST_EVENT_ID) {

    params.set(
      "eventID",
      process.env.TEST_EVENT_ID
    );

  }

  if (cursor) {

    params.set(
      "cursor",
      cursor
    );

  }

  const response =
    await fetch(
      `${API_URL}?${params.toString()}`,
      {
        headers: {
          "x-api-key":
            API_KEY
        }
      }
    );

  if (!response.ok) {

    throw new Error(
      `SportsGameOdds request failed: ${response.status}`
    );

  }

  const data =
    await response.json();

  if (!data.success) {

    throw new Error(
      data.error ||
      "SportsGameOdds returned an unsuccessful response."
    );

  }

  return data;

}

// ============================================================
// CHECK PLAYER PROP
// ============================================================

function isPlayerProp(odd) {

  if (
    !odd ||
    !odd.statEntityID
  ) {

    return false;

  }

  return ![
    "home",
    "away",
    "all"
  ].includes(
    String(
      odd.statEntityID
    ).toLowerCase()
  );

}


// ============================================================
// CHECK FULL-GAME CORE MARKET
// ============================================================

function isAllowedMarket(odd) {

  if (
    !isPlayerProp(odd)
  ) {

    return false;

  }

  if (
    odd.periodID !==
    "game"
  ) {

    return false;

  }

  if (
    odd.statID ===
    "touchdowns"
  ) {

    return (
      odd.betTypeID ===
      "yn"
    );

  }

  if (
    !ALLOWED_MARKETS.has(
      odd.statID
    )
  ) {

    return false;

  }

  return true;

}


// ============================================================
// NORMALIZE SIDE
// ============================================================

function normalizeSide(side) {

  const value =
    String(
      side || ""
    ).toLowerCase();

  if (
    value === "over"
  ) {

    return "OVER";

  }

  if (
    value === "under"
  ) {

    return "UNDER";

  }

  return value.toUpperCase();

}


// ============================================================
// NORMALIZE MARKET
// ============================================================

function normalizeMarket(statID) {

  const markets = {

    passing_yards:
      "Passing Yards",

    passing_attempts:
      "Passing Attempts",

    passing_completions:
      "Completions",

    passing_interceptions:
      "Interceptions",

    passing_touchdowns:
      "Passing Touchdowns",

    rushing_yards:
      "Rushing Yards",

    rushing_attempts:
      "Rushing Attempts",

    rushing_touchdowns:
      "Rushing Touchdowns",

    receiving_yards:
      "Receiving Yards",

    receiving_receptions:
      "Receptions",

    receiving_targets:
      "Receiving Targets",

    receiving_touchdowns:
      "Receiving Touchdowns",
    
     touchdowns:
      "Anytime TD",

    "rushing+receiving_yards":
      "Rushing + Receiving Yards",

    receiving_longestReception:
      "Longest Reception",

    rushing_longestRush:
      "Longest Rush"

  };

  return (
    markets[statID] ||
    statID
  );

}


// ============================================================
// EXTRACT PLAYER NAME
// ============================================================

function playerName(
  event,
  playerID
) {

  const player =
    event.players?.[
      playerID
    ];

  if (
    player?.name
  ) {

    return player.name;

  }

  return String(
    playerID
  )
    .replace(
      /_1_NFL$/,
      ""
    )
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );

}


// ============================================================
// NORMALIZE PROP
// ============================================================

function normalizeProp(
  event,
  odd
) {

  const line =
    odd.bookOverUnder ??
    odd.fairOverUnder ??
    null;

  const isAnytimeTD =
    odd.statID ===
      "touchdowns" &&
    odd.betTypeID ===
      "yn";

  return {

    id:
      odd.oddID,

    eventId:
      event.eventID,

    week:
      event.info?.seasonWeek ||
      null,

    season:
      2026,

    player: {
      id:
        odd.statEntityID,

      name:
        playerName(
          event,
          odd.statEntityID
        )
    },

    game: {

      eventId:
        event.eventID,

      awayTeam:
        event.teams?.away?.name ||
        event.teams?.away?.displayName ||
        "",

      homeTeam:
        event.teams?.home?.name ||
        event.teams?.home?.displayName ||
        ""

    },

    market: {

      name:
        isAnytimeTD
          ? "Anytime TD"
          : normalizeMarket(
              odd.statID
            ),

      statId:
        odd.statID,

      betType:
        odd.betTypeID

    },

    side:
      normalizeSide(
        odd.sideID
      ),

    line:

      isAnytimeTD
        ? null
        : (
            line !== null
              ? Number(line)
              : null
          ),

    odds:
      odd.bookOdds ??
      odd.fairOdds ??
      null,

    fairOdds:
      odd.fairOdds ??
      null,

    sportsbooks:
      odd.byBookmaker ||
      {},

    period:
      odd.periodID,

    updatedAt:
      new Date()
        .toISOString()

  };

}

// ============================================================
// COLLECT ALL EVENTS
// ============================================================

async function collectAllEvents() {

  const events = [];

  let cursor =
    null;

  do {

    const response =
      await fetchEvents(
        cursor
      );

    if (
      Array.isArray(
        response.data
      )
    ) {

      events.push(
        ...response.data
      );

    }

    cursor =
      response.nextCursor ||
      null;

  } while (cursor);

  return events;

}


// ============================================================
// BUILD MARKET DATA
// ============================================================

async function buildMarketData() {

  if (!API_KEY) {

    throw new Error(
      "SPORTSGAMEODDS_API_KEY is not set."
    );

  }

  const events =
    await collectAllEvents();

  const props = [];

  for (
    const event of events
  ) {

    const odds =
      event.odds ||
      {};

    for (
      const odd of Object.values(
        odds
      )
    ) {

      if (
        !isAllowedMarket(
          odd
        )
      ) {

        continue;

      }

      props.push(
        normalizeProp(
          event,
          odd
        )
      );

    }

  }


  // ============================================================
  // GROUP PROP SIDES
  // ============================================================

  const grouped =
    new Map();

  for (
    const prop of props
  ) {

    const isAnytimeTD =
      prop.market?.statId ===
        "touchdowns" &&
      prop.market?.betType ===
        "yn";

    const key =
      [
        prop.eventId,
        prop.player?.id,
        prop.market?.statId,
        isAnytimeTD
          ? "TD"
          : prop.line
      ].join("|");

    if (
      !grouped.has(
        key
      )
    ) {

      grouped.set(
        key,
        {

          id:
            key,

          eventId:
            prop.eventId,

          week:
            prop.week,

          season:
            prop.season,

          player:
            prop.player,

          game:
            prop.game,

          market:
            prop.market,

          sides: {},

          period:
            prop.period,

          updatedAt:
            prop.updatedAt

        }
      );

    }


    const market =
      grouped.get(
        key
      );


    // ----------------------------------------------------------
    // ANYTIME TD
    // ----------------------------------------------------------

    if (
      isAnytimeTD
    ) {

      if (
        prop.side ===
        "YES"
      ) {

        market.sides.yes = {

          odds:
            prop.odds,

          fairOdds:
            prop.fairOdds,

          sportsbooks:
            prop.sportsbooks

        };

      }

      if (
        prop.side ===
        "NO"
      ) {

        market.sides.no = {

          odds:
            prop.odds,

          fairOdds:
            prop.fairOdds,

          sportsbooks:
            prop.sportsbooks

        };

      }

      continue;

    }


    // ----------------------------------------------------------
    // OVER / UNDER
    // ----------------------------------------------------------

    if (
      prop.side ===
      "OVER"
    ) {

      market.sides.over = {

        line:
          prop.line,

        odds:
          prop.odds,

        fairOdds:
          prop.fairOdds,

        sportsbooks:
          prop.sportsbooks

      };

    }

    if (
      prop.side ===
      "UNDER"
    ) {

      market.sides.under = {

        line:
          prop.line,

        odds:
          prop.odds,

        fairOdds:
          prop.fairOdds,

        sportsbooks:
          prop.sportsbooks

      };

    }

  }


  const markets =
    Array.from(
      grouped.values()
    );


  return {

    success:
      true,

    source:
      "SportsGameOdds",

    season:
      2026,

    refreshedAt:
      new Date()
        .toISOString(),

    eventCount:
      events.length,

    marketCount:
      markets.length,

    markets

  };

}


// ============================================================
// MAIN
// ============================================================

async function main() {

  const output =
    await buildMarketData();

  fs.writeFileSync(

    "market-data.json",

    JSON.stringify(
      output,
      null,
      2
    )

  );

  console.log(
    `Collected ${output.marketCount} full-game player props across ${output.eventCount} NFL events.`
  );

}


main()
  .catch(error => {

    console.error(
      error.message
    );

    process.exit(1);

  });
