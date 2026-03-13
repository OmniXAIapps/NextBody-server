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

// Mémoire simple en RAM par utilisateur
const memory = {};

// Route test
app.get("/", (req, res) => {
  res.send("NextBody server OK 🚀");
});

// Route coach IA
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
- pas trop longue
- utile immédiatement

Tu dois toujours :
- adapter tes conseils au profil utilisateur
- proposer des actions simples
- éviter le blabla inutile
- donner des conseils réalistes
- répondre en français

Si l'utilisateur pose une question fitness :
- conseille sur entraînement
- nutrition
- récupération
- régularité

Si l'utilisateur veut perdre du gras :
- parle déficit calorique, activité, protéines

Si l'utilisateur veut prendre du muscle :
- parle surcharge progressive, protéines, récupération, volume d'entraînement

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

    // Garde seulement les derniers messages pour éviter que ça grossisse trop
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

app.listen(PORT, () => {
  console.log(`🚀 NextBody server lancé sur le port ${PORT}`);
});