export default async function handler(req, res) {
  try {
    const season = 2026;
    const week = 1;

    // Get today's NFL scoreboard from ESPN
    const scoreboardUrl =
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` +
      `?dates=20260913`;

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
