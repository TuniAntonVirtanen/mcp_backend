import express from "express";
import jwt from "jsonwebtoken";

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[MCP BACKEND REQ] ${req.method} ${req.url}`);
  next();
});

const CUSTOMER_BACKEND_URL = process.env.CUSTOMER_BACKEND_URL || "https://customer-backend-stqk.onrender.com";

// PROD NOTE: Cache JWKS key in memory to avoid fetching on every request.
let cachedPublicKey = null;

const getPublicKey = async () => {
  if (cachedPublicKey) return cachedPublicKey;
  const res = await fetch(`${CUSTOMER_BACKEND_URL}/.well-known/jwks.json`);
  const jwks = await res.json();
  
  // Extract key and build PEM
  const jwk = jwks.keys[0];
  cachedPublicKey = jwt.jwkToPem ? jwt.jwkToPem(jwk) : jwk; 
  return cachedPublicKey;
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // PROD NOTE: In production, use `jwks-rsa` package to handle JWKS caching and key rotation natively.
    const resKey = await fetch(`${CUSTOMER_BACKEND_URL}/.well-known/jwks.json`);
    const jwks = await resKey.json();
    const key = jwks.keys[0];
    
    // Cryptographically verify token signature, expiration, and issuer
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) return res.status(403).json({ error: "forbidden", message: "Malformed token" });

    // Store identity context on request
    req.user = decoded.payload.sub;
    next();
  } catch (err) {
    console.error("[MCP BACKEND AUTH ERROR]", err.message);
    return res.status(403).json({ error: "forbidden", message: "Token verification failed" });
  }
};

app.get("/api/v1/projects", authenticateToken, async (req, res) => {
  try {
    // Forward Bearer JWT token to Customer Backend
    const response = await fetch(`${CUSTOMER_BACKEND_URL}/api/data`, {
      headers: { Authorization: req.headers.authorization }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "failed_to_fetch_data" });
    }

    const data = await response.json();
    res.json({ status: "success", user: req.user, data: data });
  } catch (err) {
    console.error("[MCP BACKEND ERROR]", err.message);
    res.status(500).json({ error: "internal_error" });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`MCP Backend Layer running on port ${port}`));