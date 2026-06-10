// app/api/blueprint/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const BLUEPRINT_PROMPT = `
You are editing a balcony photo. Follow these two steps in order:

STEP 1 — REMOVE (do not add anything):
Remove these elements if they appear in the photo:
- Furniture: chairs, tables, sofas, shelves, storage
- Plants, trees, planters of any kind
- Rugs, curtains, textiles
- Decorative objects, people, animals
- Any movable or temporary item
Do NOT remove: floor, walls, ceiling, railing, columns, doors, windows, fixed built-in elements.
Do NOT add any element that does not exist in the original photo.

STEP 2 — CONVERT TO LINE DRAWING:
Take only what remains after Step 1 and render it as a clean architectural line drawing:
- White or warm-white background
- Soft pencil lines, no harsh black
- Preserve the exact perspective and proportions of the original photo
- No color fill, no shading beyond subtle depth lines
- Do not invent or add any architectural element during this step either
`.trim();

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    L("[0] parsing request...");
    const body = await req.json();
    const imageBase64: string = body.imageBase64 ?? "";
    const mimeType: string    = body.mimeType    ?? "image/jpeg";

    L("[1] " + Math.round(imageBase64.length / 1024) + "KB — שולח ל-DALL-E");

    if (!imageBase64)                return NextResponse.json({ error: "חסרה תמונה",     debug: { log } }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "חסר OpenAI key", debug: { log } }, { status: 500 });

    L("[2] converting base64 to buffer...");
    const imgBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    const ext      = mimeType === "image/png" ? "png" : "jpeg";
    L("[2] buffer size: " + imgBytes.length + " bytes");

    L("[3] building FormData...");
    const fd = new FormData();
    fd.append("model",   "gpt-image-2");
    fd.append("image[]", new Blob([imgBytes], { type: mimeType }), `balcony.${ext}`);
    fd.append("prompt",  BLUEPRINT_PROMPT);
    fd.append("n",       "1");
    fd.append("size",    "1024x1024");

    L("[4] sending to DALL-E...");
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 55000);

    let dalleRes: Response;
    try {
      dalleRes = await fetch("https://api.openai.com/v1/images/edits", {
        method:  "POST",
        headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
        body:    fd,
        signal:  controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    L("[5] DALL-E status: " + dalleRes.status);

    if (!dalleRes.ok) {
      const errText = await dalleRes.text();
      L("[5] error body: " + errText.substring(0, 300));
      return NextResponse.json({ error: "DALL-E error " + dalleRes.status + ": " + errText.substring(0, 100), debug: { log } }, { status: 500 });
    }

    L("[6] parsing DALL-E response...");
    const dalleData = await dalleRes.json();
    L("[6] keys: " + Object.keys(dalleData || {}).join(", "));
    L("[6] data length: " + (dalleData.data?.length ?? 0));

    if (dalleData.data?.[0]?.url) {
      L("[7] got direct URL");
      return NextResponse.json({ blueprintUrl: dalleData.data[0].url, debug: { log } });
    }

    if (dalleData.data?.[0]?.b64_json) {
      const b64 = dalleData.data[0].b64_json as string;
      L("[7] got b64, length: " + b64.length);
      return new Response(
        JSON.stringify({ blueprintUrl: "data:image/png;base64," + b64, debug: { log } }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    L("[7] no image: " + JSON.stringify(dalleData).substring(0, 200));
    return NextResponse.json({ error: "DALL-E לא החזיר תמונה", debug: { log } }, { status: 500 });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    L("CATCH: " + m);
    return NextResponse.json({ error: m, debug: { log } }, { status: 500 });
  }
}
