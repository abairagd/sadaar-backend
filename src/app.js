const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const brandsRoutes = require("./routes/brands");
const productsRoutes = require("./routes/products");
const ordersRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");
const configRoutes = require("./routes/config");
const discountsRoutes = require("./routes/discounts");
const { generalLimiter } = require("./middleware/rateLimiters");
const supportRoutes = require("./routes/support");
const spotlightRoutes = require("./routes/spotlight");
const customersRoutes = require("./routes/customers");


const app = express();

app.use(helmet());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options("*", cors());
app.use(express.json({ limit: "100kb" }));
app.use(generalLimiter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/brands", brandsRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/config", configRoutes);
app.use("/api/discounts", discountsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/spotlight", spotlightRoutes);
app.use("/api/customers", customersRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found." }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

module.exports = app;
