/**
 * LineFoundry Yep Article Collector
 *
 * STEP 3
 *
 * Purpose:
 * - Read Yep search results
 * - Extract unique article URLs
 * - Collect article text using the existing
 *   expert-source-collector.js
 * - Save collected articles for the existing
 *   expert-prop-extractor.js
 *
 * Does NOT modify:
 * - public-signals.json
 * - market-data.json
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");


// ============================================================
// CONFIGURATION
// ============================================================

const INPUT_FILE =
  "yep-results.json";

const OUTPUT_FILE =
  "yep-articles.json";

const COLLECTOR =
  path.resolve(
    "scripts/expert-source-collector.js"
  );


// ============================================================
// LOAD YEP RESULTS
// ============================================================

function loadYepResults() {

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
      data.results
    )
  ) {

    throw new Error(
      "Yep response does not contain a results array."
    );

  }

  return data.results;

}


// ============================================================
// EXTRACT UNIQUE URLS
// ============================================================

function extractUrls(
  results
) {

  const seen =
    new Set();

  const urls = [];

  for (
    const result of results
  ) {

    const url =
      result?.url;

    if (
      !url ||
      typeof url !== "string"
    ) {

      continue;

    }

    if (
      seen.has(url)
    ) {

      continue;

    }

    seen.add(url);

    urls.push({

      url,

      title:
        result.title ||
        null,

      description:
        result.description ||
        null,

      publishedDate:
        result.published_date ||
        null,

      highlights:
        Array.isArray(
          result.highlights
        )
          ? result.highlights
          : []

    });

  }

  return urls;

}


// ============================================================
// COLLECT ARTICLE
// ============================================================

function collectArticle(
  result
) {

  console.log("");
  console.log(
    `Collecting: ${result.url}`
  );

  try {

    const output =
      execFileSync(
        "node",
        [
          COLLECTOR,
          result.url
        ],
        {
          encoding: "utf8",
          maxBuffer:
            10 * 1024 * 1024
        }
      );

    const article =
      JSON.parse(
        output
      );

    return {

      ...article,

      yep: {

        title:
          result.title,

        description:
          result.description,

        publishedDate:
          result.publishedDate,

        highlights:
          result.highlights

      }

    };

  } catch (error) {

    console.error(
      `Failed to collect: ${result.url}`
    );

    return {

      success: false,

      url:
        result.url,

      error:
        error.message

    };

  }

}


// ============================================================
// MAIN
// ============================================================

function main() {

  const results =
    loadYepResults();

  const urls =
    extractUrls(
      results
    );

  console.log(
    `Yep returned ${results.length} results.`
  );

  console.log(
    `Found ${urls.length} unique article URLs.`
  );

  const articles =
    urls.map(
      collectArticle
    );

  const successful =
    articles.filter(
      article =>
        article.success !== false
    );

  const failed =
    articles.filter(
      article =>
        article.success === false
    );

  const output = {

    success: true,

    source:
      "Yep Search API",

    resultCount:
      results.length,

    urlCount:
      urls.length,

    successfulCount:
      successful.length,

    failedCount:
      failed.length,

    articles

  };

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      output,
      null,
      2
    )
  );

  console.log("");
  console.log(
    "========================================"
  );

  console.log(
    "YEP ARTICLE COLLECTION"
  );

  console.log(
    "========================================"
  );

  console.log(
    `Search results: ${results.length}`
  );

  console.log(
    `Unique URLs: ${urls.length}`
  );

  console.log(
    `Successful: ${successful.length}`
  );

  console.log(
    `Failed: ${failed.length}`
  );

  console.log(
    `Saved: ${OUTPUT_FILE}`
  );

}


main();
