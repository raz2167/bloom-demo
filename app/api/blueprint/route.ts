// app/api/blueprint/route.ts
// מקבל תמונת מרפסת → מחזיר שרטוט קווי אדריכלי נקי (DALL-E edits)
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 90;

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
    const { imageBase64, mimeType = "image/jpeg" } = await req.json();

    if (!imageBase64)              return NextResponse.json({ error: "חסרה תמונה",       debug: { log } }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "חסר OpenAI key", debug: { log } }, { status: 500 });

    L("[1] " + Math.round(imageBase64.length / 1024) + "KB — שולח ל-DALL-E");

    // המרת base64 ל-Buffer
    const imgBuffer = Buffer.from(imageBase64, "base64");
    const ext       = mimeType === "image/png" ? "png" : "jpeg";

    const fd = new FormData();
    fd.append("model",  "gpt-image-2");
    fd.append("image[]", new Blob([new Uint8Array(imgBuffer)], { type: mimeType }), `balcony.${ext}`);
    fd.append("prompt", BLUEPRINT_PROMPT);
    fd.append("n",      "1");
    fd.append("size",   "1024x1024");

    const dalleRes = await fetch("https://api.openai.com/v1/images/edits", {
      method:  "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body:    fd,
    });

    L("[2] DALL-E status: " + dalleRes.status);
    const dalleData = await dalleRes.json();
    L("[2] " + JSON.stringify(dalleData).substring(0, 200));

    let blueprintUrl: string | null = null;
    if (dalleData.data?.[0]?.url)      blueprintUrl = dalleData.data[0].url;
    if (dalleData.data?.[0]?.b64_json) blueprintUrl = "data:image/png;base64," + dalleData.data[0].b64_json;

    if (!blueprintUrl) {
      L("[2] שגיאה מ-DALL-E: " + JSON.stringify(dalleData).substring(0, 300));
      return NextResponse.json({ error: "DALL-E לא החזיר תמונה", debug: { log } }, { status: 500 });
    }

    L("[3] blueprint מוכן ✓");
    return NextResponse.json({ blueprintUrl, debug: { log } });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "שגיאה";
    log.push("CATCH: " + m);
    return NextResponse.json({ error: m, debug: { log } }, { status: 500 });
  }
}
