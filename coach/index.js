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

  if (req.method === "GET") {
    context.res = {
      status: 200,
      headers,
      body: {
        reply: "SUCCESS: Azure Function is alive"
      }
    };
    return;
  }

  context.res = {
    status: 200,
    headers,
    body: {
      reply: "SUCCESS: Storyline reached Azure Function"
    }
  };
};
