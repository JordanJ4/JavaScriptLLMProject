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
  const certPath = process.env.NODE_EXTRA_CA_CERTS;

  context.log("NODE_EXTRA_CA_CERTS =", certPath);
  context.log("CERT EXISTS =", fs.existsSync(certPath || ""));
  context.log("REQUEST BODY:", JSON.stringify(req.body));

  try {
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const tokenUrl = process.env.TOKEN_URL;
    const scope = process.env.SCOPE;
    const gatewayUrl = process.env.GATEWAY_URL;

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
        "x-app-name": "Articulate-Storyline",
        "x-model-name": "gpt-5-mini",
        "x-partner-name": "IDStorylineLLMNpr",
        "Content-Type": "application/json"
      },
      JSON.stringify(gatewayPayload),
      ca
    );

    context.log("GATEWAY STATUS:", gatewayResult.status);
    context.log("GATEWAY RESPONSE:", gatewayResult.body);

    const gatewayJson = JSON.parse(gatewayResult.body);

    context.res = {
      status: gatewayResult.status,
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        gaiaResponse: {
          result: gatewayJson.result
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
