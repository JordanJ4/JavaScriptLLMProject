module.exports = async function (context, req) {

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
            const errorText = await response.text();
            throw new Error(`Token request failed ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        if (!data.access_token) {
            throw new Error("No access token returned");
        }

        return data.access_token;
    }

    try {

        const userInput = req.body?.input || "Hello";

        // GET NEW TOKEN
        const token = await getAccessToken();

        // GET GATEWAY URL FROM ENV VARIABLE
        const gatewayUrl = process.env.GATEWAY_URL;

        if (!gatewayUrl) {
            throw new Error("GATEWAY_URL environment variable missing");
        }

        // CALL LLM GATEWAY
        const gatewayResponse = await fetch(gatewayUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                input: userInput
            })
        });

        const responseText = await gatewayResponse.text();

        context.res = {
            status: gatewayResponse.status,
            headers: {
                "Content-Type": "application/json"
            },
            body: responseText
        };

    } catch (error) {

        context.log.error("AZURE FUNCTION ERROR:", error);

        context.res = {
            status: 500,
            body: {
                error: error.message
            }
        };
    }
};
