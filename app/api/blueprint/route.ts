// v3 - 2026-06-12 - explicit removal of BBQ grills, appliances, AC units + stronger "no invention" rule
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const BLUEPRINT_PROMPT = `
You are editing a balcony photo. Follow these two steps exactly:

STEP 1 - REMOVE ALL OF THESE (leave a clean empty balcony):
- ALL furniture: chairs, tables, sofas, benches, loungers, shelves, storage boxes, cabinets
- ALL appliances: BBQ grills, barbecues, gas grills, electric grills, air conditioning units, fans, heaters
- ALL plants: every plant, tree, flower, planter, pot, tray, hanging basket, garden bed
- ALL textiles: rugs, mats, curtains, blinds, laundry, cushions, pillows
- ALL objects: decorative items, lights, lanterns, bikes, strollers, toys, tools, equipment
- ALL people and animals
- Anything that is not permanently bolted to the structure

KEEP ONLY these permanent structural elements:
- Floor surface (tiles, wood, concrete)
- Walls (back wall, side walls)
- Ceiling or roof overhang if present
- Railing and its posts
- Fixed columns or pillars
- Permanently built-in windows or doors that are part of the wall structure

CRITICAL RULES:
- Do NOT invent or add walls, doors, windows, or any element not visible in the original photo
- Do NOT fill in areas where objects were removed with guessed content
- Leave removed areas as clean empty floor/wall

STEP 2 - CONVERT TO ARCHITECTURAL LINE DRAWING:
Render only the permanent structural elements as a clean line drawing:
- White or warm-white background
- Light pencil-style lines, soft and clean
- Preserve the exact same perspective, camera angle, and proportions as the original photo
- No color, no shading, no texture fills, no decorative details
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
    fd.append("model",         "gpt-image-2");
    fd.append("image[]",       new Blob([new Uint8Array(imgBuffer)], { type: mimeType }), "balcony." + ext);
    fd.append("prompt",        BLUEPRINT_PROMPT);
    fd.append("n",             "1");
    fd.append("size",          "1024x1024");
    fd.append("quality",       "low");

    L("[4] calling DALL-E (quality=low)");
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
