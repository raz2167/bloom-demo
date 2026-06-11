// app/api/facts/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { width_m, depth_m, direction, sun_pct, garden_style } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY)
      return NextResponse.json({ facts: [] }, { status: 500 });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `אתה מעצב גינות מקצועי. צור 5 עובדות מעניינות בעברית על הגינה שמתכננים עכשיו.

פרטי המרפסת: ${width_m}מ רוחב, ${depth_m}מ עומק, פונה ל${direction}, ${sun_pct}% שמש, סגנון ${garden_style === "modern" ? "מודרני" : garden_style === "mediterranean" ? "ים-תיכוני" : "ג׳ונגל טבעי"}.

כללים:
- כל עובדה תהיה ספציפית למרפסת הזו (הכיוון, השמש, הסגנון)
- משפט אחד, עד 15 מילה
- טקסט רגיל בלבד, ללא תווים מיוחדים, ללא מירכאות, ללא מקפים
- החזר JSON בלבד: { "facts": ["עובדה1", "עובדה2", "עובדה3", "עובדה4", "עובדה5"] }`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      system: "Respond ONLY with valid JSON, no markdown, no text outside JSON.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return NextResponse.json({ facts: [] });

    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return NextResponse.json({ facts: parsed.facts ?? [] });
  } catch {
    return NextResponse.json({ facts: [] });
  }
}
