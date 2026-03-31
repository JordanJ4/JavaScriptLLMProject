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

    const openaiResponse = await fetch(process.env.LLM_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "Return a short helpful response for an e-learning prototype."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: input
              }
            ]
          }
        ]
      })
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      context.res = {
        status: openaiResponse.status,
        headers,
        body: {
          error: data?.error?.message || "OpenAI request failed"
        }
      };
      return;
    }

    let reply = "";

    if (typeof data.output_text === "string") {
      reply = data.output_text.trim();
    } else if (Array.isArray(data.output)) {
      const parts = [];
      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          for (const content of item.content) {
            if (content.type === "output_text" && content.text) {
              parts.push(content.text);
            }
          }
        }
      }
      reply = parts.join("\n").trim();
    }

    context.res = {
      status: 200,
      headers,
      body: {
        reply: reply || "No reply returned"
      }
    };
  } catch (error) {
    context.res = {
      status: 500,
      headers,
      body: {
        error: error.message || "Server error"
      }
    };
  }
};
