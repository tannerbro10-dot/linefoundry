'use strict';

/*
 * LineFoundry
 * SportsGameOdds Market Normalizer
 *
 * Converts the raw SportsGameOdds NFL event response
 * into clean Market objects for LineFoundry.
 *
 * Important:
 * - SportsGameOdds events are returned in response.data
 * - event.odds is an object keyed by oddID
 * - OVER / UNDER records are paired using opposingOddID
 * - YES / NO records are preserved for Anytime Touchdown
 * - Market data remains completely separate from Expert Signals
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

function clean(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return String(value).trim().toLowerCase();
}

function getEvents(response) {
  if (!response || typeof response !== 'object') {
    return [];
  }

  if (Array.isArray(response.data)) {
    return response.data.filter(Boolean);
  }

  if (Array.isArray(response.events)) {
    return response.events.filter(Boolean);
  }

  return [];
}

function getOdds(event) {
  if (!event || typeof event !== 'object') {
    return [];
  }

  if (Array.isArray(event.odds)) {
    return event.odds.filter(Boolean);
  }

  if (
    event.odds &&
    typeof event.odds === 'object'
  ) {
    return Object.values(event.odds)
      .filter(
        odd =>
          odd &&
          typeof odd === 'object' &&
          !Array.isArray(odd)
      );
  }

  return [];
}

function getPlayer(event, playerId) {
  if (!event || !playerId) {
    return null;
  }

  const containers = [
    event.players,
    event.player,
    event.playerDirectory
  ];

  for (const container of containers) {
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

function getPlayerName(event, odd) {
  const playerId = odd?.playerID;

  const player =
    getPlayer(event, playerId);

  if (player) {
    const fullName =
      player.name ||
      [
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

function getPlayerTeam(event, odd) {
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
  if (!team || typeof team !== 'object') {
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
      getTeamName(event?.teams?.away),

    homeTeam:
      getTeamName(event?.teams?.home),

    startsAt:
      event?.status?.startsAt ||
      event?.startsAt ||
      null,

    status:
      event?.status?.type ||
      event?.status?.status ||
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

function isSupportedOdd(odd) {
  if (!odd || typeof odd !== 'object') {
    return false;
  }

  if (odd.cancelled === true) {
    return false;
  }

  if (!odd.playerID) {
    return false;
  }

  const statId =
    clean(odd.statID);

  const periodId =
    clean(odd.periodID);

  const betTypeId =
    clean(odd.betTypeID);

  if (!SUPPORTED_MARKETS[statId]) {
    return false;
  }

  if (periodId !== 'game') {
    return false;
  }

  if (
    betTypeId !== 'ou' &&
    betTypeId !== 'yn'
  ) {
    return false;
  }

  return true;
}

function getSide(odd) {
  if (!odd || typeof odd !== 'object') {
    return null;
  }

  const betType =
    clean(odd.betTypeID);

  const side =
    clean(odd.sideID);

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

function getCurrentLine(odd) {
  if (!odd) {
    return null;
  }

  return (
    odd.bookOverUnder ??
    odd.fairOverUnder ??
    null
  );
}

function getCurrentOdds(odd) {
  if (!odd) {
    return null;
  }

  return (
    odd.bookOdds ??
    odd.fairOdds ??
    null
  );
}

function getOpeningLine(odd) {
  if (!odd) {
    return null;
  }

  return (
    odd.openBookOverUnder ??
    odd.openFairOverUnder ??
    null
  );
}

function getOpeningOdds(odd) {
  if (!odd) {
    return null;
  }

  return (
    odd.openBookOdds ??
    odd.openFairOdds ??
    null
  );
}

function getClosingLine(odd) {
  if (!odd) {
    return null;
  }

  return (
    odd.closeBookOverUnder ??
    odd.closeFairOverUnder ??
    null
  );
}

function getClosingOdds(odd) {
  if (!odd) {
    return null;
  }

  return (
    odd.closeBookOdds ??
    odd.closeFairOdds ??
    null
  );
}

function normalizeBookmaker(
  bookmaker,
  name
) {
  if (
    !bookmaker ||
    typeof bookmaker !== 'object'
  ) {
    return null;
  }

  const alternateLines =
    Array.isArray(bookmaker.altLines)
      ? bookmaker.altLines
          .filter(Boolean)
          .filter(
            line =>
              line.available !== false
          )
          .map(line => ({
            line:
              line.overUnder ??
              line.bookOverUnder ??
              line.fairOverUnder ??
              null,

            odds:
              line.odds ??
              line.bookOdds ??
              line.fairOdds ??
              null,

            available:
              line.available !== false,

            lastUpdatedAt:
              line.lastUpdatedAt ||
              null
          }))
          .filter(
            line =>
              line.line !== null ||
              line.odds !== null
          )
      : [];

  return {
    name:
      clean(name),

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
    !odd ||
    !odd.byBookmaker ||
    typeof odd.byBookmaker !== 'object'
  ) {
    return {};
  }

  const sportsbooks = {};

  for (
    const [name, bookmaker]
    of Object.entries(odd.byBookmaker)
  ) {
    const normalized =
      normalizeBookmaker(
        bookmaker,
        name
      );

    if (!normalized) {
      continue;
    }

    sportsbooks[
      clean(name)
    ] = normalized;
  }

  return sportsbooks;
}

function americanOddsProbability(odds) {
  const number =
    Number(
      String(odds)
        .replace('+', '')
        .trim()
    );

  if (!Number.isFinite(number) || number === 0) {
    return null;
  }

  if (number > 0) {
    return 100 / (number + 100);
  }

  return (
    Math.abs(number) /
    (Math.abs(number) + 100)
  );
}

function findBestBook(sportsbooks) {
  let best = null;

  for (
    const bookmaker
    of Object.values(sportsbooks || {})
  ) {
    if (
      !bookmaker ||
      bookmaker.available === false
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
      americanOddsProbability(
        bookmaker.odds
      );

    if (probability === null) {
      continue;
    }

    if (
      !best ||
      probability <
        best.impliedProbability
    ) {
      best = {
        book: bookmaker.name,
        odds: bookmaker.odds,
        line: bookmaker.line,
        impliedProbability:
          probability
      };
    }
  }

  return best;
}

function getAlternateLines(odd) {
  if (
    !odd ||
    !odd.byBookmaker ||
    typeof odd.byBookmaker !== 'object'
  ) {
    return [];
  }

  const lines = [];

  for (
    const [bookName, bookmaker]
    of Object.entries(odd.byBookmaker)
  ) {
    if (
      !bookmaker ||
      !Array.isArray(bookmaker.altLines)
    ) {
      continue;
    }

    for (
      const altLine
      of bookmaker.altLines
    ) {
      if (
        !altLine ||
        altLine.available === false
      ) {
        continue;
      }

      const line =
        altLine.overUnder ??
        altLine.bookOverUnder ??
        altLine.fairOverUnder ??
        null;

      const odds =
        altLine.odds ??
        altLine.bookOdds ??
        altLine.fairOdds ??
        null;

      if (
        line === null &&
        odds === null
      ) {
        continue;
      }

      lines.push({
        book:
          clean(bookName),

        line,

        odds,

        available:
          altLine.available !== false,

        lastUpdatedAt:
          altLine.lastUpdatedAt ||
          null
      });
    }
  }

  return lines;
}

function uniqueAlternateLines(lines) {
  const seen = new Set();
  const result = [];

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const key = [
      line.book,
      line.line,
      line.odds
    ].join('|');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(line);
  }

  return result;
}

function normalizeSide(odd) {
  if (!odd) {
    return null;
  }

  const sportsbooks =
    getSportsbooks(odd);

  const alternateLines =
    uniqueAlternateLines(
      getAlternateLines(odd)
    );

  const bestBook =
    findBestBook(
      sportsbooks
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

function getPairKey(odd) {
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
   * Preferred:
   * OVER and UNDER point to each other through
   * opposingOddID. Sorting the two IDs means
   * both records generate the same key.
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
   * Fallback when opposingOddID is unavailable.
   */
  return [
    odd.eventID ||
      '',
    odd.playerID ||
      '',
    odd.statID ||
      '',
    odd.periodID ||
      '',
    odd.betTypeID ||
      ''
  ].join('::');
}

function normalizePair(
  event,
  odds
) {
  const validOdds =
    Array.isArray(odds)
      ? odds.filter(Boolean)
      : [];

  if (validOdds.length === 0) {
    return null;
  }

  let over = null;
  let under = null;
  let yes = null;
  let no = null;

  for (const odd of validOdds) {
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
    clean(sample.statID);

  const betType =
    clean(sample.betTypeID);

  const playerId =
    sample.playerID ||
    null;

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

  return {
    id:
      getPairKey(sample),

    eventId:
      event?.eventID ||
      null,

    week:
      getWeek(event),

    game:
      getGame(event),

    player: {
      playerId,

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
        clean(sample.periodID),

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

  for (const odd of supportedOdds) {
    const key =
      getPairKey(odd);

    if (!key) {
      continue;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
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
      normalizePair(
        event,
        group
      );

    if (market) {
      markets.push(market);
    }
  }

  return markets;
}

function normalizeSportsGameOddsResponse(
  response
) {
  const events =
    getEvents(response);

  const markets = [];

  for (const event of events) {
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

module.exports = {
  SUPPORTED_MARKETS,
  normalizeSportsGameOddsResponse,
  normalizeEvent
};
