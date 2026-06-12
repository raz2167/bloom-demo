// app/api/plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const PRICES = { adanit_unit:189, plant_small:35, plant_medium:55, plant_large:85, soil_liter:1.2, perlite_liter:2.5, tuff_liter:1.8 };
const PLANTER_VOLUME_L = 43.2;

interface PlantChoice { nameHe: string; nameEn: string; totalCount: number; size: string; visualDesc: string; }
interface PlanterLayout { position: number; tall: string; mid: string; trail: string; }

const BLUEPRINT_BASE = (
  "This is a black and white architectural line drawing of a balcony. " +
  "Preserve this exact line drawing as the background. " +
  "Do not redraw the floor, walls, or railing. " +
  "Add lush colored plants and planters on top of the line drawing only. " +
  "PLACEMENT: all planters flush against the back wall, long 60cm side PARALLEL to wall like window boxes, NOT sticking into the balcony. Railing visible above and behind. "
);

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    L("[1] parsing request");
    const { blueprintUrl, width_m, depth_m, direction, sun_pct, garden_style, floor_color, wall_color, railing_color, wall_height_m } = await req.json();

    if (!blueprintUrl)                  return NextResponse.json({ error: "missing blueprintUrl",  step: "validate", debug: { log } }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "missing Anthropic key", step: "validate", debug: { log } }, { status: 500 });

    const planterCount = Math.min(8, Math.max(2, Math.floor(width_m / 0.9)));
    // wall height with fallback - planters are 30cm tall, so ratio matters
    const wallH = Math.min(Math.max(Number(wall_height_m) || 2.6, 2.0), 4.0);
    // planters occupy ~30cm of wall height, leaving the rest exposed
    const planterHeightPct = Math.round((0.30 / wallH) * 100);
    L("[1] planterCount: " + planterCount + " wallH: " + wallH + "m planterPct: " + planterHeightPct + "%");

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const styleGuide = garden_style === "mediterranean"
      ? "Mediterranean: lavender, rosemary, geranium, sage, dusty miller. Purples, pinks, silvers."
      : garden_style === "jungle"
      ? "Tropical jungle: coleus (bold colored leaves), caladium, asparagus fern, wandering jew, sweet potato vine. Bold colors, dramatic."
      : "Modern minimal: ornamental grasses, succulents, echeveria, white flowers, sedum. Clean, architectural.";

    const sunGuide = sun_pct > 70 ? "Full sun: lavender, rosemary, geranium, sage, thyme, petunia"
      : sun_pct > 40 ? "Partial sun: impatiens, begonia, coleus, browallia, fuchsia"
      : "Shade: ferns, browallia, impatiens, caladium, ivy";

    const userPrompt = `You are a professional garden designer. Design a balcony garden. Return JSON only.

BALCONY: ${width_m}m wide, ${depth_m}m deep, ${direction}, ${sun_pct}% sun, back wall height ${wallH}m
COLORS: floor=${floor_color}, walls=${wall_color}, railing=${railing_color}
STYLE: ${styleGuide}
SUN: ${sunGuide}
PLANTERS: exactly ${planterCount} rectangular 60x30x30cm planters

IMPORTANT - create a planterLayout with DIFFERENT plants in each planter:
- Each planter: 1 tall focal (back, 35-50cm), 1 medium flowering (center, 20-30cm), 1 trailing/cascading (front edge, spills down)
- Vary colors: alternate warm/cool, never same color in adjacent planters
- Example rhythm for 4 planters: [purple+pink+blue] [orange+yellow+green] [purple+white+silver] [red+pink+violet]

Return ONLY this JSON:
{
  "planterColorHe": "Hebrew color",
  "planterColorEn": "anthracite gray OR terracotta OR sand beige OR slate blue",
  "plants": [
    {"nameHe": "Hebrew", "nameEn": "English", "totalCount": 6, "size": "medium", "visualDesc": "specific: purple spike 40cm upright dense"}
  ],
  "planterLayout": [
    {"position": 1, "tall": "rosemary, silvery-green upright 40cm", "mid": "pink geranium, round clusters 25cm", "trail": "blue lobelia, cascading waterfall"},
    {"position": 2, "tall": "lavender, purple spikes 35cm", "mid": "orange calibrachoa, tiny flowers", "trail": "silver dichondra, flowing silver curtain"}
  ],
  "soilPct": 60, "perlitePct": 20, "tuffPct": 20,
  "designFacts": ["Hebrew fact max 12 words x10"]
}

planterLayout MUST have exactly ${planterCount} entries with DIFFERENT plant combinations.`;

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
    interface PlanResult {
      planterColorHe: string; planterColorEn: string;
      plants: PlantChoice[]; planterLayout: PlanterLayout[];
      soilPct: number; perlitePct: number; tuffPct: number; designFacts: string[];
    }
    let plan: PlanResult = {
      planterColorHe: "אפור אנתרציט", planterColorEn: "anthracite gray",
      plants: [{ nameHe: "לבנדר", nameEn: "lavender", totalCount: planterCount * 2, size: "medium", visualDesc: "purple flowering lavender 30cm tall" }],
      planterLayout: Array.from({ length: planterCount }, (_, i) => ({
        position: i + 1,
        tall: i % 2 === 0 ? "rosemary, silvery-green upright 40cm" : "lavender, purple spikes 35cm",
        mid:  i % 2 === 0 ? "pink geranium, round clusters 25cm"   : "white alyssum, honey-scented carpet",
        trail:i % 2 === 0 ? "blue lobelia, cascading"               : "silver dichondra, flowing"
      })),
      soilPct: 60, perlitePct: 20, tuffPct: 20, designFacts: [],
    };
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("no JSON found");
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      plan = { ...plan, ...parsed };
      if (!plan.planterLayout || plan.planterLayout.length === 0) {
        plan.planterLayout = Array.from({ length: planterCount }, (_, i) => ({
          position: i + 1, tall: "rosemary upright 40cm", mid: "geranium 25cm", trail: "lobelia cascading"
        }));
      }
    } catch (parseErr) {
      L("[3] parse error: " + parseErr + " using defaults");
    }
    L("[3] planterColor: " + plan.planterColorEn + ", layout: " + plan.planterLayout.length);

    // Build per-planter description with proportion anchoring
    const planterDescs = plan.planterLayout.slice(0, planterCount).map((p, i) => {
      const posLabel = planterCount <= 3
        ? (i === 0 ? "left planter" : i === planterCount - 1 ? "right planter" : "center planter")
        : (i === 0 ? "leftmost planter" : i === planterCount - 1 ? "rightmost planter" : "planter " + (i + 1));
      return posLabel + ": [back] " + p.tall + " | [center] " + p.mid + " | [cascading over front] " + p.trail;
    }).join("; ");

    // Proportion anchor: planters are 30cm tall on a wall_height_m wall
    // This tells DALL-E exactly how large to draw them relative to the blueprint
    const proportionAnchor = (
      "PROPORTION RULE: The back wall in this drawing is " + wallH.toFixed(1) + "m tall. " +
      "Each planter is exactly 30cm (0.3m) tall and 60cm wide - they should occupy only " + planterHeightPct + "% of the wall height. " +
      "Draw planters small relative to the wall. The floor and most of the wall remain clearly visible above and below the planters. " +
      "Plants can extend upward to max 50cm above planter rim (still well below the railing). "
    );

    const dallePrompt = (
      BLUEPRINT_BASE +
      proportionAnchor +
      "PLANTERS: " + planterCount + " " + plan.planterColorEn + " rectangular planters in a row, each 60cm wide x 30cm tall. " +
      "Plants are lush and overflowing, established, full. " +
      "ARRANGEMENT (left to right): " + planterDescs + ". " +
      "Trailing plants spill dramatically over the front edges. " +
      "The scene is vibrant, colorful, professionally designed."
    );

    L("[3] dallePrompt length: " + dallePrompt.length);

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
      dallePrompt,
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
