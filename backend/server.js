const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API działa 🚀");
});

app.get("/api/products", (req, res) => {
  res.json([
    {
      id: 1,
      name: "Produkt testowy 1",
      price: 99.99,
      image: "https://via.placeholder.com/300x300?text=Produkt+1"
    },
    {
      id: 2,
      name: "Produkt testowy 2",
      price: 149.99,
      image: "https://via.placeholder.com/300x300?text=Produkt+2"
    }
  ]);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Serwer działa na porcie " + PORT);
});