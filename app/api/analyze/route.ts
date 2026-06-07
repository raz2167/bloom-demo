// app/api/analyze/route.ts
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// קטלוג קשיח — 2 אדניות 60 ס"מ
const PRODUCTS = [
  {
    productId:  "adanit_1",
    name:       "אדנית 1 עם צמחייה",
    productUrl: "https://res.cloudinary.com/dvt1kqbjq/image/upload/Nurseries/Bloom_Demo/combinations/%D7%90%D7%93%D7%A0%D7%99%D7%AA_1_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94.png",
    label: "אדנית מלבנית · 60 ס\u05f4מ",
  },
  {
    productId:  "adanit_2",
    name:       "אדנית 2 עם צמחייה",
    productUrl: "https://res.cloudinary.com/dvt1kqbjq/image/upload/Nurseries/Bloom_Demo/combinations/%D7%90%D7%93%D7%A0%D7%99%D7%AA_2_%D7%A2%D7%9D_%D7%A6%D7%9E%D7%97%D7%99%D7%99%D7%94.png",
    label: "אדנית מלבנית · 60 ס\u05f4מ",
  },
];

// שרטוט ריק מ-Cloudinary (Demo Balcony)
const BLUEPRINT_URL =
  "https://res.cloudinary.com/dvt1kqbjq/image/upload/Nurseries/Bloom_Demo/Demo%20Balcony/%D7%9E%D7%A8%D7%A4%D7%A1%D7%AA_%D7%9E%D7%90%D7%95%D7%99%D7%99%D7%A8%D7%AA.png";

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
          width_m: 4.0, depth_m: 2.5, balcony_size: "בינונית",
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
                  {
                    type: "text",
                    text: "נתח מרפסת, החזר JSON בלבד:\n" +
                      "{\"balcony_size\":\"קטנה|בינונית|גדולה\"," +
                      "\"width_m\":4.0,\"depth_m\":2.5," +
                      "\"sun_direction\":\"מזרח|מערב|דרום|צפון\"," +
                      "\"sun_exposure\":\"שמש מלאה|חצי צל|צל\"," +
                      "\"railing\":\"זכוכית|ברזל|בטון|עץ|אין\"," +
                      "\"style\":\"מודרני|ים-תיכוני|כפרי|מינימליסטי\"," +
                      "\"notes\":\"הערה קצרה\"}",
                  },
                ],
              }],
            });
            const raw =
              msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
            const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
            if (!parsed.width_m) parsed.width_m = 4.0;
            if (!parsed.depth_m) parsed.depth_m = 2.5;
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
        const width = Number(analysis.width_m) || 4.0;
        // אדנית 60 ס"מ = 0.6 מ' מתוך width מ'
        const pct    = Math.round((0.6 / width) * 100);
        const margin = Math.max(4, Math.round(((width - 1.2) / width) * 100 / 3));

        const placements = [
          { ...PRODUCTS[0], x: margin,                     y: 52, width: pct },
          { ...PRODUCTS[1], x: 100 - margin - pct, y: 52, width: pct },
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
