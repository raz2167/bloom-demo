// app/api/plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const PRICES = { adanit_unit:189, plant_small:35, plant_medium:55, plant_large:85, soil_liter:1.2, perlite_liter:2.5, tuff_liter:1.8 };
const PLANTER_VOLUME_L = 43.2;

interface PlantChoice { nameHe: string; nameEn: string; totalCount: number; size: string; visualDesc: string; }

const DALLE_PLACEMENT_RULES = (
  "This is a black and white architectural line drawing of a balcony. " +
  "Preserve this line drawing exactly as the background. " +
  "Do not replace or redraw the floor, walls or railing. " +
  "Only add the following colored elements on top of the existing line drawing. " +
  "PLACEMENT RULES: planters must be flush against the back wall touching it, " +
  "their long 60cm side running parallel to the wall like window boxes, " +
  "NOT sticking out into the balcony, evenly spaced across the full width. " +
  "The railing must remain visible above and behind the planters. "
);

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    L("[1] parsing request");
    const { blueprintUrl, width_m, depth_m, direction, sun_pct, garden_style, floor_color, wall_color, railing_color } = await req.json();

    if (!blueprintUrl)                  return NextResponse.json({ error: "missing blueprintUrl",  step: "validate", debug: { log } }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "missing Anthropic key", step: "validate", debug: { log } }, { status: 500 });

    const planterCount = Math.min(8, Math.max(2, Math.floor(width_m / 0.9)));
    L("[1] planterCount: " + planterCount + " for width " + width_m + "m");

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userPrompt = `Create a detailed garden design for a balcony. Return JSON only.

BALCONY: ${width_m}m x ${depth_m}m, faces ${direction}, ${sun_pct}% sun, style=${garden_style}
COLORS: floor=${floor_color}, walls=${wall_color}, railing=${railing_color}
PLANTERS: exactly ${planterCount} rectangular 60x30x30cm planters

INSTRUCTIONS:
1. Choose planterColorHe (Hebrew) and planterColorEn (English) matching balcony colors: anthracite gray / light gray / terracotta / sand beige
2. Choose 3-5 plant species. Sun >70%: lavender/rosemary/geranium/sage. 40-70%: impatiens/begonia/coleus. <40%: ferns/browallia. Mediterranean: lavender/rosemary/thyme. Modern: grasses/succulents. Jungle: coleus/caladium/ferns. Mix tall, medium and trailing/cascading species.
3. Choose soilPct, perlitePct, tuffPct (must sum to 100). Drought-tolerant=60/20/20, flowering=70/20/10, succulents=40/40/20, shade=80/10/10.
4. Write dallePrompt: a rich detailed description for DALL-E. Start with this exact sentence: "${DALLE_PLACEMENT_RULES}" Then describe: the ${planterCount} planters with their color, and a VARIED arrangement with specific plant combinations per planter creating visual rhythm. Vary heights (tall centerpieces + low cascading + trailing), colors, and textures across the planters. Be specific about which plant goes in which planter position. Make it lush and wow.
5. Write designFacts: exactly 10 short Hebrew facts about THIS specific garden design. Facts about plant choices, colors, quantities, soil mix, expected bloom seasons, scents, maintenance tips. Each fact max 12 words. Plain text, no special characters.

Return ONLY this JSON:
{
  "planterColorHe": "...",
  "planterColorEn": "...",
  "plants": [{"nameHe": "...", "nameEn": "...", "totalCount": 4, "size": "medium", "visualDesc": "purple flowering lavender 35cm tall dense silver-green foliage"}],
  "soilPct": 60, "perlitePct": 20, "tuffPct": 20,
  "dallePrompt": "${DALLE_PLACEMENT_RULES}[DETAILED VARIED PLANT DESCRIPTION HERE]",
  "designFacts": ["עובדה 1", "עובדה 2", "עובדה 3", "עובדה 4", "עובדה 5", "עובדה 6", "עובדה 7", "עובדה 8", "עובדה 9", "עובדה 10"]
}`;

    L("[2] calling Claude Haiku");
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2500,
      system: "You are a professional garden designer. Respond ONLY with valid JSON, no markdown, no text outside JSON.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = response.content.filter(b => b.type === "text").map(b => (b as {type:"text";text:string}).text).join("");
    L("[2] response length: " + raw.length);

    L("[3] parsing JSON");
    let plan: { planterColorHe: string; planterColorEn: string; plants: PlantChoice[]; soilPct: number; perlitePct: number; tuffPct: number; dallePrompt: string; designFacts: string[] } = {
      planterColorHe: "אפור אנתרציט", planterColorEn: "anthracite gray",
      plants: [{ nameHe: "לבנדר", nameEn: "lavender", totalCount: planterCount * 2, size: "medium", visualDesc: "purple flowering lavender 30cm tall" }],
      soilPct: 60, perlitePct: 20, tuffPct: 20,
      dallePrompt: DALLE_PLACEMENT_RULES + "Place " + planterCount + " anthracite planters with lavender and rosemary, lush and full.",
      designFacts: [],
    };
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const start = cleaned.indexOf("{");
      const end   = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("no JSON found");
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      plan = { ...plan, ...parsed };
    } catch (parseErr) {
      L("[3] parse error: " + parseErr + " using defaults");
    }
    L("[3] plan: " + plan.planterColorEn + ", " + plan.plants.length + " species, facts: " + plan.designFacts.length);

    L("[4] calculating products");
    const items: { name: string; qty: number; unitPrice: number; total: number }[] = [];
    items.push({ name: "אדנית מלבנית 60x30x30 סמ (" + plan.planterColorHe + ")", qty: planterCount, unitPrice: PRICES.adanit_unit, total: planterCount * PRICES.adanit_unit });

    plan.plants.forEach(pl => {
      const unitPrice = pl.size === "small" ? PRICES.plant_small : pl.size === "large" ? PRICES.plant_large : PRICES.plant_medium;
      items.push({ name: pl.nameHe + " שתיל", qty: pl.totalCount, unitPrice, total: pl.totalCount * unitPrice });
    });

    const totalSoilL    = PLANTER_VOLUME_L * planterCount * plan.soilPct    / 100;
    const totalPerliteL = PLANTER_VOLUME_L * planterCount * plan.perlitePct / 100;
    const totalTuffL    = PLANTER_VOLUME_L * planterCount * plan.tuffPct    / 100;

    const soilBags    = Math.ceil(totalSoilL    / 20);
    const perliteBags = Math.ceil(totalPerliteL / 10);
    const tuffBags    = Math.ceil(totalTuffL    / 10);

    if (soilBags > 0)    items.push({ name: "אדמה לצמחים שק 20 ליטר",  qty: soilBags,    unitPrice: Math.round(PRICES.soil_liter    * 20), total: soilBags    * Math.round(PRICES.soil_liter    * 20) });
    if (perliteBags > 0) items.push({ name: "פרלייט שק 10 ליטר",        qty: perliteBags, unitPrice: Math.round(PRICES.perlite_liter * 10), total: perliteBags * Math.round(PRICES.perlite_liter * 10) });
    if (tuffBags > 0)    items.push({ name: "טוף שק 10 ליטר",            qty: tuffBags,    unitPrice: Math.round(PRICES.tuff_liter    * 10), total: tuffBags    * Math.round(PRICES.tuff_liter    * 10) });

    const grandTotal = items.reduce((s, i) => s + i.total, 0);
    L("[4] total: " + grandTotal + " ILS, " + items.length + " items");

    return NextResponse.json({
      dallePrompt: plan.dallePrompt,
      waitingFacts: plan.designFacts ?? [],
      products: { items, grandTotal },
      debug: { log }
    });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    L("CATCH: " + m);
    return NextResponse.json({ error: m, step: "catch", debug: { log } }, { status: 500 });
  }
}
