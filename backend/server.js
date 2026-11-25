const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

// Security headers (basic)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Import routers
const authRoutes = require("./routes/authRoutes");
const wargaRoutes = require("./routes/wargaRoutes");
const examinationRoutes = require("./routes/examinationRoutes");

// Mount routers
app.use("/api/auth", authRoutes);
app.use("/api/warga", wargaRoutes);
app.use("/api/examinations", examinationRoutes);

// Simple health check
app.get("/", (req, res) => {
  res.json({
    message: "Backend CareLog berhasil berjalan!"
  });
});

// Start server only when this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server CareLog berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
