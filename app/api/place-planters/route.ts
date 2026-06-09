// app/api/place-planters/route.ts
// מקבל blueprintUrl → Claude Vision מחשב קואורדינטות → מחזיר JSON בלבד
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const COMBO_1_URL =
  "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739075/%D7%90%D7%93%D7%A0%D7%99%D7%AA_1_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94_qt2ukz.png";
const COMBO_2_URL =
  "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739076/%D7%90%D7%93%D7%A0%D7%99%D7%AA_3_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94_n4014f.png";

interface PlacementZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ClaudePlacement {
  planter1: PlacementZone;
  planter2: PlacementZone;
  imageWidth: number;
  imageHeight: number;
  reasoning: string;
}

async function dlUrl(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("הורדה נכשלה: " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function getPlacementFromClaude(blueprintBase64: string): Promise<ClaudePlacement> {
  const client = new Anthropic();

  const prompt = `This is an architectural line drawing of a balcony.

Your task: identify where two 60cm planters should be placed along the railing.

Rules:
- Planters must sit ON the floor, touching the railing from the inside
- Space them: one at roughly 25% from left, one at 65% from left
- Each planter is 60cm wide — estimate pixel size from the balcony proportions
- Planter height should be ~45% of its width
- Account for perspective: planters further away appear smaller
- Also return the full image dimensions in pixels

Return ONLY valid JSON, no markdown:
{
  "imageWidth": <total image width in px>,
  "imageHeight": <total image height in px>,
  "planter1": { "x": <left edge px>, "y": <top edge px>, "width": <px>, "height": <px> },
  "planter2": { "x": <left edge px>, "y": <top edge px>, "width": <px>, "height": <px> },
  "reasoning": "<one sentence>"
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: blueprintBase64 } },
        { type: "text", text: prompt },
      ],
    }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as ClaudePlacement;
}

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    const { blueprintUrl } = await req.json();
    if (!blueprintUrl)
      return NextResponse.json({ error: "חסר blueprintUrl", debug: { log } }, { status: 400 });

    L("[1] מוריד blueprint...");
    const bpBuf = await dlUrl(blueprintUrl);
    L("[1] " + bpBuf.length + " bytes");

    L("[2] שולח ל-Claude Vision...");
    const blueprintBase64 = bpBuf.toString("base64");
    const placement = await getPlacementFromClaude(blueprintBase64);
    L("[2] קואורדינטות: " + JSON.stringify(placement));

    L("[3] מוכן ✓ — " + placement.reasoning);
    return NextResponse.json({
      placement,
      combo1Url: COMBO_1_URL,
      combo2Url: COMBO_2_URL,
      debug: { log },
    });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "שגיאה";
    L("CATCH: " + m);
    return NextResponse.json({ error: m, debug: { log } }, { status: 500 });
  }
}
