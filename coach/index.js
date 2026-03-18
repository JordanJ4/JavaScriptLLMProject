module.exports = async function (context, req) {
      try {
        const { input, persona, scenario } = req.body || {};

        if (!input) {
          context.res = {
            status: 400,
            jsonBody: { error: "Missing input" }
          };
          return;
        }

        context.res = {
          status: 200,
          jsonBody: {
            reply: "• Acknowledge the concern
• Reference policy
• Offer next steps"
          }
        };
      } catch (err) {
        context.res = {
          status: 500,
          jsonBody: { error: "Server error" }
        };
      }
    };