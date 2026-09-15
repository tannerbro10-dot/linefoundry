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

const SUPPORTED_OU_MARKETS = new Set([
  'passing_yards',
  'passing_touchdowns',
  'completions',
  'interceptions',
  'rushing_yards',
  'rushing_attempts',
  'rushing_touchdowns',
  'receiving_yards',
  'receptions',
  'receiving_touchdowns',
  'rushing_receiving_yards',
  'rushing_receiving_attempts'
]);

function getEvents(response) {
  if (!response) return [];

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.events)) {
    return response.events;
  }

  return [];
}

function getOdds(event) {
  if (!event || !event.odds) {
    return [];
  }

  if (Array.isArray(event.odds)) {
    return event.odds;
  }

  return Object.values(event.odds);
}

function normalizePeriod(periodID) {
  if (!periodID) return null;

  const value = String(periodID).toLowerCase();

  if (
    value === 'game' ||
    value === 'full_game' ||
    value === 'fullgame'
  ) {
    return 'game';
  }

  return value;
}

function isSupportedOdd(odd) {
  if (!odd) return false;

  const statId = odd.statID;
  const betType = String(odd.betTypeID || '').toLowerCase();
  const period = normalizePeriod(odd.periodID);

  if (!statId || !SUPPORTED_MARKETS[statId]) {
    return false;
  }

  if (period !== 'game') {
    return false;
  }

  /*
   * O/U markets:
   * These are the normal player prop markets we want.
   */
  if (
    betType === 'ou' &&
    SUPPORTED_OU_MARKETS.has(statId)
  ) {
    return true;
  }

  /*
   * YES/NO markets:
   *
   * SportsGameOdds returns YES/NO versions of many statistical
   * markets. We do NOT want those in the main Market layer.
   *
   * The exception is touchdowns, which represents Anytime TD.
   */
  if (
    betType === 'yn' &&
    statId === 'touchdowns'
  ) {
    return true;
  }

  return false;
}

function normalizeSideID(sideID, betTypeID) {
  if (!sideID) return null;

  const side = String(sideID).toLowerCase();
  const betType = String(betTypeID || '').toLowerCase();

  if (betType === 'ou') {
    if (side.includes('over')) return 'over';
    if (side.includes('under')) return 'under';
  }

  if (betType === 'yn') {
    if (side === 'yes' || side.includes('yes')) return 'yes';
    if (side === 'no' || side.includes('no')) return 'no';
  }

  return null;
}

function parseNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function normalizeOdds(value) {
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
  if (!name) return null;

  return String(name)
    .trim()
    .toLowerCase();
}

function normalizeBookmaker(bookmakerName, bookmaker) {
  if (!bookmaker) return null;

  const name =
    normalizeBookmakerName(bookmakerName);

  if (!name) return null;

  const odds =
    normalizeOdds(bookmaker.odds);

  const line =
    parseNumber(bookmaker.overUnder);

  const available =
    bookmaker.available === true;

  const alternateLines =
    Array.isArray(bookmaker.altLines)
      ? bookmaker.altLines
          .filter(Boolean)
          .map(line => ({
            line: parseNumber(line.overUnder),
            odds: normalizeOdds(line.odds),
            available: line.available === true,
            lastUpdatedAt:
              line.lastUpdatedAt || null
          }))
      : [];

  return {
    name,
    line,
    odds,
    available,
    lastUpdatedAt:
      bookmaker.lastUpdatedAt || null,
    deeplink:
      bookmaker.deeplink || null,
    alternateLines
  };
}

function extractBookmakers(odd) {
  if (!odd || !odd.byBookmaker) {
    return {};
  }

  const sportsbooks = {};

  for (const [
    bookmakerName,
    bookmaker
  ] of Object.entries(odd.byBookmaker)) {
    const normalized =
      normalizeBookmaker(
        bookmakerName,
        bookmaker
      );

    if (!normalized) continue;

    sportsbooks[normalized.name] =
      normalized;
  }

  return sportsbooks;
}

function getBestBook(sportsbooks) {
  const available =
    Object.values(sportsbooks || {})
      .filter(book =>
        book &&
        book.available === true &&
        book.odds !== null
      );

  if (!available.length) {
    return null;
  }

  /*
   * For American odds, the highest payout is the
   * most favorable price.
   */
  return available.reduce(
    (best, current) => {
      if (!best) return current;

      const bestOdds =
        Number(best.odds);

      const currentOdds =
        Number(current.odds);

      if (
        !Number.isFinite(bestOdds) ||
        !Number.isFinite(currentOdds)
      ) {
        return best;
      }

      return currentOdds > bestOdds
        ? current
        : best;
    },
    null
  );
}

function extractSide(odd) {
  if (!odd) return null;

  const sportsbooks =
    extractBookmakers(odd);

  const bestBook =
    getBestBook(sportsbooks);

  const side = {
    line:
      parseNumber(odd.bookOverUnder) ??
      parseNumber(odd.fairOverUnder),

    odds:
      normalizeOdds(odd.bookOdds) ??
      normalizeOdds(odd.fairOdds),

    fairLine:
      parseNumber(odd.fairOverUnder),

    fairOdds:
      normalizeOdds(odd.fairOdds),

    openingLine:
      parseNumber(odd.openBookOverUnder) ??
      parseNumber(odd.openFairOverUnder),

    openingOdds:
      normalizeOdds(odd.openBookOdds) ??
      normalizeOdds(odd.openFairOdds),

    closingLine:
      parseNumber(odd.closeBookOverUnder) ??
      parseNumber(odd.closeFairOverUnder),

    closingOdds:
      normalizeOdds(odd.closeBookOdds) ??
      normalizeOdds(odd.closeFairOdds),

    bestBook:
      bestBook
        ? bestBook.name
        : null,

    bestBookOdds:
      bestBook
        ? bestBook.odds
        : null,

    bestBookLine:
      bestBook
        ? bestBook.line
        : null,

    sportsbooks,

    alternateLines:
      []
  };

  /*
   * Collect alternate lines across bookmakers.
   */
  const alternateMap = new Map();

  for (const bookmaker of Object.values(sportsbooks)) {
    for (
      const alt of bookmaker.alternateLines || []
    ) {
      if (
        alt.line === null ||
        alt.odds === null
      ) {
        continue;
      }

      const key =
        `${alt.line}:${alt.odds}`;

      if (!alternateMap.has(key)) {
        alternateMap.set(key, alt);
      }
    }
  }

  side.alternateLines =
    Array.from(alternateMap.values());

  return side;
}

function isUsefulSide(side) {
  if (!side) return false;

  /*
   * A side must have at least one currently
   * available sportsbook price to be useful
   * in the public Market layer.
   */
  return (
    side.bestBook !== null &&
    side.bestBookOdds !== null
  );
}

function buildMarketId(
  event,
  playerID,
  statID,
  periodID,
  betTypeID,
  overOdd,
  underOdd,
  yesOdd,
  noOdd
) {
  const eventId =
    event.eventID || 'unknown-event';

  const sideIds = [];

  if (overOdd?.oddID) {
    sideIds.push(overOdd.oddID);
  }

  if (underOdd?.oddID) {
    sideIds.push(underOdd.oddID);
  }

  if (yesOdd?.oddID) {
    sideIds.push(yesOdd.oddID);
  }

  if (noOdd?.oddID) {
    sideIds.push(noOdd.oddID);
  }

  return [
    eventId,
    playerID,
    statID,
    periodID,
    betTypeID,
    ...sideIds
  ].join(':');
}

function getPlayer(event, playerID) {
  if (!event || !playerID) {
    return null;
  }

  const players =
    event.players ||
    event.player ||
    {};

  if (Array.isArray(players)) {
    return (
      players.find(
        player =>
          player?.playerID === playerID ||
          player?.id === playerID
      ) || null
    );
  }

  return players[playerID] || null;
}

function getPlayerName(event, playerID) {
  const player =
    getPlayer(event, playerID);

  if (!player) {
    return playerID || 'Unknown Player';
  }

  return (
    player.name ||
    [
      player.firstName,
      player.lastName
    ]
      .filter(Boolean)
      .join(' ') ||
    player.displayName ||
    playerID
  );
}

function getPlayerTeam(event, playerID) {
  const player =
    getPlayer(event, playerID);

  if (!player) {
    return null;
  }

  return (
    player.teamID ||
    player.teamId ||
    player.team ||
    null
  );
}

function getTeamName(team) {
  if (!team) return null;

  return (
    team.names?.long ||
    team.name ||
    team.displayName ||
    team.shortName ||
    null
  );
}

function buildGame(event) {
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
      event?.status?.status ||
      event?.status?.type ||
      null
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

function normalizeEvent(event) {
  if (!event) {
    return [];
  }

  const odds =
    getOdds(event);

  const grouped =
    new Map();

  for (const odd of odds) {
    if (!isSupportedOdd(odd)) {
      continue;
    }

    if (
      odd.cancelled === true ||
      odd.ended === true
    ) {
      continue;
    }

    const playerID =
      odd.playerID ||
      odd.statEntityID;

    if (!playerID) {
      continue;
    }

    const statID =
      odd.statID;

    const periodID =
      normalizePeriod(odd.periodID);

    const betTypeID =
      String(
        odd.betTypeID || ''
      ).toLowerCase();

    const side =
      normalizeSideID(
        odd.sideID,
        betTypeID
      );

    if (!side) {
      continue;
    }

    const key =
      [
        event.eventID,
        playerID,
        statID,
        periodID,
        betTypeID
      ].join(':');

    if (!grouped.has(key)) {
      grouped.set(key, {
        event,
        playerID,
        statID,
        periodID,
        betTypeID,
        overOdd: null,
        underOdd: null,
        yesOdd: null,
        noOdd: null
      });
    }

    const group =
      grouped.get(key);

    if (side === 'over') {
      group.overOdd = odd;
    }

    if (side === 'under') {
      group.underOdd = odd;
    }

    if (side === 'yes') {
      group.yesOdd = odd;
    }

    if (side === 'no') {
      group.noOdd = odd;
    }
  }

  const markets = [];

  for (const group of grouped.values()) {
    const {
      event,
      playerID,
      statID,
      periodID,
      betTypeID,
      overOdd,
      underOdd,
      yesOdd,
      noOdd
    } = group;

    const over =
      overOdd
        ? extractSide(overOdd)
        : null;

    const under =
      underOdd
        ? extractSide(underOdd)
        : null;

    const yes =
      yesOdd
        ? extractSide(yesOdd)
        : null;

    const no =
      noOdd
        ? extractSide(noOdd)
        : null;

    /*
     * O/U markets need at least one usable side.
     */
    if (betTypeID === 'ou') {
      if (
        !isUsefulSide(over) &&
        !isUsefulSide(under)
      ) {
        continue;
      }
    }

    /*
     * YES/NO markets need at least one usable side.
     */
    if (betTypeID === 'yn') {
      if (
        !isUsefulSide(yes) &&
        !isUsefulSide(no)
      ) {
        continue;
      }
    }

    const playerName =
      getPlayerName(
        event,
        playerID
      );

    const playerTeam =
      getPlayerTeam(
        event,
        playerID
      );

    const market = {
      id:
        buildMarketId(
          event,
          playerID,
          statID,
          periodID,
          betTypeID,
          overOdd,
          underOdd,
          yesOdd,
          noOdd
        ),

      eventId:
        event.eventID || null,

      week:
        getWeek(event),

      game:
        buildGame(event),

      player: {
        playerId:
          playerID,

        name:
          playerName,

        teamId:
          playerTeam
      },

      market: {
        statId:
          statID,

        name:
          SUPPORTED_MARKETS[statID],

        period:
          periodID,

        betType:
          betTypeID,

        marketType:
          betTypeID === 'ou'
            ? 'over_under'
            : 'yes_no'
      },

      sides: {
        over,
        under,
        yes,
        no
      },

      createdFromApiAt:
        new Date().toISOString()
    };

    markets.push(market);
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
      response?.success !== false,

    generatedAt:
      new Date().toISOString(),

    source:
      'SportsGameOdds',

    marketCount:
      markets.length,

    markets
  };
}

module.exports = {
  normalizeSportsGameOddsResponse,
  normalizeEvent
};
