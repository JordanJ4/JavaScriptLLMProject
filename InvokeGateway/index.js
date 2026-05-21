const fs = require("fs");

module.exports = async function (context, req) {
    context.log("NODE_EXTRA_CA_CERTS =", process.env.NODE_EXTRA_CA_CERTS);
    context.log("CERT EXISTS =", fs.existsSync(process.env.NODE_EXTRA_CA_CERTS || ""));

    async function getAccessToken() {
        context.log("ABOUT TO REQUEST TOKEN:", process.env.TOKEN_URL);

        const encoded = Buffer.from(
            `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
        ).toString("base64");

        const tokenResponse = await fetch(process.env.TOKEN_URL, {
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

        const tokenText = await tokenResponse.text();

        context.log("TOKEN STATUS:", tokenResponse.status);

        if (!tokenResponse.ok) {
            throw new Error(`Token request failed ${tokenResponse.status}: ${tokenText}`);
        }

        const tokenData = JSON.parse(tokenText);

        if (!tokenData.access_token) {
            throw new Error("Token response did not include access_token");
        }

        context.log("TOKEN RECEIVED: yes");

        return tokenData.access_token;
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

        const gatewayUrl = process.env.GATEWAY_URL;

        if (!gatewayUrl) {
            throw new Error("GATEWAY_URL environment variable missing");
        }

        const token = await getAccessToken();

        context.log("ABOUT TO CALL GATEWAY:", gatewayUrl);

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

        const gatewayText = await gatewayResponse.text();

        context.log("GATEWAY STATUS:", gatewayResponse.status);

        context.res = {
            status: gatewayResponse.status,
            headers: {
                "Content-Type": "application/json"
            },
            body: gatewayText
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
