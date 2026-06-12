// app/api/plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const PRICES = { adanit_unit:189, plant_small:35, plant_medium:55, plant_large:85, soil_liter:1.2, perlite_liter:2.5, tuff_liter:1.8 };
const PLANTER_VOLUME_L = 43.2;

interface PlantChoice { nameHe: string; nameEn: string; totalCount: number; size: string; visualDesc: string; }
interface PlanterLayout { position: number; tall: string; mid: string; trail: string; }

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

    const styleGuide = garden_style === "mediterranean"
      ? "Mediterranean style: lavender, rosemary, thyme, sage, geranium, silver dusty miller. Warm purples, pinks, silvers."
      : garden_style === "jungle"
      ? "Tropical jungle style: coleus (vibrant colored leaves), caladium, asparagus fern, wandering jew, sweet potato vine. Bold colors, dramatic leaves."
      : "Modern minimal style: ornamental grasses, succulents, echeveria, sedum, agave, white or pale flowers only. Clean, architectural.";

    const sunGuide = sun_pct > 70
      ? "Full sun (>70%): drought-tolerant sun-lovers"
      : sun_pct > 40
      ? "Partial sun (40-70%): adaptable species"
      : "Shade (<40%): shade-tolerant species only";

    const userPrompt = `You are a world-class garden designer. Design a stunning balcony garden. Return JSON only.

BALCONY: ${width_m}m wide, ${depth_m}m deep, faces ${direction}, ${sun_pct}% sun
COLORS: floor=${floor_color}, walls=${wall_color}, railing=${railing_color}
STYLE: ${styleGuide}
SUN: ${sunGuide}
PLANTERS: exactly ${planterCount} rectangular planters, 60cm wide x 30cm deep x 30cm tall, flush to back wall

DESIGN RULES:
- Each planter has a UNIQUE combination: 1 tall focal plant (back) + 1 mid flowering plant (center) + 1 trailing/cascading plant (front edge)
- Vary colors dramatically between planters - no two adjacent planters the same
- Create visual rhythm: alternate heights and colors across the row
- Plants look lush and established (2-3 seasons old, full, overflowing)

Choose a planter color that contrasts beautifully with: walls=${wall_color}, floor=${floor_color}

Return ONLY this JSON (no markdown):
{
  "planterColorHe": "Hebrew color name",
  "planterColorEn": "English color name e.g. anthracite gray / terracotta / sand beige / slate blue",
  "plants": [
    {"nameHe": "Hebrew name", "nameEn": "English name", "totalCount": 6, "size": "medium", "visualDesc": "specific visual: color, height, form e.g. deep purple spike 40cm upright"}
  ],
  "planterLayout": [
    {"position": 1, "tall": "plant name + visual", "mid": "plant name + visual", "trail": "plant name + visual"}
  ],
  "soilPct": 60, "perlitePct": 20, "tuffPct": 20,
  "designFacts": ["Hebrew fact max 12 words", "...10 total facts..."]
}

planterLayout must have exactly ${planterCount} entries. Make each planter visually distinct.`;

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
      planterColorHe: string;
      planterColorEn: string;
      plants: PlantChoice[];
      planterLayout: PlanterLayout[];
      soilPct: number;
      perlitePct: number;
      tuffPct: number;
      designFacts: string[];
    }
    let plan: PlanResult = {
      planterColorHe: "אפור אנתרציט", planterColorEn: "anthracite gray",
      plants: [{ nameHe: "לבנדר", nameEn: "lavender", totalCount: planterCount * 2, size: "medium", visualDesc: "purple flowering lavender 30cm tall" }],
      planterLayout: Array.from({ length: planterCount }, (_, i) => ({
        position: i + 1,
        tall: "rosemary, upright 40cm silver-green",
        mid: "lavender, purple spikes 30cm",
        trail: "lobelia, cascading blue flowers"
      })),
      soilPct: 60, perlitePct: 20, tuffPct: 20,
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
    L("[3] planterColor: " + plan.planterColorEn + ", plants: " + plan.plants.length + ", layout: " + plan.planterLayout.length);

    // Build a rich, photorealistic DALL-E prompt from the layout
    const planterDescs = plan.planterLayout.map((p, i) => {
      const pos = i === 0 ? "leftmost" : i === plan.planterLayout.length - 1 ? "rightmost" : `planter ${i + 1}`;
      return `${pos}: tall back - ${p.tall}; center - ${p.mid}; cascading over front edge - ${p.trail}`;
    }).join(". ");

    const dallePrompt = (
      `Photorealistic image of a balcony garden. ` +
      `Background: the architectural line drawing of the balcony must remain visible as a faint watermark underneath. ` +
      `${planterCount} rectangular planters (60cm wide, 30cm deep, ${plan.planterColorEn} color) are placed in a row, ` +
      `flush against the back wall, their long side parallel to the wall like window boxes. ` +
      `Plants are lush and overflowing, established, full (2-3 seasons old). ` +
      `Each planter has a unique combination: ${planterDescs}. ` +
      `The overall scene is vibrant, colorful, professionally designed. ` +
      `The balcony floor (${floor_color}) and wall (${wall_color}) are visible. ` +
      `The railing (${railing_color}) is visible above and behind the planters. ` +
      `Soft natural Mediterranean light, photographic quality, shallow depth of field.`
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
