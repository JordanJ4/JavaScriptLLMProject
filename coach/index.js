const axios = require("axios");

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

    const gatewayUrl = process.env.GAIA_GATEWAY_URL;
    const jwt = process.env.GAIA_JWT;

    if (!gatewayUrl) {
      context.res = {
        status: 500,
        headers,
        body: { error: "Missing GAIA_GATEWAY_URL app setting" }
      };
      return;
    }

    if (!jwt) {
      context.res = {
        status: 500,
        headers,
        body: { error: "Missing GAIA_JWT app setting" }
      };
      return;
    }

    context.log("Calling GAIA gateway...");
    context.log("GAIA_GATEWAY_URL:", gatewayUrl);
    context.log("JWT exists:", !!jwt);
    context.log("JWT first 20 chars:", jwt ? jwt.substring(0, 20) : "missing");

    const response = await axios.post(
      gatewayUrl,
      {
        messages: [
          {
            role: "user",
            content: input
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const data = response.data;

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
    context.log("Error message:", error.message);
    context.log("Error status:", error.response?.status);
    context.log("Error response data:", error.response?.data);

    context.res = {
      status: error.response?.status || 500,
      headers,
      body: {
        error: error.message,
        status: error.response?.status || null,
        details: error.response?.data || null
      }
    };
  }
};
