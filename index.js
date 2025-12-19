import fetch from "node-fetch";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

/* =======================
   HEALTH CHECK
   ======================= */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* =======================
   BATCH UPDATE (ASYNC)
   ======================= */
app.get("/update", (req, res) => {
  // Svar med det samme, så Koyeb Edge ikke giver 502
  res.json({ ok: true, status: "Batch job started" });

  // Kør batch-jobbet i baggrunden
  (async () => {
    try {
      const sikRes = await fetch(
        "https://www.sik.dk/registries/export/autorisationsregister",
        {
          headers: {
            "User-Agent": "CVR-Tjek/1.0",
            "Accept": "application/json"
          }
        }
      );

      if (!sikRes.ok) {
        throw new Error(`SIK HTTP ${sikRes.status}`);
      }

      const sikData = await sikRes.json();

      let i = 0;

      for (const entry of sikData) {
        i++;

        const cvr = String(entry.cvr || "").replace(/\D/g, "");
        if (cvr.length !== 8) continue;

        const auth = {
          VVS: false,
          Kloak: false,
          El: false,
          Asbest: false
        };

        /* -------- autorisationsnumre (primær kilde) -------- */
        if (entry.autnr) {
          entry.autnr.split("#").forEach(block => {
            const prefix = block.split("-")[0]?.trim().toUpperCase();
            if (prefix === "VFUL") auth.VVS = true;
            if (prefix === "KFUL") auth.Kloak = true;
            if (prefix === "EFUL") auth.El = true;
            if (prefix === "ASBE") auth.Asbest = true;
          });
        }

        /* -------- forretningsområde (sekundær/fallback) -------- */
        if (entry.forretningsomr) {
          const t = entry.forretningsomr.toLowerCase();
          if (t.includes("vvs")) auth.VVS = true;
          if (t.includes("kloak")) auth.Kloak = true;
          if (t.includes("elinstall")) auth.El = true;
          if (t.includes("asbest")) auth.Asbest = true;
        }

        /* -------- skriv til Cloudflare KV -------- */
        const kvRes = await fetch(`${process.env.KV_ENDPOINT}/${cvr}`, {
  method: "PUT",
  headers: {
    "Authorization": `Bearer ${process.env.KV_TOKEN}`,
    "Content-Type": "application/json",
    "X-Auth-User-Service-Key": "true"
  },
  body: JSON.stringify(auth)
});


        if (!kvRes.ok) {
          const text = await kvRes.text();
          console.error("KV WRITE FAILED", cvr, kvRes.status, text);
        }

        /* -------- yield hver 100 opslag (stabilitet) -------- */
        if (i % 100 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }

      console.log("SIK batch update completed");

    } catch (err) {
      console.error("Batch update failed:", err.message);
    }
  })();
});

/* =======================
   START SERVER
   ======================= */
app.listen(PORT, () => {
  console.log("SIK batch updater running on port", PORT);
});
