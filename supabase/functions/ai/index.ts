// ADCC QS Register — AI function (Supabase Edge Function "ai"), using Google Gemini (free tier).
// Keeps the API key secret on the server. Only logged-in app users can call it.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const PUBLIC_KEY = "sb_publishable_lQvZkU-cNR2DyqF7uAbBzA_JMpW1KBq"; // public app key (safe to share)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://lfyivbmwdgovvmbkxnqv.supabase.co";
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"];

// deno-lint-ignore no-explicit-any
const toParts = (c: any) => typeof c === "string" ? [{ text: c }] : c.map((p: any) =>
  p.type === "image" ? { inlineData: { mimeType: p.source.media_type, data: p.source.data } } : { text: p.text || "" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: { message: "GEMINI_API_KEY is not set in Supabase Edge Function secrets." } }, 500);
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { authorization: req.headers.get("authorization") || "", apikey: req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || PUBLIC_KEY },
    });
    if (!u.ok) return json({ error: { message: "Please log in again." } }, 401);

    const b = await req.json();
    // deno-lint-ignore no-explicit-any
    const body: any = {
      contents: (b.messages || []).map((m: any) => ({ role: m.role === "assistant" ? "model" : "user", parts: toParts(m.content) })),
      generationConfig: { maxOutputTokens: 8192, temperature: 0.4 },
    };
    if (b.system) body.systemInstruction = { parts: [{ text: b.system }] };
    if (b.tools) {
      body.tools = [{ functionDeclarations: b.tools.map((t: any) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }];
      body.toolConfig = { functionCallingConfig: b.tool_choice?.type === "tool"
        ? { mode: "ANY", allowedFunctionNames: [b.tool_choice.name] } : { mode: "AUTO" } };
    }
    let last = "";
    // Find the current free models automatically (Google renames models over time)
    const models = [...MODELS];
    try {
      const lr = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } });
      if (lr.ok) {
        // deno-lint-ignore no-explicit-any
        const names = ((await lr.json()).models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
          // deno-lint-ignore no-explicit-any
          .map((m: any) => String(m.name).replace("models/", ""))
          .filter((n: string) => !/image|tts|audio|embed|live|vision-only|learnlm|gemma/i.test(n));
        const rank = (n: string) => (/flash/i.test(n) ? 0 : /pro/i.test(n) ? 2 : 1) + (/lite/i.test(n) ? 0.5 : 0) + (/preview|exp/i.test(n) ? 0.3 : 0);
        models.push(...names.sort((a: string, b: string) => rank(a) - rank(b)).slice(0, 6));
      }
    } catch { /* use defaults */ }
    for (const model of [...new Set(models)]) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const t = await r.text();
      if (!r.ok) {
        last = t;
        if ([400, 404, 429, 500, 503].includes(r.status) && /not found|not supported|RESOURCE_EXHAUSTED|UNAVAILABLE|INTERNAL|overloaded/i.test(t)) continue; // try next model
        let msg = t; try { msg = JSON.parse(t).error.message; } catch { /* keep */ }
        return json({ error: { message: msg } }, r.status);
      }
      const d = JSON.parse(t);
      const parts = d.candidates?.[0]?.content?.parts || [];
      // deno-lint-ignore no-explicit-any
      const content = parts.filter((p: any) => !p.thought).flatMap((p: any) =>
        p.functionCall ? [{ type: "tool_use", name: p.functionCall.name, input: p.functionCall.args || {} }]
        : p.text ? [{ type: "text", text: p.text }] : []);
      return json({ content, model });
    }
    let msg = "AI is busy or the free daily limit is reached. Try again later.";
    try { const e = JSON.parse(last).error; if (e?.status !== "RESOURCE_EXHAUSTED") msg = e.message || msg; } catch { /* keep */ }
    return json({ error: { message: msg } }, 429);
  } catch (e) {
    return json({ error: { message: String(e) } }, 500);
  }
});
