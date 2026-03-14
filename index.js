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

Profil utilisateur :

sexe: ${profile?.gender ?? "inconnu"}
age: ${profile?.age ?? "inconnu"}
taille: ${profile?.height_cm ?? "inconnu"} cm
poids: ${profile?.weight_kg ?? "inconnu"} kg
niveau: ${profile?.level ?? "inconnu"}
lieu entrainement: ${profile?.place ?? "inconnu"}
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
        ...history
      ],

      temperature: 0.7,
      max_tokens: 300,

    });

    const reply = completion.choices[0].message.content;

    memory[uid].push({
      role: "assistant",
      content: reply,
    });

    res.json({ reply });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Erreur coach IA"
    });

  }

});



// ======================
// ANALYSE PHOTO IA
// ======================

app.post("/ai/photo-analysis", async (req, res) => {

  try {

    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        error: "Image manquante"
      });
    }

    const completion = await openai.chat.completions.create({

      model: "gpt-4o-mini",

      messages: [

        {
          role: "system",
          content: `
Tu es un coach fitness expert en analyse physique.

Analyse le physique visible sur la photo.

Réponds uniquement en JSON.

Structure obligatoire :

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

Tout doit être en FRANÇAIS.
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

      max_tokens: 800

    });

    const raw = completion.choices[0].message.content.trim();

    let parsed;

    try {

      parsed = JSON.parse(raw);

    } catch {

      console.log("JSON IA invalide:", raw);

      return res.status(500).json({
        error: "JSON invalide"
      });

    }

    res.json(parsed);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Erreur analyse IA"
    });

  }

});



app.listen(PORT, () => {

  console.log(`🚀 NextBody server lancé sur le port ${PORT}`);

});