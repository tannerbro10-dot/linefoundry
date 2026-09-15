'use strict';

/**
 * LineFoundry — SportsGameOdds Market Normalizer
 *
 * Converts the raw SportsGameOdds API response into
 * clean, frontend-friendly NFL player market objects.
 *
 * Important:
 * - SportsGameOdds returns events under `data`
 * - OVER and UNDER records are paired using opposingOddID
 * - O/U and Y/N markets are kept semantically separate
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

const SUPPORTED_PERIODS = new Set([
  'game'
]);

const SUPPORTED_BET_TYPES = new Set([
  'ou',
  'yn'
]);

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getEvents(response) {
  if (!response) {
    return [];
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.events)) {
    return response.events;
  }

  return [];
}

function getSeasonWeek(event) {
  return (
    event?.info?.seasonWeek ||
    event?.seasonWeek ||
    event?.week ||
    null
  );
}

function getTeamName(team) {
  return (
    team?.names?.long ||
    team?.names?.medium ||
    team?.names?.short ||
    team?.teamName ||
    team?.name ||
    null
  );
}

function getGameInfo(event) {
  return {
    awayTeam: getTeamName(event?.teams?.away),
    homeTeam: getTeamName(event?.teams?.home),
    startsAt:
      event?.status?.startsAt ||
      event?.startsAt ||
      null,
    status:
      event?.status?.type ||
      event?.status?.status ||
      event?.status?.name ||
      event?.status ||
      null
  };
}

function getPlayerName(event, playerId, odd) {
  const player =
    event?.players?.[playerId] ||
    event?.player?.[playerId] ||
    event?.playerDirectory?.[playerId];

  if (player) {
    return (
      player.name ||
      [player.firstName, player.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      null
    );
  }

  return (
    odd?.playerName ||
    odd?.name ||
    null
  );
}

function getPlayerTeamId(event, playerId, odd) {
  const player =
    event?.players?.[playerId] ||
    event?.player?.[playerId] ||
    event?.playerDirectory?.[playerId];

  return (
    player?.teamID ||
    player?.teamId ||
    odd?.teamID ||
    odd?.teamId ||
    null
  );
}

function isSupportedOdd(odd) {
  if (!odd || odd.cancelled) {
    return false;
  }

  const statId = normalizeText(odd.statID);
  const periodId = normalizeText(odd.periodID);
  const betTypeId = normalizeText(odd.betTypeID);

  if (!SUPPORTED_MARKETS[statId]) {
    return false;
  }

  if (!SUPPORTED_PERIODS.has(periodId)) {
    return false;
  }

  if (!SUPPORTED_BET_TYPES.has(betTypeId)) {
    return false;
  }

  if (!odd.playerID) {
    return false;
  }

  return true;
}

function getSide(odd) {
  const betType = normalizeText(odd.betTypeID);
  const side = normalizeText(odd.sideID);

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
  if (
    odd.bookOverUnder !== undefined &&
    odd.bookOverUnder !== null
  ) {
    return odd.bookOverUnder;
  }

  if (
    odd.fairOverUnder !== undefined &&
    odd.fairOverUnder !== null
  ) {
    return odd.fairOverUnder;
  }

  return null;
}

function getCurrentOdds(odd) {
  if (
    odd.bookOdds !== undefined &&
    odd.bookOdds !== null
  ) {
    return odd.bookOdds;
  }

  if (
    odd.fairOdds !== undefined &&
    odd.fairOdds !== null
  ) {
    return odd.fairOdds;
  }

  return null;
}

function getOpeningLine(odd) {
  if (
    odd.openBookOverUnder !== undefined &&
    odd.openBookOverUnder !== null
  ) {
    return odd.openBookOverUnder;
  }

  if (
    odd.openFairOverUnder !== undefined &&
    odd.openFairOverUnder !== null
  ) {
    return odd.openFairOverUnder;
  }

  return null;
}

function getOpeningOdds(odd) {
  if (
    odd.openBookOdds !== undefined &&
    odd.openBookOdds !== null
  ) {
    return odd.openBookOdds;
  }

  if (
    odd.openFairOdds !== undefined &&
    odd.openFairOdds !== null
  ) {
    return odd.openFairOdds;
  }

  return null;
}

function getClosingLine(odd) {
  if (
    odd.closeBookOverUnder !== undefined &&
    odd.closeBookOverUnder !== null
  ) {
    return odd.closeBookOverUnder;
  }

  if (
    odd.closeFairOverUnder !== undefined &&
    odd.closeFairOverUnder !== null
  ) {
    return odd.closeFairOverUnder;
  }

  return null;
}

function getClosingOdds(odd) {
  if (
    odd.closeBookOdds !== undefined &&
    odd.closeBookOdds !== null
  ) {
    return odd.closeBookOdds;
  }

  if (
    odd.closeFairOdds !== undefined &&
    odd.closeFairOdds !== null
  ) {
    return odd.closeFairOdds;
  }

  return null;
}

function normalizeBookmakerName(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

function normalizeBookmaker(bookmaker, bookmakerName) {
  if (!bookmaker) {
    return null;
  }

  const alternateLines = Array.isArray(bookmaker.altLines)
    ? bookmaker.altLines
        .filter(line => line && line.available !== false)
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
          lastUpdatedAt:
            line.lastUpdatedAt ||
            null,
          available:
            line.available !== false
        }))
        .filter(line => line.line !== null || line.odds !== null)
    : [];

  return {
    name: normalizeBookmakerName(bookmakerName),
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
  const bookmakers = odd?.byBookmaker;

  if (!bookmakers || typeof bookmakers !== 'object') {
    return {};
  }

  const result = {};

  for (const [name, bookmaker] of Object.entries(bookmakers)) {
    const normalized = normalizeBookmaker(
      bookmaker,
      name
    );

    if (normalized) {
      result[normalizeBookmakerName(name)] = normalized;
    }
  }

  return result;
}

function impliedProbabilityFromAmericanOdds(odds) {
  const numericOdds = Number(odds);

  if (!Number.isFinite(numericOdds) || numericOdds === 0) {
    return null;
  }

  if (numericOdds > 0) {
    return 100 / (numericOdds + 100);
  }

  return Math.abs(numericOdds) /
    (Math.abs(numericOdds) + 100);
}

function findBestBook(sportsbooks) {
  let best = null;

  for (const bookmaker of Object.values(sportsbooks)) {
    if (!bookmaker || bookmaker.available === false) {
      continue;
    }

    if (bookmaker.odds === null || bookmaker.odds === undefined) {
      continue;
    }

    const probability =
      impliedProbabilityFromAmericanOdds(
        bookmaker.odds
      );

    if (probability === null) {
      continue;
    }

    if (
      !best ||
      probability < best.impliedProbability
    ) {
      best = {
        book: bookmaker.name,
        odds: bookmaker.odds,
        line: bookmaker.line,
        impliedProbability: probability
      };
    }
  }

  return best;
}

function getAlternateLinesFromOdd(odd) {
  const result = [];

  const bookmakers = odd?.byBookmaker;

  if (!bookmakers || typeof bookmakers !== 'object') {
    return result;
  }

  for (const [bookName, bookmaker] of Object.entries(bookmakers)) {
    if (!Array.isArray(bookmaker?.altLines)) {
      continue;
    }

    for (const altLine of bookmaker.altLines) {
      if (!altLine || altLine.available === false) {
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

      if (line === null && odds === null) {
        continue;
      }

      result.push({
        book: normalizeBookmakerName(bookName),
        line,
        odds,
        available: altLine.available !== false,
        lastUpdatedAt:
          altLine.lastUpdatedAt ||
          null
      });
    }
  }

  return result;
}

function uniqueAlternateLines(lines) {
  const seen = new Set();
  const result = [];

  for (const line of lines) {
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
  const sportsbooks = getSportsbooks(odd);

  const alternateLines =
    uniqueAlternateLines(
      getAlternateLinesFromOdd(odd)
    );

  const bestBook =
    findBestBook(sportsbooks);

  return {
    line: getCurrentLine(odd),
    odds: getCurrentOdds(odd),

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

function getMarketFamilyKey(odd) {
  const oddId = String(odd?.oddID || '');
  const opposingOddId =
    String(odd?.opposingOddID || '');

  /*
   * SportsGameOdds gives opposingOddID on the
   * corresponding side. Sorting the pair gives us
   * the same key regardless of whether we encounter
   * OVER or UNDER first.
   */

  const pair = [
    oddId,
    opposingOddId
  ]
    .filter(Boolean)
    .sort();

  if (pair.length === 2) {
    return pair.join('::');
  }

  /*
   * Fallback for records without opposingOddID.
   */
  return [
    odd.eventID,
    odd.playerID,
    odd.statID,
    odd.periodID,
    odd.betTypeID
  ]
    .filter(Boolean)
    .join('::');
}

function normalizeMarketPair(event, pair) {
  const first = pair[0];
  const second = pair[1];

  const firstSide = getSide(first);
  const secondSide = getSide(second);

  const sides = {};

  if (firstSide) {
    sides[firstSide] = normalizeSide(first);
  }

  if (secondSide) {
    sides[secondSide] = normalizeSide(second);
  }

  const sample =
    first ||
    second;

  const statId =
    normalizeText(sample.statID);

  const betTypeId =
    normalizeText(sample.betTypeID);

  const playerId =
    sample.playerID;

  const marketType =
    betTypeId === 'yn'
      ? 'yes_no'
      : 'over_under';

  return {
    id: getMarketFamilyKey(sample),

    eventId:
      event.eventID ||
      null,

    week:
      getSeasonWeek(event),

    game:
      getGameInfo(event),

    player: {
      playerId,
      name:
        getPlayerName(
          event,
          playerId,
          sample
        ),
      teamId:
        getPlayerTeamId(
          event,
          playerId,
          sample
        )
    },

    market: {
      statId,
      name:
        SUPPORTED_MARKETS[statId],
      period:
        normalizeText(sample.periodID),
      betType: betTypeId,
      marketType
    },

    sides,

    /*
     * Convenience fields for the common O/U markets.
     */
    over:
      sides.over ||
      null,

    under:
      sides.under ||
      null,

    /*
     * Convenience fields for Y/N markets such as
     * Anytime Touchdown.
     */
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
  if (!event || typeof event !== 'object') {
    return [];
  }

  /*
   * SportsGameOdds stores odds in the event's `odds`
   * collection. Some responses may expose it as an
   * object keyed by oddID, while others may expose
   * an array.
   */
  let odds = [];

  if (Array.isArray(event.odds)) {
    odds = event.odds;
  } else if (
    event.odds &&
    typeof event.odds === 'object'
  ) {
    odds = Object.values(event.odds);
  }

  /*
   * Defensive fallback for alternate response shapes.
   */
  if (
    odds.length === 0 &&
    Array.isArray(event.odd)
  ) {
    odds = event.odd;
  }

  const supportedOdds =
    odds.filter(isSupportedOdd);

  const groups = new Map();

  for (const odd of supportedOdds) {
    const key =
      getMarketFamilyKey(odd);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(odd);
  }

  const markets = [];

  for (const pair of groups.values()) {
    const market =
      normalizeMarketPair(
        event,
        pair
      );

    if (market) {
      markets.push(market);
    }
  }

  return markets;
}

function normalizeSportsGameOddsResponse(response) {
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

if (typeof module !== 'undefined') {
  module.exports = {
    SUPPORTED_MARKETS,
    normalizeSportsGameOddsResponse,
    normalizeEvent
  };
}
