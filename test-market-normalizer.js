const {
  normalizeSportsGameOddsResponse
} = require('./market-normalizer');

const API_KEY = process.env.SGO_API_KEY;

if (!API_KEY) {
  console.error('Missing SGO_API_KEY.');
  console.error('Set it in the terminal before running the test.');
  process.exit(1);
}

const EVENT_ID = 'dflovmgz7KuRpeUeYjiO';

async function runTest() {
  console.log('Fetching SportsGameOdds event...');

  const url =
    `https://api.sportsgameodds.com/v2/events` +
    `?apiKey=${encodeURIComponent(API_KEY)}` +
    `&eventID=${EVENT_ID}` +
    `&includeAltLines=true`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `SportsGameOdds returned HTTP ${response.status}`
    );
  }

  const data = await response.json();

  console.log(`API success: ${data.success}`);

  const eventCount =
    Array.isArray(data.data)
      ? data.data.length
      : 0;

  console.log(`Events returned: ${eventCount}`);

  const result =
    normalizeSportsGameOddsResponse(data);

  console.log('\n================================');
  console.log('MARKET NORMALIZER TEST');
  console.log('================================');

  console.log(`Market count: ${result.marketCount}`);

  const markets =
    Array.isArray(result.markets)
      ? result.markets
      : [];

  const marketTypes = {};

  for (const market of markets) {
    const name =
      market?.market?.name || 'Unknown';

    marketTypes[name] =
      (marketTypes[name] || 0) + 1;
  }

  console.log('\nMarket types:');

  Object.entries(marketTypes)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, count]) => {
      console.log(`- ${name}: ${count}`);
    });

  console.log('\nSample markets:');
  console.log('--------------------------------');

  markets
    .slice(0, 15)
    .forEach((market, index) => {
      const player =
        market?.player?.name || 'Unknown Player';

      const marketName =
        market?.market?.name || 'Unknown Market';

      const betType =
        market?.market?.marketType || '';

      const over =
        market?.sides?.over;

      const under =
        market?.sides?.under;

      const yes =
        market?.sides?.yes;

      const no =
        market?.sides?.no;

      let display = '';

      if (betType === 'over_under') {
        const overLine =
          over?.line ?? '-';

        const overOdds =
          over?.odds ?? '-';

        const underLine =
          under?.line ?? '-';

        const underOdds =
          under?.odds ?? '-';

        display =
          `OVER ${overLine} ${overOdds} | ` +
          `UNDER ${underLine} ${underOdds}`;
      }

      if (betType === 'yes_no') {
        const yesOdds =
          yes?.odds ?? '-';

        const noOdds =
          no?.odds ?? '-';

        display =
          `YES ${yesOdds} | NO ${noOdds}`;
      }

      const bestBook =
        over?.bestBook ||
        under?.bestBook ||
        yes?.bestBook ||
        no?.bestBook ||
        'none';

      console.log(
        `${index + 1}. ${player} — ${marketName}`
      );

      console.log(
        `   ${display}`
      );

      console.log(
        `   Best book: ${bestBook}`
      );
    });

  console.log('\n================================');
  console.log('TEST COMPLETE');
  console.log('================================');
}

runTest().catch(error => {
  console.error('\nTEST FAILED');
  console.error(error.message);
  process.exit(1);
});
