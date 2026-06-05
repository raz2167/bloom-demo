// app/api/analyze/route.ts
// Backend: קולט תמונה → Claude Vision → DALL-E → מחזיר תוצאות

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { filterProducts } from "@/lib/catalog";
export const maxDuration = 60;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "לא התקבלה תמונה" }, { status: 400 });
    }

    // ── שלב 1: Claude Vision מנתח את המרפסת ───────────────
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
              text: `אתה מעצב גינות מרפסת מקצועי. נתח את התמונה והחזר JSON בלבד, ללא טקסט נוסף:
{
  "balcony_size": "קטנה|בינונית|גדולה",
  "sun_exposure": "שמש מלאה|חצי צל|צל",
  "style": "ים-תיכוני|מודרני|כפרי|מינימליסטי|בוהו",
  "railing": "ברזל|בטון|זכוכית|עץ|אין",
  "floor_color": "תיאור קצר של צבע הריצפה",
  "notes": "הערה קצרה אחת על מה שייחודי במרפסת"
}

הנחיות:
- balcony_size: קטנה = עד 6מ"ר, בינונית = 6-15מ"ר, גדולה = מעל 15מ"ר
- sun_exposure: בדוק כיוון המרפסת ואת צל הבניין
- style: נחש לפי הריהוט, המעקה וסגנון הבנייה`
            },
          ],
        },
      ],
    });

    // נקה את תשובת Claude (לפעמים מגיע עם ```json)
    const rawText =
      analysisMsg.content[0].type === "text"
        ? analysisMsg.content[0].text.trim()
        : "{}";
    const jsonStr = rawText.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(jsonStr);

    // ── שלב 2: סינון מוצרים מהקטלוג ──────────────────────
    const recommendations = filterProducts(analysis);

    // ── שלב 3: בניית פרומפט ל-DALL-E ─────────────────────
    const dallePrompt = buildDallePrompt(analysis);

    // ── שלב 4: יצירת תמונה עם DALL-E 3 ───────────────────
    let imageUrl: string | null = null;

if (process.env.OPENAI_API_KEY) {
      const dalleRes = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-2",
prompt: dallePrompt,
n: 1,
size: "512x512",
            
          }),
        }
      );

      if (dalleRes.ok) {
        const dalleData = await dalleRes.json();
console.log("DALL-E full response:", JSON.stringify(dalleData));
imageUrl = dalleData.data?.[0]?.url ?? null;
console.log("imageUrl result:", imageUrl);
      } else {
        console.error("DALL-E error:", await dalleRes.text());
      }
    }

    return NextResponse.json({ analysis, recommendations, imageUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
    console.error("API Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── בניית פרומפט ────────────────────────────────────────
function buildDallePrompt(analysis: {
  style?: string;
  sun_exposure?: string;
  balcony_size?: string;
  railing?: string;
}): string {
  const styleMap: Record<string, string> = {
    "ים-תיכוני": "Mediterranean style, terracotta pots, lavender and rosemary, blue and white ceramics",
    "מודרני": "modern minimalist style, sleek concrete planters, structured greenery",
    "כפרי": "rustic country style, wooden planters, wildflowers and herbs",
    "מינימליסטי": "clean minimalist, simple white ceramic pots, single-variety plants",
    "בוהו": "boho natural style, hanging plants, macrame, mixed textures",
  };
  const sunMap: Record<string, string> = {
    "שמש מלאה": "bathed in bright warm Mediterranean sunlight",
    "חצי צל": "with warm dappled light and pleasant partial shade",
    "צל": "in cool pleasant shade with lush shade-loving ferns and pothos",
  };
  const sizeMap: Record<string, string> = {
    "קטנה": "small cozy intimate",
    "בינונית": "medium comfortable",
    "גדולה": "large spacious",
  };

  const style = styleMap[analysis.style ?? ""] ?? styleMap["ים-תיכוני"];
  const sun = sunMap[analysis.sun_exposure ?? ""] ?? sunMap["חצי צל"];
  const size = sizeMap[analysis.balcony_size ?? ""] ?? sizeMap["בינונית"];
  const railing = analysis.railing ?? "iron";

  return (
    `A stunning ${size} balcony garden ${sun}, ${style}, ` +
    `lush with colorful blooming flowers, vibrant green plants, ` +
    `${railing} railing visible, realistic professional photography, ` +
    `golden hour lighting, Israeli urban architecture, high quality, photorealistic`
  );
}
