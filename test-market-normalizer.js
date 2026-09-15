const {
  normalizeSportsGameOddsResponse
} = require('./market-normalizer');

console.log('Market normalizer loaded successfully.');

const sampleResponse = {
  success: true,
  events: []
};

const result =
  normalizeSportsGameOddsResponse(sampleResponse);

console.log(
  JSON.stringify(result, null, 2)
);
