module.exports = async function (context, req) {
  try {
    const clientId = process.env.SSO_CLIENT_ID;
    const clientSecret = process.env.SSO_CLIENT_SECRET;
    const tokenUrl = process.env.SSO_TOKEN_URL;
    const scope = process.env.SSO_SCOPE;
    const gatewayUrl = process.env.LLM_GATEWAY_URL;

    if (!clientId || !clientSecret || !tokenUrl || !scope || !gatewayUrl) {
      context.res = {
        status: 500,
        body: {
          error: "Missing required environment variables."
        }
      };
      return;
    }

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

    let tokenJson;
    try {
      tokenJson = JSON.parse(tokenText);
    } catch (err) {
      context.res = {
        status: 502,
        body: {
          error: "Token endpoint did not return valid JSON.",
          rawResponse: tokenText
        }
      };
      return;
    }

    const accessToken = tokenJson.access_token;

    if (!accessToken) {
      context.res = {
        status: 502,
        body: {
          error: "Token response did not include access_token.",
          tokenResponse: tokenJson
        }
      };
      return;
    }

    const gatewayPayload = {
      provider: "openai",
      sessionId: "test-session",
      messages: [
        {
          role: "system",
          id: null,
          content: "Hello"
        }
      ],
      temperature: 0.0,
      scrub_pii: true
    };

    const gatewayResp = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-app-name": "IDStoryLine",
        "x-model-name": "gpt-4o-mini",
        "x-partner-name": "IDStoryLine",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(gatewayPayload)
    });

    const gatewayText = await gatewayResp.text();

    context.res = {
      status: gatewayResp.status,
      headers: {
        "Content-Type": "application/json"
      },
      body: gatewayText
    };
  } catch (error) {
    context.log("Function error:", error);

    context.res = {
      status: 500,
      body: {
        error: "Unexpected error running function.",
        message: error.message
      }
    };
  }
};
