import fetch from "node-fetch";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/test-sik", async (req, res) => {
  try {
    const sikRes = await fetch(
      "https://www.sik.dk/registries/export/autorisationsregister",
      {
        headers: {
          "User-Agent": "CVR-Tjek/1.0",
          "Accept": "application/json",
          "Accept-Language": "da-DK,da;q=0.9"
        },
        timeout: 30000
      }
    );

    res.json({
      status: sikRes.status,
      contentType: sikRes.headers.get("content-type")
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log("SIK updater listening on port", PORT);
});
