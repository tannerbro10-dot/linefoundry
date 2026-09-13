const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const INPUT = path.join(ROOT, 'public-signals.json');
const CACHE = path.join(ROOT, 'engine-cache.json');
const STATIC_INPUT = require('./public-signals.json');

const QUALITY = {
  HIGH: 0.9,
  MEDIUM: 0.75,
  LOW: 0.6
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function key(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildConsensus(input) {
  const sourceMap = Object.fromEntries(
    (input.sources || []).map(s => [s.id, s])
  );

  const groups = new Map();

  for (const s of input.signals || []) {
    const k = [
      key(s.player),
      key(s.market),
      key(s.side),
      s.line ?? 'any'
    ].join('|');

    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }

  const props = [];

  for (const rows of groups.values()) {
    const srcs = rows
      .map(r => sourceMap[r.sourceId])
      .filter(Boolean);

    const weights = srcs.map(s => s.quality ?? 0.7);

    const avgQuality = weights.length
      ? weights.reduce((a, b) => a + b, 0) / weights.length
      : 0.7;

    const agreement = Math.min(1, rows.length / 4);

    const consensusScore = Math.round(
      (0.65 * avgQuality + 0.35 * agreement) * 100
    );

    const confidence =
      rows.length >= 3
        ? 'HIGH'
        : rows.length === 2
          ? 'MEDIUM'
          : 'EARLY';

    props.push({
      id:
        'CONS-' +
        Buffer.from(
          rows[0].player +
          '|' +
          rows[0].market +
          '|' +
          rows[0].side +
          '|' +
          (rows[0].line ?? 'any')
        )
          .toString('base64url')
          .slice(0, 16),

      player: rows[0].player,
      market: rows[0].market,
      side: rows[0].side,
      line: rows[0].line,

      analystCount: rows.length,
      consensusScore,
      confidence,

      analysts: rows.map(r => ({
        name: r.analyst,
        sourceId: r.sourceId,
        note: r.note,
        url: sourceMap[r.sourceId]?.url,
        outlet: sourceMap[r.sourceId]?.outlet
      })),

      rationale:
        rows.length > 1
          ? `${rows.length} tracked sources agree on this direction.`
          : `One tracked source currently supports this direction; treat as an early signal until more sources agree.`
    });
  }

  return props.sort(
    (a, b) =>
      b.consensusScore - a.consensusScore ||
      b.analystCount - a.analystCount
  );
}

function refresh() {
 const input=STATIC_INPUT;

  const board = {
    mode: 'public-consensus',
    provider: 'curated public sources',
    week: input.week,
    season: input.season,
    refreshedAt: new Date().toISOString(),
    sources: input.sources,
    props: buildConsensus(input)
  };

  // Vercel's serverless filesystem is read-only at runtime.
  // Build the board in memory there; only write the local cache during local runs.
  if (!process.env.VERCEL) {
    try {
      fs.writeFileSync(
        CACHE,
        JSON.stringify(board, null, 2)
      );
    } catch {}
  }

  return board;
}

if (require.main === module) {
  console.log(JSON.stringify(refresh(), null, 2));
}

module.exports = {
  refresh,
  buildConsensus
};
