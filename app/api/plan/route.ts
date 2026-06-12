// app/api/plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const PRICES = { adanit_unit:189, plant_small:35, plant_medium:55, plant_large:85, soil_liter:1.2, perlite_liter:2.5, tuff_liter:1.8 };
const PLANTER_VOLUME_L = 43.2;

interface PlantChoice { nameHe: string; nameEn: string; totalCount: number; size: string; visualDesc: string; }

function buildDallePrompt(planterCount: number, planterColorEn: string, plants: PlantChoice[], arrangement: string): string {
  const plantList = plants.map(p => p.visualDesc + " (" + p.nameEn + ")").join(", ");
  return (
    "This is a black and white architectural line drawing of a balcony. " +
    "Preserve this line drawing exactly as the background. " +
    "Do not replace or redraw the floor, walls or railing. " +
    "Only add the following colored elements on top of the existing line drawing: " +
    "Place exactly " + planterCount + " rectangular planters (60x30x30cm) in " + planterColorEn + ", " +
    "flush against the back wall, touching it, their long 60cm side running parallel to the wall like window boxes. " +
    "They are NOT sticking out into the balcony. " +
    "Evenly spaced across the full width of the back wall. " +
    "The railing is visible above and behind them. " +
    "Plant species available: " + plantList + ". " +
    "Visual arrangement across the planters: " + arrangement + " " +
    "Each planter overflows with lush established plants (2-3 seasons old, full and dense). " +
    "Plants spill naturally over the planter edges. Create clear visual variety and rhythm between planters."
  );
}

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

    const userPrompt = `Garden design for a balcony. Return minimal JSON only.

BALCONY: ${width_m}m x ${depth_m}m, faces ${direction}, ${sun_pct}% sun, style=${garden_style}
COLORS: floor=${floor_color}, walls=${wall_color}, railing=${railing_color}
PLANTERS: ${planterCount} rectangular 60x30x30cm planters

CHOOSE:
1. planterColorHe (Hebrew color name) and planterColorEn (English) - match balcony colors, pick from: anthracite gray, light gray, terracotta, sand beige
2. plants - 3 to 5 species total. Sun >70%: lavender/rosemary/geranium/sage. 40-70%: impatiens/begonia/coleus. <40%: ferns/browallia. Mediterranean: lavender/rosemary/thyme. Modern: ornamental grasses/succulents. Jungle: coleus/caladium/ferns. Mix tall, medium and trailing/cascading species for visual interest.
3. arrangement - one sentence describing the visual rhythm across the planters. Specify which plants go where, alternating patterns, height variation, color contrast. Example: "Alternate tall lavender centerpieces with low cascading rosemary, place red coleus as accent every third planter, trailing thyme spills over front edges."
4. soilPct, perlitePct, tuffPct - one mix for all planters. Total must equal 100.
5. waitingFacts - 3 facts in Hebrew about the chosen plants, plain text, no special characters

Return ONLY this JSON, nothing else:
{
  "planterColorHe": "...",
  "planterColorEn": "...",
  "plants": [
    {"nameHe": "...", "nameEn": "...", "totalCount": 4, "size": "medium", "visualDesc": "purple flowering lavender 30cm tall dense foliage"}
  ],
  "arrangement": "Alternate tall lavender with cascading rosemary, red coleus accent every other planter, trailing thyme over front edges.",
  "soilPct": 60, "perlitePct": 20, "tuffPct": 20,
  "waitingFacts": ["fact1", "fact2", "fact3"]
}`;

    L("[2] calling Claude Haiku (minimal output)");
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      system: "You are a professional garden designer. Respond ONLY with valid JSON, no markdown, no text outside JSON.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = response.content.filter(b => b.type === "text").map(b => (b as {type:"text";text:string}).text).join("");
    L("[2] response length: " + raw.length);

    L("[3] parsing JSON");
    let plan: { planterColorHe: string; planterColorEn: string; plants: PlantChoice[]; arrangement: string; soilPct: number; perlitePct: number; tuffPct: number; waitingFacts: string[] } = {
      planterColorHe: "אפור אנתרציט", planterColorEn: "anthracite gray",
      plants: [{ nameHe: "לבנדר", nameEn: "lavender", totalCount: planterCount * 2, size: "medium", visualDesc: "purple flowering lavender 30cm tall" }],
      arrangement: "Alternate tall lavender with low cascading rosemary across planters, varying heights for visual rhythm.",
      soilPct: 60, perlitePct: 20, tuffPct: 20,
      waitingFacts: [],
    };
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const start = cleaned.indexOf("{");
      const end   = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("no JSON found");
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      plan = { ...plan, ...parsed };
    } catch (parseErr) {
      L("[3] parse error: " + parseErr + " — using defaults");
    }
    L("[3] plan: " + plan.planterColorEn + ", " + plan.plants.length + " species");

    L("[4] building dallePrompt server-side");
    const dallePrompt = buildDallePrompt(planterCount, plan.planterColorEn, plan.plants, plan.arrangement);
    L("[4] prompt length: " + dallePrompt.length);

    L("[5] calculating products");
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
    L("[5] total: " + grandTotal + " ILS, " + items.length + " items");

    return NextResponse.json({ dallePrompt, waitingFacts: plan.waitingFacts ?? [], products: { items, grandTotal }, debug: { log } });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    L("CATCH: " + m);
    return NextResponse.json({ error: m, step: "catch", debug: { log } }, { status: 500 });
  }
}
