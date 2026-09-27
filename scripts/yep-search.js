const response = await fetch(
  "https://platform.yep.com/api/search",
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.YEP_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: "...",
      type: "highlights",
      limit: 20,
      language: ["en"],
      location: "US"
    })
  }
);
