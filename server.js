import express from "express";

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[MCP BACKEND REQ] ${req.method} ${req.url}`);
  next();
});

const EXPECTED_TOKEN = process.env.EXPECTED_TOKEN || "mock_access_token_9999";
const CUSTOMER_BACKEND_URL = process.env.CUSTOMER_BACKEND_URL || "https://customer-backend-stqk.onrender.com";

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  if (token !== EXPECTED_TOKEN) {
    return res.status(403).json({ error: "forbidden" });
  }

  next();
};

app.get("/api/v1/projects", authenticateToken, async (req, res) => {
  try {
    // Relay request to Customer Backend to fetch real data
    const response = await fetch(`${CUSTOMER_BACKEND_URL}/api/data`, {
      headers: { Authorization: req.headers.authorization }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "failed_to_fetch_data" });
    }

    const data = await response.json();

    res.json({
      status: "success",
      data: data
    });
  } catch (err) {
    console.error("[MCP BACKEND ERROR]", err.message);
    res.status(500).json({ error: "internal_error" });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`MCP Backend Layer running on port ${port}`));