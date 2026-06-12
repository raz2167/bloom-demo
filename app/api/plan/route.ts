// v6 - 2026-06-12 - fix planter shape (2:1 ratio), fix plant arrangement (side-by-side not stacked)
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const PRICES = { adanit_unit:189, plant_small:35, plant_medium:55, plant_large:85, soil_liter:1.2, perlite_liter:2.5, tuff_liter:1.8 };
const PLANTER_VOLUME_L = 43.2;

interface PlantChoice { nameHe: string; nameEn: string; totalCount: number; size: string; visualDesc: string; }
interface PlanterLayout { position: number; left: string; center: string; right: string; }

const BLUEPRINT_BASE = (
  "This is a black and white architectural line drawing of a balcony. " +
  "Preserve this exact line drawing as the background. " +
  "Do not redraw the floor, walls, or railing. " +
  "Add lush colored plants and planters on top of the line drawing only. " +
  "PLACEMENT: all planters flush against the back wall, long 60cm side PARALLEL to wall like window boxes, NOT sticking into the balcony. Railing visible above and behind. "
);

const COLOR_RHYTHMS: Record<number, string> = {
  2: "planter 1: purple+white+blue; planter 2: orange+red+yellow-green",
  3: "planter 1: purple+pink+blue; planter 2: orange+yellow+lime; planter 3: white+red+silver",
  4: "planter 1: purple+pink+blue; planter 2: orange+yellow+lime; planter 3: white+red+silver; planter 4: magenta+peach+violet",
  5: "planter 1: purple+white+blue; planter 2: orange+red+lime; planter 3: pink+silver+violet; planter 4: yellow+green+coral; planter 5: magenta+white+teal",
  6: "planter 1: purple+pink+blue; planter 2: orange+yellow+lime; planter 3: white+red+silver; planter 4: magenta+peach+violet; planter 5: coral+green+gold; planter 6: lavender+crimson+sage",
  7: "planter 1: purple+white+blue; planter 2: orange+red+lime; planter 3: pink+silver+violet; planter 4: yellow+green+coral; planter 5: magenta+white+teal; planter 6: peach+burgundy+sage; planter 7: cream+scarlet+chartreuse",
  8: "planter 1: purple+pink+blue; planter 2: orange+yellow+lime; planter 3: white+red+silver; planter 4: magenta+peach+violet; planter 5: coral+green+gold; planter 6: lavender+crimson+sage; planter 7: cream+scarlet+chartreuse; planter 8: salmon+indigo+mint",
};

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  try {
    L("[1] parsing request");
    const { blueprintUrl, width_m, depth_m, direction, sun_pct, garden_style, floor_color, wall_color, railing_color, wall_height_m } = await req.json();

    if (!blueprintUrl)                  return NextResponse.json({ error: "missing blueprintUrl",  step: "validate", debug: { log } }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "missing Anthropic key", step: "validate", debug: { log } }, { status: 500 });

    const planterCount = Math.min(8, Math.max(2, Math.floor(width_m / 0.9)));
    const wallH = Math.min(Math.max(Number(wall_height_m) || 2.6, 2.0), 4.0);
    const planterHeightPct = Math.round((0.30 / wallH) * 100);
    L("[1] planterCount: " + planterCount + " wallH: " + wallH + "m");

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const styleGuide = garden_style === "mediterranean"
      ? "Mediterranean: lavender, rosemary, geranium, sage, dusty miller, thyme, alyssum."
      : garden_style === "jungle"
      ? "Tropical jungle: coleus (bold colored leaves), caladium, asparagus fern, wandering jew, sweet potato vine, impatiens."
      : "Modern minimal: ornamental grasses, succulents, echeveria, sedum, agave, white or pale flowers.";

    const sunGuide = sun_pct > 70 ? "Full sun: lavender, rosemary, geranium, sage, thyme, petunia, calibrachoa, portulaca"
      : sun_pct > 40 ? "Partial sun: impatiens, begonia, coleus, browallia, fuchsia, lobelia, diascia"
      : "Shade: ferns, browallia, impatiens, caladium, ivy, torenia";

    const colorRhythm = COLOR_RHYTHMS[planterCount] || COLOR_RHYTHMS[4];

    const userPrompt = `You are a professional garden designer. Design a visually stunning balcony garden. Return JSON only.

BALCONY: ${width_m}m wide, ${depth_m}m deep, ${direction}, ${sun_pct}% sun, wall height ${wallH}m
COLORS: floor=${floor_color}, walls=${wall_color}, railing=${railing_color}
STYLE: ${styleGuide}
SUN: ${sunGuide}
PLANTERS: exactly ${planterCount} rectangular 60x30x30cm planters

MANDATORY COLOR DIVERSITY:
${colorRhythm}

PLANT ARRANGEMENT RULES - this is critical:
- Each planter contains 2-3 plants placed SIDE BY SIDE horizontally (not stacked vertically)
- LEFT side of planter: 1 plant species
- CENTER of planter: 1 plant species (can be taller)
- RIGHT side of planter: 1 plant species (can trail over the front edge)
- Plants grow naturally upward from the soil - they are NOT on shelves or layers
- The visual effect is a natural garden, not a tiered display

STRICT PROHIBITIONS:
- NO two adjacent planters may have the same species
- NO monotonous repetition across the row

Return ONLY this JSON:
{
  "planterColorHe": "Hebrew color name",
  "planterColorEn": "anthracite gray OR terracotta OR sand beige OR slate blue",
  "plants": [
    {"nameHe": "Hebrew name", "nameEn": "English name", "totalCount": 6, "size": "medium", "visualDesc": "specific: deep purple spikes 40cm"}
  ],
  "planterLayout": [
    {"position": 1, "left": "lobelia, blue cascading over front edge", "center": "rosemary, silvery-green upright 40cm", "right": "pink geranium, round clusters 25cm"},
    {"position": 2, "left": "silver dichondra, trailing", "center": "lavender, purple spikes 35cm", "right": "orange calibrachoa, mounding"}
  ],
  "soilPct": 60, "perlitePct": 20, "tuffPct": 20,
  "designFacts": ["10 Hebrew facts about this specific garden, max 12 words each"]
}

planterLayout MUST have exactly ${planterCount} entries. Every planter MUST differ from neighbors.`;

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
      plants: [{ nameHe: "לבנדר", nameEn: "lavender", totalCount: planterCount * 2, size: "medium", visualDesc: "purple flowering lavender 30cm" }],
      planterLayout: Array.from({ length: planterCount }, (_, i) => {
        const palettes = [
          { left:"blue lobelia, cascading over edge", center:"rosemary, silvery-green upright 40cm", right:"pink geranium, round clusters 25cm" },
          { left:"silver dichondra, trailing", center:"lavender, purple spikes 35cm", right:"orange calibrachoa, mounding" },
          { left:"green-gold creeping jenny, trailing", center:"ornamental grass, lime arching 40cm", right:"white alyssum, mounding fragrant" },
          { left:"red verbena, trailing stems", center:"sage, blue-purple upright 40cm", right:"coral impatiens, mounding" },
          { left:"purple sweet potato vine, dramatic trailing", center:"coleus, burgundy-gold leaves 35cm", right:"yellow lantana, round clusters" },
          { left:"yellow bidens, feathery cascade", center:"dusty miller, silver upright 35cm", right:"magenta petunia, trumpet flowers" },
          { left:"coral creeping zinnia, trailing", center:"lemon grass, architectural 45cm", right:"white bacopa, tiny star flowers" },
          { left:"variegated ivy, cascading green-white", center:"caladium, bold patterned leaves 35cm", right:"browallia, blue star flowers" },
        ];
        const p = palettes[i % palettes.length];
        return { position: i + 1, left: p.left, center: p.center, right: p.right };
      }),
      soilPct: 60, perlitePct: 20, tuffPct: 20, designFacts: [],
    };
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("no JSON found");
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      plan = { ...plan, ...parsed };
      if (!plan.planterLayout || plan.planterLayout.length < planterCount) {
        L("[3] layout too short, using defaults");
      }
    } catch (parseErr) {
      L("[3] parse error: " + parseErr + " using defaults");
    }
    L("[3] planterColor: " + plan.planterColorEn + ", layout: " + plan.planterLayout.length);

    // Build per-planter description - horizontal side-by-side arrangement
    const planterDescs = plan.planterLayout.slice(0, planterCount).map((p, i) => {
      const posLabel = planterCount <= 3
        ? (i === 0 ? "left planter" : i === planterCount - 1 ? "right planter" : "center planter")
        : (i === 0 ? "leftmost planter" : i === planterCount - 1 ? "rightmost planter" : "planter " + (i + 1));
      return posLabel + ": left-side=" + p.left + ", center=" + p.center + ", right-side=" + p.right;
    }).join("; ");

    const proportionAnchor = (
      "PROPORTION RULE: The back wall is " + wallH.toFixed(1) + "m tall. " +
      "Each planter is a WIDE RECTANGULAR WINDOW BOX: 60cm wide and only 30cm tall (2:1 width-to-height ratio, much wider than tall). " +
      "Planters occupy only " + planterHeightPct + "% of the wall height. " +
      "Draw them as low wide boxes, not cubes. The floor and wall remain clearly visible. " +
      "Plants grow upward from soil to max 50cm above planter rim. "
    );

    const dallePrompt = (
      BLUEPRINT_BASE +
      proportionAnchor +
      "PLANTERS: " + planterCount + " " + plan.planterColorEn + " wide rectangular window boxes in a row. " +
      "Each box is wider than tall (60cm wide, 30cm tall). " +
      "Plants are arranged SIDE BY SIDE within each planter, growing naturally from the soil - not stacked in layers. " +
      "Plants are lush and full (2-3 seasons old). " +
      "ARRANGEMENT left to right: " + planterDescs + ". " +
      "The overall scene is vibrant and colorful with clear visual rhythm and variety across planters."
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
