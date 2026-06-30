const fs = require("fs");
const https = require("https");

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
  const certPath =
    process.env.NODE_EXTRA_CA_CERTS ||
    "/home/site/wwwroot/coach/rootca-bundle.cer";

  context.log("NODE_EXTRA_CA_CERTS =", certPath);
  context.log("CERT EXISTS =", fs.existsSync(certPath || ""));
  context.log("REQUEST BODY:", JSON.stringify(req.body));

  try {
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const tokenUrl = process.env.TOKEN_URL;
    const scope = process.env.SCOPE;
    const gatewayUrl = process.env.GATEWAY_URL;
    const gaiaClientId = process.env.GAIA_CLIENT_ID || "IDStoryLineLLmProd";
    const gaiaAppName = process.env.GAIA_APP_NAME || "Articulate-Storyline";
    const gaiaModelName = process.env.GAIA_MODEL_NAME || "gpt-5-mini";

    const requiredSettings = {
      CLIENT_ID: clientId,
      CLIENT_SECRET: clientSecret,
      TOKEN_URL: tokenUrl,
      SCOPE: scope,
      GATEWAY_URL: gatewayUrl,
      NODE_EXTRA_CA_CERTS: certPath,
      GAIA_CLIENT_ID: gaiaClientId,
      GAIA_APP_NAME: gaiaAppName,
      GAIA_MODEL_NAME: gaiaModelName
    };

    const missingSettings = Object.entries(requiredSettings)
      .filter(([key, value]) => !value)
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

    context.log("USER INPUT:", userInput);

    if (!userInput) {
      context.res = {
        status: 400,
        body: { error: "Missing input", receivedBody: req.body }
      };
      return;
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    context.log("ABOUT TO REQUEST TOKEN:", tokenUrl);

    const tokenResp = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`
    });

    const tokenText = await tokenResp.text();
    context.log("TOKEN STATUS:", tokenResp.status);

    if (!tokenResp.ok) {
      throw new Error(`Token request failed. Status: ${tokenResp.status}. Body: ${tokenText}`);
    }

    const tokenJson = JSON.parse(tokenText);
    const accessToken = tokenJson.access_token;

    if (!accessToken) {
      throw new Error("Token response did not include access_token");
    }

    context.log("TOKEN RECEIVED: yes");

    const gatewayPayload = {
      provider: "openai",
      sessionId: "storyline-session",
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

    context.log("ABOUT TO CALL GATEWAY:", gatewayUrl);

    const ca = fs.readFileSync(certPath, "utf8");

   const gatewayResult = await httpsPost(
  gatewayUrl,
  {
    Authorization: `Bearer ${accessToken}`,
    "x-client-id": process.env.GAIA_CLIENT_ID || "IDStoryLineLLmProd",
    "x-app-name": process.env.GAIA_APP_NAME || "Articulate-Storyline",
    "x-model-name": process.env.GAIA_MODEL_NAME || "gpt-5-mini",
    "x-partner-name": process.env.GAIA_PARTNER_NAME || "asurion",
    "Content-Type": "application/json"
  },
  JSON.stringify(gatewayPayload),
  ca
);

    context.log("GATEWAY STATUS:", gatewayResult.status);
    context.log("GATEWAY RESPONSE:", gatewayResult.body);

    let gatewayJson;
    try {
      gatewayJson = JSON.parse(gatewayResult.body);
    } catch {
      gatewayJson = { rawResponse: gatewayResult.body };
    }

    context.res = {
      status: gatewayResult.status,
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        gaiaResponse: {
          result: gatewayJson.result || gatewayJson.rawResponse || gatewayJson
        }
      }
    };
  } catch (error) {
    context.log.error("AZURE FUNCTION ERROR MESSAGE:", error.message);
    context.log.error("AZURE FUNCTION ERROR CAUSE:", error.cause);
    context.log.error("AZURE FUNCTION ERROR STACK:", error.stack);

    context.res = {
      status: 500,
      body: {
        error: error.message,
        cause: error.cause?.message || null
      }
    };
  }
};
