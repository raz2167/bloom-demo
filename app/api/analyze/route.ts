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
  public_id:  string;
  secure_url: string;
  width:      number;
  height:     number;
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
        ctrl.enqueue(encoder.encode("data: " + JSON.stringify(data) + "\n\n"));
      };
      const L = (msg: string) => { console.log(msg); log.push(msg); };
      const fail = (msg: string) => {
        L("FAIL: " + msg);
        send({ type: "error", message: msg, debug: { log } });
        ctrl.close();
      };

      try {
        if (!imageBase64) return fail("לא התקבלה תמונה");
        if (!process.env.ANTHROPIC_API_KEY) return fail("חסר מפתח Anthropic");

        L("[1] " + Math.round(imageBase64.length / 1024) + "KB");
        send({ type: "step", step: 0 });

        let analysisMsg: Anthropic.Message | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            analysisMsg = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 600,
              messages: [{
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg"|"image/png"|"image/webp", data: imageBase64 } },
                  { type: "text", text: "נתח את המרפסת והחזר JSON בלבד:\n{\"balcony_size\":\"קטנה|בינונית|גדולה\",\"width_m\":4.0,\"depth_m\":2.5,\"sun_exposure\":\"שמש מלאה|חצי צל|צל\",\"style\":\"מודרני|ים-תיכוני|כפרי|מינימליסטי\",\"railing\":\"זכוכית|ברזל|בטון|עץ|אין\",\"notes\":\"הערה\"}" },
                ],
              }],
            });
            L("[1] OK"); break;
          } catch (e: unknown) {
            if (attempt === 3) return fail("השירות עמוס - נסה שוב");
            await new Promise(r => setTimeout(r, 2000 * attempt));
          }
        }

        const raw = analysisMsg!.content[0].type === "text" ? analysisMsg!.content[0].text.trim() : "{}";
        let analysis: Record<string, string|number>;
        try {
          analysis = JSON.parse(raw.replace(/```json|```/g,"").trim());
          if (!analysis.width_m) analysis.width_m = 4.0;
          if (!analysis.depth_m) analysis.depth_m = 2.5;
          L("[1] " + JSON.stringify(analysis));
        } catch { return fail("שגיאה בניתוח"); }

        send({ type: "step", step: 1, analysis });
        send({ type: "step", step: 2 });

        let catalog: CatalogItem[] = [];
        const cn = process.env.CLOUDINARY_CLOUD_NAME;
        const ak = process.env.CLOUDINARY_API_KEY;
        const as = process.env.CLOUDINARY_API_SECRET;

        if (cn && ak && as) {
          const auth = Buffer.from(ak + ":" + as).toString("base64");
          try {
            const r = await fetch("https://api.cloudinary.com/v1_1/" + cn + "/resources/search", {
              method: "POST",
              headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" },
              body: JSON.stringify({ expression: "folder:Nurseries/" + nursery + "/*", max_results: 50 }),
            });
            const d = await r.json();
            L("[2] HTTP " + r.status + " | " + JSON.stringify(d).substring(0,200));
            catalog = (d.resources||[]).map((r: CloudinaryResource) => {
              const p = r.public_id.split("/");
              return { id: r.public_id, name: (p[p.length-1]||"").replace(/[-_]/g," "), url: r.secure_url, width: r.width, height: r.height, folder: p[p.length-2]||"other" };
            });
            L("[2] " + catalog.length + " items");
          } catch(e) { L("[2] err: "+e); }
        }
const bgImages = catalog.filter(i => i.folder === "Demo Balcony" || i.folder === "Demo_Balcony");
const products = catalog.filter(i => i.folder !== "Demo Balcony" && i.folder !== "Demo_Balcony");
let imageUrl: string | null = null;
if (bgImages.length > 0) {
  const empty = bgImages.find(i => !i.name.includes("צמחייה"));
  imageUrl = (empty || bgImages[0]).url;
}

        send({ type: "step", step: 3 });
        let placements: PlacedProduct[] = [];

        if (products.length > 0) {
          const pl = products.slice(0,8).map(p=>({id:p.id,name:p.name,url:p.url}));
          try {
            const pm = await anthropic.messages.create({
              model: "claude-sonnet-4-6", max_tokens: 800,
              messages:[{role:"user",content:"מעצב גינות. מרפסת "+analysis.width_m+"x"+analysis.depth_m+"מ. מוצרים: "+JSON.stringify(pl)+"\nהחזר JSON: {\"placements\":[{\"productId\":\"id\",\"productUrl\":\"url\",\"name\":\"שם\",\"x\":10,\"y\":62,\"width\":28,\"label\":\"תיאור\"}]}\nחוקים: 3-5, y 45-80."}],
            });
            const pr = pm.content[0].type==="text" ? pm.content[0].text.trim() : "{}";
            const pd = JSON.parse(pr.replace(/```json|```/g,"").trim());
            placements = Array.isArray(pd.placements) ? pd.placements : [];
            L("[3] " + placements.length + " placements");
          } catch(e) {
            placements = products.slice(0,3).map((p,i)=>({productId:p.id,productUrl:p.url,name:p.name,x:8+i*30,y:60,width:26,label:p.name}));
          }
        }

        send({ type: "step", step: 4 });
        // imageUrl כבר הוגדר למעלה
        L("DONE placements:" + placements.length);
        send({ type: "done", analysis, placements, imageUrl, debug: { log } });

      } catch(err: unknown) {
        send({ type: "error", message: "משהו השתבש, נסה שוב", debug: { log } });
      }
      ctrl.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
}
