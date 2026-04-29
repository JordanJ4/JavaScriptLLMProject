const fs = require("fs");
const https = require("https");

module.exports = async function (context, req) {
  const origin = req.headers.origin || "*";

  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers
    };
    return;
  }

  try {
    const { input } = req.body || {};

    if (!input) {
      context.res = {
        status: 400,
        headers,
        body: { error: "Missing input" }
      };
      return;
    }

    const certPath = "/home/site/wwwroot/coach/rootca.cer";
    const gatewayUrl = process.env.GAIA_GATEWAY_URL;
    const jwt = process.env.GAIA_JWT;
    const appName = process.env.GAIA_APP_NAME;
    const modelName = process.env.GAIA_MODEL_NAME;
    const partnerName = process.env.GAIA_PARTNER_NAME;
    const clientId = process.env.GAIA_CLIENT_ID;

    // ===== DEBUG LOGS =====
    context.log("===== GAIA DEBUG START =====");

    context.log("GAIA_GATEWAY_URL:", gatewayUrl);
    context.log("GAIA_APP_NAME:", appName);
    context.log("GAIA_MODEL_NAME:", modelName);
    context.log("GAIA_PARTNER_NAME:", partnerName);
    context.log("GAIA_CLIENT_ID:", clientId);

    context.log("JWT length:", jwt ? jwt.length : "missing");
    context.log("JWT starts with:", jwt ? jwt.substring(0, 20) : "missing");

    context.log("Cert exists:", fs.existsSync(certPath));

    context.log("===== GAIA DEBUG END =====");
    // ======================

    if (!gatewayUrl || !jwt || !appName || !modelName || !partnerName || !clientId) {
      context.res = {
        status: 500,
        headers,
        body: {
          error: "Missing required app settings"
        }
      };
      return;
    }

    const caCert = fs.readFileSync(certPath, "utf8");

    const payload = JSON.stringify({
      sessionId: "test",
      provider: "openai",
      messages: [
        {
          role: "user",
          content: input
        }
      ]
    });

    const url = new URL(gatewayUrl);

    const options = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: "POST",
      ca: caCert,
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "x-app-name": appName,
        "x-model-name": modelName,
        "x-partner-name": partnerName,
        "x-client-id": clientId
      }
    };

    context.log("Sending headers:", {
      "x-app-name": appName,
      "x-model-name": modelName,
      "x-partner-name": partnerName,
      "x-client-id": clientId
    });

    const result = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          resolve({
            statusCode: response.statusCode || 500,
            body
          });
        });
      });

      request.on("error", reject);
      request.write(payload);
      request.end();
    });

    context.log("GAIA raw response:", result.body);

    let data;
    try {
      data = JSON.parse(result.body);
    } catch {
      data = { raw: result.body };
    }

    context.res = {
      status: result.statusCode,
      headers,
      body: {
        debug: true,
        gaiaResponse: data
      }
    };

  } catch (error) {
    context.log("Full error:", error);

    context.res = {
      status: 500,
      headers,
      body: {
        error: error.message
      }
    };
  }
};
