module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

  context.log("FUNCTION HIT");
  context.log("METHOD:", req.method);

  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    };
    return;
  }

  if (req.method === "GET") {
    context.res = {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Content-Type": "application/json"
      },
      body: {
        reply: "SUCCESS: Azure Function is alive"
      }
    };
    return;
  }

  context.res = {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Content-Type": "application/json"
    },
    body: {
      reply: "SUCCESS: Storyline reached Azure Function"
    }
  };
};
