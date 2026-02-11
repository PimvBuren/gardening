const express = require("express");
const path = require("path");
const app = express();

// Zorgt dat alle bestanden in deze map bereikbaar zijn
app.use(express.static(__dirname));

// Optioneel: route "/" → index.html automatisch
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Optioneel: route "/admin" → admin.html
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.listen(3000, () => {
  console.log("Server draait op http://localhost:3000");
});
