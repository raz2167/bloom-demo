// app/api/compose/route.ts
// מקבל prompt מ-plan + blueprint → DALL-E → תמונה סופית
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

async function dlUrl(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("הורדה נכשלה: " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    const { blueprintUrl, dallePrompt } = await req.json() as { blueprintUrl: string; dallePrompt: string };

    if (!blueprintUrl) return NextResponse.json({ error: "חסר blueprintUrl", debug: { log } }, { status: 400 });
    if (!dallePrompt)  return NextResponse.json({ error: "חסר dallePrompt",  debug: { log } }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "חסר OpenAI key", debug: { log } }, { status: 500 });

    L("[1] מוריד blueprint...");
    const bpBuf = await dlUrl(blueprintUrl);
    L("[1] " + bpBuf.length + " bytes");

    L("[2] שולח ל-DALL-E...");
    L("[2] prompt: " + dallePrompt.substring(0, 150) + "...");

    const fd = new FormData();
    fd.append("model",   "gpt-image-2");
    fd.append("image[]", new Blob([new Uint8Array(bpBuf)], { type: "image/png" }), "blueprint.png");
    fd.append("prompt",  dallePrompt);
    fd.append("n",       "1");
    fd.append("size",    "1024x1024");

    const dr = await fetch("https://api.openai.com/v1/images/edits", {
      method:  "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body:    fd,
    });

    L("[3] DALL-E status: " + dr.status);
    const dd = await dr.json();
    L("[3] " + JSON.stringify(dd).substring(0, 200));

    let finalUrl: string | null = null;
    if (dd.data?.[0]?.url)      finalUrl = dd.data[0].url;
    if (dd.data?.[0]?.b64_json) finalUrl = "data:image/png;base64," + dd.data[0].b64_json;

    if (!finalUrl)
      return NextResponse.json({ error: "DALL-E לא החזיר תמונה: " + JSON.stringify(dd).substring(0, 150), debug: { log } }, { status: 500 });

    L("[4] מוכן ✓");
    return NextResponse.json({ imageUrl: finalUrl, debug: { log } });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "שגיאה";
    L("CATCH: " + m);
    return NextResponse.json({ error: m, debug: { log } }, { status: 500 });
  }
}
