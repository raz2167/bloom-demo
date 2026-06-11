// app/api/place-planters/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 300;

// ── כתובות — לא לשנות ────────────────────────────────
const COMBO_1_URL = "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739076/%D7%90%D7%93%D7%A0%D7%99%D7%AA_3_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94_n4014f.png";
const COMBO_2_URL = "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739075/%D7%90%D7%93%D7%A0%D7%99%D7%AA_1_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94_qt2ukz.png";
const POT_URL     = "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739077/%D7%9B%D7%93_%D7%92%D7%91%D7%95%D7%94_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94_hbbgvb.png";
// ─────────────────────────────────────────────────────

const FIXED_WIDTH_M = 3.0;
const PLANTER_W_M   = 0.60;
const PLANTER_H_M   = 0.35;
const POT_W_M       = 0.50;
const POT_H_M       = 1.00;

interface Zone { x: number; y: number; width: number; height: number; }

interface ClaudeVision {
  imageWidth:    number;
  imageHeight:   number;
  floorEndPct:   number; // % מלמעלה של הקו שבו הרצפה מסתיימת (קצה הרצפה הקרוב למשקיף)
}

async function dlUrl(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("הורדה נכשלה: " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function getVisionData(blueprintBase64: string): Promise<ClaudeVision> {
  const client = new Anthropic();

  const prompt = `This is an architectural line drawing of a balcony in perspective view.

Find the bottom edge of the balcony floor — the horizontal line where the floor ends at the far end near the railing/wall. This is the line furthest from the viewer in the perspective drawing, where the floor meets the railing base.

Return ONLY valid JSON:
{
  "imageWidth": <total image width in pixels>,
  "imageHeight": <total image height in pixels>,
  "floorEndPct": <Y position of the far floor edge as % of imageHeight from top>
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 150,
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

  const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as ClaudeVision;
  // clamp סביר — קצה הרצפה הרחוק תמיד בין 25%-55%
  parsed.floorEndPct = Math.max(25, Math.min(55, parsed.floorEndPct));
  return parsed;
}

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    const { blueprintUrl } = await req.json() as { blueprintUrl: string };
    if (!blueprintUrl)
      return NextResponse.json({ error: "חסר blueprintUrl", debug: { log } }, { status: 400 });

    L("[1] מוריד blueprint...");
    const bpBuf = await dlUrl(blueprintUrl);
    L("[1] " + bpBuf.length + " bytes");

    L("[2] Claude Vision...");
    const vision = await getVisionData(bpBuf.toString("base64"));
    L("[2] floorEndPct=" + vision.floorEndPct + " size=" + vision.imageWidth + "x" + vision.imageHeight);

    const { imageWidth, imageHeight, floorEndPct } = vision;

    // Y תחתית האלמנטים = קצה הרצפה הרחוק
    const floorEndPx = Math.round((floorEndPct / 100) * imageHeight);

    // גדלים לפי רוחב בלבד
    const pxPerMeterH = imageWidth / FIXED_WIDTH_M;
    const planterWpx  = Math.round(PLANTER_W_M * pxPerMeterH);
    const planterHpx  = Math.round(PLANTER_H_M * pxPerMeterH);
    const potWpx      = Math.round(POT_W_M     * pxPerMeterH);
    const potHpx      = Math.round(POT_H_M     * pxPerMeterH);

    L("[3] pxPerM=" + pxPerMeterH.toFixed(1) + " planter=" + planterWpx + "x" + planterHpx + " pot=" + potWpx + "x" + potHpx);
    L("[3] floorEndPx=" + floorEndPx + " planterTop=" + (floorEndPx - planterHpx) + " potTop=" + (floorEndPx - potHpx));

    const planterTopY = floorEndPx - planterHpx;
    const potTopY     = floorEndPx - potHpx;

    // X — [כד][אדנית1][אדנית2][כד]
    const totalW    = potWpx + planterWpx + planterWpx + potWpx;
    const gap       = Math.round((imageWidth - totalW) / 5);
    const potLeftX  = gap;
    const planter1X = potLeftX  + potWpx     + gap;
    const planter2X = planter1X + planterWpx + gap;
    const potRightX = planter2X + planterWpx + gap;

    L("[4] X: " + potLeftX + " " + planter1X + " " + planter2X + " " + potRightX);

    const potLeft:  Zone = { x: potLeftX,  y: potTopY,     width: potWpx,     height: potHpx     };
    const planter1: Zone = { x: planter1X, y: planterTopY, width: planterWpx, height: planterHpx };
    const planter2: Zone = { x: planter2X, y: planterTopY, width: planterWpx, height: planterHpx };
    const potRight: Zone = { x: potRightX, y: potTopY,     width: potWpx,     height: potHpx     };

    return NextResponse.json({
      placement: { potLeft, planter1, planter2, potRight, imageWidth, imageHeight },
      combo1Url: COMBO_1_URL,
      combo2Url: COMBO_2_URL,
      potUrl:    POT_URL,
      debug: { log },
    });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "שגיאה";
    L("CATCH: " + m);
    return NextResponse.json({ error: m, debug: { log } }, { status: 500 });
  }
}
