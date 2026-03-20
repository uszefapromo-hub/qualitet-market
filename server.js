const express = require("express");
const cors = require("cors");
const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API działa 🚀");
});

app.get("/api/products", (req, res) => {
  res.json([
    { id: 1, name: "Produkt 1", price: 99 },
    { id: 2, name: "Produkt 2", price: 149 }
  ]);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Serwer działa na porcie " + PORT);
});
