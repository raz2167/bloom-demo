// app/api/compose/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

// Safety net: always prepend blueprint-preserve + floor placement instruction
const BLUEPRINT_PREFIX = "This is a black and white architectural line drawing of a balcony. Preserve this line drawing exactly as the background. Do not replace or redraw the floor, walls or railing. All planters must be placed ON THE FLOOR SURFACE, standing upright, pushed against the back wall, with the railing clearly visible BEHIND and ABOVE them. Planters appear in the LOWER HALF of the image, not on top of the railing. Only add the following colored elements on top of the existing line drawing: ";

async function getBlueprintBuffer(blueprintUrl: string): Promise<Buffer> {
  if (blueprintUrl.startsWith("data:")) {
    const comma = blueprintUrl.indexOf(",");
    if (comma === -1) throw new Error("invalid data URL");
    return Buffer.from(blueprintUrl.slice(comma + 1), "base64");
  }
  const r = await fetch(blueprintUrl);
  if (!r.ok) throw new Error("blueprint download failed: " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    L("[1] parsing request");
    const { blueprintUrl, dallePrompt } = await req.json() as { blueprintUrl: string; dallePrompt: string };

    if (!blueprintUrl)               return NextResponse.json({ error: "missing blueprintUrl", step: "validate", debug: { log } }, { status: 400 });
    if (!dallePrompt)                return NextResponse.json({ error: "missing dallePrompt",  step: "validate", debug: { log } }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "missing OpenAI key",  step: "validate", debug: { log } }, { status: 500 });

    L("[2] extracting blueprint buffer");
    const bpBuf = await getBlueprintBuffer(blueprintUrl);
    L("[2] buffer: " + bpBuf.length + " bytes");

    // Prepend blueprint-preserve prefix if not already present
    const alreadyHasPrefix = dallePrompt.startsWith("This is a black and white architectural line drawing");
    const finalPrompt = alreadyHasPrefix ? dallePrompt : BLUEPRINT_PREFIX + dallePrompt;
    L("[3] prompt length: " + finalPrompt.length + " chars (prefix " + (alreadyHasPrefix ? "already present" : "added") + ")");

    L("[4] building FormData");
    const fd = new FormData();
    fd.append("model",         "gpt-image-2");
    fd.append("image[]",       new Blob([new Uint8Array(bpBuf)], { type: "image/png" }), "blueprint.png");
    fd.append("prompt",        finalPrompt);
    fd.append("n",             "1");
    fd.append("size",          "1024x1024");
    fd.append("quality",       "medium");
    fd.append("output_format", "jpeg");

    L("[5] calling DALL-E (quality=medium, format=jpeg)");
    const dr = await fetch("https://api.openai.com/v1/images/edits", {
      method:  "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body:    fd,
    });

    L("[6] DALL-E status: " + dr.status);

    if (!dr.ok) {
      const errText = await dr.text();
      L("[6] error: " + errText.substring(0, 300));
      return NextResponse.json({ error: "DALL-E error " + dr.status, step: "dalle_call", debug: { log } }, { status: 500 });
    }

    L("[7] parsing response");
    const dd = await dr.json();
    L("[7] data items: " + (dd.data?.length ?? 0));

    if (dd.data?.[0]?.url) {
      L("[8] returning URL");
      return NextResponse.json({ imageUrl: dd.data[0].url, debug: { log } });
    }

    if (dd.data?.[0]?.b64_json) {
      const b64 = dd.data[0].b64_json as string;
      L("[8] returning b64, length: " + b64.length);
      return new Response(
        JSON.stringify({ imageUrl: "data:image/jpeg;base64," + b64, debug: { log } }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    L("[8] no image in response");
    return NextResponse.json({ error: "DALL-E returned no image", step: "dalle_parse", debug: { log } }, { status: 500 });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    L("CATCH: " + m);
    return NextResponse.json({ error: m, step: "catch", debug: { log } }, { status: 500 });
  }
}
