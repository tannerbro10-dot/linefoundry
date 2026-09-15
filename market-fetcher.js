const {
  normalizeSportsGameOddsResponse
} = require('./market-normalizer');

const API_KEY = process.env.SGO_API_KEY;

const BASE_URL =
  'https://api.sportsgameodds.com/v2/events';

const DEFAULT_LIMIT = 10;

async function fetchNFLMarkets(options = {}) {
  if (!API_KEY) {
    throw new Error(
      'Missing SGO_API_KEY environment variable.'
    );
  }

  const {
    limit = DEFAULT_LIMIT,
    includeAltLines = true,
    includeOpenCloseOdds = true,
    live,
    started,
    ended
  } = options;

  const params = new URLSearchParams({
    apiKey: API_KEY,
    leagueID: 'NFL',
    oddsAvailable: 'true',
    limit: String(limit),
    includeAltLines: String(includeAltLines),
    includeOpenCloseOdds:
      String(includeOpenCloseOdds)
  });

  if (live !== undefined) {
    params.set('live', String(live));
  }

  if (started !== undefined) {
    params.set('started', String(started));
  }

  if (ended !== undefined) {
    params.set('ended', String(ended));
  }

  const url =
    `${BASE_URL}?${params.toString()}`;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `SportsGameOdds returned HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  if (data.success === false) {
    throw new Error(
      data.error ||
      'SportsGameOdds request failed.'
    );
  }

  return data;
}

async function getNFLMarketData(options = {}) {
  const rawResponse =
    await fetchNFLMarkets(options);

  const normalized =
    normalizeSportsGameOddsResponse(
      rawResponse
    );

  return {
    success: true,

    source: 'SportsGameOdds',

    generatedAt:
      new Date().toISOString(),

    eventCount:
      Array.isArray(rawResponse.data)
        ? rawResponse.data.length
        : 0,

    marketCount:
      normalized.marketCount,

    markets:
      normalized.markets
  };
}

async function main() {
  console.log(
    'Fetching NFL market data...'
  );

  const result =
    await getNFLMarketData({
      limit: 10,
      includeAltLines: true,
      includeOpenCloseOdds: true
    });

  console.log('');
  console.log(
    '================================'
  );
  console.log(
    'NFL MARKET FETCHER'
  );
  console.log(
    '================================'
  );

  console.log(
    `Events: ${result.eventCount}`
  );

  console.log(
    `Markets: ${result.marketCount}`
  );

  console.log(
    `Generated: ${result.generatedAt}`
  );

  console.log('');
  console.log(
    'First 10 markets:'
  );
  console.log(
    '--------------------------------'
  );

  result.markets
    .slice(0, 10)
    .forEach((market, index) => {
      const player =
        market?.player?.name ||
        'Unknown Player';

      const marketName =
        market?.market?.name ||
        'Unknown Market';

      const marketType =
        market?.market?.marketType ||
        '';

      let display = '';

      if (
        marketType ===
        'over_under'
      ) {
        const over =
          market?.sides?.over;

        const under =
          market?.sides?.under;

        display =
          `OVER ${over?.line ?? '-'} ` +
          `${over?.odds ?? '-'} | ` +
          `UNDER ${under?.line ?? '-'} ` +
          `${under?.odds ?? '-'}`;
      }

      if (
        marketType ===
        'yes_no'
      ) {
        const yes =
          market?.sides?.yes;

        display =
          `YES ${yes?.odds ?? '-'}`;
      }

      console.log(
        `${index + 1}. ` +
        `${player} — ` +
        `${marketName}`
      );

      console.log(
        `   ${display}`
      );
    });

  console.log('');
  console.log(
    'Market fetch complete.'
  );
}

if (require.main === module) {
  main().catch(error => {
    console.error('');
    console.error(
      'MARKET FETCH FAILED'
    );
    console.error(
      error.message
    );
    process.exit(1);
  });
}

module.exports = {
  fetchNFLMarkets,
  getNFLMarketData
};
