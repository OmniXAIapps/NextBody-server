const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
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

function cleanText(v, fallback = "") {
  if (v === null || v === undefined) return fallback;
  const text = String(v).trim();
  if (!text || text === "null" || text === "undefined" || text === "unknown") {
    return fallback;
  }
  return text;
}

function cleanList(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => cleanText(e, ""))
    .filter(Boolean);
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
    meal_name: cleanText(data.meal_name, fallback.meal_name),
    summary: cleanText(data.summary, fallback.summary),
    calories: Math.round(toNumber(data.calories, 0)),
    protein: Math.round(toNumber(data.protein, 0)),
    carbs: Math.round(toNumber(data.carbs, 0)),
    fat: Math.round(toNumber(data.fat, 0)),
    foods: cleanList(data.foods),
    positives: cleanList(data.positives),
    cautions: cleanList(data.cautions),
    advice: cleanText(data.advice, fallback.advice),
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
    ratios: {
      shoulder_to_waist_ratio: "",
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
    genetics: {
      genetic_potential: "",
      muscle_gain_potential: "",
      aesthetic_potential: "",
    },
    strength_zones: [],
    weak_zones: [],
    strengths: [],
    weaknesses: [],
    posture: "",
    six_month_projection: {
      weight_estimate: "",
      body_fat_estimate: "",
      physique: "",
      changes: [],
    },
  };

  if (!data || typeof data !== "object") return fallback;

  const rawRatios = data?.ratios || data?.aesthetic_ratios || {};
  const rawGenetics = data?.genetics || {};
  const rawProjection = data?.six_month_projection || {};

  const strengths = cleanList(data.strengths);
  const weaknesses = cleanList(data.weaknesses);
  const strengthZones = cleanList(data.strength_zones);
  const weakZones = cleanList(data.weak_zones);

  return {
    body_fat: cleanText(data.body_fat, fallback.body_fat),
    body_type: cleanText(data.body_type, fallback.body_type),
    physique_level: cleanText(data.physique_level, fallback.physique_level),
    aesthetic_score: Math.round(toNumber(data.aesthetic_score, 0)),
    genetic_potential: cleanText(
      data.genetic_potential,
      fallback.genetic_potential
    ),
    score: {
      global: Math.round(toNumber(data?.score?.global, 0)),
      musculature: Math.round(toNumber(data?.score?.musculature, 0)),
      definition: Math.round(toNumber(data?.score?.definition, 0)),
      posture: Math.round(toNumber(data?.score?.posture, 0)),
      symmetry: Math.round(toNumber(data?.score?.symmetry, 0)),
    },
    morphology: {
      clavicle_width: cleanText(data?.morphology?.clavicle_width),
      waist_structure: cleanText(data?.morphology?.waist_structure),
      bone_structure: cleanText(data?.morphology?.bone_structure),
      muscle_insertions: cleanText(data?.morphology?.muscle_insertions),
    },
    ratios: {
      shoulder_to_waist_ratio: cleanText(
        rawRatios?.shoulder_to_waist_ratio || rawRatios?.shoulder_waist_ratio
      ),
      v_taper_score: Math.round(toNumber(rawRatios?.v_taper_score, 0)),
      upper_lower_balance: cleanText(rawRatios?.upper_lower_balance),
    },
    muscle_analysis: {
      shoulders: cleanText(data?.muscle_analysis?.shoulders),
      upper_chest: cleanText(data?.muscle_analysis?.upper_chest),
      chest: cleanText(data?.muscle_analysis?.chest),
      arms: cleanText(data?.muscle_analysis?.arms),
      abs: cleanText(data?.muscle_analysis?.abs),
      waist: cleanText(data?.muscle_analysis?.waist),
      back: cleanText(data?.muscle_analysis?.back),
      legs: cleanText(data?.muscle_analysis?.legs),
    },
    genetics: {
      genetic_potential: cleanText(
        rawGenetics?.genetic_potential || data?.genetic_potential
      ),
      muscle_gain_potential: cleanText(rawGenetics?.muscle_gain_potential),
      aesthetic_potential: cleanText(rawGenetics?.aesthetic_potential),
    },
    strength_zones: strengthZones.length > 0 ? strengthZones : strengths,
    weak_zones: weakZones.length > 0 ? weakZones : weaknesses,
    strengths,
    weaknesses,
    posture: cleanText(data?.posture || data?.posture_analysis),
    six_month_projection: {
      weight_estimate: cleanText(rawProjection?.weight_estimate),
      body_fat_estimate: cleanText(rawProjection?.body_fat_estimate),
      physique: cleanText(rawProjection?.physique),
      changes: cleanList(rawProjection?.changes || rawProjection?.focus_points),
    },
  };
}

function buildBodyFuturePrompt({
  goal = "",
  focusAreas = [],
  intensity = "",
  customPrompt = "",
  langCode = "fr",
}) {
  const goalMap = {
    "Plus musclé":
      "make the physique more muscular with fuller muscle mass and stronger upper-body presence",
    "More muscular":
      "make the physique more muscular with fuller muscle mass and stronger upper-body presence",

    "Plus sec":
      "make the physique leaner with lower body fat, sharper lines, and more visible definition",
    "Leaner":
      "make the physique leaner with lower body fat, sharper lines, and more visible definition",

    "Physique esthétique":
      "create a more aesthetic physique with balanced proportions, stronger V-taper, and visually pleasing symmetry",
    "Aesthetic physique":
      "create a more aesthetic physique with balanced proportions, stronger V-taper, and visually pleasing symmetry",
  };

  const intensityMap = {
    "Naturel":
      "keep the result subtle, realistic, and naturally achievable",
    "Natural":
      "keep the result subtle, realistic, and naturally achievable",

    "Athlétique":
      "make the result clearly athletic, enhanced, and motivating while staying believable",
    "Athletic":
      "make the result clearly athletic, enhanced, and motivating while staying believable",

    "Très avancé":
      "push the physique further with a highly developed transformation, while keeping anatomy coherent",
    "Advanced":
      "push the physique further with a highly developed transformation, while keeping anatomy coherent",
  };

  const focusMap = {
    "Épaules": "broader and rounder shoulders",
    "Shoulders": "broader and rounder shoulders",

    "Pectoraux": "fuller and stronger chest",
    "Chest": "fuller and stronger chest",

    "Bras": "bigger and more defined arms",
    "Arms": "bigger and more defined arms",

    "Dos": "wider and thicker back",
    "Back": "wider and thicker back",

    "Abdos": "more visible abs and tighter waistline",
    "Abs": "more visible abs and tighter waistline",

    "Jambes": "stronger and more developed legs",
    "Legs": "stronger and more developed legs",
  };

  const goalInstruction =
    goalMap[goal] ||
    "improve the physique in a realistic and visually appealing way";

  const intensityInstruction =
    intensityMap[intensity] ||
    "keep the transformation realistic and visually coherent";

  const focusInstructions = Array.isArray(focusAreas)
    ? focusAreas.map((area) => focusMap[area]).filter(Boolean)
    : [];

  const focusBlock =
    focusInstructions.length > 0
      ? `Prioritize these visual upgrades: ${focusInstructions.join(", ")}.`
      : "Keep the transformation balanced across the whole physique.";

  const customBlock =
    cleanText(customPrompt).length > 0
      ? `Additional user preference: ${cleanText(customPrompt)}.`
      : "";

  const langBlock =
    langCode === "fr"
      ? "The output must feel premium, realistic, motivating, and suitable for a fitness transformation app."
      : "The output must feel premium, realistic, motivating, and suitable for a fitness transformation app.";

  return `
Transform the physique in this photo into a believable future-body projection.

Main objective: ${goalInstruction}.
Intensity: ${intensityInstruction}.
${focusBlock}
${customBlock}

Important rules:
- Keep the same person identity.
- Preserve the same pose and general framing.
- Keep the image photorealistic, not illustrated.
- Maintain believable anatomy.
- Do not distort the face.
- Do not make the result cartoonish or fake.
- Keep skin tones natural.
- Keep the background coherent.
- The result must look like a plausible future version of the same person.
- Improve the body visually without changing the person into someone else.

${langBlock}
  `.trim();
}
async function sendCoachReplyPush({ userId, reply, langCode = "fr" }) {
  try {
    if (!userId || userId === "default") return;

    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) return;

    const userData = userSnap.data() || {};
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log("No fcmToken for user:", userId);
      return;
    }

    const titleMap = {
      fr: "Coach IA",
      en: "AI Coach",
      es: "Coach IA",
      it: "Coach IA",
      pt: "Coach IA",
      nl: "AI-coach",
      de: "KI-Coach",
      ar: "المدرب الذكي",
    };

    const bodyMap = {
      fr: "Le coach a répondu à ton message.",
      en: "The coach replied to your message.",
      es: "El coach respondió a tu mensaje.",
      it: "Il coach ha risposto al tuo messaggio.",
      pt: "O coach respondeu à tua mensagem.",
      nl: "De coach heeft op je bericht gereageerd.",
      de: "Der Coach hat auf deine Nachricht geantwortet.",
      ar: "قام المدرب بالرد على رسالتك.",
    };

    const finalLang = titleMap[langCode] ? langCode : "fr";

    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: titleMap[finalLang],
        body: bodyMap[finalLang],
      },
      data: {
        type: "coach",
        route: "coach",
        accentHex: "#FF3B30",
        title_fr: titleMap.fr,
        title_en: titleMap.en,
        title_es: titleMap.es,
        title_it: titleMap.it,
        title_pt: titleMap.pt,
        title_nl: titleMap.nl,
        title_de: titleMap.de,
        title_ar: titleMap.ar,
        body_fr: bodyMap.fr,
        body_en: bodyMap.en,
        body_es: bodyMap.es,
        body_it: bodyMap.it,
        body_pt: bodyMap.pt,
        body_nl: bodyMap.nl,
        body_de: bodyMap.de,
        body_ar: bodyMap.ar,
        coachReply: reply || "",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "nextbody_main_channel",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    });

    console.log("Coach push sent to:", userId);
  } catch (e) {
    console.error("sendCoachReplyPush error", e);
  }
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
    const { message, profile, userId, langCode } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message manquant" });
    }

    const uid = userId || "default";
    if (!memory[uid]) memory[uid] = [];

    const normalizedLang = String(
      langCode || profile?.langCode || "fr"
    ).toLowerCase().trim();

    const supportedLangs = ["fr", "en", "es", "it", "pt", "nl", "de", "ar"];
    const finalLang = supportedLangs.includes(normalizedLang)
      ? normalizedLang
      : "fr";

    const languageMap = {
      fr: "FRANÇAIS",
      en: "ENGLISH",
      es: "SPANISH",
      it: "ITALIAN",
      pt: "PORTUGUESE",
      nl: "DUTCH",
      de: "GERMAN",
      ar: "ARABIC",
    };

    const refusalMap = {
      fr: "Je réponds uniquement aux questions liées au sport, au fitness, à la musculation, au cardio, à la nutrition sportive, à la récupération et à la progression physique.",
      en: "I only answer questions related to sport, fitness, bodybuilding, cardio, sports nutrition, recovery, and physical progress.",
      es: "Solo respondo preguntas relacionadas con el deporte, el fitness, la musculación, el cardio, la nutrición deportiva, la recuperación y el progreso físico.",
      it: "Rispondo solo a domande relative a sport, fitness, muscolazione, cardio, nutrizione sportiva, recupero e progresso fisico.",
      pt: "Respondo apenas a perguntas relacionadas com esporte, fitness, musculação, cardio, nutrição esportiva, recuperação e progresso físico.",
      nl: "Ik beantwoord alleen vragen over sport, fitness, krachttraining, cardio, sportvoeding, herstel en fysieke vooruitgang.",
      de: "Ich beantworte nur Fragen zu Sport, Fitness, Muskelaufbau, Cardio, Sporternährung, Regeneration und körperlichem Fortschritt.",
      ar: "أجيب فقط عن الأسئلة المتعلقة بالرياضة واللياقة وبناء العضلات والكارديو والتغذية الرياضية والاستشفاء والتطور البدني.",
    };

    const systemPrompt = `
You are the official AI coach of the NextBody app.

STRICT RULES:
- Reply only in ${languageMap[finalLang]}.
- You are ONLY allowed to answer questions related to:
  sport, fitness, bodybuilding, workouts, cardio, training plans,
  physical transformation, recovery, stretching, mobility,
  sports nutrition, hydration, calories, macros, healthy eating for performance,
  body composition, discipline, motivation for training.
- If the user asks anything outside those topics, DO NOT answer the actual question.
- Instead, politely refuse in ${languageMap[finalLang]} and redirect the user to ask a sport or nutrition question.
- Never answer general culture, geography, politics, history, school knowledge, news, tech support, or unrelated real-time questions.
- Do not say your data stops in 2023.
- Do not mention model limitations unless necessary.
- Be concise, useful, motivating, and concrete.
- Short to medium answers only.

REFUSAL SENTENCE TO USE FOR OFF-TOPIC REQUESTS:
${refusalMap[finalLang]}

User profile:
- sexe: ${profile?.gender ?? "unknown"}
- age: ${profile?.age ?? "unknown"}
- taille: ${profile?.height_cm ?? "unknown"} cm
- poids: ${profile?.weight_kg ?? "unknown"} kg
- niveau: ${profile?.level ?? "unknown"}
- objectif: ${profile?.goal ?? "unknown"}
- lieu entraînement: ${profile?.place ?? "unknown"}
`.trim();

    memory[uid].push({ role: "user", content: message });
    const history = memory[uid].slice(-10);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 300,
      messages: [{ role: "system", content: systemPrompt }, ...history],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "";
memory[uid].push({ role: "assistant", content: reply });

await sendCoachReplyPush({
  userId: uid,
  reply,
  langCode: finalLang,
});

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
      max_tokens: 1400,
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
  "ratios": {
    "shoulder_to_waist_ratio": "",
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

Règles :
- langue : ${isFr ? "FRANÇAIS" : "ANGLAIS"}
- réaliste
- pas d'exagération
- pas de jugement insultant
- analyser uniquement ce qui est visuellement plausible
- si une donnée n'est pas fiable visuellement, laisse une chaîne vide
- conserve des noms de champs EXACTEMENT identiques à la structure demandée
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
        raw,
      });
    }

    const normalized = normalizePhotoAnalysis(parsed);
    return res.json(normalized);
  } catch (e) {
    console.error("photo-analysis error", e);
    res.status(500).json({
      error: "photo-analysis error",
      details: e?.message || "unknown photo-analysis error",
    });
  }
});

/* =========================
   TRANSFORMATION 6 MOIS / BODYFUTURE
========================= */

app.post("/ai/transform", async (req, res) => {
  try {
    const {
      imageBase64,
      langCode = "fr",
      goal = "",
      focusAreas = [],
      intensity = "",
      customPrompt = "",
    } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "missing imageBase64" });
    }

    const prompt = buildBodyFuturePrompt({
      goal,
      focusAreas,
      intensity,
      customPrompt,
      langCode,
    });

    const imageBuffer = Buffer.from(imageBase64, "base64");

    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: imageBuffer,
      prompt,
      size: "1024x1536",
    });

    const transformedImage = result?.data?.[0]?.b64_json;

    if (!transformedImage) {
      return res.status(500).json({
        error: "transform error",
        details: "No transformed image returned",
      });
    }

    return res.json({
      transformedImage,
      meta: {
        goal,
        focusAreas: Array.isArray(focusAreas) ? focusAreas : [],
        intensity,
        customPrompt,
      },
      promptUsed: prompt,
    });
  } catch (e) {
    console.error("transform error", e);
    return res.status(500).json({
      error: "transform error",
      details: e?.message || "unknown transform error",
    });
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

    return res.json(normalized);
  } catch (e) {
    console.error("meal scan error", e);
    return res.status(500).json({
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