const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("API działa 🚀");
});

app.get("/api/products", (req, res) => {
  res.json([
    { id: 1, name: "Produkt 1", price: 99 },
    { id: 2, name: "Produkt 2", price: 149 }
  ]);
});

app.listen(PORT, () => {
  console.log("Serwer działa na porcie " + PORT);
});