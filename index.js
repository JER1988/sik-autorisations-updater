import fetch from "node-fetch";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/test-sik", async (req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8 sek max

  try {
    const sikRes = await fetch(
      "https://www.sik.dk/registries/export/autorisationsregister",
      {
        headers: {
          "User-Agent": "CVR-Tjek/1.0",
          "Accept": "application/json",
          "Accept-Language": "da-DK,da;q=0.9"
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    res.json({
      ok: true,
      status: sikRes.status,
      contentType: sikRes.headers.get("content-type")
    });

  } catch (err) {
    clearTimeout(timeout);

    res.json({
      ok: false,
      error: err.name === "AbortError"
        ? "SIK request timed out"
        : err.message
    });
  }
});


app.listen(PORT, () => {
  console.log("SIK updater listening on port", PORT);
});
