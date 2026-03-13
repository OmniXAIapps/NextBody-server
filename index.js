const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("NextBody server OK 🚀");
});

app.post("/ai/photo-analysis", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Image manquante" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Tu es un coach fitness expert spécialisé en analyse physique.

Réponds uniquement en FRANÇAIS.

Analyse le physique visible sur la photo.

Tu dois répondre uniquement avec ce JSON :

{
 "body_fat": "",
 "body_type": "",
 "physique_level": "",
 "score": {
   "global": 0,
   "musculature": 0,
   "definition": 0,
   "posture": 0,
   "symmetry": 0
 },
 "strength_zones": [],
 "weak_zones": [],
 "strengths": [],
 "weaknesses": [],
 "posture": "",
 "six_month_projection": {
   "weight_estimate": "",
   "body_fat_estimate": "",
   "physique": ""
 }
}

Les scores sont sur 100.

Ne mets aucun texte hors JSON.
`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyse ce physique."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 800,
    });

    const raw = completion.choices[0].message.content.trim();

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Erreur JSON IA" });
    }

    res.json(parsed);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur IA" });
  }
});

app.listen(PORT, () => {
  console.log("🚀 NextBody server lancé sur le port " + PORT);
});