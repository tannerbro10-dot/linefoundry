const fs = require("fs");

async function main() {
  if (!process.env.YEP_API_KEY) {
    throw new Error("YEP_API_KEY is not set.");
  }

  const response = await fetch(
    "https://platform.yep.com/api/search",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.YEP_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: "NFL player prop bets expert picks Week 4 2026",
        type: "highlights",
        limit: 20,
        language: ["en"],
        location: "US"
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Yep API request failed: ${response.status} ${text}`
    );
  }

  const data = await response.json();

  fs.writeFileSync(
    "yep-results.json",
    JSON.stringify(data, null, 2)
  );

  console.log("Yep search successful.");
  console.log("Results saved to yep-results.json");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
