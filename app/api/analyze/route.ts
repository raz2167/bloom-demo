// app/api/analyze/route.ts
// Claude Vision + DALL-E blueprint במקביל
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const log: string[] = [];
  const body = await req.json();
  const { imageBase64, mimeType = "image/jpeg" } = body;

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (d: object) => ctrl.enqueue(encoder.encode("data: " + JSON.stringify(d) + "\n\n"));
      const L = (m: string) => { console.log(m); log.push(m); };
      const fail = (m: string) => { send({ type: "error", message: m, debug: { log } }); ctrl.close(); };

      try {
        if (!imageBase64) return fail("לא התקבלה תמונה");
        if (!process.env.ANTHROPIC_API_KEY) return fail("חסר מפתח Anthropic");

        L("[0] " + Math.round(imageBase64.length / 1024) + "KB");
        send({ type: "step", step: 0 });

        // הרץ Claude ו-DALL-E במקביל
        const analysisPromise  = runClaudeAnalysis(imageBase64, mimeType, L);
        const blueprintPromise = generateBlueprint(imageBase64, mimeType, L);

        // Claude מהיר יותר - שלח ניתוח ברגע שמוכן
        let analysis: Record<string, string|number>;
        try {
          analysis = await analysisPromise;
          L("[A] ניתוח הושלם");
          send({ type: "step", step: 1, analysis });
        } catch (e) {
          return fail("השירות עמוס - נסה שוב: " + e);
        }

        // המתן ל-DALL-E blueprint
        send({ type: "step", step: 2 });
        let blueprintUrl: string | null = null;
        try {
          blueprintUrl = await blueprintPromise;
          L("[B] blueprint: " + (blueprintUrl ? "יש" : "אין"));
        } catch (e) {
          L("[B] כשל: " + e);
        }

        send({ type: "done", analysis, blueprintUrl, debug: { log } });

      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : "שגיאה";
        L("CATCH: " + m);
        send({ type: "error", message: "משהו השתבש, נסה שוב", debug: { log } });
      }
      ctrl.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}

async function runClaudeAnalysis(imageBase64: string, mimeType: string, L: (m: string) => void): Promise<Record<string, string|number>> {
  L("[A] שולח ל-Claude...");
  for (let a = 1; a <= 3; a++) {
    try {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6", max_tokens: 700,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg"|"image/png"|"image/webp", data: imageBase64 } },
          { type: "text", text: "נתח מרפסת, החזר JSON בלבד:\n{\"balcony_size\":\"קטנה|בינונית|גדולה\",\"width_m\":4.0,\"depth_m\":2.5,\"height_m\":1.1,\"sun_direction\":\"מזרח|מערב|דרום|צפון\",\"sun_exposure\":\"שמש מלאה|חצי צל|צל\",\"railing\":\"זכוכית|ברזל|בטון|עץ|אין\",\"style\":\"מודרני|ים-תיכוני|כפרי|מינימליסטי\",\"notes\":\"הערה קצרה\"}" },
        ]}],
      });
      const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
      const analysis = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (!analysis.width_m) analysis.width_m = 4.0;
      if (!analysis.depth_m) analysis.depth_m = 2.5;
      L("[A] " + JSON.stringify(analysis));
      return analysis;
    } catch (e: unknown) {
      L("[A] ניסיון " + a + " נכשל");
      if (a === 3) throw e;
      await new Promise(r => setTimeout(r, 2000 * a));
    }
  }
  throw new Error("Claude לא הגיב");
}

async function generateBlueprint(imageBase64: string, mimeType: string, L: (m: string) => void): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) { L("[B] אין OPENAI_API_KEY"); return null; }
  L("[B] שולח ל-DALL-E edits...");
  try {
    const fd = new FormData();
    fd.append("model", "gpt-image-2");
    fd.append("image[]", new Blob([Buffer.from(imageBase64, "base64")], { type: mimeType }), "balcony.jpg");
    fd.append("prompt",
      "Convert this balcony photo into a clean architectural line drawing. " +
      "Keep exact same perspective, dimensions, floor tiles, railing, walls and door frames. " +
      "Black thin precise lines on pure white background. No shading, no color, no shadows. " +
      "Technical drawing style. Empty balcony, no plants, no furniture."
    );
    fd.append("n", "1");
    fd.append("size", "1024x1024");

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body: fd,
    });
    L("[B] status: " + res.status);
    const data = await res.json();
    L("[B] " + JSON.stringify(data).substring(0, 200));

    if (data.data?.[0]?.url) return data.data[0].url;
    if (data.data?.[0]?.b64_json) return await saveToCloudinary(data.data[0].b64_json, L);
    return null;
  } catch (e) {
    L("[B] שגיאה: " + e);
    return null;
  }
}

async function saveToCloudinary(b64: string, L: (m: string) => void): Promise<string | null> {
  const cn = process.env.CLOUDINARY_CLOUD_NAME;
  const ak = process.env.CLOUDINARY_API_KEY;
  const as = process.env.CLOUDINARY_API_SECRET;
  if (!cn || !ak || !as) return null;
  try {
    const body = new URLSearchParams();
    body.append("file", "data:image/png;base64," + b64);
    body.append("folder", "blueprints");
    const res = await fetch("https://api.cloudinary.com/v1_1/" + cn + "/image/upload", {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(ak + ":" + as).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await res.json();
    L("[C] " + (data.secure_url ? "שמור ב-Cloudinary" : JSON.stringify(data).substring(0, 100)));
    return data.secure_url || null;
  } catch (e) {
    L("[C] שגיאה: " + e);
    return null;
  }
}
