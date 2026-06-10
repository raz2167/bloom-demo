// app/api/plan/route.ts
// קלוד מנתח בלופרינט + נתוני משתמש → prompt ל-DALL-E + מוצרים + עובדות
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const PRICES = {
  adanit_unit:   189,
  plant_small:    35,
  plant_medium:   55,
  plant_large:    85,
  soil_liter:    1.2,
  perlite_liter: 2.5,
  tuff_liter:    1.8,
};

const PLANTER_VOLUME_L = 54 * 0.8;

async function dlUrl(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("הורדה נכשלה: " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    const {
      blueprintUrl,
      width_m, depth_m, direction, sun_pct, garden_style,
      floor_color, wall_color, railing_color,
    } = await req.json();

    if (!blueprintUrl) return NextResponse.json({ error: "חסר blueprintUrl", debug: { log } }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "חסר Anthropic key", debug: { log } }, { status: 500 });

    L("[1] מוריד blueprint...");
    const bpBuf = await dlUrl(blueprintUrl);
    const blueprintBase64 = bpBuf.toString("base64");
    L("[1] " + bpBuf.length + " bytes");

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are a professional garden designer and balcony architect specializing in Israeli balconies.
You analyze architectural blueprints and create precise garden design plans.
You must respond ONLY with valid JSON, no markdown, no explanation.`;

    const userPrompt = `Analyze this architectural line drawing of a balcony and create a complete garden design plan.

BALCONY DATA:
- Dimensions: ${width_m}m wide x ${depth_m}m deep (area: ${(width_m * depth_m).toFixed(1)} sqm)
- Direction: ${direction}
- Sun exposure: ${sun_pct}%
- Style preference: ${garden_style}
- Colors: floor=${floor_color}, walls=${wall_color}, railing=${railing_color}

PLANTER SPECS: rectangular 60x30x30cm, matte finish, volume=43.2L usable

YOUR DECISIONS:
1. How many planters (based on balcony width: 2 planters per 2-3m, 3 for 3-5m, add side planters for >5m or L-shape)
2. Layout: straight line along railing, or L-shape using side wall too
3. Planter color: choose from [anthracite/dark gray, light gray, terracotta, sand/beige] based on balcony colors
4. For each planter: exact plants (2-3 species), fill mix (soil/perlite/tuff ratios by plant type)
5. Perspective analysis from the blueprint: identify vanishing point location, floor angle, railing line Y position
6. Plant selection rules: ${sun_pct}% sun + ${direction} exposure + ${garden_style} style. Plants must look established (2-3 seasons old, full and lush)

PLANT SELECTION GUIDE:
- Full sun (>70%) + south/west: lavender, rosemary, geranium, portulaca, sage
- Partial shade (40-70%): impatiens, begonia, fuchsia, coleus
- Shade (<40%) + north: ferns, begonia rex, browallia
- Mediterranean style: lavender, rosemary, thyme, sage, cyclamen
- Modern style: ornamental grasses, succulents, agave, lavender
- Jungle style: coleus, caladium, elephant ear, ferns, begonia

FILL MIX GUIDE (per liter of planter volume):
- Mediterranean/drought plants: 60% soil + 20% perlite + 20% tuff
- Flowering plants: 70% soil + 20% perlite + 10% tuff
- Succulents: 40% soil + 40% perlite + 20% tuff
- Shade plants: 80% soil + 10% perlite + 10% tuff

Respond with this exact JSON structure:
{
  "planterCount": <number>,
  "layout": "line|L-shape",
  "planterColor": "<color name in English for DALL-E>",
  "planterColorHe": "<color name in Hebrew>",
  "perspective": {
    "vanishingPointDescription": "<where vanishing point is>",
    "floorAngle": "<description of floor recession angle>",
    "railingPosition": "<description of railing line position in image>",
    "depthCue": "<how to show perspective foreshortening>"
  },
  "planters": [
    {
      "id": 1,
      "position": "<e.g. left third of railing>",
      "rotation": "<e.g. parallel to railing, or 90-degrees for side wall>",
      "plants": [
        { "nameHe": "<Hebrew name>", "nameEn": "<English name>", "count": <number>, "size": "small|medium|large", "description": "<1 sentence visual description for DALL-E>" }
      ],
      "fillMix": { "soilPct": <0-100>, "perlitePct": <0-100>, "tuffPct": <0-100> }
    }
  ],
  "dallePrompt": "<complete DALL-E prompt in English>",
  "waitingFacts": [
    "<fact 1 about chosen plants in Hebrew>",
    "<fact 2>",
    "<fact 3>",
    "<fact 4>",
    "<fact 5>"
  ]
}`;

    L("[2] שולח לקלוד לתכנון...");
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: blueprintBase64 } },
          { type: "text", text: userPrompt },
        ],
      }],
    });

    const raw = response.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");
    const plan = JSON.parse(raw.replace(/```json|```/g, "").trim());
    L("[2] plan: " + plan.planterCount + " planters, " + plan.layout);

    interface PlantItem { nameHe: string; count: number; size: string; }
    interface PlanterItem { fillMix: { soilPct: number; perlitePct: number; tuffPct: number }; plants: PlantItem[]; }

    const items: { name: string; qty: number; unitPrice: number; total: number }[] = [];

    items.push({
      name: "אדנית מלבנית 60x30x30 ס\"מ (" + plan.planterColorHe + ")",
      qty: plan.planterCount,
      unitPrice: PRICES.adanit_unit,
      total: plan.planterCount * PRICES.adanit_unit,
    });

    const allPlants: { nameHe: string; count: number; size: string }[] = [];
    plan.planters.forEach((p: PlanterItem) => p.plants.forEach((pl: PlantItem) => allPlants.push(pl)));

    const plantMap: Record<string, { count: number; size: string }> = {};
    allPlants.forEach(pl => {
      if (!plantMap[pl.nameHe]) plantMap[pl.nameHe] = { count: 0, size: pl.size };
      plantMap[pl.nameHe].count += pl.count;
    });
    Object.entries(plantMap).forEach(([name, { count, size }]) => {
      const unitPrice = size === "small" ? PRICES.plant_small : size === "large" ? PRICES.plant_large : PRICES.plant_medium;
      items.push({ name: name + " (שתיל)", qty: count, unitPrice, total: count * unitPrice });
    });

    let totalSoilL = 0, totalPerliteL = 0, totalTuffL = 0;
    plan.planters.forEach((p: PlanterItem) => {
      totalSoilL    += PLANTER_VOLUME_L * p.fillMix.soilPct    / 100;
      totalPerliteL += PLANTER_VOLUME_L * p.fillMix.perlitePct / 100;
      totalTuffL    += PLANTER_VOLUME_L * p.fillMix.tuffPct    / 100;
    });

    const soilBags    = Math.ceil(totalSoilL    / 20);
    const perliteBags = Math.ceil(totalPerliteL / 10);
    const tuffBags    = Math.ceil(totalTuffL    / 10);

    if (soilBags > 0)    items.push({ name: "אדמה לצמחים (שק 20 ליטר)",  qty: soilBags,    unitPrice: Math.round(PRICES.soil_liter    * 20), total: soilBags    * Math.round(PRICES.soil_liter    * 20) });
    if (perliteBags > 0) items.push({ name: "פרלייט (שק 10 ליטר)",        qty: perliteBags, unitPrice: Math.round(PRICES.perlite_liter * 10), total: perliteBags * Math.round(PRICES.perlite_liter * 10) });
    if (tuffBags > 0)    items.push({ name: "טוף (שק 10 ליטר)",            qty: tuffBags,    unitPrice: Math.round(PRICES.tuff_liter    * 10), total: tuffBags    * Math.round(PRICES.tuff_liter    * 10) });

    const grandTotal = items.reduce((s, i) => s + i.total, 0);
    L("[3] total: " + grandTotal + " ILS, " + items.length + " items");

    return NextResponse.json({
      dallePrompt:  plan.dallePrompt,
      waitingFacts: plan.waitingFacts,
      products:     { items, grandTotal },
      planterCount: plan.planterCount,
      layout:       plan.layout,
      debug:        { log },
    });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "שגיאה";
    L("CATCH: " + m);
    return NextResponse.json({ error: m, debug: { log } }, { status: 500 });
  }
}
