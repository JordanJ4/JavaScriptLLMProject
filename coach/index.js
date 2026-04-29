module.exports = async function (context, req) {
  const fs = require("fs");

  const origin = req.headers.origin || "*";

  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  // Handle CORS preflight
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

    // ===== DEBUG CERT LOADING =====
    const certPath = "/home/site/wwwroot/coach/rootca.cer";

    context.log("NODE_EXTRA_CA_CERTS:", process.env.NODE_EXTRA_CA_CERTS);
    context.log("Checking cert path:", certPath);
    context.log("Exists:", fs.existsSync(certPath));

    if (fs.existsSync(certPath)) {
      const firstLine = fs.readFileSync(certPath, "utf8").split("\n")[0];
      context.log("First line:", firstLine);
    }
    // ==============================

    const gatewayUrl = process.env.GAIA_GATEWAY_URL;
    const jwt = process.env.GAIA_JWT;
    const appName = process.env.GAIA_APP_NAME;
    const modelName = process.env.GAIA_MODEL_NAME;
    const partnerName = process.env.GAIA_PARTNER_NAME;
    const clientId = process.env.GAIA_CLIENT_ID;

    if (!gatewayUrl || !jwt) {
      context.res = {
        status: 500,
        headers,
        body: {
          error: "Missing GAIA settings",
          required: ["GAIA_GATEWAY_URL", "GAIA_JWT"]
        }
      };
      return;
    }

    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "x-app-name": appName,
        "x-model-name": modelName,
        "x-partner-name": partnerName,
        "x-client-id": clientId
      },
      body: JSON.stringify({
        sessionId: "test",
        provider: "openai",
        messages: [
          {
            role: "user",
            content: input
          }
        ]
      })
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      context.res = {
        status: response.status,
        headers,
        body: {
          error: "GAIA request failed",
          details: data
        }
      };
      return;
    }

    const reply =
      data.reply ||
      data.output ||
      data.text ||
      data.answer ||
      data.choices?.[0]?.message?.content ||
      "No reply returned";

    context.res = {
      status: 200,
      headers,
      body: {
        reply,
        raw: data
      }
    };

  } catch (error) {
    context.log("Full error:", error);
    context.log("Cause:", error.cause);

    context.res = {
      status: 500,
      headers,
      body: {
        error: error.message,
        cause: error.cause ? {
          message: error.cause.message,
          code: error.cause.code,
          name: error.cause.name
        } : null,
        stack: error.stack
      }
    };
  }
};
