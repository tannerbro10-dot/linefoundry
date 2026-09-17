/**
 * LineFoundry Expert Market Validator
 *
 * STEP 2E
 *
 * Purpose:
 * - Compare extracted expert props against Market data.
 * - Confirm whether the expert's player/market/line
 *   exists in the current Market data.
 *
 * IMPORTANT:
 * - Does NOT modify public-signals.json.
 * - Does NOT modify Market data.
 * - Does NOT publish signals.
 */

const fs = require("fs");
const path = require("path");


// ============================================================
// LOAD JSON
// ============================================================

function loadJson(filePath) {

  const absolutePath =
    path.resolve(filePath);

  if (
    !fs.existsSync(
      absolutePath
    )
  ) {

    throw new Error(
      `File not found: ${filePath}`
    );

  }

  return JSON.parse(
    fs.readFileSync(
      absolutePath,
      "utf8"
    )
  );

}


// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(value) {

  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

}


// ============================================================
// NORMALIZE MARKET NAME
// ============================================================

function normalizeMarket(value) {

  const market =
    normalizeText(value);

  const mappings = [

    {
      terms: [
        "reception",
        "receptions",
        "receiving receptions"
      ],
      value: "receptions"
    },

    {
      terms: [
        "receiving yard",
        "receiving yards"
      ],
      value: "receiving yards"
    },

    {
      terms: [
        "rushing yard",
        "rushing yards"
      ],
      value: "rushing yards"
    },

    {
      terms: [
        "rushing attempt",
        "rushing attempts",
        "carries",
        "rush attempts"
      ],
      value: "rushing attempts"
    },

    {
      terms: [
        "passing yard",
        "passing yards"
      ],
      value: "passing yards"
    },

    {
      terms: [
        "completion",
        "completions"
      ],
      value: "completions"
    },

    {
      terms: [
        "interception",
        "interceptions"
      ],
      value: "interceptions"
    },

    {
      terms: [
        "anytime td",
        "anytime touchdown"
      ],
      value: "anytime td"
    }

  ];

  for (
    const mapping of mappings
  ) {

    if (
      mapping.terms.some(
        term =>
          market === term ||
          market.includes(term)
      )
    ) {

      return mapping.value;

    }

  }

  return market;

}


// ============================================================
// EXTRACT MARKET ARRAY
// ============================================================

function extractMarkets(
  marketData
) {

  if (
    Array.isArray(
      marketData
    )
  ) {

    return marketData;

  }

  if (
    Array.isArray(
      marketData.markets
    )
  ) {

    return marketData.markets;

  }

  if (
    Array.isArray(
      marketData.data
    )
  ) {

    return marketData.data;

  }

  return [];

}


// ============================================================
// EXTRACT PLAYER NAME
// ============================================================

function getMarketPlayer(
  market
) {

  return (
    market?.player?.name ||
    market?.playerName ||
    market?.player ||
    market?.name ||
    ""
  );

}


// ============================================================
// EXTRACT MARKET NAME
// ============================================================

function getMarketType(
  market
) {

  return (
    market?.market ||
    market?.marketName ||
    market?.type ||
    market?.propType ||
    ""
  );

}


// ============================================================
// EXTRACT LINE
// ============================================================

function getMarketLine(
  market
) {

  const candidates = [

    market?.line,

    market?.point,

    market?.points,

    market?.threshold,

    market?.handicap

  ];

  for (
    const value of candidates
  ) {

    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      Number.isFinite(
        Number(value)
      )
    ) {

      return Number(value);

    }

  }

  return null;

}


// ============================================================
// VALIDATE SINGLE PROP
// ============================================================

function validateProp(
  prop,
  markets
) {

  const player =
    normalizeText(
      prop.player
    );

  const market =
    normalizeMarket(
      prop.market
    );

  const line =
    Number(
      prop.line
    );

  const matches =
    markets.filter(
      item => {

        const marketPlayer =
          normalizeText(
            getMarketPlayer(
              item
            )
          );

        const marketType =
          normalizeMarket(
            getMarketType(
              item
            )
          );

        const marketLine =
          getMarketLine(
            item
          );

        return (
          marketPlayer === player &&
          marketType === market &&
          marketLine === line
        );

      }
    );

  if (
    matches.length > 0
  ) {

    return {

      status: "VALIDATED",

      reason:
        "Matching player, market, and line found.",

      matches

    };

  }


  /*
   * Check whether the player and market
   * exist but the line differs.
   */

  const lineMismatches =
    markets.filter(
      item => {

        const marketPlayer =
          normalizeText(
            getMarketPlayer(
              item
            )
          );

        const marketType =
          normalizeMarket(
            getMarketType(
              item
            )
          );

        return (
          marketPlayer === player &&
          marketType === market
        );

      }
    );

  if (
    lineMismatches.length > 0
  ) {

    return {

      status: "LINE_MISMATCH",

      reason:
        "Player and market found, but the line differs.",

      matches:
        lineMismatches

    };

  }


  return {

    status: "NOT_FOUND",

    reason:
      "No matching player and market found.",

    matches: []

  };

}


// ============================================================
// VALIDATE EXTRACTED DATA
// ============================================================

function validate(
  extracted,
  marketData
) {

  const markets =
    extractMarkets(
      marketData
    );

  const props =
    Array.isArray(
      extracted?.props
    )
      ? extracted.props
      : [];

  const results =
    props.map(
      prop => {

        const validation =
          validateProp(
            prop,
            markets
          );

        return {

          ...prop,

          ...validation

        };

      }
    );

  return {

    success: true,

    analyst:
      extracted?.analyst ||
      null,

    source:
      extracted?.source ||
      null,

    marketCount:
      markets.length,

    propCount:
      results.length,

    validatedCount:
      results.filter(
        item =>
          item.status ===
          "VALIDATED"
      ).length,

    lineMismatchCount:
      results.filter(
        item =>
          item.status ===
          "LINE_MISMATCH"
      ).length,

    notFoundCount:
      results.filter(
        item =>
          item.status ===
          "NOT_FOUND"
      ).length,

    results

  };

}


// ============================================================
// COMMAND LINE
// ============================================================

function main() {

  const extractedFile =
    process.argv[2];

  const marketFile =
    process.argv[3];

  if (
    !extractedFile ||
    !marketFile
  ) {

    console.error(
      "Usage: node scripts/expert-market-validator.js <extracted-json> <market-json>"
    );

    process.exit(1);

  }

  try {

    const extracted =
      loadJson(
        extractedFile
      );

    const marketData =
      loadJson(
        marketFile
      );

    const result =
      validate(
        extracted,
        marketData
      );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

  } catch (error) {

    console.error(
      JSON.stringify(
        {
          success: false,

          error:
            error.message
        },
        null,
        2
      )
    );

    process.exit(1);

  }

}


main();
