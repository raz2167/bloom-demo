// app/api/place-planters/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const COMBO_1_URL = "https://res.cloudinary.com/dvt1kqbjq/image/upload/Nurseries/Bloom_Demo/combinations/%D7%90%D7%93%D7%A0%D7%99%D7%AA_1_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94.png";
const COMBO_2_URL = "https://res.cloudinary.com/dvt1kqbjq/image/upload/Nurseries/Bloom_Demo/combinations/%D7%90%D7%93%D7%A0%D7%99%D7%AA_2_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94.png";
const POT_URL     = "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739077/%D7%9B%D7%93_%D7%92%D7%91%D7%95%D7%94_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94_hbbgvb.png";

// מידות קבועות — לא תלוי במה שהמשתמש הזין
const FIXED_WIDTH_M  = 3.0;
const FIXED_DEPTH_M  = 2.0;

const PLANTER_W_M = 0.60;  // אדנית
const PLANTER_H_M = 0.35;
const POT_W_M     = 0.50;  // כד
const POT_H_M     = 1.00;

interface Zone { x: number; y: number; width: number; height: number; }

interface ClaudeRailing {
  railingY:   number;
  floorY:     number;
  imageWidth:  number;
  imageHeight: number;
}

async function dlUrl(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("הורדה נכשלה: " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function getRailingFromClaude(blueprintBase64: string): Promise<ClaudeRailing> {
  const client = new Anthropic();

  const prompt = `This is an architectural line drawing of a balcony.

Identify these pixel coordinates:
1. railingY: Y coordinate (px from top) of the inner edge of the railing — where planters would sit against it
2. floorY: Y coordinate of the floor at the very front/bottom of the visible balcony
3. imageWidth: total image width in pixels
4. imageHeight: total image height in pixels

Return ONLY valid JSON, no markdown:
{
  "railingY": <px>,
  "floorY": <px>,
  "imageWidth": <px>,
  "imageHeight": <px>
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 200,
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

  return JSON.parse(text.replace(/```json|```/g, "").trim()) as ClaudeRailing;
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

    L("[2] שולח ל-Claude Vision...");
    const railing = await getRailingFromClaude(bpBuf.toString("base64"));
    L("[2] " + JSON.stringify(railing));

    const { imageWidth, imageHeight, railingY, floorY } = railing;

    // ── חישוב סקאלה לפי מידות קבועות ──────────────
    const pxPerMeterH    = imageWidth  / FIXED_WIDTH_M;
    const visibleDepthPx = floorY - railingY;
    const pxPerMeterV    = visibleDepthPx / FIXED_DEPTH_M;

    const planterWpx = Math.round(PLANTER_W_M * pxPerMeterH);
    const planterHpx = Math.round(PLANTER_H_M * pxPerMeterV);
    const potWpx     = Math.round(POT_W_M     * pxPerMeterH);
    const potHpx     = Math.round(POT_H_M     * pxPerMeterV);

    L("[3] planter=" + planterWpx + "x" + planterHpx + "px  pot=" + potWpx + "x" + potHpx + "px");

    // ── מיקום Y ─────────────────────────────────────
    // כל האלמנטים יושבים על הרצפה צמוד למעקה — תחתית ב-railingY
    const planterY = railingY - planterHpx;
    const potY     = railingY - potHpx;

    // ── מיקום X — פריסה: [כד][אדנית1][אדנית2][כד] ─
    // רווח שווה בין האלמנטים
    const totalElementsW = potWpx + planterWpx + planterWpx + potWpx;
    const totalGap       = imageWidth - totalElementsW;
    const gap            = Math.round(totalGap / 5); // 5 חללים: שמאל, בין כל אלמנט, ימין

    const potLeftX     = gap;
    const planter1X    = potLeftX  + potWpx     + gap;
    const planter2X    = planter1X + planterWpx + gap;
    const potRightX    = planter2X + planterWpx + gap;

    L("[4] potL=" + potLeftX + " p1=" + planter1X + " p2=" + planter2X + " potR=" + potRightX);

    const potLeft:   Zone = { x: potLeftX,  y: potY,     width: potWpx,     height: potHpx     };
    const planter1:  Zone = { x: planter1X, y: planterY, width: planterWpx, height: planterHpx };
    const planter2:  Zone = { x: planter2X, y: planterY, width: planterWpx, height: planterHpx };
    const potRight:  Zone = { x: potRightX, y: potY,     width: potWpx,     height: potHpx     };

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
