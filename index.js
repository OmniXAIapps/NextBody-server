const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const client = new OpenAI({
apiKey: process.env.OPENAI_API_KEY,
});

// TEST SERVEUR
app.get("/", (req, res) => {
res.send("NextBody server OK 🚀");
});

// ROUTE COACH IA (vraie IA)
app.post("/ai/coach", async (req, res) => {
try {
const { message } = req.body;

```
if (!message || !message.trim()) {
  return res.status(400).json({ error: "Message manquant" });
}

const completion = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content:
        "Tu es le coach IA de NextBody. Réponds en français de manière claire, motivante, concise et utile. Donne des conseils fitness et nutrition réalistes.",
    },
    {
      role: "user",
      content: message,
    },
  ],
  temperature: 0.7,
  max_tokens: 300,
});

const reply =
  completion.choices?.[0]?.message?.content?.trim() ||
  "Je n’ai pas pu générer de réponse.";

return res.json({ reply });
```

} catch (error) {
console.error("Erreur OpenAI:", error);
return res.status(500).json({
error: "Erreur serveur IA",
});
}
});

app.listen(PORT, () => {
console.log(`🚀 NextBody server lancé sur le port ${PORT}`);
});