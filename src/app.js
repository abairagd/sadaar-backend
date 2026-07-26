const express = require("express");
const cors = require("cors");

const brandsRoutes = require("./routes/brands");
const productsRoutes = require("./routes/products");
const ordersRoutes = require("./routes/orders");

const app = express();

app.use(cors({
     origin: "*",
     methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
     allowedHeaders: ["Content-Type", "Authorization"],
   }));
   app.options("*", cors());
   app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/brands", brandsRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/orders", ordersRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found." }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

module.exports = app;
