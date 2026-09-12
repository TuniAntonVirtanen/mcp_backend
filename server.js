import express from "express";

const app = express();
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[MCP BACKEND REQ] ${req.method} ${req.url}`);
  next();
});

const EXPECTED_TOKEN = process.env.EXPECTED_TOKEN || "mock_access_token_9999";

// Middleware to authorize incoming requests from MCP App
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  if (token !== EXPECTED_TOKEN) {
    console.log(`[MCP BACKEND AUTH] Invalid token: ${token}`);
    return res.status(403).json({ error: "forbidden" });
  }

  next();
};

// Internal domain REST endpoint called by MCP App
app.get("/api/v1/projects", authenticateToken, (req, res) => {
  // Perform business logic, scrub data, or query Customer Backend endpoints here
  console.log("[MCP BACKEND] Fetching project data...");
  
  res.json({
    status: "success",
    summary: `🎉 Successfully retrieved Customer Data for user "user"! Active Sprint: 12 completed tasks, 3 in progress.`,
    data: {
      completedTasks: 12,
      inProgressTasks: 3,
      user: "user"
    }
  });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`MCP Backend Layer running on port ${port}`));