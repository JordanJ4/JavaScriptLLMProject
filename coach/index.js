module.exports = async function (context, req) {
  try {
    const prompt = req.body?.prompt || req.query?.prompt || "Hello";

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        ok: true,
        message: "Azure Function is running",
        prompt
      }
    };
  } catch (error) {
    context.res = {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        ok: false,
        error: error.message
      }
    };
  }
};
