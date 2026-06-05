// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { filterProducts } from "@/lib/catalog";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // ── לוג מלא של כל שלב ─────────────────────────────
  const log: string[] = [];
  const L = (msg: string) => {
    console.log(msg);
    log.push(msg);
  };

  try {
    L("🟢 [START] קיבלתי בקשה");

    // ── שלב 1: קריאת הנתונים ─────────────────────────
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg" } = body;

    if (!imageBase64) {
      L("🔴 [1] שגיאה: לא התקבלה תמונה");
      return NextResponse.json({ error: "לא התקבלה תמונה", debug: { log } }, { status: 400 });
    }

    L(`🟢 [1] תמונה התקבלה | mimeType: ${mimeType} | גודל: ${Math.round(imageBase64.length / 1024)}KB`);

    // ── שלב 2: Claude Vision ──────────────────────────
    L("🟡 [2] שולח ל-Claude Vision...");

    if (!process.env.ANTHROPIC_API_KEY) {
      L("🔴 [2] שגיאה: אין ANTHROPIC_API_KEY");
      return NextResponse.json({ error: "אין ANTHROPIC_API_KEY", debug: { log } }, { status: 500 });
    }

    const analysisMsg = await anthropic.messages.create({
      model: "claude-opus-4-5",
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

    L("🟢 [2] Claude ענה");

    const rawText =
      analysisMsg.content[0].type === "text"
        ? analysisMsg.content[0].text.trim()
        : "{}";

    L(`🟢 [2] תשובה גולמית: ${rawText.substring(0, 150)}`);

    const jsonStr = rawText.replace(/```json|```/g, "").trim();

    let analysis: Record<string, string>;
    try {
      analysis = JSON.parse(jsonStr);
      L(`🟢 [2] JSON פורסר בהצלחה: ${JSON.stringify(analysis)}`);
    } catch {
      L(`🔴 [2] כשל בפרסור JSON: ${jsonStr}`);
      return NextResponse.json({ error: "Claude לא החזיר JSON תקין", debug: { log } }, { status: 500 });
    }

    // ── שלב 3: סינון מוצרים ──────────────────────────
    L("🟡 [3] מסנן מוצרים מהקטלוג...");

    const recommendations = filterProducts(analysis as Parameters<typeof filterProducts>[0]);

    L(`🟢 [3] נמצאו ${recommendations.length} מוצרים`);

    // ── שלב 4: DALL-E / gpt-image-2 ──────────────────
    L("🟡 [4] מתחיל שלב DALL-E...");

    let imageUrl: string | null = null;

    if (!process.env.OPENAI_API_KEY) {
      L("🔴 [4] אין OPENAI_API_KEY — מדלג על DALL-E");
    } else {
      L("🟢 [4] יש OPENAI_API_KEY — בונה פרומפט...");

      const prompt = buildPrompt(analysis);
      L(`🟢 [4] פרומפט: ${prompt.substring(0, 100)}...`);
      L("🟡 [4] שולח בקשה ל-OpenAI...");

      const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
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

      L(`🟢 [4] OpenAI status: ${dalleRes.status}`);

      const dalleData = await dalleRes.json();
      L(`🟢 [4] OpenAI response keys: ${Object.keys(dalleData).join(", ")}`);

      if (dalleData.error) {
        L(`🔴 [4] OpenAI שגיאה: ${JSON.stringify(dalleData.error)}`);
      } else if (dalleData.data?.[0]) {
        const item = dalleData.data[0];
        L(`🟢 [4] data[0] keys: ${Object.keys(item).join(", ")}`);

        if (item.url) {
          imageUrl = item.url;
          L(`🟢 [4] קיבלתי URL: ${imageUrl!.substring(0, 60)}...`);
        } else if (item.b64_json) {
          imageUrl = `data:image/png;base64,${item.b64_json}`;
          L(`🟢 [4] קיבלתי base64, אורך: ${item.b64_json.length} תווים`);
        } else {
          L(`🔴 [4] לא מצאתי url או b64_json ב-data[0]`);
        }
      } else {
        L(`🔴 [4] אין data[0] בתשובה: ${JSON.stringify(dalleData).substring(0, 200)}`);
      }
    }

    // ── סיום ────────────────────────────────────────
    L(`✅ [DONE] imageUrl: ${imageUrl ? "יש" : "אין"}`);

    return NextResponse.json({
      analysis,
      recommendations,
      imageUrl,
      debug: { log },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "שגיאה לא ידועה";
    L(`🔴 [CATCH] ${msg}`);
    console.error("Full error:", err);
    return NextResponse.json({ error: msg, debug: { log } }, { status: 500 });
  }
}

// ── בניית פרומפט ────────────────────────────────────
function buildPrompt(analysis: Record<string, string>): string {
  const styles: Record<string, string> = {
    "ים-תיכוני": "Mediterranean style with terracotta pots, lavender and rosemary",
    "מודרני":    "modern minimalist with clean concrete planters and structured greenery",
    "כפרי":      "rustic country style with wooden planters and wildflowers",
    "מינימליסטי": "clean minimalist with simple white ceramic pots",
    "בוהו":      "boho natural with hanging plants and mixed textures",
  };
  const suns: Record<string, string> = {
    "שמש מלאה": "bathed in bright Mediterranean sunlight",
    "חצי צל":   "with warm dappled light and partial shade",
    "צל":       "in cool pleasant shade with lush shade-loving plants",
  };
  const sizes: Record<string, string> = {
    "קטנה":   "small cozy intimate",
    "בינונית": "medium comfortable",
    "גדולה":   "large spacious",
  };

  const style = styles[analysis.style]   ?? styles["ים-תיכוני"];
  const sun   = suns[analysis.sun_exposure] ?? suns["חצי צל"];
  const size  = sizes[analysis.balcony_size] ?? sizes["בינונית"];

  return (
    `A beautiful ${size} balcony garden ${sun}, ${style}, ` +
    `lush flowering plants, vibrant greenery, ` +
    `${analysis.railing ?? "iron"} railing, realistic photography, ` +
    `golden hour lighting, Israeli urban architecture, photorealistic`
  );
}
