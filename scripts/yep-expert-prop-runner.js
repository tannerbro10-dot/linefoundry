/**
 * LineFoundry Yep Expert Prop Runner
 *
 * Purpose:
 * - Read collected Yep articles
 * - Filter to NFL player-prop content
 * - Exclude unwanted sports/content
 * - Send qualifying articles to the existing
 *   expert-prop-extractor.js
 * - Save combined results to expert-props.json
 *
 * IMPORTANT:
 * - Does NOT extract props itself.
 * - Uses expert-prop-extractor.js for all prop extraction.
 * - Does NOT modify public-signals.json.
 * - Does NOT modify market data.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");


// ============================================================
// CONFIGURATION
// ============================================================

const INPUT_FILE =
  "yep-articles.json";

const OUTPUT_FILE =
  "expert-props.json";

const EXTRACTOR =
  path.resolve(
    "scripts/expert-prop-extractor.js"
  );

const TEMP_DIR =
  path.resolve(
    ".tmp-expert-props"
  );


// ============================================================
// LOAD ARTICLES
// ============================================================

function loadArticles() {

  if (
    !fs.existsSync(
      INPUT_FILE
    )
  ) {

    throw new Error(
      `${INPUT_FILE} not found.`
    );

  }

  const raw =
    fs.readFileSync(
      INPUT_FILE,
      "utf8"
    );

  const data =
    JSON.parse(
      raw
    );

  if (
    !Array.isArray(
      data.articles
    )
  ) {

    throw new Error(
      "Yep article response does not contain an articles array."
    );

  }

  return data.articles;

}


// ============================================================
// ARTICLE FILTER
// ============================================================

function classifyArticle(
  article
) {

  const url =
    String(
      article.url ||
      ""
    ).toLowerCase();

  const title =
    String(
      article.title ||
      article.yep?.title ||
      ""
    ).toLowerCase();

  const description =
    String(
      article.description ||
      article.yep?.description ||
      ""
    ).toLowerCase();

  const text =
    String(
      article.text ||
      ""
    ).toLowerCase();

  const combined =
    [
      url,
      title,
      description
    ].join(" ");

  // ----------------------------------------------------------
  // EXCLUDE NON-NFL SPORTS
  // ----------------------------------------------------------

  if (
    /\/cfl\b|cfl\b|canadian football/.test(
      combined
    )
  ) {

    return {
      include: false,
      reason: "CFL"
    };

  }

  if (
    /college football|ncaaf|ncaa football|\/college-football\b/.test(
      combined
    )
  ) {

    return {
      include: false,
      reason: "College Football"
    };

  }

  if (
    /\/mlb\b|mlb\b|major league baseball|baseball/.test(
      combined
    )
  ) {

    return {
      include: false,
      reason: "MLB/Baseball"
    };

  }

  // ----------------------------------------------------------
  // EXCLUDE NFL DRAFT
  // ----------------------------------------------------------

  if (
    /nfl draft|\/draft\b|draft prop|draft picks/.test(
      combined
    )
  ) {

    return {
      include: false,
      reason: "NFL Draft"
    };

  }

  // ----------------------------------------------------------
  // EXCLUDE PROMOTIONS
  // ----------------------------------------------------------

  if (
    /promotion|promo|bet protection|bet protected|protected if|bonus|bonus bet|deposit match|odds boost|free bet/.test(
      combined
    )
  ) {

    return {
      include: false,
      reason: "Promotion"
    };

  }

  // ----------------------------------------------------------
  // EXCLUDE FUTURES
  // ----------------------------------------------------------

  if (
    /futures|super bowl winner|division winner|conference winner|mvp odds|rookie of the year/.test(
      combined
    )
  ) {

    return {
      include: false,
      reason: "Futures"
    };

  }

  // ----------------------------------------------------------
  // REQUIRE NFL CONTENT
  // ----------------------------------------------------------

  const nflMatch =
    /nfl|national football league/.test(
      combined
    );

  if (
    !nflMatch
  ) {

    return {
      include: false,
      reason: "Not NFL"
    };

  }

  // ----------------------------------------------------------
  // REQUIRE PROP/BET CONTENT
  // ----------------------------------------------------------

  const propMatch =
    /player prop|player props|prop bet|prop bets|player betting|player pick|player picks/.test(
      combined
    );

  if (
    !propMatch
  ) {

    return {
      include: false,
      reason: "Not Player Prop Content"
    };

  }

  return {
    include: true,
    reason: "NFL Player Props"
  };

}


// ============================================================
// RUN EXISTING EXPERT PROP EXTRACTOR
// ============================================================

function extractProps(
  article,
  index
) {

  const tempFile =
    path.join(
      TEMP_DIR,
      `article-${index}.json`
    );

  fs.writeFileSync(
    tempFile,
    JSON.stringify(
      article,
      null,
      2
    )
  );

  try {

    const output =
      execFileSync(
        "node",
        [
          EXTRACTOR,
          tempFile
        ],
        {
          encoding: "utf8",
          maxBuffer:
            10 * 1024 * 1024
        }
      );

    return JSON.parse(
      output
    );

  } finally {

    if (
      fs.existsSync(
        tempFile
      )
    ) {

      fs.unlinkSync(
        tempFile
      );

    }

  }

}


// ============================================================
// MAIN
// ============================================================

function main() {

  const articles =
    loadArticles();

  fs.mkdirSync(
    TEMP_DIR,
    {
      recursive: true
    }
  );

  const included = [];
  const excluded = [];
  const extractionFailures = [];

  articles.forEach(
    (article, index) => {

      if (
        article.success === false
      ) {

        excluded.push({
          url:
            article.url ||
            null,

          reason:
            "Article Collection Failed"
        });

        return;

      }

      const classification =
        classifyArticle(
          article
        );

      if (
        !classification.include
      ) {

        excluded.push({
          url:
            article.url ||
            null,

          title:
            article.title ||
            article.yep?.title ||
            null,

          reason:
            classification.reason
        });

        return;

      }

      console.log(
        `Including: ${
          article.title ||
          article.yep?.title ||
          article.url
        }`
      );

      try {

        const result =
          extractProps(
            article,
            index
          );

        included.push({
          article: {
            url:
              article.url ||
              null,

            title:
              article.title ||
              article.yep?.title ||
              null,

            outlet:
              article.outlet ||
              null
          },

          extraction:
            result
        });

      } catch (error) {

        extractionFailures.push({
          url:
            article.url ||
            null,

          error:
            error.message
        });

      }

    }
  );

  const props =
    included.flatMap(
      item =>
        Array.isArray(
          item.extraction?.props
        )
          ? item.extraction.props.map(
              prop => ({
                ...prop,

                analyst:
                  item.extraction.analyst ||
                  null,

                source:
                  item.extraction.source ||
                  null
              })
            )
          : []
    );

  const output = {

    success: true,

    generatedAt:
      new Date()
        .toISOString(),

    inputArticleCount:
      articles.length,

    includedArticleCount:
      included.length,

    excludedArticleCount:
      excluded.length,

    extractionFailureCount:
      extractionFailures.length,

    propCount:
      props.length,

    props,

    includedArticles:
      included,

    excludedArticles:
      excluded,

    extractionFailures

  };

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      output,
      null,
      2
    )
  );

  fs.rmSync(
    TEMP_DIR,
    {
      recursive: true,
      force: true
    }
  );

  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "YEP EXPERT PROP RUNNER"
  );
  console.log(
    "========================================"
  );

  console.log(
    `Input articles: ${articles.length}`
  );

  console.log(
    `Included NFL prop articles: ${included.length}`
  );

  console.log(
    `Excluded articles: ${excluded.length}`
  );

  console.log(
    `Extraction failures: ${extractionFailures.length}`
  );

  console.log(
    `Extracted props: ${props.length}`
  );

  console.log(
    `Saved: ${OUTPUT_FILE}`
  );

}


main();
