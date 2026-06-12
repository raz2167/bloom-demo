// app/api/compose/route.ts
import { NextRequest } from "next/server";

export const maxDuration = 300;

const BLUEPRINT_PREFIX = "This is a black and white architectural line drawing of a balcony. Preserve this line drawing exactly as the background. Do not replace or redraw the floor, walls or railing. All planters must be placed flush against the back wall, touching it, their long 60cm side running PARALLEL to the wall like window boxes - NOT sticking out into the balcony. The railing is visible above and behind the planters. Only add the following colored elements on top of the existing line drawing: ";

async function getBlueprintBuffer(blueprintUrl: string): Promise<Buffer> {
  if (blueprintUrl.startsWith("data:")) {
    const comma = blueprintUrl.indexOf(",");
    if (comma === -1) throw new Error("invalid data URL");
    return Buffer.from(blueprintUrl.slice(comma + 1), "base64");
  }
  const r = await fetch(blueprintUrl);
  if (!r.ok) throw new Error("blueprint download failed: " + r.status);
  return Buffer.from(await r.arrayBuffer());
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

      L("[2] extracting blueprint buffer");
      const bpBuf = await getBlueprintBuffer(blueprintUrl);
      L("[2] buffer: " + bpBuf.length + " bytes");

      const alreadyHasPrefix = dallePrompt.startsWith("This is a black and white architectural line drawing");
      const finalPrompt = alreadyHasPrefix ? dallePrompt : BLUEPRINT_PREFIX + dallePrompt;
      L("[3] prompt: " + finalPrompt.length + " chars");

      L("[4] building FormData (stream=true, partial_images=2)");
      const fd = new FormData();
      fd.append("model",              "gpt-image-2");
      fd.append("image[]",            new Blob([new Uint8Array(bpBuf)], { type: "image/png" }), "blueprint.png");
      fd.append("prompt",             finalPrompt);
      fd.append("n",                  "1");
      fd.append("size",               "1024x1024");
      fd.append("quality",            "low");
      fd.append("output_format",      "jpeg");
      fd.append("output_compression", "80");
      fd.append("stream",             "true");
      fd.append("partial_images",     "2");

      L("[5] calling DALL-E edits (streaming)");
      const dr = await fetch("https://api.openai.com/v1/images/edits", {
        method:  "POST",
        headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
        body:    fd,
      });

      L("[5] status: " + dr.status);

      if (!dr.ok || !dr.body) {
        const errText = await dr.text();
        L("[5] error: " + errText.substring(0, 300));
        await send({ type: "error", message: "DALL-E error " + dr.status, log });
        await writer.close();
        return;
      }

      const reader = dr.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let partialCount = 0;
      let lastPartialB64 = "";

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

          // partial image event
          if (ev.type === "image_generation.partial_image" || ev.partial_image_index !== undefined) {
            partialCount++;
            const b64 = (ev.b64_json ?? ev.partial_image_b64) as string | undefined;
            if (b64) {
              lastPartialB64 = b64;
              L("[partial " + partialCount + "] " + Math.round(b64.length / 1024) + "KB");
              await send({ type: "partial", imageUrl: "data:image/jpeg;base64," + b64, index: partialCount });
            }
          }

          // final image (non-streaming event format: data array)
          if (Array.isArray(ev.data) && ev.data[0]?.b64_json) {
            const b64 = ev.data[0].b64_json as string;
            L("[final-data] " + Math.round(b64.length / 1024) + "KB");
            await send({ type: "done", imageUrl: "data:image/jpeg;base64," + b64, log });
            await writer.close();
            return;
          }

          // streaming completed event
          if (ev.type === "image_generation.completed" || (ev.b64_json && !ev.partial_image_index)) {
            const b64 = ev.b64_json as string | undefined;
            if (b64) {
              L("[final-stream] " + Math.round(b64.length / 1024) + "KB");
              await send({ type: "done", imageUrl: "data:image/jpeg;base64," + b64, log });
              await writer.close();
              return;
            }
          }
        }
      }

      // stream ended — use last partial as final if no explicit done received
      if (lastPartialB64) {
        L("[fallback] using last partial as final");
        await send({ type: "done", imageUrl: "data:image/jpeg;base64," + lastPartialB64, log });
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
