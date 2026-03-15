const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const fs = require("fs");
const os = require("os");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const memory = {};

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
    if (!memory[uid]) memory[uid] = [];

    const systemPrompt = `
Tu es le coach fitness officiel de l'application NextBody.
Tu réponds uniquement en FRANÇAIS.
Réponses claires, utiles, motivantes et concrètes.

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
        { role: "system", content: systemPrompt },
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
  } catch (e) {
    console.error("coach error", e);
    res.status(500).json({
      error: "coach error",
      details: e?.message || "Erreur coach IA",
    });
  }
});

// ======================
// ANALYSE PHOTO AVANCÉE
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

Réponds uniquement en JSON valide, en FRANÇAIS, sans texte autour.

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
- body_fat = estimation réaliste, ex: "8-10%"
- body_type = ectomorphe / mésomorphe / endomorphe / mixte
- physique_level = débutant / intermédiaire / bon physique / athlétique / très athlétique
- aesthetic_score = score sur 100
- clavicle_width = étroites / moyennes / larges
- waist_structure = étroite / moyenne / large
- bone_structure = fine / moyenne / robuste
- muscle_insertions = défavorables / moyennes / bonnes / très bonnes
- shoulder_to_waist_ratio = faible / moyen / bon / excellent
- v_taper_score = score sur 100
- upper_lower_balance = haut du corps dominant / équilibré / bas du corps dominant / difficile à juger
- genetic_potential = faible / moyen / bon / élevé
- muscle_gain_potential = faible / moyen / bon / élevé
- aesthetic_potential = faible / moyen / bon / élevé
- si une zone n'est pas visible, reste prudent
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
    } catch (err) {
      console.log("JSON IA invalide:", raw);
      return res.status(500).json({
        error: "analysis error",
        details: "JSON invalide renvoyé par l'IA",
      });
    }

    parsed.body_fat = parsed.body_fat || "12-15%";
    parsed.body_type = parsed.body_type || "mixte";
    parsed.physique_level = parsed.physique_level || "intermédiaire";
    parsed.aesthetic_score = Number.isInteger(parsed.aesthetic_score) ? parsed.aesthetic_score : 60;

    parsed.morphology = parsed.morphology || {};
    parsed.morphology.clavicle_width = parsed.morphology.clavicle_width || "moyennes";
    parsed.morphology.waist_structure = parsed.morphology.waist_structure || "moyenne";
    parsed.morphology.bone_structure = parsed.morphology.bone_structure || "moyenne";
    parsed.morphology.muscle_insertions = parsed.morphology.muscle_insertions || "moyennes";

    parsed.ratios = parsed.ratios || {};
    parsed.ratios.shoulder_to_waist_ratio = parsed.ratios.shoulder_to_waist_ratio || "bon";
    parsed.ratios.v_taper_score = Number.isInteger(parsed.ratios.v_taper_score) ? parsed.ratios.v_taper_score : 60;
    parsed.ratios.upper_lower_balance = parsed.ratios.upper_lower_balance || "difficile à juger";

    parsed.score = parsed.score || {};
    parsed.score.global = Number.isInteger(parsed.score.global) ? parsed.score.global : 60;
    parsed.score.musculature = Number.isInteger(parsed.score.musculature) ? parsed.score.musculature : 60;
    parsed.score.definition = Number.isInteger(parsed.score.definition) ? parsed.score.definition : 60;
    parsed.score.posture = Number.isInteger(parsed.score.posture) ? parsed.score.posture : 60;
    parsed.score.symmetry = Number.isInteger(parsed.score.symmetry) ? parsed.score.symmetry : 60;

    parsed.muscle_analysis = parsed.muscle_analysis || {};
    parsed.muscle_analysis.shoulders = parsed.muscle_analysis.shoulders || "Bonne base, largeur à développer.";
    parsed.muscle_analysis.upper_chest = parsed.muscle_analysis.upper_chest || "Partie haute à développer.";
    parsed.muscle_analysis.chest = parsed.muscle_analysis.chest || "Pectoraux corrects, marge de progression.";
    parsed.muscle_analysis.arms = parsed.muscle_analysis.arms || "Bras à développer en volume.";
    parsed.muscle_analysis.abs = parsed.muscle_analysis.abs || "Abdominaux visibles, bon niveau de définition.";
    parsed.muscle_analysis.waist = parsed.muscle_analysis.waist || "Taille fine, bon point esthétique.";
    parsed.muscle_analysis.back = parsed.muscle_analysis.back || "Difficile à juger de face.";
    parsed.muscle_analysis.legs = parsed.muscle_analysis.legs || "Jambes peu visibles, estimation prudente.";

    parsed.genetics = parsed.genetics || {};
    parsed.genetics.genetic_potential = parsed.genetics.genetic_potential || "moyen";
    parsed.genetics.muscle_gain_potential = parsed.genetics.muscle_gain_potential || "bon";
    parsed.genetics.aesthetic_potential = parsed.genetics.aesthetic_potential || "bon";

    parsed.strength_zones = Array.isArray(parsed.strength_zones) ? parsed.strength_zones : ["abdominaux", "taille"];
    parsed.weak_zones = Array.isArray(parsed.weak_zones) ? parsed.weak_zones : ["bras"];
    parsed.strengths = Array.isArray(parsed.strengths) ? parsed.strengths : ["bonne définition musculaire"];
    parsed.weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses : ["masse musculaire à développer"];
    parsed.posture = parsed.posture || "Posture globalement correcte.";

    parsed.six_month_projection = parsed.six_month_projection || {};
    parsed.six_month_projection.weight_estimate = parsed.six_month_projection.weight_estimate || "+2 à +4 kg";
    parsed.six_month_projection.body_fat_estimate = parsed.six_month_projection.body_fat_estimate || "8-10%";
    parsed.six_month_projection.physique =
      parsed.six_month_projection.physique ||
      "Physique plus athlétique avec davantage de masse musculaire visible.";
    parsed.six_month_projection.changes = Array.isArray(parsed.six_month_projection.changes)
      ? parsed.six_month_projection.changes
      : ["épaules plus larges", "bras plus pleins", "physique plus dense"];

    res.json(parsed);
  } catch (e) {
    console.error("analysis error", e);
    res.status(500).json({
      error: "analysis error",
      details: e?.message || "Erreur analyse IA",
    });
  }
});

// ======================
// TRANSFORMATION 6 MOIS
// ======================
app.post("/ai/transform", async (req, res) => {
  let inputPath = null;

  try {
    const { imageBase64, langCode } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Image manquante" });
    }

    const buffer = Buffer.from(imageBase64, "base64");
    inputPath = path.join(os.tmpdir(), `nextbody_${Date.now()}.png`);
    fs.writeFileSync(inputPath, buffer);

    const prompt =
      langCode === "en"
        ? `Edit this fitness photo into a realistic 6-month transformation of the SAME man. Keep the same face, same person, same pose, same framing, same lighting, same photo style. Make him naturally more muscular: slightly wider shoulders, fuller chest, bigger arms, denser upper body, still lean, still realistic, not extreme.`
        : `Transforme cette photo en une version réaliste du MÊME homme après 6 mois de musculation sérieuse. Garde le même visage, la même personne, la même pose, le même cadrage, la même lumière et le même style photo. Rends le physique naturellement plus musclé : épaules un peu plus larges, pectoraux plus pleins, bras plus volumineux, haut du corps plus dense, tout en restant sec, naturel et réaliste, sans rendu extrême.`;

    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: fs.createReadStream(inputPath),
      prompt,
      size: "1024x1024",
    });

    const image = result?.data?.[0]?.b64_json;

    if (!image) {
      return res.status(500).json({
        error: "transform error",
        details: "Aucune image transformée renvoyée",
      });
    }

    res.json({
      transformedImage: image,
    });
  } catch (e) {
    console.error("transform error", e);
    res.status(500).json({
      error: "transform error",
      details: e?.message || "Erreur transformation IA",
    });
  } finally {
    try {
      if (inputPath && fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
    } catch (_) {}
  }
});

app.listen(PORT, () => {
  console.log("🚀 NextBody server running on", PORT);
});