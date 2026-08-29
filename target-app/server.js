const express = require("express");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "proofloop-target-app" });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`target-app listening on http://localhost:${port}`);
});
