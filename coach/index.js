module.exports = async function (context, req) {
  try {
    const { input, persona, scenario } = req.body || {};

    if (!input) {
      context.res = {
        status: 400,
        body: { error: "Missing input" }
      };
      return;
    }

    context.res = {
      status: 200,
      body: {
        reply: `• Acknowledge the concern
• Reference policy
• Offer next steps`
      }
    };
  } catch (err) {
    context.res = {
      status: 500,
      body: { error: "Server error" }
    };
  }
};
