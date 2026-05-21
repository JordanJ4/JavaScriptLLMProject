const fs = require("fs");
const { Agent } = require("undici");

module.exports = async function (context, req) {
  const certPath = process.env.NODE_EXTRA_CA_CERTS;

  context.log("NODE_EXTRA_CA_CERTS =", certPath);
  context.log("CERT EXISTS =", fs.existsSync(certPath || ""));

  try {
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const tokenUrl = process.env.TOKEN_URL;
    const scope = process.env.SCOPE;
    const gatewayUrl = process.env.GATEWAY_URL;

    const userInput = req.body?.input;

    if (!userInput) {
      context.res = {
        status: 400,
        body: { error: "Missing input" }
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
          role: "system",
          id: null,
          content: userInput
        }
      ],
      temperature: 0.0,
      scrub_pii: true
    };

    context.log("ABOUT TO CALL GATEWAY:", gatewayUrl);

    const ca = fs.readFileSync(certPath, "utf8");
    const dispatcher = new Agent({ connect: { ca } });

    const gatewayResp = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-app-name": "IDStoryLine",
        "x-model-name": "gpt-4o-mini",
        "x-partner-name": "IDStoryLine",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(gatewayPayload),
      dispatcher
    });

    const gatewayText = await gatewayResp.text();
    context.log("GATEWAY STATUS:", gatewayResp.status);

    context.res = {
      status: gatewayResp.status,
      headers: {
        "Content-Type": "application/json"
      },
      body: gatewayText
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
