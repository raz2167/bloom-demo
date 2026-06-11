// app/api/plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const PRICES = { adanit_unit:189, plant_small:35, plant_medium:55, plant_large:85, soil_liter:1.2, perlite_liter:2.5, tuff_liter:1.8 };
const PLANTER_VOLUME_L = 43.2;

interface PlantItem { nameHe: string; count: number; size: string; }
interface PlanterItem { fillMix: { soilPct: number; perlitePct: number; tuffPct: number }; plants: PlantItem[]; }

async function getBlueprintBase64(blueprintUrl: string): Promise<string> {
  if (blueprintUrl.startsWith("data:")) {
    const comma = blueprintUrl.indexOf(",");
    if (comma === -1) throw new Error("invalid data URL");
    return blueprintUrl.slice(comma + 1);
  }
  const r = await fetch(blueprintUrl);
  if (!r.ok) throw new Error("blueprint download failed: " + r.status);
  return Buffer.from(await r.arrayBuffer()).toString("base64");
}

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    L("[1] parsing request");
    const { blueprintUrl, width_m, depth_m, direction, sun_pct, garden_style, floor_color, wall_color, railing_color } = await req.json();

    if (!blueprintUrl)                  return NextResponse.json({ error: "missing blueprintUrl",  step: "validate", debug: { log } }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "missing Anthropic key", step: "validate", debug: { log } }, { status: 500 });

    L("[2] extracting blueprint base64");
    const blueprintBase64 = await getBlueprintBase64(blueprintUrl);
    L("[2] base64 length: " + blueprintBase64.length);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userPrompt = `Analyze this balcony blueprint and create a garden design plan.

BALCONY: ${width_m}m x ${depth_m}m, faces ${direction}, ${sun_pct}% sun, style=${garden_style}
COLORS: floor=${floor_color}, walls=${wall_color}, railing=${railing_color}
PLANTER: rectangular 60x30x30cm, 43.2L usable

RULES:
- Planters: 2 for 2-3m wide, 3 for 3-5m, L-shape for >5m
- Plants must look established (2-3 seasons old, full and lush)
- Sun >70%: lavender/rosemary/geranium/sage. 40-70%: impatiens/begonia/coleus. <40%: ferns/browallia
- Mediterranean: lavender/rosemary/thyme. Modern: grasses/succulents. Jungle: coleus/caladium/ferns
- Fill: drought=60%soil+20%perlite+20%tuff, flowering=70%+20%+10%, succulents=40%+40%+20%, shade=80%+10%+10%
- Planter color from: anthracite, light gray, terracotta, sand/beige (match balcony colors)
- waitingFacts in Hebrew only, plain text, no special characters

Return ONLY valid JSON, no markdown:
{
  "planterCount": 2,
  "layout": "line",
  "planterColor": "anthracite gray",
  "planterColorHe": "אפור אנתרציט",
  "perspective": { "vanishingPointDescription": "...", "floorAngle": "...", "railingPosition": "...", "depthCue": "..." },
  "planters": [{ "id": 1, "position": "left third", "rotation": "parallel to railing", "plants": [{ "nameHe": "לבנדר", "nameEn": "lavender", "count": 2, "size": "medium", "description": "purple flowering lavender 30cm tall" }], "fillMix": { "soilPct": 60, "perlitePct": 20, "tuffPct": 20 } }],
  "dallePrompt": "...",
  "waitingFacts": ["fact1", "fact2", "fact3", "fact4", "fact5"]
}`;

    L("[3] calling Claude Vision");
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: "You are a professional garden designer. Respond ONLY with valid JSON, no markdown, no text outside JSON.",
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: blueprintBase64 } },
        { type: "text", text: userPrompt },
      ]}],
    });

    const raw = response.content.filter(b => b.type === "text").map(b => (b as {type:"text";text:string}).text).join("");
    L("[3] response length: " + raw.length);

    L("[4] parsing JSON");
    let plan: Record<string, unknown>;
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const start = cleaned.indexOf("{");
      const end   = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("no JSON found");
      plan = JSON.parse(cleaned.slice(start, end + 1));
    } catch (parseErr) {
      L("[4] parse error: " + parseErr);
      return NextResponse.json({ error: "invalid JSON from Claude", step: "json_parse", debug: { log } }, { status: 500 });
    }

    L("[4] plan: " + plan.planterCount + " planters");

    L("[5] calculating products");
    const items: { name: string; qty: number; unitPrice: number; total: number }[] = [];

    items.push({ name: "אדנית מלבנית 60x30x30 סמ (" + plan.planterColorHe + ")", qty: plan.planterCount as number, unitPrice: PRICES.adanit_unit, total: (plan.planterCount as number) * PRICES.adanit_unit });

    const allPlants: PlantItem[] = [];
    (plan.planters as PlanterItem[]).forEach(p => p.plants.forEach(pl => allPlants.push(pl)));

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
    (plan.planters as PlanterItem[]).forEach(p => {
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
    L("[5] total: " + grandTotal + " ILS, " + items.length + " items");

    return NextResponse.json({ dallePrompt: plan.dallePrompt, waitingFacts: plan.waitingFacts ?? [], products: { items, grandTotal }, debug: { log } });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    L("CATCH: " + m);
    return NextResponse.json({ error: m, step: "catch", debug: { log } }, { status: 500 });
  }
}
