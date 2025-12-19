import fetch from "node-fetch";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------- HEALTH ----------------
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ---------------- UPDATE ----------------
app.get("/update", (req, res) => {
  // Svar med det samme – så Koyeb Edge er tilfreds
  res.json({ ok: true, status: "Batch job started" });

  // Kør batch-jobbet ASYNKRONT
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

      const sikData = await sikRes.json();

      const AUTH_MAP = {
        VFUL: "VVS",
        KFUL: "Kloak",
        EFUL: "El",
        ASBE: "Asbest"
      };

      for (const entry of sikData) {
        const cvr = String(entry.cvr || "").replace(/\D/g, "");
        if (cvr.length !== 8) continue;

        const auth = { VVS: false, Kloak: false, El: false, Asbest: false };

        if (entry.autnr) {
          entry.autnr.split("#").forEach(block => {
            const prefix = block.split("-")[0]?.trim().toUpperCase();
            const mapped = AUTH_MAP[prefix];
            if (mapped) auth[mapped] = true;
          });
        }

        if (entry.forretningsomr) {
          const t = entry.forretningsomr.toLowerCase();
          if (t.includes("vvs")) auth.VVS = true;
          if (t.includes("kloak")) auth.Kloak = true;
          if (t.includes("el")) auth.El = true;
          if (t.includes("asbest")) auth.Asbest = true;
        }

        await fetch(`${process.env.KV_ENDPOINT}/${cvr}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${process.env.KV_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(auth)
        });
      }

      console.log("SIK batch update completed");

    } catch (err) {
      console.error("Batch update failed:", err.message);
    }
  })();
});


app.listen(PORT, () => {
  console.log("SIK batch updater running on port", PORT);
});
