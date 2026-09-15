/**
 * LineFoundry Market Normalizer
 *
 * Purpose:
 * SportsGameOdds raw response
 *        ↓
 * Clean LineFoundry Market objects
 *
 * Expert Signals are intentionally NOT included here.
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

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function cleanOdds(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  return String(value);
}

function normalizeBookmakerName(name) {
  const names = {
    draftkings: 'DraftKings',
    fanduel: 'FanDuel',
    betmgm: 'BetMGM',
    caesars: 'Caesars',
    bet365: 'bet365',
    betrivers: 'BetRivers',
    espnbet: 'ESPN BET',
    fanatics: 'Fanatics',
    hardrock: 'Hard Rock',
    betway: 'Betway',
    pointsbet: 'PointsBet',
    betfred: 'Betfred',
    sportsbet: 'Sportsbet',
    betfair: 'Betfair',
    betonline: 'BetOnline',
    lowvig: 'LowVig',
    betsson: 'Betsson',
    nordicbet: 'NordicBet',
    paddypower: 'Paddy Power',
    ladbrokes: 'Ladbrokes',
    coral: 'Coral'
  };

  return names[name] || name;
}

function getPlayerDirectory(event) {
  return (
    event?.players ||
    event?.playerDirectory ||
    event?.info?.players ||
    {}
  );
}

function getPlayer(event, playerId) {
  const players = getPlayerDirectory(event);

  if (!playerId) {
    return null;
  }

  if (players[playerId]) {
    return players[playerId];
  }

  if (Array.isArray(players)) {
    return players.find(
      player =>
        player?.playerID === playerId ||
        player?.playerId === playerId
    ) || null;
  }

  return null;
}

function getTeamName(event, side) {
  const team = event?.teams?.[side];

  return (
    team?.names?.long ||
    team?.name ||
    team?.displayName ||
    null
  );
}

function getEventWeek(event) {
  return (
    event?.info?.seasonWeek ||
    event?.seasonWeek ||
    event?.week ||
    null
  );
}

function getEventStart(event) {
  return (
    event?.status?.startsAt ||
    event?.startsAt ||
    null
  );
}

function getEventStatus(event) {
  if (typeof event?.status === 'string') {
    return event.status;
  }

  return (
    event?.status?.type ||
    event?.status?.name ||
    event?.status?.state ||
    null
  );
}

function getOddsContainer(event) {
  return (
    event?.odds ||
    event?.markets ||
    event?.lines ||
    {}
  );
}

function getMarketName(statId) {
  return SUPPORTED_MARKETS[statId] || null;
}

function isSupportedOdd(odd) {
  if (!odd) {
    return false;
  }

  const statId = odd.statID;

  if (!SUPPORTED_MARKETS[statId]) {
    return false;
  }

  if (!SUPPORTED_PERIODS.has(odd.periodID)) {
    return false;
  }

  if (!SUPPORTED_BET_TYPES.has(odd.betTypeID)) {
    return false;
  }

  if (odd.cancelled === true) {
    return false;
  }

  /*
   * For normal Over/Under props we need a player.
   *
   * Anytime Touchdown can also be represented as a
   * Yes/No market, so playerID is still expected here.
   */
  if (!odd.playerID) {
    return false;
  }

  return true;
}

function getSide(odd) {
  if (odd.betTypeID === 'ou') {
    if (odd.sideID === 'over') {
      return 'over';
    }

    if (odd.sideID === 'under') {
      return 'under';
    }
  }

  if (odd.betTypeID === 'yn') {
    if (odd.sideID === 'yes') {
      return 'over';
    }

    if (odd.sideID === 'no') {
      return 'under';
    }
  }

  return null;
}

function extractBookmakers(odd) {
  const bookmakers = {};

  if (!odd?.byBookmaker || typeof odd.byBookmaker !== 'object') {
    return bookmakers;
  }

  for (const [bookKey, book] of Object.entries(
    odd.byBookmaker
  )) {
    if (!book || typeof book !== 'object') {
      continue;
    }

    const bookmaker = normalizeBookmakerName(bookKey);

    const alternateLines = Array.isArray(book.altLines)
      ? book.altLines
          .filter(line => line && line.overUnder !== undefined)
          .map(line => ({
            line: toNumber(line.overUnder),
            odds: cleanOdds(line.odds),
            available: line.available === true,
            lastUpdatedAt:
              line.lastUpdatedAt || null
          }))
      : [];

    bookmakers[bookKey] = {
      name: bookmaker,
      line: toNumber(book.overUnder),
      odds: cleanOdds(book.odds),
      available: book.available === true,
      lastUpdatedAt:
        book.lastUpdatedAt || null,
      deeplink: book.deeplink || null,
      alternateLines
    };
  }

  return bookmakers;
}

function extractAlternateLines(odd) {
  const lines = [];

  if (!odd?.byBookmaker) {
    return lines;
  }

  for (const [bookKey, book] of Object.entries(
    odd.byBookmaker
  )) {
    if (!Array.isArray(book?.altLines)) {
      continue;
    }

    for (const alt of book.altLines) {
      if (!alt || alt.overUnder === undefined) {
        continue;
      }

      lines.push({
        bookmaker: normalizeBookmakerName(bookKey),
        bookmakerKey: bookKey,
        line: toNumber(alt.overUnder),
        odds: cleanOdds(alt.odds),
        available: alt.available === true,
        lastUpdatedAt:
          alt.lastUpdatedAt || null
      });
    }
  }

  return lines;
}

function getBestAvailablePrice(bookmakers) {
  const available = Object.values(bookmakers).filter(
    book =>
      book.available &&
      book.line !== null &&
      book.odds !== null
  );

  if (!available.length) {
    return null;
  }

  /*
   * Convert American odds into an implied probability.
   * Lower implied probability = better price for the bettor.
   */
  function impliedProbability(odds) {
    const numeric = Number(
      String(odds).replace('+', '')
    );

    if (!Number.isFinite(numeric)) {
      return Infinity;
    }

    if (numeric > 0) {
      return 100 / (numeric + 100);
    }

    return Math.abs(numeric) /
      (Math.abs(numeric) + 100);
  }

  return available.sort(
    (a, b) =>
      impliedProbability(a.odds) -
      impliedProbability(b.odds)
  )[0];
}

function createEmptySide() {
  return {
    line: null,
    odds: null,
    fairLine: null,
    fairOdds: null,

    openingLine: null,
    openingOdds: null,

    closingLine: null,
    closingOdds: null,

    bestBook: null,
    bestBookOdds: null
  };
}

function applyOddToSide(market, odd, side) {
  if (!side) {
    return;
  }

  const target = market[side];

  const bookLine =
    toNumber(odd.bookOverUnder);

  const fairLine =
    toNumber(odd.fairOverUnder);

  const bookOdds =
    cleanOdds(odd.bookOdds);

  const fairOdds =
    cleanOdds(odd.fairOdds);

  const openingBookLine =
    toNumber(odd.openBookOverUnder);

  const openingBookOdds =
    cleanOdds(odd.openBookOdds);

  const closingBookLine =
    toNumber(odd.closeBookOverUnder);

  const closingBookOdds =
    cleanOdds(odd.closeBookOdds);

  target.line = bookLine;
  target.odds = bookOdds;

  target.fairLine = fairLine;
  target.fairOdds = fairOdds;

  target.openingLine = openingBookLine;
  target.openingOdds = openingBookOdds;

  target.closingLine = closingBookLine;
  target.closingOdds = closingBookOdds;

  const bookmakers =
    extractBookmakers(odd);

  const bestBook =
    getBestAvailablePrice(bookmakers);

  if (bestBook) {
    target.bestBook = bestBook.name;
    target.bestBookOdds = bestBook.odds;
  }
}

function normalizeEvent(event) {
  if (!event) {
    return [];
  }

  const odds = getOddsContainer(event);

  if (!odds || typeof odds !== 'object') {
    return [];
  }

  /*
   * Grouping key:
   *
   * event + player + stat + period + line
   *
   * This creates one Market object for a specific
   * player/prop/line and allows OVER + UNDER to live
   * together.
   */
  const markets = new Map();

  for (const odd of Object.values(odds)) {
    if (!isSupportedOdd(odd)) {
      continue;
    }

    const playerId = odd.playerID;
    const statId = odd.statID;
    const period = odd.periodID;

    /*
     * SportsGameOdds gives us separate OVER and UNDER
     * records. Their current lines can sometimes differ.
     *
     * We therefore use the actual side line when grouping.
     *
     * If both sides have the same line, they naturally
     * become one Market object.
     */
    const side = getSide(odd);

    if (!side) {
      continue;
    }

    const line =
      toNumber(odd.bookOverUnder) ??
      toNumber(odd.fairOverUnder);

    /*
     * A side without a usable line is not useful for
     * our initial Market display.
     */
    if (line === null && odd.betTypeID === 'ou') {
      continue;
    }

    /*
     * For normal O/U markets we initially group around
     * the actual current book line.
     */
    const lineKey =
      line !== null ? line : 'NA';

    const key = [
      event.eventID,
      playerId,
      statId,
      period,
      lineKey
    ].join('|');

    if (!markets.has(key)) {
      const player =
        getPlayer(event, playerId);

      markets.set(key, {
        id: key,

        eventId:
          event.eventID || null,

        week:
          getEventWeek(event),

        game: {
          awayTeam:
            getTeamName(event, 'away'),

          homeTeam:
            getTeamName(event, 'home'),

          startsAt:
            getEventStart(event),

          status:
            getEventStatus(event)
        },

        player: {
          playerId,

          name:
            player?.name ||
            [
              player?.firstName,
              player?.lastName
            ]
              .filter(Boolean)
              .join(' ') ||
            'Unknown Player',

          teamId:
            player?.teamID || null
        },

        market: {
          statId,

          name:
            getMarketName(statId),

          period
        },

        over:
          createEmptySide(),

        under:
          createEmptySide(),

        sportsbooks: {
          over: {},
          under: {}
        },

        alternateLines: {
          over: [],
          under: []
        },

        createdFromApiAt:
          new Date().toISOString()
      });
    }

    const market = markets.get(key);

    applyOddToSide(
      market,
      odd,
      side
    );

    market.sportsbooks[side] =
      extractBookmakers(odd);

    market.alternateLines[side] =
      extractAlternateLines(odd);
  }

  return Array.from(markets.values());
}

function normalizeSportsGameOddsResponse(response) {
  if (!response) {
    return {
      success: false,
      generatedAt: new Date().toISOString(),
      markets: []
    };
  }

  const events =
    Array.isArray(response.events)
      ? response.events
      : [];

  const markets = [];

  for (const event of events) {
    const eventMarkets =
      normalizeEvent(event);

    markets.push(...eventMarkets);
  }

  return {
    success: true,

    generatedAt:
      new Date().toISOString(),

    source: 'SportsGameOdds',

    marketCount:
      markets.length,

    markets
  };
}

/*
 * Export for Node / Worker use.
 */
if (typeof module !== 'undefined') {
  module.exports = {
    normalizeSportsGameOddsResponse,
    normalizeEvent
  };
}
