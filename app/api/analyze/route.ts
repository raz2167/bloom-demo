// app/api/analyze/route.ts
// SSE — שולח אירועי התקדמות אמיתיים בזמן אמת

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { filterProducts } from "@/lib/catalog";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const log: string[] = [];

  // קריאת הנתונים לפני פתיחת ה-stream
  const body = await req.json();
  const { imageBase64, mimeType = "image/jpeg" } = body;

  const stream = new ReadableStream({
    async start(ctrl) {

      // פונקציות עזר
      const send = (data: object) => {
        const line = `data: ${JSON.stringify(data)}\n\n`;
        console.log("SSE →", JSON.stringify(data).substring(0, 120));
        ctrl.enqueue(encoder.encode(line));
      };

      const L = (msg: string) => {
        console.log(msg);
        log.push(msg);
      };

      const fail = (message: string) => {
        L(`🔴 [FAIL] ${message}`);
        send({ type: "error", message, debug: { log } });
        ctrl.close();
      };

      // ─────────────────────────────────────────────
      try {
        L("🟢 [START]");

        // ── בדיקות בסיסיות ──────────────────────────
        if (!imageBase64) return fail("לא התקבלה תמונה");
        if (!process.env.ANTHROPIC_API_KEY) return fail("חסר מפתח Anthropic");

        L(`🟢 [1] תמונה: ${Math.round(imageBase64.length / 1024)}KB | ${mimeType}`);

        // ── שלב 0: מנתח את התמונה ───────────────────
        send({ type: "step", step: 0 });

        // ── שלב 1: Claude Vision ─────────────────────
        let analysisMsg: Anthropic.Message | null = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            L(`🟡 [2] Claude Vision ניסיון ${attempt}/3...`);

            analysisMsg = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 512,
              messages: [
                {
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
                      text: `אתה מעצב גינות מרפסת. נתח את התמונה והחזר JSON בלבד, ללא טקסט נוסף:
{
  "balcony_size": "קטנה|בינונית|גדולה",
  "sun_exposure": "שמש מלאה|חצי צל|צל",
  "style": "ים-תיכוני|מודרני|כפרי|מינימליסטי|בוהו",
  "railing": "ברזל|בטון|זכוכית|עץ|אין",
  "floor_color": "תיאור קצר",
  "notes": "הערה קצרה אחת"
}`,
                    },
                  ],
                },
              ],
            });

            L(`🟢 [2] הצליח בניסיון ${attempt}`);
            break;

          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            L(`🔴 [2] ניסיון ${attempt} נכשל: ${msg.substring(0, 100)}`);
            if (attempt === 3) return fail("השירות עמוס כרגע — נסה שוב בעוד 30 שניות 🌿");
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        }

        // ── פרסור JSON ───────────────────────────────
        const rawText =
          analysisMsg!.content[0].type === "text"
            ? analysisMsg!.content[0].text.trim()
            : "{}";

        L(`🟢 [2] תשובה: ${rawText.substring(0, 150)}`);

        const jsonStr = rawText.replace(/```json|```/g, "").trim();

        let analysis: Record<string, string>;
        try {
          analysis = JSON.parse(jsonStr);
          L(`🟢 [3] ניתוח: ${JSON.stringify(analysis)}`);
        } catch {
          return fail("שגיאה בניתוח התמונה, נסה שוב");
        }

        // ── שלב 1 הושלם: שלח ניתוח ──────────────────
        send({ type: "step", step: 1, analysis });

        // ── סינון מוצרים ─────────────────────────────
        const recommendations = filterProducts(
          analysis as Parameters<typeof filterProducts>[0]
        );
        L(`🟢 [4] נמצאו ${recommendations.length} מוצרים`);

        // ── שלב 2 הושלם ──────────────────────────────
        send({ type: "step", step: 2 });

        // ── שלב 3: DALL-E ────────────────────────────
        let imageUrl: string | null = null;

        if (!process.env.OPENAI_API_KEY) {
          L("🔴 [5] אין OPENAI_API_KEY");
        } else {
          send({ type: "step", step: 3 });
          L("🟡 [5] שולח ל-gpt-image-2...");

          try {
            const abortCtrl = new AbortController();
            const tid = setTimeout(() => {
              abortCtrl.abort();
              L("🔴 [5] timeout אחרי 25 שניות");
            }, 25000);

            const dalleRes = await fetch(
              "https://api.openai.com/v1/images/generations",
              {
                method: "POST",
                signal: abortCtrl.signal,
                headers: {
                  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "gpt-image-2",
                  prompt: buildPrompt(analysis),
                  n: 1,
                  size: "1024x1024",
                  quality: "medium",
                }),
              }
            );

            clearTimeout(tid);
            L(`🟢 [5] status: ${dalleRes.status}`);

            const dalleData = await dalleRes.json();

            if (dalleData.error) {
              L(`🔴 [5] OpenAI שגיאה: ${JSON.stringify(dalleData.error).substring(0, 100)}`);
            } else if (dalleData.data?.[0]?.b64_json) {
              imageUrl = `data:image/png;base64,${dalleData.data[0].b64_json}`;
              L("🟢 [5] קיבלתי base64!");
            } else if (dalleData.data?.[0]?.url) {
              imageUrl = dalleData.data[0].url;
              L("🟢 [5] קיבלתי URL!");
            } else {
              L(`🔴 [5] תשובה לא צפויה: ${JSON.stringify(dalleData).substring(0, 150)}`);
            }
          } catch (e: unknown) {
            const isAbort = e instanceof Error && e.name === "AbortError";
            L(`🔴 [5] ${isAbort ? "timeout" : (e instanceof Error ? e.message : "שגיאה")}`);
          }
        }

        // ── שלח תוצאות ───────────────────────────────
        L(`✅ [DONE] imageUrl: ${imageUrl ? "יש" : "אין"}`);
        send({ type: "done", analysis, recommendations, imageUrl, debug: { log } });

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "שגיאה לא ידועה";
        return fail(msg);
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

// ── בניית פרומפט ────────────────────────────────────
function buildPrompt(analysis: Record<string, string>): string {
  const styles: Record<string, string> = {
    "ים-תיכוני":  "Mediterranean style with terracotta pots, lavender and rosemary",
    "מודרני":     "modern minimalist with clean concrete planters",
    "כפרי":       "rustic country style with wooden planters and wildflowers",
    "מינימליסטי": "clean minimalist with simple white ceramic pots",
    "בוהו":       "boho natural with hanging plants and mixed textures",
  };
  const suns: Record<string, string> = {
    "שמש מלאה": "bathed in bright Mediterranean sunlight",
    "חצי צל":   "with warm dappled light and partial shade",
    "צל":       "in cool pleasant shade with lush shade-loving plants",
  };
  const sizes: Record<string, string> = {
    "קטנה":    "small cozy intimate",
    "בינונית": "medium comfortable",
    "גדולה":   "large spacious",
  };

  return (
    `A beautiful ${sizes[analysis.balcony_size] ?? "medium"} balcony garden ` +
    `${suns[analysis.sun_exposure] ?? "in natural light"}, ` +
    `${styles[analysis.style] ?? styles["ים-תיכוני"]}, ` +
    `lush flowering plants, vibrant greenery, ` +
    `${analysis.railing ?? "iron"} railing, realistic photography, ` +
    `golden hour lighting, Israeli urban architecture, photorealistic`
  );
}
