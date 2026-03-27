try {
  const p = GetPlayer();

  const userPrompt = p.GetVar("UserPrompt");
  const persona = p.GetVar("Persona");
  const scenario = p.GetVar("Scenario");

  p.SetVar("CoachInProgress", 1);

  const FUNCTION_URL = "https://javascriptazurellmproject2.azurewebsites.net/api/coach";

  const r = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: userPrompt,
      persona: persona,
      scenario: scenario
    })
  });

  if (!r.ok) {
    throw new Error("Backend error " + r.status);
  }

  const data = await r.json();
  let guidance = (data.reply || data.content || data.text || "").trim();

  const looksLikeScript =
    /(^|\\n)(\"|“|”|')|(^|\\n)REP:|(^|\\n)Customer:|(^|\\n)Say:|(^|\\n)You should say/i.test(guidance);

  if (!guidance || looksLikeScript) {
    const list = offlineSuggestions(scenario);
    guidance =
      "• " + list.join("\\n• ") +
      "\\nPitfall to avoid: overpromising or accepting returns against policy";
  }

  p.SetVar("CoachReply", guidance);
  p.SetVar("CoachHint", "Use these tips to craft your own response.");
  p.SetVar("CoachInProgress", 0);

  const used = Number(p.GetVar("CoachUses") || 0) + 1;
  p.SetVar("CoachUses", used);

} catch (e) {
  const p = GetPlayer();
  const scenario = p.GetVar("Scenario");
  const list = offlineSuggestions(scenario);

  p.SetVar(
    "CoachReply",
    "• " + list.join("\\n• ") +
    "\\nPitfall to avoid: overpromising or accepting returns against policy"
  );
  p.SetVar("CoachHint", "(Offline coach guidance)");
  p.SetVar("CoachInProgress", 0);
}
