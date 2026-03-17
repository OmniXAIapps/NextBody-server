const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const memory = {};

/* =========================
   HELPERS
========================= */

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function extractJson(text) {
  if (!text || typeof text !== "string") return null;

  const direct = safeJsonParse(text);
  if (direct) return direct;

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const cleanedParsed = safeJsonParse(cleaned);
  if (cleanedParsed) return cleanedParsed;

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const sliced = cleaned.slice(firstBrace, lastBrace + 1);
    return safeJsonParse(sliced);
  }

  return null;
}

function toNumber(v, fallback = 0) {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function normalizeMealScan(data, langCode = "fr") {
  const isFr = langCode === "fr";

  const fallback = {
    meal_name: isFr ? "Repas scanné" : "Scanned meal",
    summary: isFr
      ? "Analyse nutritionnelle générée par IA."
      : "AI nutrition analysis.",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    foods: [],
    positives: [],
    cautions: [],
    advice: isFr
      ? "Ajoute davantage de légumes et surveille les sauces."
      : "Add more vegetables and watch sauces.",
    nutrients: {
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
      cholesterol_mg: 0,
      omega3_g: 0,
      saturated_fat_g: 0,
      magnesium_mg: 0,
      vitamin_d_mcg: 0,
      vitamin_c_mg: 0,
      vitamin_a_mcg: 0,
      iron_mg: 0,
      water_ml: 0,
      caffeine_mg: 0,
      alcohol_g: 0,
    },
  };

  if (!data || typeof data !== "object") return fallback;

  return {
    meal_name: data.meal_name || fallback.meal_name,
    summary: data.summary || fallback.summary,
    calories: Math.round(toNumber(data.calories, 0)),
    protein: Math.round(toNumber(data.protein, 0)),
    carbs: Math.round(toNumber(data.carbs, 0)),
    fat: Math.round(toNumber(data.fat, 0)),
    foods: Array.isArray(data.foods) ? data.foods : [],
    positives: Array.isArray(data.positives) ? data.positives : [],
    cautions: Array.isArray(data.cautions) ? data.cautions : [],
    advice: data.advice || fallback.advice,
    nutrients: {
      fiber_g: toNumber(data?.nutrients?.fiber_g, 0),
      sugar_g: toNumber(data?.nutrients?.sugar_g, 0),
      sodium_mg: toNumber(data?.nutrients?.sodium_mg, 0),
      cholesterol_mg: toNumber(data?.nutrients?.cholesterol_mg, 0),
      omega3_g: toNumber(data?.nutrients?.omega3_g, 0),
      saturated_fat_g: toNumber(data?.nutrients?.saturated_fat_g, 0),
      magnesium_mg: toNumber(data?.nutrients?.magnesium_mg, 0),
      vitamin_d_mcg: toNumber(data?.nutrients?.vitamin_d_mcg, 0),
      vitamin_c_mg: toNumber(data?.nutrients?.vitamin_c_mg, 0),
      vitamin_a_mcg: toNumber(data?.nutrients?.vitamin_a_mcg, 0),
      iron_mg: toNumber(data?.nutrients?.iron_mg, 0),
      water_ml: toNumber(data?.nutrients?.water_ml, 0),
      caffeine_mg: toNumber(data?.nutrients?.caffeine_mg, 0),
      alcohol_g: toNumber(data?.nutrients?.alcohol_g, 0),
    },
  };
}

function normalizePhotoAnalysis(data) {
  const fallback = {
    body_fat: "",
    body_type: "",
    physique_level: "",
    aesthetic_score: 0,
    genetic_potential: "",
    score: {
      global: 0,
      musculature: 0,
      definition: 0,
      posture: 0,
      symmetry: 0,
    },
    morphology: {
      clavicle_width: "",
      waist_structure: "",
      bone_structure: "",
      muscle_insertions: "",
    },
    aesthetic_ratios: {
      shoulder_waist_ratio: "",
      v_taper_score: 0,
      upper_lower_balance: "",
    },
    muscle_analysis: {
      shoulders: "",
      upper_chest: "",
      chest: "",
      arms: "",
      abs: "",
      waist: "",
      back: "",
      legs: "",
    },
    strengths: [],
    weaknesses: [],
    posture_analysis: "",
    six_month_projection: {
      weight_estimate: "",
      body_fat_estimate: "",
      physique: "",
      focus_points: [],
    },
  };

  if (!data || typeof data !== "object") return fallback;

  return {
    body_fat: data.body_fat ?? fallback.body_fat,
    body_type: data.body_type ?? fallback.body_type,
    physique_level: data.physique_level ?? fallback.physique_level,
    aesthetic_score: Math.round(toNumber(data.aesthetic_score, 0)),
    genetic_potential: data.genetic_potential ?? fallback.genetic_potential,
    score: {
      global: Math.round(toNumber(data?.score?.global, 0)),
      musculature: Math.round(toNumber(data?.score?.musculature, 0)),
      definition: Math.round(toNumber(data?.score?.definition, 0)),
      posture: Math.round(toNumber(data?.score?.posture, 0)),
      symmetry: Math.round(toNumber(data?.score?.symmetry, 0)),
    },
    morphology: {
      clavicle_width: data?.morphology?.clavicle_width ?? "",
      waist_structure: data?.morphology?.waist_structure ?? "",
      bone_structure: data?.morphology?.bone_structure ?? "",
      muscle_insertions: data?.morphology?.muscle_insertions ?? "",
    },
    aesthetic_ratios: {
      shoulder_waist_ratio:
        data?.aesthetic_ratios?.shoulder_waist_ratio ?? "",
      v_taper_score: Math.round(
        toNumber(data?.aesthetic_ratios?.v_taper_score, 0)
      ),
      upper_lower_balance:
        data?.aesthetic_ratios?.upper_lower_balance ?? "",
    },
    muscle_analysis: {
      shoulders: data?.muscle_analysis?.shoulders ?? "",
      upper_chest: data?.muscle_analysis?.upper_chest ?? "",
      chest: data?.muscle_analysis?.chest ?? "",
      arms: data?.muscle_analysis?.arms ?? "",
      abs: data?.muscle_analysis?.abs ?? "",
      waist: data?.muscle_analysis?.waist ?? "",
      back: data?.muscle_analysis?.back ?? "",
      legs: data?.muscle_analysis?.legs ?? "",
    },
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
    posture_analysis: data.posture_analysis ?? "",
    six_month_projection: {
      weight_estimate: data?.six_month_projection?.weight_estimate ?? "",
      body_fat_estimate:
        data?.six_month_projection?.body_fat_estimate ?? "",
      physique: data?.six_month_projection?.physique ?? "",
      focus_points: Array.isArray(data?.six_month_projection?.focus_points)
        ? data.six_month_projection.focus_points
        : [],
    },
  };
}

/* =========================
   ROOT
========================= */

app.get("/", (req, res) => {
  res.send("NextBody server OK 🚀");
});

app.get("/ping", (req, res) => {
  res.send("awake");
});

/* =========================
   COACH IA
========================= */

app.post("/ai/coach", async (req, res) => {
  try {
    const { message, profile, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message manquant" });
    }

    const uid = userId || "default";
    if (!memory[uid]) memory[uid] = [];

    const langCode = profile?.langCode || "fr";
    const isFr = langCode === "fr";

    const systemPrompt = `
Tu es le coach fitness officiel de l'application NextBody.
Réponds uniquement en ${isFr ? "FRANÇAIS" : "ANGLAIS"}.
Sois utile, motivant, concret, clair.
Évite le blabla inutile.
Réponses courtes à moyennes.

Profil utilisateur :
- sexe : ${profile?.gender ?? "inconnu"}
- age : ${profile?.age ?? "inconnu"}
- taille : ${profile?.height_cm ?? "inconnu"} cm
- poids : ${profile?.weight_kg ?? "inconnu"} kg
- niveau : ${profile?.level ?? "inconnu"}
- objectif : ${profile?.goal ?? "inconnu"}
- lieu entraînement : ${profile?.place ?? "inconnu"}
`;

    memory[uid].push({ role: "user", content: message });
    const history = memory[uid].slice(-10);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 350,
      messages: [{ role: "system", content: systemPrompt }, ...history],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "";
    memory[uid].push({ role: "assistant", content: reply });

    res.json({ reply });
  } catch (e) {
    console.error("coach error", e);
    res.status(500).json({ error: "coach error" });
  }
});

/* =========================
   ANALYSE PHOTO PHYSIQUE
========================= */

app.post("/ai/photo-analysis", async (req, res) => {
  try {
    const { imageBase64, langCode = "fr" } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "missing imageBase64" });
    }

    const isFr = langCode === "fr";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Tu es un coach fitness expert.
Tu analyses un physique humain à partir d'une photo.

Réponds UNIQUEMENT en JSON valide.
Pas de markdown.
Pas de texte hors JSON.

Structure attendue :
{
  "body_fat": "",
  "body_type": "",
  "physique_level": "",
  "aesthetic_score": 0,
  "genetic_potential": "",
  "score": {
    "global": 0,
    "musculature": 0,
    "definition": 0,
    "posture": 0,
    "symmetry": 0
  },
  "morphology": {
    "clavicle_width": "",
    "waist_structure": "",
    "bone_structure": "",
    "muscle_insertions": ""
  },
  "aesthetic_ratios": {
    "shoulder_waist_ratio": "",
    "v_taper_score": 0,
    "upper_lower_balance": ""
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
  "strengths": [],
  "weaknesses": [],
  "posture_analysis": "",
  "six_month_projection": {
    "weight_estimate": "",
    "body_fat_estimate": "",
    "physique": "",
    "focus_points": []
  }
}

Règles :
- langue : ${isFr ? "FRANÇAIS" : "ANGLAIS"}
- réaliste
- pas d'exagération
- pas de jugement insultant
- analyser uniquement ce qui est visuellement plausible
`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: isFr
                ? "Analyse ce physique de façon réaliste."
                : "Analyze this physique realistically.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    const parsed = extractJson(raw);

    if (!parsed) {
      console.error("photo-analysis invalid json:", raw);
      return res.status(500).json({
        error: "photo analysis json invalid",
      });
    }

    res.json(normalizePhotoAnalysis(parsed));
  } catch (e) {
    console.error("photo-analysis error", e);
    res.status(500).json({ error: "photo-analysis error" });
  }
});

/* =========================
   TRANSFORMATION 6 MOIS
========================= */

app.post("/ai/transform", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "missing imageBase64" });
    }

    // Version mock propre pour éviter les erreurs de génération serveur
    // tant que tu ne branches pas une vraie pipeline d'édition.
    // On renvoie l'image d'origine pour garder l'app fonctionnelle.
    res.json({
      transformedImage: imageBase64,
      note: "mock_transform_same_image",
    });
  } catch (e) {
    console.error("transform error", e);
    res.status(500).json({ error: "transform error" });
  }
});

/* =========================
   SCAN REPAS IA
========================= */

app.post("/ai/meal-scan", async (req, res) => {
  try {
    const { imageBase64, langCode = "fr" } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Image manquante" });
    }

    const isFr = langCode === "fr";

    const systemPrompt = isFr
      ? `
Tu es un expert en analyse nutritionnelle de repas à partir d'une photo.

Ta mission :
1. Identifier le plat avec le nom LE PLUS PROBABLE et LE PLUS COURANT en français.
2. Ne donne pas un nom trop générique si un nom commercial/usuel est visuellement beaucoup plus probable.
3. Priorité aux noms courants en restauration rapide et en alimentation réelle.

Exemples importants :
- si ça ressemble visuellement à un kebab sandwich : réponds "Kebab"
- si ça ressemble à un dürüm : réponds "Dürüm"
- si ça ressemble à un tacos français : réponds "Tacos"
- si ça ressemble à un burger : réponds "Burger"
- si ça ressemble à une pizza : réponds "Pizza"
- si ça ressemble à une assiette kebab / assiette grecque : réponds avec ce nom
- évite les noms trop vagues comme "pita au poulet grillé" si "kebab" est visuellement bien plus logique

Tu dois te baser sur :
- le pain
- la forme du sandwich
- la viande visible
- les crudités
- les sauces
- le format de restauration rapide
- la portion visible
- l'aspect réel du plat, pas une version théorique "saine"

Important :
- si l'image montre vraisemblablement un kebab, il faut l'appeler kebab
- si tu hésites entre 2 noms, choisis le plus probable dans le langage courant
- tu peux préciser dans le résumé qu'il s'agit d'une estimation si besoin

Réponds UNIQUEMENT en JSON valide avec cette structure :
{
  "meal_name": "",
  "summary": "",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "foods": [],
  "positives": [],
  "cautions": [],
  "advice": "",
  "nutrients": {
    "fiber_g": 0,
    "sugar_g": 0,
    "sodium_mg": 0,
    "cholesterol_mg": 0,
    "omega3_g": 0,
    "saturated_fat_g": 0,
    "magnesium_mg": 0,
    "vitamin_d_mcg": 0,
    "vitamin_c_mg": 0,
    "vitamin_a_mcg": 0,
    "iron_mg": 0,
    "water_ml": 0,
    "caffeine_mg": 0,
    "alcohol_g": 0
  }
}

Règles :
- langue : FRANÇAIS
- donne une estimation réaliste
- pense aux sauces si elles sont probables visuellement
- pense à la taille réelle du pain et à la quantité de viande
- foods = liste des éléments probables du plat
- positives = bons points nutritionnels
- cautions = éléments à surveiller
- advice = conseil simple, concret
- tous les nombres doivent être numériques
- pas de texte hors JSON
`
      : `
You are an expert meal nutrition analyzer from a photo.

Your mission:
1. Identify the meal with the MOST PROBABLE and MOST COMMON name in English.
2. Avoid vague generic names if a common commercial name is visually more likely.
3. Prioritize real-world fast food / restaurant naming.

Examples:
- if it visually looks like a kebab sandwich, answer "Kebab"
- if it looks like a durum wrap, answer "Durum"
- if it looks like a burger, answer "Burger"
- if it looks like pizza, answer "Pizza"
- if it looks like a plate meal, use the most likely common name
- avoid vague labels like "grilled chicken pita" if "kebab" is much more visually logical

Base your answer on:
- bread shape
- sandwich format
- visible meat
- vegetables
- sauces
- fast-food presentation
- visible portion size
- real-world food appearance

Reply ONLY in valid JSON with this structure:
{
  "meal_name": "",
  "summary": "",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "foods": [],
  "positives": [],
  "cautions": [],
  "advice": "",
  "nutrients": {
    "fiber_g": 0,
    "sugar_g": 0,
    "sodium_mg": 0,
    "cholesterol_mg": 0,
    "omega3_g": 0,
    "saturated_fat_g": 0,
    "magnesium_mg": 0,
    "vitamin_d_mcg": 0,
    "vitamin_c_mg": 0,
    "vitamin_a_mcg": 0,
    "iron_mg": 0,
    "water_ml": 0,
    "caffeine_mg": 0,
    "alcohol_g": 0
  }
}

Rules:
- language: ENGLISH
- realistic estimate
- include sauces if visually likely
- foods = likely ingredients
- positives = nutrition positives
- cautions = things to watch
- advice = short useful tip
- all numbers must be numeric
- no text outside JSON
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: isFr
                ? "Analyse ce repas. Donne le nom courant le plus probable."
                : "Analyze this meal. Give the most likely common real-world name.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    const parsed = extractJson(raw);

    if (!parsed) {
      console.error("meal scan invalid json:", raw);
      return res.status(500).json({
        error: "meal scan error",
        details: "JSON invalide renvoyé par l'IA",
      });
    }

    const normalized = normalizeMealScan(parsed, langCode);

    res.json(normalized);
  } catch (e) {
    console.error("meal scan error", e);
    res.status(500).json({
      error: "meal scan error",
      details: e?.message || "Erreur scan repas IA",
    });
  }
});

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log(`🚀 NextBody server lancé sur le port ${PORT}`);
});