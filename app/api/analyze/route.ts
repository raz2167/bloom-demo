// app/api/analyze/route.ts
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface PlacedProduct {
  productId:  string;
  productUrl: string;
  name:       string;
  x:          number;
  y:          number;
  width:      number;
  label:      string;
}

interface CloudinaryResource {
  public_id:   string;
  secure_url:  string;
  width:       number;
  height:      number;
}

interface CatalogItem {
  id:     string;
  name:   string;
  url:    string;
  width:  number;
  height: number;
  folder: string;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const log: string[] = [];
  const body = await req.json();
  const { imageBase64, mimeType = "image/jpeg", nursery = "Bloom_Demo" } = body;

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (data: object) => {
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        console.log("SSE →", JSON.stringify(data).substring(0, 100));
      };
      const L = (msg: string) => { console.log(msg); log.push(msg); };
      const fail = (msg: string) => {
        L(`🔴 FAIL: ${msg}`);
        send({ type: "error", message: msg, debug: { log } });
        ctrl.close();
      };

      try {
        if (!imageBase64) return fail("לא התקבלה תמונה");
        if (!process.env.ANTHROPIC_API_KEY) return fail("חסר מפתח Anthropic");

        L(`🟢 [1] תמונה: ${Math.round(imageBase64.length / 1024)}KB`);
        send({ type: "step", step: 0 });

        // ── שלב 1: Claude Vision ─────────────────────
        let analysisMsg: Anthropic.Message | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            L(`🟡 [1] ניסיון ${attempt}/3`);
            analysisMsg = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 600,
              messages: [{
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
                    text: `אתה מעצב גינות מרפסת. נתח את התמונה והחזר JSON בלבד ללא טקסט נוסף:
{
  "balcony_size": "קטנה|בינונית|גדולה",
  "width_m": 4.0,
  "depth_m": 2.5,
  "sun_exposure": "שמש מלאה|חצי צל|צל",
  "style": "מודרני|ים-תיכוני|כפרי|מינימליסטי",
  "railing": "זכוכית|ברזל|בטון|עץ|אין",
  "floor_color": "תיאור קצר",
  "notes": "הערה קצרה"
}
חשוב: width_m ו-depth_m הם מספרים עשרוניים בלבד.`,
                  },
                ],
              }],
            });
            L("🟢 [1] הצליח");
            break;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            L(`🔴 [1] ניסיון ${attempt}: ${msg.substring(0, 80)}`);
            if (attempt === 3) return fail("השירות עמוס — נסה שוב בעוד 30 שניות 🌿");
            await new Promise(r => setTimeout(r, 2000 * attempt));
          }
        }

        const rawText = analysisMsg!.content[0].type === "text"
          ? analysisMsg!.content[0].text.trim() : "{}";
        const jsonStr = rawText.replace(/```json|```/g, "").trim();

        let analysis: Record<string, string | number>;
        try {
          analysis = JSON.parse(jsonStr);
          if (!analysis.width_m) analysis.width_m = 4.0;
          if (!analysis.depth_m) analysis.depth_m = 2.5;
          L(`🟢 [1] ניתוח: ${JSON.stringify(analysis)}`);
        } catch {
          return fail("שגיאה בניתוח התמונה");
        }

        send({ type: "step", step: 1, analysis });

        // ── שלב 2: Cloudinary Search API ─────────────
        L("🟡 [2] טוען קטלוג...");
        send({ type: "step", step: 2 });

        let catalog: CatalogItem[] = [];

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey    = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (cloudName && apiKey && apiSecret) {
          const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
          try {
            const searchRes = await fetch(
              `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`,
              {
                method: "POST",
                headers: {
                  Authorization: `Basic ${auth}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  expression: `folder:Nurseries/${nursery}/*`,
                  max_results: 50,
                }),
              }
            );
            const searchData = await searchRes.json();
            L(`🟢 [2] Search status: ${searchRes.status}`);
            L(`🟢 [2] Raw response: ${JSON.stringify(searchData).substring(0, 200)}`);

            catalog = (searchData.resources || []).map((r: CloudinaryResource) => {
              const parts  = r.public_id.split("/");
              const folder = parts[parts.length - 2] || "combinations";
              const name   = (parts[parts.length - 1] || "").replace(/[-_]/g, " ");
              return {
                id:     r.public_id,
                name,
                url:    r.secure_url,
                width:  r.width,
                height: r.height,
                folder,
              };
            });
            L(`🟢 [2] ${catalog.length} מוצרים`);
          } catch (e) {
            L(`🔴 [2] Cloudinary: ${e}`);
          }
        } else {
          L("🔴 [2] חסרים פרטי Cloudinary");
        }

        // ── שלב 3: תכנון מיקום ───────────────────────
        L("🟡 [3] מתכנן מיקום...");
        send({ type: "step", step: 3 });

        const productList = catalog.slice(0, 8).map(p => ({
          id: p.id, name: p.name, url: p.url,
        }));

        let placements: PlacedProduct[] = [];

        if (productList.length > 0) {
          try {
            const pm = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 800,
              messages: [{
                role: "user",
                content: `אתה מעצב גינות. מקם מוצרים על מרפסת.

מרפסת: ${analysis.width_m}מ׳ × ${analysis.depth_m}מ׳, מעקה: ${analysis.railing}, שמש: ${analysis.sun_exposure}

מוצרים: ${JSON.stringify(productList)}

החזר JSON בלבד:
{
  "placements": [
    {
      "productId": "public_id",
      "productUrl": "url",
      "name": "שם",
      "x": 10,
      "y": 62,
      "width": 28,
      "label": "תיאור"
    }
  ]
}

חוקים: 3-5 מוצרים, אל תחפוף, y בין 45-80.`,
              }],
            });

            const pRaw   = pm.content[0].type === "text" ? pm.content[0].text.trim() : "{}";
            const pJson  = pRaw.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(pJson);
            placements   = Array.isArray(parsed.placements) ? parsed.placements : [];
            L(`🟢 [3] ${placements.length} מיקומים`);
          } catch (e) {
            L(`🔴 [3] כשל: ${e} — fallback`);
            placements = catalog.slice(0, 3).map((p, i) => ({
              productId:  p.id,
              productUrl: p.url,
              name:       p.name,
              x:          8 + i * 30,
              y:          60,
              width:      26,
              label:      p.name,
            }));
          }
        }

        // ── שלב 4: DALL-E ─────────────────────────────
        L("🟡 [4] DALL-E...");
        send({ type: "step", step: 4 });

        let imageUrl: string | null = null;

        if (process.env.OPENAI_API_KEY) {
          const railMap: Record<string, string> = {
            "זכוכית": "glass panels railing",
            "ברזל":   "iron vertical bars railing",
            "בטון":   "solid concrete parapet",
            "עץ":     "wooden railing",
            "אין":    "open edge",
          };
          const prompt =
            `Clean architectural line drawing of a balcony viewed from inside. ` +
            `${railMap[String(analysis.railing)] || "glass railing"}, ` +
            `white tiled floor with grid, glass door frames on sides. ` +
            `Black thin lines on pure white background, no shading, no color. ` +
            `Technical drawing style, frontal view, ${analysis.width_m}m wide.`;

          try {
            const ac  = new AbortController();
            const tid = setTimeout(() => { ac.abort(); L("🔴 [4] timeout"); }, 50000);

            const dr = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              signal: ac.signal,
              headers: {
                Authorization:  `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-image-2", prompt, n: 1,
                size: "1024x1024", quality: "medium",
              }),
            });

            clearTimeout(tid);
            L(`🟢 [4] status: ${dr.status}`);
            const dd = await dr.json();

            if (dd.data?.[0]?.b64_json) {
              imageUrl = `data:image/png;base64,${dd.data[0].b64_json}`;
              L("🟢 [4] תמונה!");
            } else if (dd.data?.[0]?.url) {
              imageUrl = dd.data[0].url;
              L("🟢 [4] URL!");
            } else {
              L(`🔴 [4] ${JSON.stringify(dd).substring(0, 120)}`);
            }
          } catch (e: unknown) {
            const isAbort = e instanceof Error && e.name === "AbortError";
            L(`🔴 [4] ${isAbort ? "timeout" : (e instanceof Error ? e.message : "שגיאה")}`);
          }
        }

        L(`✅ DONE | placements:${placements.length} | image:${imageUrl ? "יש" : "אין"}`);
        send({ type: "done", analysis, placements, imageUrl, debug: { log } });

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "שגיאה לא ידועה";
        L(`🔴 CATCH: ${msg}`);
        send({ type: "error", message: "משהו השתבש, נסה שוב", debug: { log } });
      }

      ctrl.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
