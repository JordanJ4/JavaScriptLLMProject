async function getAccessToken() {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const tokenUrl = process.env.TOKEN_URL;
  const scope = process.env.SCOPE;

  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${encoded}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: scope
    })
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

module.exports = async function (context, req) {
  try {

    // GET FRESH TOKEN
    const token = await getAccessToken();

    // CALL LLM GATEWAY
    const response = await fetch("GATEWAY_URL", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    context.res = {
      status: 200,
      body: data
    };

  } catch (error) {
    context.log.error("AZURE FUNCTION ERROR:", error);

    context.res = {
      status: 500,
      body: error.message
    };
  }
};
