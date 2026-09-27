const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const INPUT = path.join(__dirname, '..', 'yep-articles.json');
const OUTPUT = path.join(__dirname, '..', 'expert-props.json');
const PUBLIC_SIGNALS = path.join(
  __dirname,
  '..',
  'public',
  'public-signals.json'
);

const EXTRACTOR = path.join(
  __dirname,
  'expert-prop-extractor.js'
);

const NFL_KEYWORDS = [
  'nfl',
  'football',
  'player prop',
  'player props',
  'player-prop',
  'player-props'
];

const EXCLUDE_KEYWORDS = [
  'cfl',
  'college football',
  'ncaa',
  'draft',
  'nfl draft',
  'mlb',
  'baseball',
  'promotion',
  'promo',
  'futures',
  'super bowl futures'
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2) + '\n'
  );
}

function text(value) {
  return String(value || '').toLowerCase();
}

function combinedArticleText(article) {
  return [
    article.url,
    article.title,
    article.description,
    article.text,
    ...(article.highlights || [])
  ]
    .map(text)
    .join(' ');
}

function isExcluded(article) {
  const combined = combinedArticleText(article);

  return EXCLUDE_KEYWORDS.some(keyword =>
    combined.includes(keyword)
  );
}

function isNFLPropArticle(article) {
  const combined = combinedArticleText(article);

  const hasNFL =
    combined.includes('nfl') ||
    combined.includes('national football league');

  const hasProp =
    combined.includes('player prop') ||
    combined.includes('player props') ||
    combined.includes('player-prop') ||
    combined.includes('player-props') ||
    combined.includes('prop bet') ||
    combined.includes('prop bets');

  return hasNFL && hasProp;
}

function detectWeek(article) {
  const combined = combinedArticleText(article);

  const match = combined.match(
    /\bweek[\s-]*(\d{1,2})\b/i
  );

  if (!match) return null;

  return Number(match[1]);
}

function cleanPlayerName(player) {
  let value = String(player || '').trim();

  // Remove common extraction garbage that can appear before a real name.
  value = value.replace(
    /^(props?|picks?|recommendation|player props?)\s+/i,
    ''
  );

  // If extraction captured a sentence before the player,
  // use the final sentence fragment containing the likely name.
  value = value
    .split(/\.\s+/)
    .pop()
    .trim();

  // Remove trailing prose.
  value = value.replace(
    /\s+(going|needs|allowed|shouted|putting|recommendation|pick|selection)\b.*$/i,
    ''
  );

  value = value.replace(/\s+/g, ' ').trim();

  return value;
}

function looksLikePlayerName(player) {
  const value = String(player || '').trim();

  if (!value) return false;

  if (value.length < 5 || value.length > 40) {
    return false;
  }

  const words = value.split(/\s+/);

  if (words.length < 2 || words.length > 4) {
    return false;
  }

  // A player name should consist primarily of name-like characters.
  if (!/^[A-Za-zÀ-ÿ.'’-]+(?:\s+[A-Za-zÀ-ÿ.'’-]+){1,3}$/.test(value)) {
    return false;
  }

  const badFragments = [
    'props',
    'picks',
    'recommendation',
    'allowed',
    'injury',
    'average',
    'putting',
    'shouted',
    'game script'
  ];

  const lower = value.toLowerCase();

  return !badFragments.some(fragment =>
    lower.includes(fragment)
  );
}

function validMarket(market) {
  const allowed = [
    'Receptions',
    'Receiving Yards',
    'Rushing Yards',
    'Rushing Attempts',
    'Passing Yards',
    'Passing Attempts',
    'Completions',
    'Interceptions',
    'Anytime TD'
  ];

  return allowed.includes(market);
}

function makeSignalId(prop) {
  return [
    cleanPlayerName(prop.player),
    prop.market,
    prop.side,
    prop.line ?? 'any',
    prop.source?.sourceId || 'yep',
    'w3'
  ]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function sourceFromProp(prop) {
  const source = prop.source || {};

  return {
    id: source.sourceId || `yep-${source.outlet || 'unknown'}`,
    analyst:
      prop.analyst ||
      source.title ||
      source.outlet ||
      'Unknown Analyst',
    outlet:
      source.outlet ||
      'Yep-discovered source',
    quality:
      typeof source.quality === 'number'
        ? source.quality
        : 0.75,
    verification: 'discovered',
    url: source.url || null
  };
}

function convertToSignal(prop, article) {
  const player = cleanPlayerName(prop.player);

  if (!looksLikePlayerName(player)) {
    return null;
  }

  if (!validMarket(prop.market)) {
    return null;
  }

  if (!['OVER', 'UNDER', 'YES', 'NO'].includes(prop.side)) {
    return null;
  }

  const source = sourceFromProp(prop);

  return {
    id: makeSignalId({
      ...prop,
      player,
      source
    }),
    player,
    market: prop.market,
    side: prop.side,
    line:
      prop.line === undefined
        ? null
        : prop.line,
    analyst:
      prop.analyst ||
      source.analyst,
    sourceId: source.id,
    week: 3,
    note:
      prop.note ||
      `Yep-discovered Week 3 expert prop from ${source.outlet}.`,
    url: article.url
  };
}

function loadExistingSignals() {
  try {
    return readJson(PUBLIC_SIGNALS);
  } catch (error) {
    throw new Error(
      `Could not read ${PUBLIC_SIGNALS}: ${error.message}`
    );
  }
}

function publishWeek3Signals(signals) {
  const publicData = loadExistingSignals();

  const existingSignals = Array.isArray(publicData.signals)
    ? publicData.signals
    : [];

  // Preserve Week 1 and Week 2 exactly as they are.
  const historicalSignals = existingSignals.filter(
    signal => Number(signal.week || 1) !== 3
  );

  const mergedSignals = [
    ...historicalSignals,
    ...signals
  ];

  // Remove duplicate Week 3 signals by ID.
  const seen = new Set();

  const dedupedSignals = mergedSignals.filter(signal => {
    if (seen.has(signal.id)) {
      return false;
    }

    seen.add(signal.id);
    return true;
  });

  const existingSources = Array.isArray(publicData.sources)
    ? publicData.sources
    : [];

  const sourceMap = new Map(
    existingSources.map(source => [source.id, source])
  );

  for (const signal of signals) {
    if (!sourceMap.has(signal.sourceId)) {
      sourceMap.set(signal.sourceId, {
        id: signal.sourceId,
        analyst: signal.analyst,
        outlet: 'Yep-discovered source',
        quality: 0.75,
        verification: 'discovered',
        url: signal.url || null
      });
    }
  }

  const updated = {
    ...publicData,
    refreshedAt: new Date().toISOString(),
    sources: Array.from(sourceMap.values()),
    signals: dedupedSignals
  };

  writeJson(PUBLIC_SIGNALS, updated);

  return updated;
}

function main() {
  const input = readJson(INPUT);

  const articles = Array.isArray(input)
    ? input
    : input.articles || [];

  const includedArticles = [];
  const excludedArticles = [];
  const extractionFailures = [];
  const props = [];

  for (const article of articles) {
    const week = detectWeek(article);

    if (
      week !== 3 ||
      isExcluded(article) ||
      !isNFLPropArticle(article)
    ) {
      excludedArticles.push({
        url: article.url,
        title: article.title,
        week
      });
      continue;
    }

    includedArticles.push({
      url: article.url,
      title: article.title,
      week
    });

    const tempFile = path.join(
      os.tmpdir(),
      `linefoundry-expert-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.json`
    );

    try {
      fs.writeFileSync(
        tempFile,
        JSON.stringify(article, null, 2)
      );

      const raw = execFileSync(
        'node',
        [EXTRACTOR, tempFile],
        {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024
        }
      );

      const result = JSON.parse(raw);

      if (
        result &&
        Array.isArray(result.props)
      ) {
        for (const prop of result.props) {
          const signal = convertToSignal(
            prop,
            article
          );

          if (signal) {
            props.push({
              ...prop,
              player: signal.player,
              week: 3,
              source: {
                ...(prop.source || {}),
                url:
                  prop.source?.url ||
                  article.url
              }
            });
          }
        }
      }
    } catch (error) {
      extractionFailures.push({
        url: article.url,
        title: article.title,
        error: error.message
      });
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
  }

  const signals = [];

  for (const prop of props) {
    const article = includedArticles.find(
      item =>
        item.url ===
        prop.source?.url
    ) || {
      url: prop.source?.url
    };

    const signal = convertToSignal(
      prop,
      article
    );

    if (signal) {
      signals.push(signal);
    }
  }

  const publicData =
    publishWeek3Signals(signals);

  const output = {
    success: true,
    generatedAt: new Date().toISOString(),
    inputArticleCount: articles.length,
    includedArticleCount:
      includedArticles.length,
    excludedArticleCount:
      excludedArticles.length,
    extractionFailureCount:
      extractionFailures.length,
    propCount: props.length,
    publishedWeek3SignalCount:
      signals.length,
    props,
    includedArticles,
    excludedArticles,
    extractionFailures
  };

  writeJson(OUTPUT, output);

  console.log(
    JSON.stringify(
      {
        success: true,
        inputArticles: articles.length,
        week3Articles:
          includedArticles.length,
        extractedProps: props.length,
        publishedWeek3Signals:
          signals.length,
        publicSignalCount:
          publicData.signals.length
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
