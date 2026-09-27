export default async function handler(req, res) {
  try {
    
const season = 2026;
    
const NFL_WEEKS = [
  { week: 1, start: "2026-09-09", end: "2026-09-14" },
  { week: 2, start: "2026-09-15", end: "2026-09-21" },
  { week: 3, start: "2026-09-22", end: "2026-09-28" },
  { week: 4, start: "2026-09-29", end: "2026-10-05" },
  { week: 5, start: "2026-10-06", end: "2026-10-12" },
  { week: 6, start: "2026-10-13", end: "2026-10-19" },
  { week: 7, start: "2026-10-20", end: "2026-10-26" },
  { week: 8, start: "2026-10-27", end: "2026-11-02" },
  { week: 9, start: "2026-11-03", end: "2026-11-09" },
  { week: 10, start: "2026-11-10", end: "2026-11-16" },
  { week: 11, start: "2026-11-17", end: "2026-11-23" },
  { week: 12, start: "2026-11-24", end: "2026-11-30" },
  { week: 13, start: "2026-12-01", end: "2026-12-07" },
  { week: 14, start: "2026-12-08", end: "2026-12-14" },
  { week: 15, start: "2026-12-15", end: "2026-12-21" },
  { week: 16, start: "2026-12-22", end: "2026-12-28" },
  { week: 17, start: "2026-12-29", end: "2027-01-04" },
  { week: 18, start: "2027-01-05", end: "2027-01-11" }
];

const today = new Date().toISOString().slice(0, 10);

const currentWeek = NFL_WEEKS.find(
  w => today >= w.start && today <= w.end
);

if (!currentWeek) {
  throw new Error(`No NFL week found for ${today}`);
}

const week = currentWeek.week;

    // Get today's NFL scoreboard from ESPN
    const scoreboardUrl =
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` +
     `?dates=${today}`;

    const scoreboardResponse = await fetch(scoreboardUrl);

    if (!scoreboardResponse.ok) {
      throw new Error(
        `ESPN scoreboard returned ${scoreboardResponse.status}`
      );
    }

    const scoreboard = await scoreboardResponse.json();

    const events = scoreboard.events || [];

    const games = [];

    // Get the full ESPN summary for each game
    for (const event of events) {
      const summaryUrl =
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary` +
        `?event=${event.id}`;

      const response = await fetch(summaryUrl);

      if (!response.ok) {
        continue;
      }

      const summary = await response.json();

      const competitors =
        event.competitions?.[0]?.competitors || [];

      const teams = competitors.map(c => ({
        id: c.team?.id,
        abbreviation: c.team?.abbreviation,
        name: c.team?.displayName
      }));

      games.push({
        eventId: event.id,
        name: event.name,
        date: event.date,
        status: event.status?.type || null,
        teams,
        boxscore: summary.boxscore || null
      });
    }

    return res.status(200).json({
      success: true,
      source: 'ESPN',
      season,
      week,
      updatedAt: new Date().toISOString(),
      gameCount: games.length,
      games
    });

  } catch (error) {
    console.error('LineFoundry ESPN stats error:', error);

    return res.status(500).json({
      success: false,
      source: 'ESPN',
      error: error.message
    });
  }
}
