import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[MCP BACKEND REQ] ${req.method} ${req.url}`);
  next();
});

const CUSTOMER_BACKEND_URL = process.env.CUSTOMER_BACKEND_URL || "https://customer-backend-stqk.onrender.com";

// Helper to convert JWK from Customer Backend into standard PEM format for JWT verification
let cachedPemPublicKey = null;

async function getPublicKeyFromJWKS() {
  if (cachedPemPublicKey) return cachedPemPublicKey;

  const resKey = await fetch(`${CUSTOMER_BACKEND_URL}/.well-known/jwks.json`);
  if (!resKey.ok) throw new Error(`Failed to fetch JWKS: ${resKey.status}`);
  
  const jwks = await resKey.json();
  const jwk = jwks.keys && jwks.keys[0];
  if (!jwk) throw new Error("No public key found in JWKS");

  // Export JWK to standard public key object and PEM string
  const keyObject = crypto.createPublicKey({ key: jwk, format: "jwk" });
  cachedPemPublicKey = keyObject.export({ type: "spki", format: "pem" });
  return cachedPemPublicKey;
}

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const publicKey = await getPublicKeyFromJWKS();
    
    // Authenticate token cryptographically against RS256 signature
    const verifiedPayload = jwt.verify(token, publicKey, { algorithms: ["RS256"] });

    req.user = verifiedPayload.sub;
    next();
  } catch (err) {
    console.error("[MCP BACKEND AUTH ERROR]", err.message);
    // Invalidate cached key if verification fails to allow key rotation recovery
    cachedPemPublicKey = null;
    return res.status(403).json({ error: "forbidden", message: "Token verification failed" });
  }
};

app.get("/api/v1/projects", authenticateToken, async (req, res) => {
  try {
    const response = await fetch(`${CUSTOMER_BACKEND_URL}/api/data`, {
      headers: { Authorization: req.headers.authorization }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "failed_to_fetch_data" });
    }

    const data = await response.json();

    res.json({
      status: "success",
      user: req.user,
      data: data
    });
  } catch (err) {
    console.error("[MCP BACKEND ERROR]", err.message);
    res.status(500).json({ error: "internal_error" });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`MCP Backend Layer running on port ${port}`));