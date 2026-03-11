const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// TEST SERVEUR
app.get("/", (req, res) => {
  res.send("NextBody server OK 🚀");
});

// ROUTE IA (test)
app.post("/ai/coach", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message manquant" });
  }

  // Pour l’instant on simule l’IA
  res.json({
    reply: `Coach IA : j’ai bien reçu ➜ "${message}"`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 NextBody server lancé sur le port ${PORT}`);
});
