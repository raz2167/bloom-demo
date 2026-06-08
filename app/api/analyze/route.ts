// app/api/analyze/route.ts
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PRODUCTS = [
  {
    productId:  "adanit_1",
    name:       "אדנית 1 עם צמחייה",
    productUrl: "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739075/%D7%90%D7%93%D7%A0%D7%99%D7%AA_1_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94_qt2ukz.png",
    label: "אדנית מלבנית · 60 ס\u05f4מ",
  },
  {
    productId:  "adanit_2",
    name:       "אדנית 2 עם צמחייה",
    productUrl: "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739075/%D7%90%D7%93%D7%A0%D7%99%D7%AA_2_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94_ganzd2.png",
    label: "אדנית מלבנית · 60 ס\u05f4מ",
  },
];

const BLUEPRINT_URL =
  "https://res.cloudinary.com/dvt1kqbjq/image/upload/v1780739920/%D7%9E%D7%A8%D7%A4%D7%A1%D7%AA_%D7%9E%D7%90%D7%95%D7%99%D7%99%D7%A8%D7%AA_jisx2e.png";

const ANALYSIS_PROMPT = `אתה מומחה לאדריכלות ומרפסות ישראליות. נתח את תמונת המרפסת והחזר JSON בלבד, ללא טקסט נוסף.

הנחיות להערכת מידות — חשוב מאוד:
- מרפסת ישראלית טיפוסית: רוחב 2.5–5 מ׳, עומק 1.2–2.0 מ׳
- השתמש בנקודות ייחוס ויזואליות: גובה מעקה ≈ 1.0–1.1 מ׳, דלת ≈ 2.0 מ׳, כיסא ≈ 0.45 מ׳
- עומק של מרפסת רגילה לרוב 1.2–1.8 מ׳ — לא יותר מ-2.5 מ׳ אלא אם ברור שהיא גדולה במיוחד
- אם אין רמזי גודל ברורים — הטה לצד הקטן, לא הגדול

החזר בדיוק את מבנה ה-JSON הזה:
{
  "balcony_size": "קטנה|בינונית|גדולה",
  "width_m": <מספר עשרוני, למשל 3.2>,
  "depth_m": <מספר עשרוני, למשל 1.4>,
  "sun_direction": "מזרח|מערב|דרום|צפון|לא ידוע",
  "sun_exposure": "שמש מלאה|חצי צל|צל",
  "railing": "זכוכית|ברזל|בטון|עץ|אין",
  "style": "מודרני|ים-תיכוני|כפרי|מינימליסטי",
  "notes": "תיאור קצר של המרפסת בעברית, משפט אחד"
}`;

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const log: string[] = [];
  const body = await req.json();
  const { imageBase64, mimeType = "image/jpeg" } = body;

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (d: object) =>
        ctrl.enqueue(encoder.encode("data: " + JSON.stringify(d) + "\n\n"));
      const L = (m: string) => { console.log(m); log.push(m); };
      const fail = (m: string) => {
        send({ type: "error", message: m, debug: { log } });
        ctrl.close();
      };

      try {
        if (!imageBase64) return fail("לא התקבלה תמונה");
        if (!process.env.ANTHROPIC_API_KEY) return fail("חסר מפתח Anthropic");

        L("[0] " + Math.round(imageBase64.length / 1024) + "KB");
        send({ type: "step", step: 0 });

        // ── שלב 1: Claude Vision ──────────────────────
        let analysis: Record<string, string | number> = {
          width_m: 3.0, depth_m: 1.4, balcony_size: "בינונית",
          sun_exposure: "חצי צל", style: "מודרני", railing: "זכוכית", notes: "",
        };

        for (let a = 1; a <= 3; a++) {
          try {
            const msg = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 700,
              messages: [{
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mimeType as "image/jpeg" | "image/png" | "image/webp",
                      data: imageBase64,
                    },
                  },
                  { type: "text", text: ANALYSIS_PROMPT },
                ],
              }],
            });
            const raw =
              msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
            const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
            // ברירות מחדל רק אם חסר לחלוטין
            if (!parsed.width_m) parsed.width_m = 3.0;
            if (!parsed.depth_m) parsed.depth_m = 1.4;
            // clamp — לא יעלה על ערכים סבירים
            parsed.width_m = Math.min(Math.max(Number(parsed.width_m), 1.0), 8.0);
            parsed.depth_m = Math.min(Math.max(Number(parsed.depth_m), 0.8), 3.0);
            analysis = parsed;
            L("[1] " + JSON.stringify(analysis));
            break;
          } catch (e: unknown) {
            L("[1] ניסיון " + a + " נכשל: " + e);
            if (a === 3) {
              L("[1] ממשיך עם ברירות מחדל");
            } else {
              await new Promise(r => setTimeout(r, 2000 * a));
            }
          }
        }

        send({ type: "step", step: 1, analysis });

        // ── שלב 2: מיקום 2 האדניות ───────────────────
        const width = Number(analysis.width_m) || 3.0;
        const pct    = Math.round((0.6 / width) * 100);
        const margin = Math.max(4, Math.round(((width - 1.2) / width) * 100 / 3));

        const placements = [
          { ...PRODUCTS[0], x: margin,              y: 52, width: pct },
          { ...PRODUCTS[1], x: 100 - margin - pct,  y: 52, width: pct },
        ];

        L("[2] x1=" + placements[0].x + "% x2=" + placements[1].x + "% w=" + pct + "%");

        send({
          type: "done",
          analysis,
          placements,
          imageUrl: BLUEPRINT_URL,
          debug: { log },
        });

      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : "שגיאה";
        L("CATCH: " + m);
        send({ type: "error", message: "משהו השתבש, נסה שוב", debug: { log } });
      }

      ctrl.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
