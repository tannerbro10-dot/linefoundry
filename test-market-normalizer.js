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

  console.log(
    `API success: ${data.success}`
  );

  console.log(
    `Events returned: ${Array.isArray(data.data) ? data.data.length : 0}`
  );

  const result =
    normalizeSportsGameOddsResponse(data);

  console.log('\nNORMALIZED MARKET RESULT');
  console.log('========================');
  console.log(`Market count: ${result.marketCount}`);

  console.log(
    JSON.stringify(result.markets, null, 2)
  );
}

runTest().catch(error => {
  console.error('\nTEST FAILED');
  console.error(error.message);
  process.exit(1);
});
