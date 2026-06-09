// app/api/place-planters/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const COMBO_1_URL = "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739076/%D7%90%D7%93%D7%A0%D7%99%D7%AA_3_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94_n4014f.png";
const COMBO_2_URL = "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739075/%D7%90%D7%93%D7%A0%D7%99%D7%AA_1_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94_qt2ukz.png";
const POT_URL     = "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739077/%D7%9B%D7%93_%D7%92%D7%91%D7%95%D7%94_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94_hbbgvb.png";

// מידות קבועות
const FIXED_WIDTH_M  = 3.0;
const FIXED_DEPTH_M  = 2.0;
const PLANTER_W_M    = 0.60;
const PLANTER_H_M    = 0.35;
const POT_W_M        = 0.50;
const POT_H_M        = 1.00;

interface Zone { x: number; y: number; width: number; height: number; }

interface ClaudeVision {
  imageWidth:   number;
  imageHeight:  number;
  railingBottomPct: number; // % מלמעלה של הקו שבו הרצפה פוגשת את המעקה (תחתית האדניות)
}

async function dlUrl(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("הורדה נכשלה: " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function getVisionData(blueprintBase64: string): Promise<ClaudeVision> {
  const client = new Anthropic();

  const prompt = `This is an architectural line drawing of a balcony viewed from inside, perspective view.

I need to place planters against the railing. Tell me:

1. imageWidth: total image width in pixels
2. imageHeight: total image height in pixels  
3. railingBottomPct: the Y position (as % of imageHeight, from top) of the line where the FLOOR meets the RAILING — this is where the bottom of the planters should sit. Look for the horizontal line at the base of the railing, where it meets the floor. This is typically in the upper 20-45% of the image.

Return ONLY valid JSON, no markdown:
{
  "imageWidth": <px>,
  "imageHeight": <px>,
  "railingBottomPct": <number 0-100>
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

  return JSON.parse(text.replace(/```json|```/g, "").trim()) as ClaudeVision;
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
    L("[2] " + JSON.stringify(vision));

    const { imageWidth, imageHeight, railingBottomPct } = vision;

    // קו הרצפה-מעקה בפיקסלים — תחתית כל האלמנטים
    const railingBottomPx = Math.round((railingBottomPct / 100) * imageHeight);

    // פיקסלים למטר — אופקי לפי רוחב התמונה, אנכי לפי עומק נראה (מהמעקה עד 85% מהתמונה)
    const pxPerMeterH    = imageWidth / FIXED_WIDTH_M;
    const visibleDepthPx = (imageHeight * 0.85) - railingBottomPx;
    const pxPerMeterV    = visibleDepthPx / FIXED_DEPTH_M;

    // גדלים בפיקסלים
    const planterWpx = Math.round(PLANTER_W_M * pxPerMeterH);
    const planterHpx = Math.round(PLANTER_H_M * pxPerMeterV);
    const potWpx     = Math.round(POT_W_M     * pxPerMeterH);
    const potHpx     = Math.round(POT_H_M     * pxPerMeterV);

    L("[3] planter=" + planterWpx + "x" + planterHpx + "  pot=" + potWpx + "x" + potHpx);

    // Y — top edge = רצפה-מעקה פחות גובה האלמנט
    const planterTopY = railingBottomPx - planterHpx;
    const potTopY     = railingBottomPx - potHpx;

    // X — פריסה שווה: [כד][אדנית1][אדנית2][כד]
    const totalW = potWpx + planterWpx + planterWpx + potWpx;
    const gap    = Math.round((imageWidth - totalW) / 5);

    const potLeftX  = gap;
    const planter1X = potLeftX  + potWpx     + gap;
    const planter2X = planter1X + planterWpx + gap;
    const potRightX = planter2X + planterWpx + gap;

    L("[4] X positions: " + potLeftX + " " + planter1X + " " + planter2X + " " + potRightX);
    L("[4] Y: planterTop=" + planterTopY + " potTop=" + potTopY + " railingBottom=" + railingBottomPx);

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
