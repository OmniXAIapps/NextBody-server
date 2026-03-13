const express = require("express");
const cors = require("cors");
require("dotenv").config();
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Mémoire simple en RAM par utilisateur pour le coach
const memory = {};

// Route test
app.get("/", (req, res) => {
  res.send("NextBody server OK 🚀");
});

// =========================
// COACH IA
// =========================
app.post("/ai/coach", async (req, res) => {
  try {
    const { message, profile, userId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message manquant" });
    }

    const safeUserId = userId || "default_user";

    if (!memory[safeUserId]) {
      memory[safeUserId] = [];
    }

    const systemPrompt = `
Tu es le coach officiel de l'application NextBody.

Ton rôle :
- coach fitness
- coach nutrition
- motivateur
- accompagnateur progression

Ta manière de répondre :
- claire
- motivante
- concrète
- utile immédiatement
- pas trop longue
- en français

Tu dois toujours :
- adapter tes conseils au profil utilisateur
- proposer des actions simples
- éviter le blabla inutile
- donner des conseils réalistes

Profil utilisateur :
- sexe : ${profile?.gender ?? "non renseigné"}
- âge : ${profile?.age ?? "non renseigné"}
- taille : ${profile?.height_cm ?? "non renseigné"} cm
- poids : ${profile?.weight_kg ?? "non renseigné"} kg
- niveau : ${profile?.level ?? "non renseigné"}
- lieu d'entraînement : ${profile?.place ?? "non renseigné"}

Tu représentes la marque NextBody.
`;

    memory[safeUserId].push({
      role: "user",
      content: message,
    });

    const recentMessages = memory[safeUserId].slice(-10);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...recentMessages,
      ],
      temperature: 0.7,
      max_tokens: 350,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Je n’ai pas pu générer de réponse.";

    memory[safeUserId].push({
      role: "assistant",
      content: reply,
    });

    return res.json({ reply });
  } catch (error) {
    console.error("Erreur OpenAI:", error);
    return res.status(500).json({ error: "Erreur IA" });
  }
});

// =========================
// GENERATEUR DE PROGRAMME IA
// =========================
app.post("/ai/program", async (req, res) => {
  try {
    const {
      gender,
      age,
      height_cm,
      weight_kg,
      level,
      place,
      objective,
      days_per_week,
      lang,
    } = req.body;

    const fr = lang !== "en";

    if (
      !gender ||
      !age ||
      !height_cm ||
      !weight_kg ||
      !level ||
      !place ||
      !objective ||
      !days_per_week
    ) {
      return res.status(400).json({ error: "Données incomplètes" });
    }

    const prompt = `
Tu génères un programme fitness structuré pour l'application NextBody.

Réponds UNIQUEMENT en JSON valide.
Ne mets aucun texte avant ou après le JSON.
Pas de markdown.
Pas de balises.
Pas d'explication hors JSON.

Langue de sortie: ${fr ? "français" : "anglais"}.

Données utilisateur :
- gender: ${gender}
- age: ${age}
- height_cm: ${height_cm}
- weight_kg: ${weight_kg}
- level: ${level}
- place: ${place}
- objective: ${objective}
- days_per_week: ${days_per_week}

Le JSON doit avoir EXACTEMENT cette structure :

{
  "gender": "male",
  "age": 25,
  "height_cm": 175,
  "weight_kg": 70,
  "level": "beginner",
  "place": "home",
  "objective": "muscle_gain",
  "days_per_week": 3,
  "lang": "fr",
  "goal_label": "Prise de masse",
  "place_label": "Maison",
  "level_label": "Débutant",
  "bmi": "22.9",
  "calories": 2400,
  "protein_g": 130,
  "carbs_g": 250,
  "fat_g": 70,
  "progression_bullets": ["...", "...", "..."],
  "nutrition_bullets": ["...", "...", "..."],
  "bonus_bullets": ["...", "...", "..."],
  "sessions": [
    {
      "title": "Jour 1 — Haut du corps",
      "focus_note": "Pecs/dos/épaules + bras.",
      "finisher": "10 min cardio léger",
      "exercises": [
        { "name": "Pompes", "sets_reps_rest": "4×8–12, repos 90s" },
        { "name": "Row haltère", "sets_reps_rest": "4×8–12, repos 90s" }
      ]
    }
  ]
}

Règles :
- retourne un JSON utilisable directement par l'app
- sessions réalistes selon objectif, niveau, lieu et fréquence
- si place = home, n'utilise pas d'exercices impossibles sans matériel de base
- si objective = muscle_gain, mets l'accent sur hypertrophie, protéines, récupération
- si objective = fat_loss, mets l'accent sur déficit calorique, densité, activité
- bullets courtes et concrètes
- entre 2 et 5 sessions selon days_per_week
- chaque session doit avoir :
  - title
  - focus_note
  - finisher
  - exercises (au moins 4)
- chaque exercice doit avoir :
  - name
  - sets_reps_rest
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Tu es un générateur de programmes fitness JSON pour l'app NextBody.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1800,
    });

    const raw =
      completion.choices?.[0]?.message?.content?.trim() || "";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("JSON OpenAI invalide:", raw);
      return res.status(500).json({ error: "JSON IA invalide" });
    }

    return res.json(parsed);
  } catch (error) {
    console.error("Erreur génération programme:", error);
    return res.status(500).json({ error: "Erreur génération programme" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 NextBody server lancé sur le port ${PORT}`);
});