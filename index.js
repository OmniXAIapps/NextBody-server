const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("NextBody server OK 🚀");
});

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

Analyse le physique d'une personne à partir d'une photo.

Réponds uniquement en JSON avec cette structure :

{
 "body_fat": "",
 "body_type": "",
 "physique_level": "",
 "strengths": [],
 "weaknesses": [],
 "posture": ""
}
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
      max_tokens: 500
    });

    const result = completion.choices[0].message.content;

    res.json(JSON.parse(result));

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Erreur analyse IA"
    });

  }
});

app.listen(PORT, () => {
  console.log(`🚀 NextBody server lancé sur ${PORT}`);
});