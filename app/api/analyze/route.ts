// app/api/analyze/route.ts
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ANALYSIS_PROMPT = `אתה מומחה לאדריכלות ומרפסות ישראליות. נתח את תמונת המרפסת והחזר JSON בלבד, ללא טקסט נוסף.

הנחיות להערכת מידות:
- מרפסת ישראלית טיפוסית: רוחב 2.5-5 מ׳, עומק 1.2-2.0 מ׳
- השתמש בנקודות ייחוס: גובה מעקה ~ 1.0-1.1 מ׳, דלת ~ 2.0 מ׳, אדם ~ 1.7 מ׳
- אם אין רמזי גודל ברורים - הטה לצד הקטן
- גובה הקיר האחורי: מדוד מרצפה עד תקרה/גג - בדרך כלל 2.4-3.2 מ׳

הנחיות לצבעים:
- זהה את הצבעים הדומיננטיים של הרצפה, הקירות, המעקה
- תאר בשמות צבע פשוטים (חום, אפור, לבן, בז׳, שחור, עץ טבעי)

החזר בדיוק את מבנה ה-JSON הזה:
{
  "balcony_size": "קטנה|בינונית|גדולה",
  "width_m": <מספר עשרוני>,
  "depth_m": <מספר עשרוני>,
  "wall_height_m": <גובה הקיר האחורי במטרים, מספר עשרוני>,
  "sun_direction": "מזרח|מערב|דרום|צפון|לא ידוע",
  "sun_exposure": "שמש מלאה|חצי צל|צל",
  "railing": "זכוכית|ברזל|בטון|עץ|אין",
  "style": "מודרני|ים-תיכוני|כפרי|מינימליסטי",
  "floor_color": "<צבע הרצפה>",
  "wall_color": "<צבע הקירות>",
  "railing_color": "<צבע המעקה>",
  "notes": "<תיאור קצר בעברית, משפט אחד>"
}`;

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const log: string[] = [];
  const { imageBase64, mimeType = "image/jpeg" } = await req.json();

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (d: object) =>
        ctrl.enqueue(encoder.encode("data: " + JSON.stringify(d) + "\n\n"));
      const L = (m: string) => { console.log(m); log.push(m); };
      const fail = (m: string) => { send({ type: "error", message: m, debug: { log } }); ctrl.close(); };

      try {
        if (!imageBase64) return fail("לא התקבלה תמונה");
        if (!process.env.ANTHROPIC_API_KEY) return fail("חסר מפתח Anthropic");

        L("[0] " + Math.round(imageBase64.length / 1024) + "KB");
        send({ type: "step", step: 0 });

        let analysis: Record<string, string | number> = {
          width_m: 3.0, depth_m: 1.4, wall_height_m: 2.6,
          balcony_size: "בינונית", sun_exposure: "חצי צל",
          style: "מודרני", railing: "זכוכית",
          floor_color: "אפור", wall_color: "לבן", railing_color: "אפור", notes: "",
        };

        for (let a = 1; a <= 3; a++) {
          try {
            const msg = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 700,
              messages: [{
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg"|"image/png"|"image/webp", data: imageBase64 } },
                  { type: "text", text: ANALYSIS_PROMPT },
                ],
              }],
            });
            const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
            const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
            parsed.width_m      = Math.min(Math.max(Number(parsed.width_m)      || 3.0, 1.0), 8.0);
            parsed.depth_m      = Math.min(Math.max(Number(parsed.depth_m)      || 1.4, 0.8), 3.0);
            parsed.wall_height_m = Math.min(Math.max(Number(parsed.wall_height_m) || 2.6, 2.0), 4.0);
            analysis = parsed;
            L("[1] " + JSON.stringify(analysis));
            break;
          } catch (e) {
            L("[1] attempt " + a + " failed: " + e);
            if (a < 3) await new Promise(r => setTimeout(r, 2000 * a));
          }
        }

        send({ type: "step", step: 1, analysis });
        send({ type: "done", analysis, debug: { log } });

      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : "error";
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
