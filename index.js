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

const memory = {};

// ======================
// TEST SERVEUR
// ======================
app.get("/", (req, res) => {
  res.send("NextBody server OK 🚀");
});

app.get("/ping", (req, res) => {
  res.send("awake");
});

// ======================
// COACH IA
// ======================
app.post("/ai/coach", async (req, res) => {
  try {
    const { message, profile, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message manquant" });
    }

    const uid = userId || "default";

    if (!memory[uid]) {
      memory[uid] = [];
    }

    const systemPrompt = `
Tu es le coach fitness officiel de l'application NextBody.

Ton rôle :
- coach musculation
- coach nutrition
- coach motivation

Tu réponds uniquement en FRANÇAIS.

Tes réponses doivent être :
- claires
- utiles
- motivantes
- concrètes
- pas trop longues

Profil utilisateur :
- sexe : ${profile?.gender ?? "inconnu"}
- âge : ${profile?.age ?? "inconnu"}
- taille : ${profile?.height_cm ?? "inconnu"} cm
- poids : ${profile?.weight_kg ?? "inconnu"} kg
- niveau : ${profile?.level ?? "inconnu"}
- lieu d'entraînement : ${profile?.place ?? "inconnu"}
`;

    memory[uid].push({
      role: "user",
      content: message,
    });

    const history = memory[uid].slice(-10);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...history,
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Je n'ai pas pu répondre pour le moment.";

    memory[uid].push({
      role: "assistant",
      content: reply,
    });

    res.json({ reply });
  } catch (error) {
    console.error("Erreur coach IA :", error);
    res.status(500).json({ error: "Erreur coach IA" });
  }
});

// ======================
// ANALYSE PHOTO IA AVANCÉE
// ======================
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
Tu es un coach fitness professionnel spécialisé dans l'analyse physique.

Tu analyses le corps visible sur une photo.

Tu dois être précis, réaliste, prudent et objectif.

IMPORTANT :
- Réponds uniquement en FRANÇAIS.
- Réponds uniquement en JSON valide.
- Ne mets aucun texte avant ou après le JSON.
- Si une zone n'est pas visible, indique une estimation prudente.
- Les scores doivent être cohérents avec le physique observé.

BARÈME :
90-100 = physique élite
75-89 = très athlétique
60-74 = bon physique
45-59 = physique moyen
30-44 = débutant
0-29 = mauvaise condition

Structure obligatoire :

{
  "body_fat": "",
  "body_type": "",
  "physique_level": "",
  "aesthetic_score": 0,
  "score": {
    "global": 0,
    "musculature": 0,
    "definition": 0,
    "posture": 0,
    "symmetry": 0
  },
  "muscle_analysis": {
    "shoulders": "",
    "chest": "",
    "arms": "",
    "abs": "",
    "waist": "",
    "back": "",
    "legs": ""
  },
  "strength_zones": [],
  "weak_zones": [],
  "strengths": [],
  "weaknesses": [],
  "posture": "",
  "genetic_potential": "",
  "six_month_projection": {
    "weight_estimate": "",
    "body_fat_estimate": "",
    "physique": "",
    "changes": []
  }
}

Consignes :
- body_fat = estimation réaliste, ex : "10-12%"
- body_type = ectomorphe / mésomorphe / endomorphe / mixte
- physique_level = débutant / intermédiaire / bon physique / athlétique / très athlétique
- aesthetic_score = score esthétique sur 100
- strength_zones = 2 à 4 zones fortes
- weak_zones = 1 à 3 zones à améliorer
- strengths = 2 à 4 points forts
- weaknesses = 2 à 4 axes d'amélioration
- genetic_potential = faible / moyen / bon / élevé
- six_month_projection.changes = liste de changements probables
`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyse ce physique de manière réaliste."
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
      max_tokens: 1200,
      temperature: 0.4,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.log("JSON IA invalide :", raw);
      return res.status(500).json({ error: "JSON invalide" });
    }

    // sécurités minimales
    parsed.body_fat = parsed.body_fat || "12-15%";
    parsed.body_type = parsed.body_type || "mixte";
    parsed.physique_level = parsed.physique_level || "intermédiaire";
    parsed.aesthetic_score = Number.isInteger(parsed.aesthetic_score)
      ? parsed.aesthetic_score
      : 60;

    parsed.score = parsed.score || {};
    parsed.score.global = Number.isInteger(parsed.score.global) ? parsed.score.global : 60;
    parsed.score.musculature = Number.isInteger(parsed.score.musculature) ? parsed.score.musculature : 60;
    parsed.score.definition = Number.isInteger(parsed.score.definition) ? parsed.score.definition : 60;
    parsed.score.posture = Number.isInteger(parsed.score.posture) ? parsed.score.posture : 60;
    parsed.score.symmetry = Number.isInteger(parsed.score.symmetry) ? parsed.score.symmetry : 60;

    parsed.muscle_analysis = parsed.muscle_analysis || {};
    parsed.muscle_analysis.shoulders =
      parsed.muscle_analysis.shoulders || "Bonne base, largeur à développer.";
    parsed.muscle_analysis.chest =
      parsed.muscle_analysis.chest || "Pectoraux corrects, marge de progression.";
    parsed.muscle_analysis.arms =
      parsed.muscle_analysis.arms || "Bras à développer en volume.";
    parsed.muscle_analysis.abs =
      parsed.muscle_analysis.abs || "Abdominaux visibles, bon niveau de définition.";
    parsed.muscle_analysis.waist =
      parsed.muscle_analysis.waist || "Taille fine, bon point esthétique.";
    parsed.muscle_analysis.back =
      parsed.muscle_analysis.back || "Zone difficile à juger de face, estimation prudente.";
    parsed.muscle_analysis.legs =
      parsed.muscle_analysis.legs || "Jambes non visibles, estimation prudente.";

    parsed.strength_zones = Array.isArray(parsed.strength_zones)
      ? parsed.strength_zones
      : ["épaules", "abdominaux"];
    parsed.weak_zones = Array.isArray(parsed.weak_zones)
      ? parsed.weak_zones
      : ["bras"];
    parsed.strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths
      : ["bonne définition musculaire"];
    parsed.weaknesses = Array.isArray(parsed.weaknesses)
      ? parsed.weaknesses
      : ["masse musculaire à développer"];
    parsed.posture = parsed.posture || "Posture globalement correcte.";
    parsed.genetic_potential = parsed.genetic_potential || "bon";

    parsed.six_month_projection = parsed.six_month_projection || {};
    parsed.six_month_projection.weight_estimate =
      parsed.six_month_projection.weight_estimate || "+2 à +4 kg";
    parsed.six_month_projection.body_fat_estimate =
      parsed.six_month_projection.body_fat_estimate || "8-10%";
    parsed.six_month_projection.physique =
      parsed.six_month_projection.physique ||
      "Physique plus athlétique avec davantage de masse musculaire visible.";
    parsed.six_month_projection.changes = Array.isArray(parsed.six_month_projection.changes)
      ? parsed.six_month_projection.changes
      : ["épaules plus larges", "bras plus pleins", "physique plus dense"];

    res.json(parsed);
  } catch (error) {
    console.error("Erreur analyse IA :", error);
    res.status(500).json({ error: "Erreur analyse IA" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 NextBody server lancé sur le port ${PORT}`);
});