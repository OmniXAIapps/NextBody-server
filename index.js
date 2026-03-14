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
Tu es un coach fitness expert et analyste morphologique.

Tu analyses précisément un physique humain à partir d'une photo.

Tu dois évaluer :
1. le niveau de sèche
2. la morphologie générale
3. les proportions esthétiques
4. le développement musculaire
5. le potentiel génétique visible
6. la projection physique réaliste à 6 mois

IMPORTANT :
- Réponds uniquement en FRANÇAIS
- Réponds uniquement en JSON valide
- Ne mets aucun texte avant ou après le JSON
- Sois réaliste, prudent et cohérent
- Si une zone n'est pas visible, dis-le de manière prudente
- Les scores doivent correspondre au physique observé

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

  "morphology": {
    "clavicle_width": "",
    "waist_structure": "",
    "bone_structure": "",
    "muscle_insertions": ""
  },

  "ratios": {
    "shoulder_to_waist_ratio": "",
    "v_taper_score": 0,
    "upper_lower_balance": ""
  },

  "score": {
    "global": 0,
    "musculature": 0,
    "definition": 0,
    "posture": 0,
    "symmetry": 0
  },

  "muscle_analysis": {
    "shoulders": "",
    "upper_chest": "",
    "chest": "",
    "arms": "",
    "abs": "",
    "waist": "",
    "back": "",
    "legs": ""
  },

  "genetics": {
    "genetic_potential": "",
    "muscle_gain_potential": "",
    "aesthetic_potential": ""
  },

  "strength_zones": [],
  "weak_zones": [],
  "strengths": [],
  "weaknesses": [],
  "posture": "",

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
- morphology.clavicle_width = étroites / moyennes / larges
- morphology.waist_structure = étroite / moyenne / large
- morphology.bone_structure = fine / moyenne / robuste
- morphology.muscle_insertions = défavorables / moyennes / bonnes / très bonnes
- ratios.shoulder_to_waist_ratio = faible / moyen / bon / excellent
- ratios.v_taper_score = score sur 100
- ratios.upper_lower_balance = haut du corps dominant / équilibré / bas du corps dominant / difficile à juger
- genetics.genetic_potential = faible / moyen / bon / élevé
- genetics.muscle_gain_potential = faible / moyen / bon / élevé
- genetics.aesthetic_potential = faible / moyen / bon / élevé
- strength_zones = 2 à 4 zones fortes
- weak_zones = 1 à 4 zones à améliorer
- strengths = 2 à 4 points forts
- weaknesses = 2 à 4 axes d'amélioration
- six_month_projection.changes = liste de changements probables

Le JSON doit toujours être complet.
`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyse ce physique de manière réaliste et détaillée."
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
      max_tokens: 1400,
      temperature: 0.35,
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

    parsed.morphology = parsed.morphology || {};
    parsed.morphology.clavicle_width =
      parsed.morphology.clavicle_width || "moyennes";
    parsed.morphology.waist_structure =
      parsed.morphology.waist_structure || "moyenne";
    parsed.morphology.bone_structure =
      parsed.morphology.bone_structure || "moyenne";
    parsed.morphology.muscle_insertions =
      parsed.morphology.muscle_insertions || "moyennes";

    parsed.ratios = parsed.ratios || {};
    parsed.ratios.shoulder_to_waist_ratio =
      parsed.ratios.shoulder_to_waist_ratio || "bon";
    parsed.ratios.v_taper_score = Number.isInteger(parsed.ratios.v_taper_score)
      ? parsed.ratios.v_taper_score
      : 60;
    parsed.ratios.upper_lower_balance =
      parsed.ratios.upper_lower_balance || "difficile à juger";

    parsed.score = parsed.score || {};
    parsed.score.global = Number.isInteger(parsed.score.global) ? parsed.score.global : 60;
    parsed.score.musculature = Number.isInteger(parsed.score.musculature) ? parsed.score.musculature : 60;
    parsed.score.definition = Number.isInteger(parsed.score.definition) ? parsed.score.definition : 60;
    parsed.score.posture = Number.isInteger(parsed.score.posture) ? parsed.score.posture : 60;
    parsed.score.symmetry = Number.isInteger(parsed.score.symmetry) ? parsed.score.symmetry : 60;

    parsed.muscle_analysis = parsed.muscle_analysis || {};
    parsed.muscle_analysis.shoulders =
      parsed.muscle_analysis.shoulders || "Bonne base, largeur à développer.";
    parsed.muscle_analysis.upper_chest =
      parsed.muscle_analysis.upper_chest || "Partie haute peu visible ou à développer.";
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
      parsed.muscle_analysis.legs || "Jambes non visibles ou difficilement visibles, estimation prudente.";

    parsed.genetics = parsed.genetics || {};
    parsed.genetics.genetic_potential =
      parsed.genetics.genetic_potential || "moyen";
    parsed.genetics.muscle_gain_potential =
      parsed.genetics.muscle_gain_potential || "bon";
    parsed.genetics.aesthetic_potential =
      parsed.genetics.aesthetic_potential || "bon";

    parsed.strength_zones = Array.isArray(parsed.strength_zones)
      ? parsed.strength_zones
      : ["abdominaux", "taille"];
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