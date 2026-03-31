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

    context.log("Calling LLM gateway...");

    const response = await fetch(process.env.LLM_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.LLM_CLIENT_SECRET}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: input
      })
    });

    const text = await response.text();
    context.log("Gateway response:", text);

    let data = {};
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
          error: data.error || data.raw || "Gateway failed"
        }
      };
      return;
    }

    const reply =
      data.reply ||
      data.output ||
      data.text ||
      data.answer ||
      "No reply returned";

    context.res = {
      status: 200,
      headers,
      body: {
        reply: reply
      }
    };

  } catch (error) {
    context.res = {
      status: 500,
      headers,
      body: {
        error: error.message
      }
    };
  }
};
