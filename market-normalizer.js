'use strict';

/*
 * LINEFOUNDRY
 * SportsGameOdds Market Normalizer
 *
 * Purpose:
 * Convert the raw SportsGameOdds response into
 * clean NFL player-prop Market objects.
 *
 * IMPORTANT:
 * Market data is completely separate from Expert Signals.
 */

const SUPPORTED_MARKETS = {
  passing_yards: 'Passing Yards',
  passing_touchdowns: 'Passing Touchdowns',
  completions: 'Pass Completions',
  interceptions: 'Interceptions',

  rushing_yards: 'Rushing Yards',
  rushing_attempts: 'Rushing Attempts',
  rushing_touchdowns: 'Rushing Touchdowns',

  receiving_yards: 'Receiving Yards',
  receptions: 'Receptions',
  receiving_touchdowns: 'Receiving Touchdowns',

  rushing_receiving_yards: 'Rush + Receiving Yards',
  rushing_receiving_attempts: 'Rush + Receiving Attempts',

  touchdowns: 'Anytime Touchdown'
};


/* --------------------------------------------------
   BASIC HELPERS
-------------------------------------------------- */

function normalize(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  return String(value)
    .trim()
    .toLowerCase();
}


function getEvents(response) {
  if (!response) {
    return [];
  }

  /*
   * SportsGameOdds currently returns events
   * inside `data`.
   */
  if (Array.isArray(response.data)) {
    return response.data;
  }

  /*
   * Fallback for alternate response shapes.
   */
  if (Array.isArray(response.events)) {
    return response.events;
  }

  return [];
}


function getOdds(event) {
  if (!event) {
    return [];
  }

  /*
   * SportsGameOdds returns odds as an object
   * keyed by oddID.
   */
  if (
    event.odds &&
    typeof event.odds === 'object' &&
    !Array.isArray(event.odds)
  ) {
    return Object.values(event.odds)
      .filter(
        odd =>
          odd &&
          typeof odd === 'object'
      );
  }

  /*
   * Defensive fallback.
   */
  if (Array.isArray(event.odds)) {
    return event.odds.filter(Boolean);
  }

  return [];
}


/* --------------------------------------------------
   PLAYER / GAME
-------------------------------------------------- */

function getPlayer(event, playerId) {
  if (
    !event ||
    !playerId
  ) {
    return null;
  }

  const containers = [
    event.players,
    event.player,
    event.playerDirectory
  ];

  for (
    const container
    of containers
  ) {
    if (
      container &&
      typeof container === 'object' &&
      container[playerId]
    ) {
      return container[playerId];
    }
  }

  return null;
}


function getPlayerName(
  event,
  odd
) {
  const player =
    getPlayer(
      event,
      odd?.playerID
    );

  if (player) {
    if (player.name) {
      return player.name;
    }

    const fullName = [
      player.firstName,
      player.lastName
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (fullName) {
      return fullName;
    }
  }

  return (
    odd?.playerName ||
    odd?.name ||
    null
  );
}


function getPlayerTeam(
  event,
  odd
) {
  const player =
    getPlayer(
      event,
      odd?.playerID
    );

  return (
    player?.teamID ||
    player?.teamId ||
    odd?.teamID ||
    odd?.teamId ||
    null
  );
}


function getTeamName(team) {
  if (!team) {
    return null;
  }

  return (
    team?.names?.long ||
    team?.names?.medium ||
    team?.names?.short ||
    team?.name ||
    null
  );
}


function getGame(event) {
  return {
    awayTeam:
      getTeamName(
        event?.teams?.away
      ),

    homeTeam:
      getTeamName(
        event?.teams?.home
      ),

    startsAt:
      event?.status?.startsAt ||
      event?.startsAt ||
      null,

    status:
      event?.status?.type ||
      event?.status?.name ||
      (
        typeof event?.status === 'string'
          ? event.status
          : null
      )
  };
}


function getWeek(event) {
  return (
    event?.info?.seasonWeek ||
    event?.seasonWeek ||
    event?.week ||
    null
  );
}


/* --------------------------------------------------
   MARKET VALIDATION
-------------------------------------------------- */

function isSupportedOdd(odd) {
  if (
    !odd ||
    typeof odd !== 'object'
  ) {
    return false;
  }

  if (odd.cancelled === true) {
    return false;
  }

  if (!odd.playerID) {
    return false;
  }

  const statId =
    normalize(odd.statID);

  const periodId =
    normalize(odd.periodID);

  const betTypeId =
    normalize(odd.betTypeID);

  /*
   * Only markets LineFoundry currently supports.
   */
  if (
    !SUPPORTED_MARKETS[statId]
  ) {
    return false;
  }

  /*
   * Only full-game player props.
   */
  if (
    periodId !== 'game'
  ) {
    return false;
  }

  /*
   * O/U and Y/N only.
   */
  if (
    betTypeId !== 'ou' &&
    betTypeId !== 'yn'
  ) {
    return false;
  }

  return true;
}


/* --------------------------------------------------
   SIDE HANDLING
-------------------------------------------------- */

function getSide(odd) {
  if (!odd) {
    return null;
  }

  const betType =
    normalize(odd.betTypeID);

  const side =
    normalize(odd.sideID);

  if (betType === 'ou') {
    if (side === 'over') {
      return 'over';
    }

    if (side === 'under') {
      return 'under';
    }
  }

  if (betType === 'yn') {
    if (side === 'yes') {
      return 'yes';
    }

    if (side === 'no') {
      return 'no';
    }
  }

  return null;
}


/* --------------------------------------------------
   PRICE / LINE DATA
-------------------------------------------------- */

function getCurrentLine(odd) {
  return (
    odd?.bookOverUnder ??
    odd?.fairOverUnder ??
    null
  );
}


function getCurrentOdds(odd) {
  return (
    odd?.bookOdds ??
    odd?.fairOdds ??
    null
  );
}


function getOpeningLine(odd) {
  return (
    odd?.openBookOverUnder ??
    odd?.openFairOverUnder ??
    null
  );
}


function getOpeningOdds(odd) {
  return (
    odd?.openBookOdds ??
    odd?.openFairOdds ??
    null
  );
}


function getClosingLine(odd) {
  return (
    odd?.closeBookOverUnder ??
    odd?.closeFairOverUnder ??
    null
  );
}


function getClosingOdds(odd) {
  return (
    odd?.closeBookOdds ??
    odd?.closeFairOdds ??
    null
  );
}


/* --------------------------------------------------
   SPORTSBOOKS
-------------------------------------------------- */

function normalizeBookmaker(
  bookmaker,
  bookmakerName
) {
  if (
    !bookmaker ||
    typeof bookmaker !== 'object'
  ) {
    return null;
  }

  const alternateLines = [];

  if (
    Array.isArray(
      bookmaker.altLines
    )
  ) {
    for (
      const alt
      of bookmaker.altLines
    ) {
      if (!alt) {
        continue;
      }

      if (
        alt.available === false
      ) {
        continue;
      }

      const line =
        alt.overUnder ??
        alt.bookOverUnder ??
        alt.fairOverUnder ??
        null;

      const odds =
        alt.odds ??
        alt.bookOdds ??
        alt.fairOdds ??
        null;

      if (
        line === null &&
        odds === null
      ) {
        continue;
      }

      alternateLines.push({
        line,
        odds,

        available:
          alt.available !== false,

        lastUpdatedAt:
          alt.lastUpdatedAt ||
          null
      });
    }
  }

  return {
    name:
      normalize(bookmakerName),

    line:
      bookmaker.overUnder ??
      bookmaker.bookOverUnder ??
      bookmaker.fairOverUnder ??
      null,

    odds:
      bookmaker.odds ??
      bookmaker.bookOdds ??
      bookmaker.fairOdds ??
      null,

    available:
      bookmaker.available !== false,

    lastUpdatedAt:
      bookmaker.lastUpdatedAt ||
      null,

    deeplink:
      bookmaker.deeplink ||
      null,

    alternateLines
  };
}


function getSportsbooks(odd) {
  if (
    !odd?.byBookmaker ||
    typeof odd.byBookmaker !== 'object'
  ) {
    return {};
  }

  const sportsbooks = {};

  for (
    const [
      bookmakerName,
      bookmaker
    ]
    of Object.entries(
      odd.byBookmaker
    )
  ) {
    const normalized =
      normalizeBookmaker(
        bookmaker,
        bookmakerName
      );

    if (!normalized) {
      continue;
    }

    sportsbooks[
      normalize(bookmakerName)
    ] = normalized;
  }

  return sportsbooks;
}


/* --------------------------------------------------
   BEST PRICE
-------------------------------------------------- */

function impliedProbability(
  odds
) {
  if (
    odds === null ||
    odds === undefined
  ) {
    return null;
  }

  const number =
    Number(
      String(odds)
        .replace('+', '')
        .trim()
    );

  if (
    !Number.isFinite(number) ||
    number === 0
  ) {
    return null;
  }

  if (number > 0) {
    return (
      100 /
      (number + 100)
    );
  }

  return (
    Math.abs(number) /
    (
      Math.abs(number) +
      100
    )
  );
}


function findBestBook(
  sportsbooks
) {
  let best = null;

  for (
    const bookmaker
    of Object.values(
      sportsbooks || {}
    )
  ) {
    /*
     * Only use currently available prices.
     */
    if (
      bookmaker.available !== true
    ) {
      continue;
    }

    if (
      bookmaker.odds === null ||
      bookmaker.odds === undefined
    ) {
      continue;
    }

    const probability =
      impliedProbability(
        bookmaker.odds
      );

    if (
      probability === null
    ) {
      continue;
    }

    if (
      !best ||
      probability <
        best.impliedProbability
    ) {
      best = {
        book:
          bookmaker.name,

        odds:
          bookmaker.odds,

        line:
          bookmaker.line,

        impliedProbability:
          probability
      };
    }
  }

  return best;
}


/* --------------------------------------------------
   ALTERNATE LINES
-------------------------------------------------- */

function getAlternateLines(
  odd
) {
  if (
    !odd?.byBookmaker ||
    typeof odd.byBookmaker !== 'object'
  ) {
    return [];
  }

  const lines = [];

  for (
    const [
      bookmakerName,
      bookmaker
    ]
    of Object.entries(
      odd.byBookmaker
    )
  ) {
    if (
      !Array.isArray(
        bookmaker?.altLines
      )
    ) {
      continue;
    }

    for (
      const alt
      of bookmaker.altLines
    ) {
      if (!alt) {
        continue;
      }

      if (
        alt.available === false
      ) {
        continue;
      }

      const line =
        alt.overUnder ??
        alt.bookOverUnder ??
        alt.fairOverUnder ??
        null;

      const odds =
        alt.odds ??
        alt.bookOdds ??
        alt.fairOdds ??
        null;

      if (
        line === null &&
        odds === null
      ) {
        continue;
      }

      lines.push({
        book:
          normalize(bookmakerName),

        line,

        odds,

        available:
          alt.available !== false,

        lastUpdatedAt:
          alt.lastUpdatedAt ||
          null
      });
    }
  }

  return lines;
}


function dedupeAlternateLines(
  lines
) {
  const seen =
    new Set();

  const result = [];

  for (
    const line
    of lines
  ) {
    const key = [
      line.book,
      line.line,
      line.odds
    ].join('|');

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push(line);
  }

  return result;
}


/* --------------------------------------------------
   NORMALIZE ONE SIDE
-------------------------------------------------- */

function normalizeSide(odd) {
  if (!odd) {
    return null;
  }

  const sportsbooks =
    getSportsbooks(odd);

  const bestBook =
    findBestBook(
      sportsbooks
    );

  const alternateLines =
    dedupeAlternateLines(
      getAlternateLines(odd)
    );

  return {
    line:
      getCurrentLine(odd),

    odds:
      getCurrentOdds(odd),

    fairLine:
      odd.fairOverUnder ??
      null,

    fairOdds:
      odd.fairOdds ??
      null,

    openingLine:
      getOpeningLine(odd),

    openingOdds:
      getOpeningOdds(odd),

    closingLine:
      getClosingLine(odd),

    closingOdds:
      getClosingOdds(odd),

    bestBook:
      bestBook?.book ||
      null,

    bestBookOdds:
      bestBook?.odds ??
      null,

    bestBookLine:
      bestBook?.line ??
      null,

    sportsbooks,

    alternateLines
  };
}


/* --------------------------------------------------
   MARKET PAIRING
-------------------------------------------------- */

function getMarketKey(odd) {
  if (!odd) {
    return null;
  }

  const oddId =
    odd.oddID
      ? String(odd.oddID)
      : '';

  const opposingOddId =
    odd.opposingOddID
      ? String(odd.opposingOddID)
      : '';

  /*
   * Best case:
   * SportsGameOdds gives each side the other's
   * oddID through opposingOddID.
   */
  if (
    oddId &&
    opposingOddId
  ) {
    return [
      oddId,
      opposingOddId
    ]
      .sort()
      .join('::');
  }

  /*
   * Fallback.
   */
  return [
    odd.eventID || '',
    odd.playerID || '',
    odd.statID || '',
    odd.periodID || '',
    odd.betTypeID || ''
  ].join('::');
}


/* --------------------------------------------------
   NORMALIZE ONE MARKET
-------------------------------------------------- */

function normalizeMarket(
  event,
  odds
) {
  if (
    !Array.isArray(odds) ||
    odds.length === 0
  ) {
    return null;
  }

  let over = null;
  let under = null;
  let yes = null;
  let no = null;

  for (
    const odd
    of odds
  ) {
    if (!odd) {
      continue;
    }

    const side =
      getSide(odd);

    if (side === 'over') {
      over = odd;
    }

    if (side === 'under') {
      under = odd;
    }

    if (side === 'yes') {
      yes = odd;
    }

    if (side === 'no') {
      no = odd;
    }
  }

  const sample =
    over ||
    under ||
    yes ||
    no;

  if (!sample) {
    return null;
  }

  const statId =
    normalize(
      sample.statID
    );

  const betType =
    normalize(
      sample.betTypeID
    );

  const sides = {};

  if (over) {
    sides.over =
      normalizeSide(over);
  }

  if (under) {
    sides.under =
      normalizeSide(under);
  }

  if (yes) {
    sides.yes =
      normalizeSide(yes);
  }

  if (no) {
    sides.no =
      normalizeSide(no);
  }

  /*
   * Do not create empty markets.
   */
  if (
    Object.keys(sides).length === 0
  ) {
    return null;
  }

  return {
    id:
      getMarketKey(sample),

    eventId:
      event?.eventID ||
      null,

    week:
      getWeek(event),

    game:
      getGame(event),

    player: {
      playerId:
        sample.playerID ||
        null,

      name:
        getPlayerName(
          event,
          sample
        ),

      teamId:
        getPlayerTeam(
          event,
          sample
        )
    },

    market: {
      statId,

      name:
        SUPPORTED_MARKETS[
          statId
        ] || statId,

      period:
        normalize(
          sample.periodID
        ),

      betType,

      marketType:
        betType === 'yn'
          ? 'yes_no'
          : 'over_under'
    },

    sides,

    /*
     * Convenience fields.
     */
    over:
      sides.over ||
      null,

    under:
      sides.under ||
      null,

    yes:
      sides.yes ||
      null,

    no:
      sides.no ||
      null,

    createdFromApiAt:
      new Date().toISOString()
  };
}


/* --------------------------------------------------
   NORMALIZE ONE EVENT
-------------------------------------------------- */

function normalizeEvent(event) {
  if (
    !event ||
    typeof event !== 'object'
  ) {
    return [];
  }

  const odds =
    getOdds(event);

  const supportedOdds =
    odds.filter(
      isSupportedOdd
    );

  const groups =
    new Map();

  for (
    const odd
    of supportedOdds
  ) {
    const key =
      getMarketKey(odd);

    if (!key) {
      continue;
    }

    if (!groups.has(key)) {
      groups.set(
        key,
        []
      );
    }

    groups
      .get(key)
      .push(odd);
  }

  const markets = [];

  for (
    const group
    of groups.values()
  ) {
    const market =
      normalizeMarket(
        event,
        group
      );

    if (market) {
      markets.push(market);
    }
  }

  return markets;
}


/* --------------------------------------------------
   NORMALIZE COMPLETE RESPONSE
-------------------------------------------------- */

function normalizeSportsGameOddsResponse(
  response
) {
  const events =
    getEvents(response);

  const markets = [];

  for (
    const event
    of events
  ) {
    markets.push(
      ...normalizeEvent(event)
    );
  }

  return {
    success:
      response?.success === true,

    generatedAt:
      response?.generatedAt ||
      new Date().toISOString(),

    source:
      'SportsGameOdds',

    marketCount:
      markets.length,

    markets
  };
}


/* --------------------------------------------------
   EXPORTS
-------------------------------------------------- */

module.exports = {
  SUPPORTED_MARKETS,
  normalizeSportsGameOddsResponse,
  normalizeEvent
};
