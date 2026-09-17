/**
 * LineFoundry Expert Source Collector
 *
 * STEP 2B
 *
 * Purpose:
 * - Accept approved expert article URLs.
 * - Fetch the article.
 * - Extract basic article metadata.
 * - Prepare the article for prop extraction.
 *
 * IMPORTANT:
 * This version does NOT modify public-signals.json.
 * This version does NOT touch Market data.
 * This version does NOT require an API key.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const SOURCES_FILE =
  path.join(
    __dirname,
    "expert-sources.json"
  );


// ============================================================
// LOAD SOURCE REGISTRY
// ============================================================

function loadSourceRegistry() {

  const raw =
    fs.readFileSync(
      SOURCES_FILE,
      "utf8"
    );

  return JSON.parse(raw);
}


// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(value) {

  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();

}


// ============================================================
// CHECK APPROVED DOMAIN
// ============================================================

function isApprovedUrl(url, registry) {

  try {

    const parsed =
      new URL(url);

    return registry.sources.some(
      source =>
        source.enabled &&
        source.domains.some(
          domain =>
            parsed.hostname === domain ||
            parsed.hostname.endsWith(
              `.${domain}`
            )
        )
    );

  } catch {

    return false;

  }

}


// ============================================================
// IDENTIFY SOURCE
// ============================================================

function identifySource(
  url,
  registry
) {

  const parsed =
    new URL(url);

  return (
    registry.sources.find(
      source =>
        source.enabled &&
        source.domains.some(
          domain =>
            parsed.hostname === domain ||
            parsed.hostname.endsWith(
              `.${domain}`
            )
        )
    ) || null
  );

}


// ============================================================
// FETCH ARTICLE
// ============================================================

async function fetchArticle(url) {

  const response =
    await fetch(
      url,
      {
        headers: {
          "User-Agent":
            "LineFoundry/1.0 Expert Source Collector",
          "Accept":
            "text/html,application/xhtml+xml"
        }
      }
    );

  if (!response.ok) {

    throw new Error(
      `Article request failed: ${response.status}`
    );

  }

  return response.text();

}


// ============================================================
// EXTRACT HTML TITLE
// ============================================================

function extractTitle(html) {

  const match =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  if (!match) {

    return "";

  }

  return normalizeText(
    match[1]
      .replace(
        /&amp;/gi,
        "&"
      )
      .replace(
        /&#39;/gi,
        "'"
      )
      .replace(
        /&quot;/gi,
        '"'
      )
  );

}


// ============================================================
// EXTRACT META DESCRIPTION
// ============================================================

function extractDescription(html) {

  const patterns = [

    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,

    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i

  ];

  for (
    const pattern of patterns
  ) {

    const match =
      html.match(pattern);

    if (match) {

      return normalizeText(
        match[1]
      );

    }

  }

  return "";

}


// ============================================================
// STRIP HTML
// ============================================================

function stripHtml(html) {

  return normalizeText(

    html

      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )

      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )

      .replace(
        /<noscript[\s\S]*?<\/noscript>/gi,
        " "
      )

      .replace(
        /<[^>]+>/g,
        " "
      )

      .replace(
        /&nbsp;/gi,
        " "
      )

      .replace(
        /&amp;/gi,
        "&"
      )

      .replace(
        /&#39;/gi,
        "'"
      )

      .replace(
        /&quot;/gi,
        '"'
      )

  );

}


// ============================================================
// EXTRACT ARTICLE
// ============================================================

async function collectArticle(
  url
) {

  const registry =
    loadSourceRegistry();

  if (
    !isApprovedUrl(
      url,
      registry
    )
  ) {

    throw new Error(
      "Source is not in the approved expert source registry."
    );

  }

  const source =
    identifySource(
      url,
      registry
    );

  const html =
    await fetchArticle(url);

  const title =
    extractTitle(html);

  const description =
    extractDescription(html);

  const text =
    stripHtml(html);

  return {

    url,

    outlet:
      source?.outlet ||
      null,

    sourceId:
      source?.id ||
      null,

    quality:
      source?.quality ??
      null,

    title,

    description,

    text,

    collectedAt:
      new Date()
        .toISOString()

  };

}


// ============================================================
// COMMAND LINE
// ============================================================

async function main() {

  const url =
    process.argv[2];

  if (!url) {

    console.error(
      "Usage: node scripts/expert-source-collector.js <article-url>"
    );

    process.exit(1);

  }

  try {

    const article =
      await collectArticle(
        url
      );

    console.log(
      JSON.stringify(
        article,
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
