const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = 3000;

// MOCK PRODUKTY (na start)
const products = [
  {
    id: 1,
    name: "AirPods Pro",
    price: 499,
    image: "https://via.placeholder.com/300",
  },
  {
    id: 2,
    name: "iPhone 13",
    price: 2999,
    image: "https://via.placeholder.com/300",
  },
  {
    id: 3,
    name: "Nike Shoes",
    price: 399,
    image: "https://via.placeholder.com/300",
  },
];

// endpoint
app.get("/api/products", (req, res) => {
  res.json(products);
});

app.listen(PORT, () => {
  console.log("API działa na http://localhost:" + PORT);
});
