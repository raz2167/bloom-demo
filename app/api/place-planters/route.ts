// app/api/place-planters/route.ts
// מקבל blueprintUrl → Claude Vision מחשב קואורדינטות → Sharp מניח combos
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

export const maxDuration = 60;

const COMBO_1_URL =
  "https://res.cloudinary.com/dvt1kqbjq/image/upload/Nurseries/Bloom_Demo/combinations/%D7%90%D7%93%D7%A0%D7%99%D7%AA_1_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94.png";
const COMBO_2_URL =
  "https://res.cloudinary.com/dvt1kqbjq/image/upload/Nurseries/Bloom_Demo/combinations/%D7%90%D7%93%D7%A0%D7%99%D7%AA_2_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94.png";

interface PlacementZone {
  x: number; // פיקסלים מהשמאל
  y: number; // פיקסלים מלמעלה
  width: number;  // רוחב בפיקסלים
  height: number; // גובה בפיקסלים
}

interface ClaudePlacement {
  planter1: PlacementZone;
  planter2: PlacementZone;
  reasoning: string;
}

async function dlUrl(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("הורדה נכשלה: " + url + " status: " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function getPlacementFromClaude(
  blueprintBase64: string,
  imageWidth: number,
  imageHeight: number
): Promise<ClaudePlacement> {
  const client = new Anthropic();

  const prompt = `This is an architectural line drawing of a balcony (${imageWidth}x${imageHeight} pixels).

Your task: identify exactly where two 60cm planters should be placed along the railing.

Rules:
- Planters must sit ON the floor, touching the railing from the inside
- Space them apart — one roughly at 25% from left, one at 65% from left
- Each planter is 60cm wide; estimate pixel size based on the balcony proportions you see
- The planter height should be ~40% of its width (realistic planter ratio)
- Account for perspective: planters further away appear smaller

Return ONLY valid JSON, no markdown, no explanation:
{
  "planter1": { "x": <left edge in px>, "y": <top edge in px>, "width": <px>, "height": <px> },
  "planter2": { "x": <left edge in px>, "y": <top edge in px>, "width": <px>, "height": <px> },
  "reasoning": "<one sentence>"
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: blueprintBase64,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
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

    // 1. הורד blueprint
    L("[1] מוריד blueprint...");
    const bpBuf = await dlUrl(blueprintUrl);
    L("[1] " + bpBuf.length + " bytes");

    // 2. קבל מידות התמונה
    const meta = await sharp(bpBuf).metadata();
    const imgW = meta.width  ?? 1024;
    const imgH = meta.height ?? 1024;
    L("[2] מידות: " + imgW + "x" + imgH);

    // 3. Claude Vision → קואורדינטות
    L("[3] שולח ל-Claude Vision...");
    const blueprintBase64 = bpBuf.toString("base64");
    const placement = await getPlacementFromClaude(blueprintBase64, imgW, imgH);
    L("[3] קואורדינטות: " + JSON.stringify(placement));

    // 4. הורד combos
    L("[4] מוריד combos...");
    const [c1Buf, c2Buf] = await Promise.all([dlUrl(COMBO_1_URL), dlUrl(COMBO_2_URL)]);
    L("[4] combo1: " + c1Buf.length + "b, combo2: " + c2Buf.length + "b");

    // 5. שנה גודל כל combo לפי הקואורדינטות
    L("[5] מכין combos בגודל הנכון...");
    const p1 = placement.planter1;
    const p2 = placement.planter2;

    const [c1Resized, c2Resized] = await Promise.all([
      sharp(c1Buf)
        .resize(p1.width, p1.height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
      sharp(c2Buf)
        .resize(p2.width, p2.height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ]);

    // 6. הנח על הבלופרינט
    L("[6] מניח combos על blueprint...");
    const resultBuf = await sharp(bpBuf)
      .composite([
        { input: c1Resized, left: p1.x, top: p1.y },
        { input: c2Resized, left: p2.x, top: p2.y },
      ])
      .png()
      .toBuffer();

    L("[6] תמונה סופית: " + resultBuf.length + " bytes");

    // 7. החזר כ-base64
    const resultBase64 = "data:image/png;base64," + resultBuf.toString("base64");

    L("[7] מוכן ✓ reasoning: " + placement.reasoning);
    return NextResponse.json({
      imageUrl: resultBase64,
      placement,
      debug: { log },
    });
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "שגיאה";
    L("CATCH: " + m);
    return NextResponse.json({ error: m, debug: { log } }, { status: 500 });
  }
}
