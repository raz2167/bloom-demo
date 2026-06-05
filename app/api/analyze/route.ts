// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { filterProducts } from "@/lib/catalog";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (msg: string) => { console.log(msg); log.push(msg); };

  try {
    L("🟢 [START] קיבלתי בקשה");

    // ── שלב 1: קריאת הנתונים ─────────────────────────
    const { imageBase64, mimeType = "image/jpeg" } = await req.json();

    if (!imageBase64) {
      L("🔴 [1] שגיאה: לא התקבלה תמונה");
      return NextResponse.json({ error: "לא התקבלה תמונה", debug: { log } }, { status: 400 });
    }
    L(`🟢 [1] תמונה התקבלה | mimeType: ${mimeType} | גודל: ${Math.round(imageBase64.length / 1024)}KB`);

    if (!process.env.ANTHROPIC_API_KEY) {
      L("🔴 [1] שגיאה: אין ANTHROPIC_API_KEY");
      return NextResponse.json({ error: "חסר מפתח Anthropic", debug: { log } }, { status: 500 });
    }

    // ── שלב 2: Claude Vision עם retry ────────────────
    L("🟡 [2] שולח ל-Claude Vision (מודל: claude-sonnet-4-6)...");

    let analysisMsg: Anthropic.Message | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        L(`🟡 [2] ניסיון ${attempt}/3...`);

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

        if (attempt === 3) {
          throw new Error("השירות עמוס כרגע — נסה שוב בעוד 30 שניות 🌿");
        }
        // המתן לפני ניסיון חוזר
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }

    if (!analysisMsg) throw new Error("לא התקבלה תשובה מ-Claude");

    // ── שלב 3: פרסור JSON ─────────────────────────────
    const rawText = analysisMsg.content[0].type === "text"
      ? analysisMsg.content[0].text.trim()
      : "{}";

    L(`🟢 [2] תשובה גולמית: ${rawText.substring(0, 150)}`);

    const jsonStr = rawText.replace(/```json|```/g, "").trim();

    let analysis: Record<string, string>;
    try {
      analysis = JSON.parse(jsonStr);
      L(`🟢 [3] JSON תקין: ${JSON.stringify(analysis)}`);
    } catch {
      L(`🔴 [3] כשל בפרסור: ${jsonStr}`);
      return NextResponse.json({ error: "שגיאה בניתוח התמונה, נסה שוב", debug: { log } }, { status: 500 });
    }

    // ── שלב 4: סינון מוצרים ──────────────────────────
    L("🟡 [4] מסנן מוצרים מהקטלוג...");
    const recommendations = filterProducts(analysis as Parameters<typeof filterProducts>[0]);
    L(`🟢 [4] נמצאו ${recommendations.length} מוצרים`);

    // ── שלב 5: DALL-E ─────────────────────────────────
    L("🟡 [5] מתחיל שלב DALL-E...");
    let imageUrl: string | null = null;

    if (!process.env.OPENAI_API_KEY) {
      L("🔴 [5] אין OPENAI_API_KEY — מדלג");
    } else {
      L("🟢 [5] יש OPENAI_API_KEY — שולח בקשה...");

      const prompt = buildPrompt(analysis);
      L(`🟢 [5] פרומפט: ${prompt.substring(0, 80)}...`);

      const controller = new AbortController();
const timeoutId = setTimeout(() => {
  controller.abort();
  L("🔴 [5] DALL-E timeout אחרי 25 שניות — ממשיך בלי תמונה");
}, 25000);

const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  signal: controller.signal,
  headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-2",
          prompt,
          n: 1,
          size: "1024x1024",
          quality: "medium",
        }),
      });

      L(`🟢 [5] OpenAI status: ${dalleRes.status}`);
      const dalleData = await dalleRes.json();

      if (dalleData.error) {
        L(`🔴 [5] OpenAI שגיאה: ${JSON.stringify(dalleData.error).substring(0, 100)}`);
      } else if (dalleData.data?.[0]?.b64_json) {
        imageUrl = `data:image/png;base64,${dalleData.data[0].b64_json}`;
        L(`🟢 [5] קיבלתי base64 (${dalleData.data[0].b64_json.length} תווים)`);
      } else if (dalleData.data?.[0]?.url) {
        imageUrl = dalleData.data[0].url;
        L(`🟢 [5] קיבלתי URL`);
      } else {
        L(`🔴 [5] תשובה לא צפויה: ${JSON.stringify(dalleData).substring(0, 150)}`);
      }
    }

    L(`✅ [DONE] imageUrl: ${imageUrl ? "יש" : "אין"}`);

    return NextResponse.json({ analysis, recommendations, imageUrl, debug: { log } });

  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : "שגיאה לא ידועה";
    L(`🔴 [CATCH] ${raw}`);

    let friendly = "משהו השתבש, נסה שוב בעוד רגע";
    if (raw.includes("🌿"))                                 friendly = raw;
    else if (raw.includes("529") || raw.includes("verloaded")) friendly = "השירות עמוס כרגע — נסה שוב בעוד 30 שניות 🌿";
    else if (raw.includes("401"))                           friendly = "בעיית חיבור — בדוק את מפתח ה-API";
    else if (raw.includes("timeout"))                       friendly = "הבקשה לקחה יותר מדי זמן — נסה תמונה קטנה יותר";

    return NextResponse.json({ error: friendly, debug: { log } }, { status: 500 });
  }
}

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
