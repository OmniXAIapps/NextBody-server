const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

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

    if (!memory[uid]) {
      memory[uid] = [];
    }

    const systemPrompt = `
Tu es le coach fitness officiel de l'application NextBody.

Tu réponds uniquement en FRANÇAIS.
Tu es :
- coach musculation
- coach nutrition
- coach motivation

Profil utilisateur :
sexe : ${profile?.gender ?? "inconnu"}
âge : ${profile?.age ?? "inconnu"}
taille : ${profile?.height_cm ?? "inconnu"} cm
poids : ${profile?.weight_kg ?? "inconnu"} kg
niveau : ${profile?.level ?? "inconnu"}
lieu : ${profile?.place ?? "inconnu"}

Tes réponses doivent être :
- claires
- motivantes
- concrètes
- utiles
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
      max_tokens: 350,
    });

    const reply = completion.choices[0].message.content || "";

    memory[uid].push({
      role: "assistant",
      content: reply,
    });

    res.json({ reply });
  } catch (e) {
    console.error("coach error", e);
    res.status(500).json({ error: "Erreur coach IA" });
  }
});

// ======================
// ANALYSE PHOTO IA
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
Tu es un coach fitness expert.
Analyse un physique humain visible sur une photo.

Réponds uniquement en JSON valide, sans texte autour.

Structure :
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

Réponds en FRANÇAIS.
`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyse ce physique." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 900,
      temperature: 0.4,
    });

    const raw = completion.choices[0].message.content?.trim() || "";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.log("JSON photo invalide:", raw);
      return res.status(500).json({ error: "JSON invalide" });
    }

    res.json(parsed);
  } catch (e) {
    console.error("photo analysis error", e);
    res.status(500).json({ error: "Erreur analyse IA" });
  }
});

// ======================
// TRANSFORMATION 6 MOIS
// ======================
app.post("/ai/transform", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Image manquante" });
    }

    const prompt = `
Transform this fitness photo into the same person after 6 months of training.

Rules:
- same face
- same person
- same pose
- realistic result
- natural physique evolution
- slightly more muscular
- chest a bit fuller
- shoulders slightly wider
- arms a bit bigger
- keep proportions realistic
`;

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    const image = result.data?.[0]?.b64_json;

    if (!image) {
      return res.status(500).json({ error: "transform error" });
    }

    res.json({ transformedImage: image });
  } catch (e) {
    console.error("transform error", e);
    res.status(500).json({ error: "transform error" });
  }
});

// ======================
// SCAN REPAS IA COMPLET
// ======================
app.post("/ai/meal-scan", async (req, res) => {
  try {
    const { imageBase64, langCode } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Image manquante" });
    }

    const isFr = langCode === "fr";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: isFr
            ? `
Tu es un nutritionniste sportif expert.

Analyse le repas visible sur l'image.
Tu dois estimer le plus proprement possible :
- les aliments détectés
- les calories
- les macronutriments
- les micronutriments importants

Réponds uniquement en JSON valide, sans texte autour.

Structure obligatoire :
{
  "meal_name": "",
  "summary": "",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
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
  },
  "foods": [],
  "positives": [],
  "cautions": [],
  "advice": ""
}

Règles :
- réponse en FRANÇAIS
- estimation réaliste
- si l'image n'est pas parfaitement claire, reste prudent
- foods = liste des aliments détectés
- positives = bons points nutritionnels
- cautions = points à surveiller
- advice = conseil simple et utile
- tous les nombres doivent être numériques
`
            : `
You are an expert sports nutritionist.

Analyze the meal visible in the image.
Estimate:
- detected foods
- calories
- macronutrients
- key micronutrients

Reply only with valid JSON, no extra text.

Required structure:
{
  "meal_name": "",
  "summary": "",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
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
  },
  "foods": [],
  "positives": [],
  "cautions": [],
  "advice": ""
}

Rules:
- answer in ENGLISH
- realistic estimate
- if image is unclear, stay cautious
- foods = detected foods
- positives = nutrition positives
- cautions = things to watch
- advice = simple useful advice
- all numeric values must be numbers
`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: isFr ? "Analyse ce repas." : "Analyze this meal."
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
      temperature: 0.3,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.log("JSON meal scan invalide:", raw);
      return res.status(500).json({
        error: "meal scan error",
        details: "JSON invalide renvoyé par l'IA",
      });
    }

    parsed.meal_name =
      parsed.meal_name || (isFr ? "Repas détecté" : "Detected meal");
    parsed.summary =
      parsed.summary ||
      (isFr
        ? "Estimation nutritionnelle du repas."
        : "Estimated meal nutrition.");

    parsed.calories = Number.isFinite(parsed.calories)
      ? Math.round(parsed.calories)
      : 0;
    parsed.protein = Number.isFinite(parsed.protein)
      ? Math.round(parsed.protein)
      : 0;
    parsed.carbs = Number.isFinite(parsed.carbs)
      ? Math.round(parsed.carbs)
      : 0;
    parsed.fat = Number.isFinite(parsed.fat)
      ? Math.round(parsed.fat)
      : 0;

    parsed.foods = Array.isArray(parsed.foods) ? parsed.foods : [];
    parsed.positives = Array.isArray(parsed.positives) ? parsed.positives : [];
    parsed.cautions = Array.isArray(parsed.cautions) ? parsed.cautions : [];
    parsed.advice =
      parsed.advice ||
      (isFr
        ? "Ajoute une source de protéines si besoin."
        : "Add a protein source if needed.");

    if (!parsed.nutrients || typeof parsed.nutrients !== "object") {
      parsed.nutrients = {};
    }

    const nutrients = {
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
      ...parsed.nutrients,
    };

    for (const key of Object.keys(nutrients)) {
      const value = Number(nutrients[key]);
      nutrients[key] = Number.isFinite(value) ? value : 0;
    }

    parsed.nutrients = nutrients;

    res.json(parsed);
  } catch (e) {
    console.error("meal scan error", e);
    res.status(500).json({
      error: "meal scan error",
      details: e?.message || "Erreur scan repas IA",
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 NextBody server running on ${PORT}`);
});