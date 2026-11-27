// ADCC QS Register — AI function (Supabase Edge Function "ai")
// Keeps the Anthropic API key secret on the server. Only logged-in app users can call it.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const MODELS = ["claude-sonnet-5-5", "claude-haiku-5-5"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: { message: "ANTHROPIC_API_KEY is not set in Supabase Edge Function secrets." } }, 500);

    // Only allow logged-in users of this app
    const auth = req.headers.get("authorization") || "";
    const u = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: { authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
    });
    if (!u.ok) return json({ error: { message: "Please log in again." } }, 401);

    const b = await req.json();
    const payload: Record<string, unknown> = {
      model: MODELS.includes(b.model) ? b.model : MODELS[0],
      max_tokens: Math.min(Number(b.max_tokens) || 2000, 4000),
      system: b.system,
      messages: b.messages,
    };
    if (b.tools) payload.tools = b.tools;
    if (b.tool_choice) payload.tool_choice = b.tool_choice;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return json({ error: { message: String(e) } }, 500);
  }
});
