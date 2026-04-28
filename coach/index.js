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

    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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

    context.res = {
      status: response.status,
      headers,
      body: data
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
