module.exports = async function (context, req) {
  context.log("InvokeGateway function started.");

  try {
    const userInput = req.body?.input;

    if (!userInput) {
      return {
        status: 400,
        body: JSON.stringify({
          error: "Missing input"
        })
      };
    }

    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const tokenUrl = process.env.TOKEN_URL;
    const gatewayUrl = process.env.GATEWAY_URL;
    const scope = process.env.SCOPE;

    if (!clientId || !clientSecret || !tokenUrl || !gatewayUrl || !scope) {
      throw new Error("Missing one or more required environment variables.");
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`
    });

    const tokenText = await tokenResponse.text();

    if (!tokenResponse.ok) {
      context.log.error("Token request failed:", tokenResponse.status, tokenText);
      throw new Error(`Token request failed: ${tokenResponse.status}`);
    }

    const tokenData = JSON.parse(tokenText);
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("No access_token returned from token endpoint.");
    }

    const gatewayBody = {
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI coach for training and learning scenarios."
        },
        {
          role: "user",
          content: userInput
        }
      ]
    };

    const gatewayResponse = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(gatewayBody)
    });

    const gatewayText = await gatewayResponse.text();

    if (!gatewayResponse.ok) {
      context.log.error("Gateway request failed:", gatewayResponse.status, gatewayText);
      throw new Error(`Gateway request failed: ${gatewayResponse.status} - ${gatewayText}`);
    }

    const gatewayData = JSON.parse(gatewayText);

    const output =
      gatewayData.choices?.[0]?.message?.content ||
      gatewayData.output_text ||
      gatewayData.response ||
      JSON.stringify(gatewayData);

    return {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        output: output
      })
    };

  } catch (error) {
    context.log.error("Function failed:", error.message);
    context.log.error("Stack:", error.stack);

    return {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Backend error",
        message: error.message
      })
    };
  }
};
