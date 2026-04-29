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

    context.log("NODE_EXTRA_CA_CERTS:", process.env.NODE_EXTRA_CA_CERTS);
    context.log("Checking cert path:", certPath);
    context.log("Exists:", fs.existsSync(certPath));

    if (fs.existsSync(certPath)) {
      const firstLine = fs.readFileSync(certPath, "utf8").split("\n")[0];
      context.log("First line:", firstLine);
    }

    if (!gatewayUrl || !jwt || !appName || !modelName || !partnerName || !clientId) {
      context.res = {
        status: 500,
        headers,
        body: {
          error: "Missing required app settings",
          required: [
            "GAIA_GATEWAY_URL",
            "GAIA_JWT",
            "GAIA_APP_NAME",
            "GAIA_MODEL_NAME",
            "GAIA_PARTNER_NAME",
            "GAIA_CLIENT_ID"
          ]
        }
      };
      return;
    }

    if (!fs.existsSync(certPath)) {
      context.res = {
        status: 500,
        headers,
        body: {
          error: "CA certificate file not found",
          certPath
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
      path: url.pathname + (url.search || ""),
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

    if (result.statusCode < 200 || result.statusCode >= 300) {
      context.res = {
        status: result.statusCode,
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

    context.res = {
      status: 500,
      headers,
      body: {
        error: error.message,
        code: error.code || null,
        stack: error.stack
      }
    };
  }
};
