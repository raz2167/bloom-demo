// app/api/compose/route.ts
import { NextRequest } from "next/server";

export const maxDuration = 300;

const BLUEPRINT_PREFIX = "This is a black and white architectural line drawing of a balcony. Preserve this line drawing exactly as the background. Do not replace or redraw the floor, walls or railing. All planters must be placed flush against the back wall, touching it, their long 60cm side running PARALLEL to the wall like window boxes - NOT sticking out into the balcony. The railing is visible above and behind the planters. Only add the following colored elements on top of the existing line drawing: ";

async function getBlueprintBase64(blueprintUrl: string): Promise<{ b64: string; mime: string }> {
  if (blueprintUrl.startsWith("data:")) {
    const comma = blueprintUrl.indexOf(",");
    if (comma === -1) throw new Error("invalid data URL");
    const mime = blueprintUrl.slice(5, blueprintUrl.indexOf(";"));
    return { b64: blueprintUrl.slice(comma + 1), mime: mime || "image/png" };
  }
  const r = await fetch(blueprintUrl);
  if (!r.ok) throw new Error("blueprint download failed: " + r.status);
  const buf = await r.arrayBuffer();
  const b64 = Buffer.from(buf).toString("base64");
  const ct = r.headers.get("content-type") || "image/png";
  return { b64, mime: ct.split(";")[0] };
}

function sseEvent(data: Record<string, unknown>): string {
  return "data: " + JSON.stringify(data) + "\n\n";
}

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const L = (m: string) => { console.log(m); log.push(m); };

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const send = async (data: Record<string, unknown>) => {
    await writer.write(encoder.encode(sseEvent(data)));
  };

  (async () => {
    try {
      L("[1] parsing request");
      const { blueprintUrl, dallePrompt } = await req.json() as { blueprintUrl: string; dallePrompt: string };

      if (!blueprintUrl || !dallePrompt || !process.env.OPENAI_API_KEY) {
        await send({ type: "error", message: "missing required fields", log });
        await writer.close();
        return;
      }

      L("[2] extracting blueprint");
      const { b64, mime } = await getBlueprintBase64(blueprintUrl);
      L("[2] blueprint: " + Math.round(b64.length / 1024) + "KB mime=" + mime);

      const alreadyHasPrefix = dallePrompt.startsWith("This is a black and white architectural line drawing");
      const finalPrompt = alreadyHasPrefix ? dallePrompt : BLUEPRINT_PREFIX + dallePrompt;
      L("[3] prompt: " + finalPrompt.length + " chars");

      L("[4] calling Responses API (streaming, partial_images=2)");
      const body = {
        model: "gpt-4o",
        stream: true,
        input: [
          {
            role: "user",
            content: [
              { type: "input_image", image_url: "data:" + mime + ";base64," + b64 },
              { type: "input_text", text: finalPrompt },
            ],
          },
        ],
        tools: [
          {
            type: "image_generation",
            quality: "low",
            size: "1024x1024",
            output_format: "jpeg",
            output_compression: 80,
            partial_images: 2,
          },
        ],
      };

      const dr = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + process.env.OPENAI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      L("[5] Responses API status: " + dr.status);

      if (!dr.ok || !dr.body) {
        const errText = await dr.text();
        L("[5] error: " + errText.substring(0, 300));
        await send({ type: "error", message: "Responses API error " + dr.status, log });
        await writer.close();
        return;
      }

      const reader = dr.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let partialCount = 0;
      let finalB64 = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          let ev: Record<string, unknown> = {};
          try { ev = JSON.parse(raw); } catch { continue; }

          const evType = ev.type as string | undefined;

          if (evType === "response.image_generation_call.partial_image") {
            partialCount++;
            const b64Partial = ev.partial_image_b64 as string | undefined;
            if (b64Partial) {
              L("[partial " + partialCount + "] size=" + Math.round(b64Partial.length / 1024) + "KB");
              await send({
                type: "partial",
                imageUrl: "data:image/jpeg;base64," + b64Partial,
                index: partialCount,
              });
            }
          }

          if (evType === "response.image_generation_call.completed") {
            const result = ev.result as string | undefined;
            if (result) {
              finalB64 = result;
              L("[final] size=" + Math.round(finalB64.length / 1024) + "KB");
            }
          }
        }
      }

      if (finalB64) {
        await send({ type: "done", imageUrl: "data:image/jpeg;base64," + finalB64, log });
      } else if (partialCount > 0) {
        L("[fallback] using last partial as final");
        await send({ type: "done", imageUrl: null, log });
      } else {
        await send({ type: "error", message: "no image generated", log });
      }

    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      log.push("CATCH: " + m);
      await send({ type: "error", message: m, log }).catch(() => null);
    } finally {
      await writer.close().catch(() => null);
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
