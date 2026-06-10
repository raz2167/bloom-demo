// app/api/compose/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

async function getBlueprintBuffer(blueprintUrl: string): Promise<Buffer> {
  // data URL — חלץ ישירות
  if (blueprintUrl.startsWith("data:")) {
    const comma = blueprintUrl.indexOf(",");
    if (comma === -1) throw new Error("invalid data URL");
    return Buffer.from(blueprintUrl.slice(comma + 1), "base64");
  }
  // URL רגיל — הורד
  const r = await fetch(blueprintUrl);
  if (!r.ok) throw new Error("הורדה נכשלה: " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    const { blueprintUrl, dallePrompt } = await req.json() as { blueprintUrl: string; dallePrompt: string };

    if (!blueprintUrl)               return NextResponse.json({ error: "חסר blueprintUrl", debug: { log } }, { status: 400 });
    if (!dallePrompt)                return NextResponse.json({ error: "חסר dallePrompt",  debug: { log } }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "חסר OpenAI key",  debug: { log } }, { status: 500 });

    L("[1] מכין blueprint...");
    const bpBuf = await getBlueprintBuffer(blueprintUrl);
    L("[1] " + bpBuf.length + " bytes");

    L("[2] שולח ל-DALL-E...");

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

    if (!dr.ok) {
      const errText = await dr.text();
      L("[3] error: " + errText.substring(0, 200));
      return NextResponse.json({ error: "DALL-E error " + dr.status, debug: { log } }, { status: 500 });
    }

    const dd = await dr.json();
    L("[3] keys: " + Object.keys(dd || {}).join(", "));

    if (dd.data?.[0]?.url) {
      L("[4] got direct URL");
      return NextResponse.json({ imageUrl: dd.data[0].url, debug: { log } });
    }

    if (dd.data?.[0]?.b64_json) {
      const b64 = dd.data[0].b64_json as string;
      L("[4] got b64, length: " + b64.length);
      return new Response(
        JSON.stringify({ imageUrl: "data:image/png;base64," + b64, debug: { log } }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    L("[4] no image: " + JSON.stringify(dd).substring(0, 200));
    return NextResponse.json({ error: "DALL-E לא החזיר תמונה", debug: { log } }, { status: 500 });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    L("CATCH: " + m);
    return NextResponse.json({ error: m, debug: { log } }, { status: 500 });
  }
}
