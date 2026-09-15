const fs = require('fs');
const path = require('path');

const {
  getNFLMarketData
} = require('./market-fetcher');

const OUTPUT_FILE =
  path.join(
    __dirname,
    'market-data.json'
  );

async function refreshMarketData() {
  console.log(
    'Refreshing LineFoundry market data...'
  );

  const marketData =
    await getNFLMarketData({
      limit: 50,
      includeAltLines: true,
      includeOpenCloseOdds: true
    });

  const output = {
    success: true,

    source: 'SportsGameOdds',

    generatedAt:
      marketData.generatedAt,

    eventCount:
      marketData.eventCount,

    marketCount:
      marketData.marketCount,

    markets:
      marketData.markets
  };

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      output,
      null,
      2
    ),
    'utf8'
  );

  console.log('');
  console.log(
    '================================'
  );
  console.log(
    'MARKET DATA REFRESH COMPLETE'
  );
  console.log(
    '================================'
  );

  console.log(
    `Events: ${output.eventCount}`
  );

  console.log(
    `Markets: ${output.marketCount}`
  );

  console.log(
    `Generated: ${output.generatedAt}`
  );

  console.log(
    `File: ${OUTPUT_FILE}`
  );
}

refreshMarketData()
  .catch(error => {
    console.error('');
    console.error(
      'MARKET DATA REFRESH FAILED'
    );

    console.error(
      error.message
    );

    process.exit(1);
  });
