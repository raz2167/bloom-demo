// app/api/place-planters/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const COMBO_1_URL =
  "https://res.cloudinary.com/dvt1kqbjq/image/upload/Nurseries/Bloom_Demo/combinations/%D7%90%D7%93%D7%A0%D7%99%D7%AA_1_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94.png";
const COMBO_2_URL =
  "https://res.cloudinary.com/dvt1kqbjq/image/upload/Nurseries/Bloom_Demo/combinations/%D7%90%D7%93%D7%A0%D7%99%D7%AA_2_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94.png";

const PLANTER_WIDTH_M  = 0.60; // אדנית 60 ס״מ
const PLANTER_HEIGHT_M = 0.35; // גובה אדנית כולל צמחייה ~35 ס״מ

interface PlacementZone { x: number; y: number; width: number; height: number; }
interface RailingInfo {
  railingY: number;       // Y פיקסל של קו המעקה
  imageWidth: number;
  imageHeight: number;
  floorY: number;         // Y פיקסל של הרצפה בקדמת הבלופרינט
}

async function dlUrl(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("הורדה נכשלה: " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function getRailingFromClaude(blueprintBase64: string): Promise<RailingInfo> {
  const client = new Anthropic();

  const prompt = `This is an architectural line drawing of a balcony.

Identify the following pixel coordinates in the image:
1. railingY: the Y coordinate (pixels from top) of the inner edge of the railing (where planters would sit)
2. floorY: the Y coordinate of the floor at the very front/bottom of the balcony
3. imageWidth: total image width in pixels
4. imageHeight: total image height in pixels

Also estimate where along the railing (as X percentages) two planters should go:
- planter1X: left edge of first planter as % of imageWidth (around 15-25%)
- planter2X: left edge of second planter as % of imageWidth (around 55-65%)

Return ONLY valid JSON, no markdown:
{
  "railingY": <px>,
  "floorY": <px>,
  "imageWidth": <px>,
  "imageHeight": <px>,
  "planter1X": <percent 0-100>,
  "planter2X": <percent 0-100>
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: blueprintBase64 } },
        { type: "text", text: prompt },
      ],
    }],
  });

  const text = response.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("");

  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    const {
      blueprintUrl,
      confirmedWidth = 4.0,   // רוחב המרפסת במטרים
      confirmedDepth = 2.5,   // עומק המרפסת במטרים
    } = await req.json();

    if (!blueprintUrl)
      return NextResponse.json({ error: "חסר blueprintUrl", debug: { log } }, { status: 400 });

    L("[1] מוריד blueprint...");
    const bpBuf = await dlUrl(blueprintUrl);
    L("[1] " + bpBuf.length + " bytes");

    L("[2] שולח ל-Claude Vision לזיהוי מעקה...");
    const blueprintBase64 = bpBuf.toString("base64");
    const railing = await getRailingFromClaude(blueprintBase64);
    L("[2] " + JSON.stringify(railing));

    const { imageWidth, imageHeight, railingY, floorY, planter1X, planter2X } = railing;

    // ── חישוב גודל האדנית בפיקסלים לפי מידות אמיתיות ──
    // פיקסלים לכל מטר אופקי (לפי רוחב התמונה = רוחב המרפסת)
    const pxPerMeterH = imageWidth / confirmedWidth;

    // פיקסלים לכל מטר אנכי (לפי עומק הנראה = מהמעקה לקדמת הרצפה)
    const visibleDepthPx = floorY - railingY;
    const pxPerMeterV = visibleDepthPx / confirmedDepth;

    // גודל האדנית בפיקסלים
    const planterWidthPx  = Math.round(PLANTER_WIDTH_M  * pxPerMeterH);
    const planterHeightPx = Math.round(PLANTER_HEIGHT_M * pxPerMeterV);

    L("[3] px/m אופקי: " + pxPerMeterH.toFixed(1) + " | px/m אנכי: " + pxPerMeterV.toFixed(1));
    L("[3] אדנית: " + planterWidthPx + "x" + planterHeightPx + " px");

    // מיקום X של כל אדנית (מהאחוז שקיבלנו)
    const p1x = Math.round((planter1X / 100) * imageWidth);
    const p2x = Math.round((planter2X / 100) * imageWidth);

    // Y — נמוך ממעקה בגובה האדנית (האדנית יושבת על הרצפה צמוד למעקה)
    const planterY = Math.round(railingY - planterHeightPx * 0.1); // overlap קטן עם המעקה

    const planter1: PlacementZone = { x: p1x, y: planterY, width: planterWidthPx, height: planterHeightPx };
    const planter2: PlacementZone = { x: p2x, y: planterY, width: planterWidthPx, height: planterHeightPx };

    L("[4] planter1: " + JSON.stringify(planter1));
    L("[4] planter2: " + JSON.stringify(planter2));

    return NextResponse.json({
      placement: { planter1, planter2, imageWidth, imageHeight },
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
