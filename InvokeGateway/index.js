const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

function httpsPost(url, headers, body, ca) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = typeof body === "string" ? body : JSON.stringify(body);

    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: "POST",
      headers: {
        ...headers,
        "Content-Length": Buffer.byteLength(payload)
      },
      ca
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async function (context, req) {
  // InvokeGateway has no cert of its own; reuse the bundle shipped with coach.
  const certPath =
    process.env.NODE_EXTRA_CA_CERTS ||
    "/home/site/wwwroot/coach/rootca-bundle.cer";

  try {
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const tokenUrl = process.env.TOKEN_URL;
    const scope = process.env.SCOPE;
    const gatewayUrl = process.env.GATEWAY_URL;
    const gaiaClientId = process.env.GAIA_CLIENT_ID || "IDStoryLineLLmProd";
    const gaiaAppName = process.env.GAIA_APP_NAME || "Articulate-Storyline";
    const gaiaModelName = process.env.GAIA_MODEL_NAME || "gpt-5-mini";
    const gaiaPartnerName = process.env.GAIA_PARTNER_NAME || "asurion";

    const requiredSettings = {
      CLIENT_ID: clientId,
      CLIENT_SECRET: clientSecret,
      TOKEN_URL: tokenUrl,
      SCOPE: scope,
      GATEWAY_URL: gatewayUrl,
      NODE_EXTRA_CA_CERTS: certPath
    };

    const missingSettings = Object.entries(requiredSettings)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingSettings.length > 0) {
      throw new Error(`Missing required app settings: ${missingSettings.join(", ")}`);
    }

    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificate file not found at path: ${certPath}`);
    }

    const userInput =
      req.body?.input ||
      req.body?.message ||
      req.body?.text ||
      req.body?.prompt ||
      (typeof req.body === "string" ? req.body : null);

    if (!userInput) {
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { error: "Missing input" }
      };
      return;
    }

    const sessionId = req.body?.sessionId || `storyline-${crypto.randomUUID()}`;

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenResp = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`
    });

    const tokenText = await tokenResp.text();

    if (!tokenResp.ok) {
      throw new Error(`Token request failed. Status: ${tokenResp.status}. Body: ${tokenText}`);
    }

    const tokenJson = JSON.parse(tokenText);
    const accessToken = tokenJson.access_token;

    if (!accessToken) {
      throw new Error("Token response did not include access_token");
    }

    const gatewayPayload = {
      provider: "openai",
      sessionId,
      messages: [
        {
          role: "user",
          id: null,
          content: userInput
        }
      ],
      temperature: 0.0,
      scrub_pii: true
    };

    const ca = fs.readFileSync(certPath, "utf8");

    const gatewayResult = await httpsPost(
      gatewayUrl,
      {
        Authorization: `Bearer ${accessToken}`,
        "x-client-id": gaiaClientId,
        "x-app-name": gaiaAppName,
        "x-model-name": gaiaModelName,
        "x-partner-name": gaiaPartnerName,
        "Content-Type": "application/json"
      },
      JSON.stringify(gatewayPayload),
      ca
    );

    context.log("GATEWAY STATUS:", gatewayResult.status);

    // InvokeGateway returns the gateway response verbatim (unlike coach, which wraps it).
    context.res = {
      status: gatewayResult.status,
      headers: { "Content-Type": "application/json" },
      body: gatewayResult.body
    };
  } catch (error) {
    context.log.error("AZURE FUNCTION ERROR MESSAGE:", error.message);
    context.log.error("AZURE FUNCTION ERROR STACK:", error.stack);

    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: {
        error: error.message,
        cause: error.cause?.message || null
      }
    };
  }
};
