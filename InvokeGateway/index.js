const fs = require("fs");

module.exports = async function (context, req) {
    context.log("NODE_EXTRA_CA_CERTS =", process.env.NODE_EXTRA_CA_CERTS);
    context.log("CERT EXISTS =", fs.existsSync(process.env.NODE_EXTRA_CA_CERTS || ""));

    async function getAccessToken() {
        const encoded = Buffer.from(
            `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
        ).toString("base64");

        const response = await fetch(process.env.TOKEN_URL, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${encoded}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                scope: process.env.SCOPE
            })
        });

        const text = await response.text();

        if (!response.ok) {
            throw new Error(`Token request failed ${response.status}: ${text}`);
        }

        const data = JSON.parse(text);
        return data.access_token;
    }

    try {
        const userInput = req.body?.input;

        if (!userInput) {
            context.res = {
                status: 400,
                body: { error: "Missing input" }
            };
            return;
        }

        const token = await getAccessToken();

        const gatewayUrl = process.env.GATEWAY_URL;

        if (!gatewayUrl) {
            throw new Error("GATEWAY_URL environment variable missing");
        }

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
        context.log.error("AZURE FUNCTION ERROR MESSAGE:", error.message);
        context.log.error("AZURE FUNCTION ERROR CAUSE:", error.cause);
        context.log.error("AZURE FUNCTION ERROR STACK:", error.stack);

        context.res = {
            status: 500,
            body: {
                error: error.message,
                cause: error.cause?.message || null
            }
        };
    }
};
