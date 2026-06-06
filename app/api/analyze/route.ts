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

        L("[1] תמונה: " + Math.round(imageBase64.length / 1024) + "KB");
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
                  { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: imageBase64 } },
                  { type: "text", text: "נתח את המרפסת והחזר JSON בלבד:\n{\"balcony_size\":\"קטנה|בינונית|גדולה\",\"width_m\":4.0,\"depth_m\":2.5,\"sun_exposure\":\"שמש מלאה|חצי צל|צל\",\"style\":\"מודרני|ים-תיכוני|כפרי|מינימליסטי\",\"railing\":\"זכוכית|ברזל|בטון|עץ|אין\",\"notes\":\"הערה\"}" },
                ],
              }],
            });
            L("[1] הצליח");
            break;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (attempt === 3) return fail("השירות עמוס - נסה שוב");
            await new Promise(r => setTimeout(r, 2000 * attempt));
            L("[1] ניסיון " + attempt + " נכשל: " + msg.substring(0, 50));
          }
        }

        const rawText = analysisMsg!.content[0].type === "text" ? analysisMsg!.content[0].text.trim() : "{}";
        let analysis: Record<string, string | number>;
        try {
          analysis = JSON.parse(rawText
