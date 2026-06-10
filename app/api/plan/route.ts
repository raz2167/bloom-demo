// app/api/plan/route.ts
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

async function getBlueprintBase64(blueprintUrl: string): Promise<string> {
  // data URL — חלץ את ה-base64 ישירות
  if (blueprintUrl.startsWith("data:")) {
    const comma = blueprintUrl.indexOf(",");
    if (comma === -1) throw new Error("invalid data URL");
    return blueprintUrl.slice(comma + 1);
  }
  // URL רגיל — הורד
  const r = await fetch(blueprintUrl);
  if (!r.ok) throw new Error("הורדה נכשלה: " + r.status);
  const buf = await r.arrayBuffer();
  return Buffer.from(buf).toString("base64");
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

    if (!blueprintUrl)               return NextResponse.json({ error: "חסר blueprintUrl",  debug: { log } }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "חסר Anthropic key", debug: { log } }, { status: 500 });

    L("[1] מכין blueprint base64...");
    const blueprintBase64 = await getBlueprintBase64(blueprintUrl);
    L("[1] " + Math.round(blueprintBase64.length / 1024) + "KB");

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are a professional garden designer and balcony architect specializing in Israeli balconies.
You analyze architectural blueprints and create precise garden design plans.
You must respond ONLY with valid JSON, no markdown, no explanation outside the JSON.`;

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
4. For each planter: exact plants (2-3 species), fill mix ratios
5. Perspective analysis: vanishing point, floor angle, railing position
6. Plant selection: ${sun_pct}% sun + ${direction} + ${garden_style}. Established look (2-3 seasons old)

PLANT GUIDE:
- Full sun >70% + south/west: lavender, rosemary, geranium, sage
- Partial shade 40-70%: impatiens, begonia, fuchsia, coleus
- Shade <40% + north: ferns, begonia rex, browallia
- Mediterranean: lavender, rosemary, thyme, sage
- Modern: ornamental grasses, succulents, agave
- Jungle: coleus, caladium, ferns, begonia

FILL MIX:
- Mediterranean/drought: 60% soil + 20% perlite + 20% tuff
- Flowering: 70% soil + 20% perlite + 10% tuff
- Succulents: 40% soil + 40% perlite + 20% tuff
- Shade: 80% soil + 10% perlite + 10% tuff

IMPORTANT: In waitingFacts and all Hebrew text fields, do NOT use special quote characters. Use simple apostrophe or avoid quotes entirely.

Return ONLY this JSON (no text before or after):
{
  "planterCount": <number>,
  "layout": "line",
  "planterColor": "<English color>",
  "planterColorHe": "<Hebrew color>",
  "perspective": {
    "vanishingPointDescription": "<description>",
    "floorAngle": "<description>",
    "railingPosition": "<description>",
    "depthCue": "<description>"
  },
  "planters": [
    {
      "id": 1,
      "position": "<position>",
      "rotation": "<rotation>",
      "plants": [
        { "nameHe": "<name>", "nameEn": "<name>", "count": 2, "size": "medium", "description": "<description>" }
      ],
      "fillMix": { "soilPct": 70, "perlitePct": 20, "tuffPct": 10 }
    }
  ],
  "dallePrompt": "<DALL-E prompt in English only>",
  "waitingFacts": ["<fact1>", "<fact2>", "<fact3>", "<fact4>", "<fact5>"]
}`;

    L("[2] שולח לקלוד...");
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

    const raw = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    L("[2] raw length: " + raw.length);

    // חילוץ JSON בצורה בטוחה
    let plan;
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      // מצא את ה-JSON הראשון
      const start = cleaned.indexOf("{");
      const end   = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("no JSON found");
      plan = JSON.parse(cleaned.slice(start, end + 1));
    } catch (parseErr) {
      L("[2] parse error: " + parseErr + " | raw: " + raw.substring(0, 200));
      throw new Error("קלוד לא החזיר JSON תקין");
    }

    L("[2] plan: " + plan.planterCount + " planters, " + plan.layout);

    interface PlantItem { nameHe: string; count: number; size: string; }
    interface PlanterItem { fillMix: { soilPct: number; perlitePct: number; tuffPct: number }; plants: PlantItem[]; }

    const items: { name: string; qty: number; unitPrice: number; total: number }[] = [];

    items.push({
      name: "אדנית מלבנית 60x30x30 סמ (" + plan.planterColorHe + ")",
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
      items.push({ name: name + " שתיל", qty: count, unitPrice, total: count * unitPrice });
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

    if (soilBags > 0)    items.push({ name: "אדמה לצמחים שק 20 ליטר",  qty: soilBags,    unitPrice: Math.round(PRICES.soil_liter    * 20), total: soilBags    * Math.round(PRICES.soil_liter    * 20) });
    if (perliteBags > 0) items.push({ name: "פרלייט שק 10 ליטר",        qty: perliteBags, unitPrice: Math.round(PRICES.perlite_liter * 10), total: perliteBags * Math.round(PRICES.perlite_liter * 10) });
    if (tuffBags > 0)    items.push({ name: "טוף שק 10 ליטר",            qty: tuffBags,    unitPrice: Math.round(PRICES.tuff_liter    * 10), total: tuffBags    * Math.round(PRICES.tuff_liter    * 10) });

    const grandTotal = items.reduce((s, i) => s + i.total, 0);
    L("[3] total: " + grandTotal + " ILS");

    return NextResponse.json({
      dallePrompt:  plan.dallePrompt,
      waitingFacts: plan.waitingFacts ?? [],
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
