// app/api/compose/route.ts
// שלב 2: blueprint + 2 combinations מ-Cloudinary → תמונה סופית
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
interface CI { id: string; name: string; url: string; }

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };
  try {
    const { blueprintUrl, nursery = "Bloom_Demo", confirmedWidth = 4.0, confirmedDepth = 2.5 } = await req.json();
    if (!blueprintUrl) return NextResponse.json({ error: "חסר blueprintUrl", debug:{log} }, { status:400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "חסר OpenAI key", debug:{log} }, { status:500 });

    L("[1] מוריד blueprint...");
    const bpBuf = await dlUrl(blueprintUrl);
    L("[1] " + bpBuf.length + " bytes");

    L("[2] טוען combinations...");
    const combos = await fetchCombos(nursery, L);
    if (!combos.length) return NextResponse.json({ error: "לא נמצאו combinations", debug:{log} }, { status:400 });

    const c1 = combos[0], c2 = combos[1] ?? combos[0];
    L("[2] " + c1.name + " + " + c2.name);
    const c1Buf = await dlUrl(c1.url);
    const c2Buf = await dlUrl(c2.url);

    const planterPct = Math.round((0.6 / confirmedWidth) * 100);
    const marginPct  = Math.round(((confirmedWidth - 1.2) / confirmedWidth) / 3 * 100);
    const pos2       = 100 - marginPct - planterPct;

    const prompt = [
      "Place exactly two planter combinations on this architectural balcony line drawing.",
      `The balcony is ${confirmedWidth}m wide and ${confirmedDepth}m deep.`,
      `Place combination1.png against the railing, ${marginPct}% from left, ${planterPct}% wide.`,
      `Place combination2.png against the railing, ${pos2}% from left, ${planterPct}% wide.`,
      "Each planter is 60cm wide. Maintain realistic perspective.",
      "Keep the line drawing style for balcony. Planters photorealistic.",
      "Do NOT add chairs, tables, or furniture. Only the two planters.",
    ].join(" ");

    L("[3] שולח ל-DALL-E edits...");
    const fd = new FormData();
    fd.append("model", "gpt-image-2");
    fd.append("image[]", new Blob([new Uint8Array(bpBuf)],  { type:"image/png" }), "blueprint.png");
fd.append("image[]", new Blob([new Uint8Array(c1Buf)],  { type:"image/png" }), "combination1.png");
fd.append("image[]", new Blob([new Uint8Array(c2Buf)],  { type:"image/png" }), "combination2.png");
    fd.append("prompt", prompt);
    fd.append("n", "1");
    fd.append("size", "1024x1024");

    const dr = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body: fd,
    });
    L("[3] status: " + dr.status);
    const dd = await dr.json();
    L("[3] " + JSON.stringify(dd).substring(0, 200));

    let finalUrl: string | null = null;
    if (dd.data?.[0]?.url)       finalUrl = dd.data[0].url;
    if (dd.data?.[0]?.b64_json)  finalUrl = "data:image/png;base64," + dd.data[0].b64_json;

    if (!finalUrl) return NextResponse.json({ error: "DALL-E: " + JSON.stringify(dd).substring(0,150), debug:{log} }, { status:500 });

    L("[4] מוכן!");
    return NextResponse.json({ imageUrl: finalUrl, products: [{ name:c1.name, url:c1.url }, { name:c2.name, url:c2.url }], debug:{log} });

  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "שגיאה";
    L("CATCH: " + m);
    return NextResponse.json({ error: m, debug:{log} }, { status:500 });
  }
}

async function dlUrl(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("הורדה נכשלה: " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function fetchCombos(nursery: string, L: (m:string)=>void): Promise<CI[]> {
  const cn=process.env.CLOUDINARY_CLOUD_NAME, ak=process.env.CLOUDINARY_API_KEY, as=process.env.CLOUDINARY_API_SECRET;
  if (!cn||!ak||!as) { L("[2] חסרים פרטי Cloudinary"); return []; }
  const r = await fetch("https://api.cloudinary.com/v1_1/"+cn+"/resources/search", {
    method:"POST",
    headers:{ Authorization:"Basic "+Buffer.from(ak+":"+as).toString("base64"), "Content-Type":"application/json" },
    body: JSON.stringify({ expression:"folder:Nurseries/"+nursery+"/combinations/*", max_results:5 }),
  });
  const d = await r.json();
  L("[2] " + (d.resources||[]).length + " נמצאו");
  return (d.resources||[]).map((r:{public_id:string;secure_url:string})=>({
    id: r.public_id,
    name: decodeURIComponent(r.public_id.split("/").pop()||"").replace(/[-_]/g," "),
    url: r.secure_url,
  }));
}
