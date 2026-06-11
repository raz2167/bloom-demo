// app/api/blueprint/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const BLUEPRINT_PROMPT = `
You are editing a balcony photo. Follow these two steps in order:

STEP 1 - REMOVE (do not add anything):
Remove these elements if they appear in the photo:
- Furniture: chairs, tables, sofas, shelves, storage
- Plants, trees, planters of any kind
- Rugs, curtains, textiles
- Decorative objects, people, animals
- Any movable or temporary item
Do NOT remove: floor, walls, ceiling, railing, columns, doors, windows, fixed built-in elements.

STEP 2 - CONVERT TO LINE DRAWING:
Render what remains as a clean architectural line drawing:
- White or warm-white background
- Soft pencil lines, no harsh black
- Preserve exact perspective and proportions
- No color fill, no shading beyond subtle depth lines
`.trim();

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    L("[1] parsing request");
    const { imageBase64, mimeType = "image/jpeg" } = await req.json();

    if (!imageBase64)                return NextResponse.json({ error: "missing image",    step: "validate", debug: { log } }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "missing API key", step: "validate", debug: { log } }, { status: 500 });

    L("[2] converting image " + Math.round(imageBase64.length / 1024) + "KB");
    const imgBuffer = Buffer.from(imageBase64, "base64");
    const ext = mimeType === "image/png" ? "png" : "jpeg";
    L("[2] buffer: " + imgBuffer.length + " bytes");

    L("[3] building FormData");
    const fd = new FormData();
    fd.append("model",   "gpt-image-2");
    fd.append("image[]", new Blob([new Uint8Array(imgBuffer)], { type: mimeType }), "balcony." + ext);
    fd.append("prompt",  BLUEPRINT_PROMPT);
    fd.append("n",       "1");
    fd.append("size",    "1024x1024");

    L("[4] calling DALL-E");
    const dalleRes = await fetch("https://api.openai.com/v1/images/edits", {
      method:  "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body:    fd,
    });

    L("[5] DALL-E status: " + dalleRes.status);

    if (!dalleRes.ok) {
      const errText = await dalleRes.text();
      L("[5] error: " + errText.substring(0, 300));
      return NextResponse.json({ error: "DALL-E error " + dalleRes.status, step: "dalle_call", debug: { log } }, { status: 500 });
    }

    L("[6] parsing response");
    const dalleData = await dalleRes.json();
    L("[6] data items: " + (dalleData.data?.length ?? 0));

    if (dalleData.data?.[0]?.url) {
      L("[7] returning URL");
      return NextResponse.json({ blueprintUrl: dalleData.data[0].url, debug: { log } });
    }

    if (dalleData.data?.[0]?.b64_json) {
      const b64 = dalleData.data[0].b64_json as string;
      L("[7] returning b64, length: " + b64.length);
      return new Response(
        JSON.stringify({ blueprintUrl: "data:image/png;base64," + b64, debug: { log } }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    L("[7] no image in response");
    return NextResponse.json({ error: "DALL-E returned no image", step: "dalle_parse", debug: { log } }, { status: 500 });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    L("CATCH: " + m);
    return NextResponse.json({ error: m, step: "catch", debug: { log } }, { status: 500 });
  }
}
