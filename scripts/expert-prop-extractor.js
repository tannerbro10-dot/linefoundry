/**
 * LineFoundry Expert Prop Extractor
 *
 * STEP 2C
 *
 * Purpose:
 * - Extract explicit player prop recommendations
 *   from collected expert article text.
 *
 * IMPORTANT:
 * - Does NOT modify public-signals.json.
 * - Does NOT modify Market data.
 * - Does NOT publish anything.
 * - Only extracts explicit prop recommendations.
 */

const fs = require("fs");
const path = require("path");


// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(value) {

  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();

}


// ============================================================
// NORMALIZE PLAYER NAME
// ============================================================

function normalizePlayerName(name) {

  return normalizeText(name)
    .replace(/^["']+|["']+$/g, "")
    .replace(
      /^(?:NFL|QB|RB|WR|TE|FB|K|DEF|DST)\s+/i,
      ""
    )
    .replace(
      /^(?:[A-Z][A-Za-z'-]+)\s+(?:QB|RB|WR|TE|FB|K|DEF|DST)\s+/i,
      ""
    )
    .trim();

}


// ============================================================
// NORMALIZE MARKET
// ============================================================

function normalizeMarket(value) {

  const market =
    normalizeText(value)
      .toLowerCase();

  const mappings = [

    {
      match: [
        "reception",
        "receptions",
        "catches",
        "catches"
      ],
      value: "Receptions"
    },

    {
      match: [
        "receiving yard",
        "receiving yards"
      ],
      value: "Receiving Yards"
    },

    {
      match: [
        "rushing yard",
        "rushing yards"
      ],
      value: "Rushing Yards"
    },

    {
      match: [
        "rushing attempt",
        "rushing attempts",
        "carries",
        "rush attempts"
      ],
      value: "Rushing Attempts"
    },

    {
      match: [
        "passing yard",
        "passing yards"
      ],
      value: "Passing Yards"
    },

    {
      match: [
        "passing attempt",
        "passing attempts"
      ],
      value: "Passing Attempts"
    },

    {
      match: [
        "completion",
        "completions"
      ],
      value: "Completions"
    },

    {
      match: [
        "interception",
        "interceptions"
      ],
      value: "Interceptions"
    },

    {
      match: [
        "touchdown",
        "touchdowns",
        "anytime touchdown",
        "anytime touchdowns"
      ],
      value: "Anytime TD"
    }

  ];

  for (
    const mapping of mappings
  ) {

    if (
      mapping.match.some(
        term =>
          market.includes(term)
      )
    ) {

      return mapping.value;

    }

  }

  return null;

}


// ============================================================
// NORMALIZE SIDE
// ============================================================

function normalizeSide(value) {

  const side =
    normalizeText(value)
      .toLowerCase();

  if (
    side === "over" ||
    side === "o"
  ) {

    return "OVER";

  }

  if (
    side === "under" ||
    side === "u"
  ) {

    return "UNDER";

  }

  return null;

}


// ============================================================
// EXTRACT PROP PHRASES
// ============================================================

function extractPropPhrases(text) {

  const normalized =
    normalizeText(text);

  const results = [];

  /*
   * Example:
   *
   * Puka Nacua Over 6.5 receptions
   *
   * Puka Nacua Over 6.5 receptions (-118)
   */

  const pattern =
    /\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\s+(Over|Under)\s+(\d+(?:\.\d+)?)\s+(receptions?|receiving yards?|rushing yards?|rushing attempts?|carries|rush attempts|passing yards?|passing attempts?|completions?|interceptions?)\b/gi;


  let match;

  while (
    (match =
      pattern.exec(normalized)) !== null
  ) {

    const player =
      normalizePlayerName(
        match[1]
      );

    const side =
      normalizeSide(
        match[2]
      );

    const line =
      Number(
        match[3]
      );

    const market =
      normalizeMarket(
        match[4]
      );

    if (
      !player ||
      !side ||
      !Number.isFinite(line) ||
      !market
    ) {

      continue;

    }

    results.push({

      player,

      market,

      side,

      line

    });

  }

  return results;

}


// ============================================================
// DEDUPLICATE
// ============================================================

function deduplicateProps(
  props
) {

  const seen =
    new Set();

  return props.filter(
    prop => {

      const key =
        [
          prop.player,
          prop.market,
          prop.side,
          prop.line
        ]
          .join("|")
          .toLowerCase();

      if (
        seen.has(key)
      ) {

        return false;

      }

      seen.add(key);

      return true;

    }
  );

}
// ============================================================
// EXTRACT EXPERT / ANALYST
// ============================================================

function extractAnalyst(
  text,
  props
) {

  const normalized =
    normalizeText(text);

  /*
   * Look for an explicit author / analyst attribution.
   *
   * The goal is to discover the analyst from the
   * article itself rather than depending on Week-specific
   * wording.
   */

  const analystPatterns = [

    /(?:written|authored|reported|analysis)\s+by\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/i,

    /(?:by|from)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}),?\s+(?:NFL|sports|betting|fantasy)\s+(?:analyst|expert|writer)/i,

    /([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\s+(?:NFL|sports|betting|fantasy)\s+(?:analyst|expert|writer)/i,

    /(?:NFL|sports|betting|fantasy)\s+(?:analyst|expert|writer)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/i,

    /expert\s+(?:picks?|props?|predictions?|bets?)\s+(?:from|by)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/i

  ];

  for (
    const pattern of analystPatterns
  ) {

    const match =
      normalized.match(
        pattern
      );

    if (
      match &&
      match[1]
    ) {

      const candidate =
        normalizeText(
          match[1]
        );

      /*
       * Reject obvious non-person matches.
       */

      const invalidNames = [
        "NFL",
        "NFL Week",
        "Week 2",
        "Week 1",
        "SportsLine",
        "CBS Sports",
        "Fantasy Points Team Bets",
        "GAME NFL NBA MLB"
      ];

      if (
        !invalidNames.some(
          invalid =>
            candidate.toLowerCase() ===
            invalid.toLowerCase()
        )
      ) {

        return candidate;

      }

    }

  }

  return null;

}

// ============================================================
// MAIN EXTRACTION FUNCTION
// ============================================================

function extractProps(
  article
) {

  const text =
    article.text ||
    "";

  const rawProps =
    extractPropPhrases(
      text
    );

  const props =
    deduplicateProps(
      rawProps
    );

  const analyst =
    extractAnalyst(
      text,
      props
    );

  return {

    success: true,

    analyst,

    source: {
      url:
        article.url ||
        null,

      outlet:
        article.outlet ||
        null,

      sourceId:
        article.sourceId ||
        null,

      quality:
        article.quality ??
        null,

      title:
        article.title ||
        null
    },

    propCount:
      props.length,

    props

  };

}


// ============================================================
// COMMAND LINE
// ============================================================

function main() {

  /*
   * For Step 2C testing we read the
   * collector output from a JSON file.
   *
   * Usage:
   *
   * node scripts/expert-prop-extractor.js
   *   scripts/test-article.json
   */

  const inputFile =
    process.argv[2];

  if (!inputFile) {

    console.error(
      "Usage: node scripts/expert-prop-extractor.js <article-json-file>"
    );

    process.exit(1);

  }

  const absolutePath =
    path.resolve(
      inputFile
    );

  if (
    !fs.existsSync(
      absolutePath
    )
  ) {

    console.error(
      `Input file not found: ${inputFile}`
    );

    process.exit(1);

  }

  try {

    const raw =
      fs.readFileSync(
        absolutePath,
        "utf8"
      );

    const article =
      JSON.parse(
        raw
      );

    const result =
      extractProps(
        article
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
