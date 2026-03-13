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

// =========================
// TEST
// =========================
app.get("/", (req, res) => {
  res.send("NextBody server OK 🚀");
});

// =========================
// ANALYSE PHOTO IA
// =========================
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

Tu dois analyser le physique visible sur une photo.

RÈGLES OBLIGATOIRES :
- réponds uniquement en FRANÇAIS
- n'utilise AUCUN mot anglais
- ne mets aucun texte avant ou après le JSON
- réponds uniquement avec un JSON valide
- ne laisse jamais un champ vide
- la projection à 6 mois doit toujours être remplie
- reste prudent : tu fais une estimation visuelle, pas un diagnostic médical

Tu dois répondre avec EXACTEMENT cette structure :

{
  "body_fat": "ex: 12-15%",
  "body_type": "ectomorphe / mésomorphe / endomorphe / mixte",
  "physique_level": "débutant / intermédiaire / athlétique / sec",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "posture": "...",
  "six_month_projection": {
    "weight_estimate": "...",
    "body_fat_estimate": "...",
    "physique": "..."
  }
}

Consignes :
- "body_fat" = estimation visuelle du taux de graisse en pourcentage
- "body_type" = type de corps dominant
- "physique_level" = niveau physique global
- "strengths" = 2 ou 3 points forts maximum
- "weaknesses" = 2 ou 3 axes d'amélioration maximum
- "posture" = phrase courte
- "six_month_projection.weight_estimate" = exemple : "+3 à +5 kg" ou "poids stable avec recomposition"
- "six_month_projection.body_fat_estimate" = exemple : "10-12%"
- "six_month_projection.physique" = description courte et réaliste du physique possible dans 6 mois si la personne suit sérieusement un programme et une nutrition adaptée
`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyse ce physique et donne aussi une projection réaliste à 6 mois."
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
      temperature: 0.5
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("JSON IA invalide:", raw);
      return res.status(500).json({ error: "JSON IA invalide" });
    }

    // Sécurité si certains champs manquent
    parsed.body_fat = parsed.body_fat || "12-15%";
    parsed.body_type = parsed.body_type || "mixte";
    parsed.physique_level = parsed.physique_level || "intermédiaire";
    parsed.strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths
      : ["base musculaire correcte"];
    parsed.weaknesses = Array.isArray(parsed.weaknesses)
      ? parsed.weaknesses
      : ["masse musculaire à développer"];
    parsed.posture = parsed.posture || "posture globalement correcte";

    if (
      !parsed.six_month_projection ||
      typeof parsed.six_month_projection !== "object"
    ) {
      parsed.six_month_projection = {};
    }

    parsed.six_month_projection.weight_estimate =
      parsed.six_month_projection.weight_estimate ||
      "évolution progressive selon l'entraînement";

    parsed.six_month_projection.body_fat_estimate =
      parsed.six_month_projection.body_fat_estimate ||
      "amélioration possible avec régularité";

    parsed.six_month_projection.physique =
      parsed.six_month_projection.physique ||
      "physique plus athlétique et plus dessiné avec une meilleure masse musculaire";

    return res.json(parsed);
  } catch (error) {
    console.error("Erreur analyse IA:", error);
    return res.status(500).json({
      error: "Erreur analyse IA"
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 NextBody server lancé sur ${PORT}`);
});