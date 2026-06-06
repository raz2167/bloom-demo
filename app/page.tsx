"use client";
// app/page.tsx — שרטוט קווי + overlay מוצרים מ-Cloudinary

import { useState, useRef } from "react";
interface PlacedProduct {
  productId:  string;
  productUrl: string;
  name:       string;
  x:          number;
  y:          number;
  width:      number;
  label:      string;
}

type AppState = "idle" | "loading" | "results" | "error";

interface Analysis {
  balcony_size: string;
  width_m: number;
  depth_m: number;
  sun_exposure: string;
  style: string;
  railing: string;
  notes: string;
}

interface ApiResult {
  analysis: Analysis;
  placements: PlacedProduct[];
  imageUrl: string | null;
  debug?: { log: string[] };
}

const STEPS = [
  { label: "מנתח את המרפסת...",         time: "~10 שנ׳" },
  { label: "מזהה תנאים ועיצוב...",      time: "~3 שנ׳"  },
  { label: "טוען קטלוג מוצרים...",      time: "~3 שנ׳"  },
  { label: "מתכנן את הגינה...",         time: "~5 שנ׳"  },
  { label: "מעצב שרטוט...",             time: "~20 שנ׳" },
];

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 800;
      let { width, height } = img;
      if (width > height && width > MAX) { height = Math.round(height * MAX / width);  width = MAX; }
      else if (height > MAX)             { width  = Math.round(width  * MAX / height); height = MAX; }
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ── Loading ───────────────────────────────────────────
function LoadingScreen({ step }: { step: number }) {
  return (
    <div dir="rtl" style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% 40%, #2A3828 0%, #111 70%)",
      padding: "40px 24px", fontFamily: "sans-serif",
    }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes blink   { 0%,100%{opacity:.3} 50%{opacity:1} }
      `}</style>

      <div style={{ position: "relative", width: "100px", height: "100px", marginBottom: "36px" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            position: "absolute", inset: `${i*12}px`, borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: `rgba(122,168,112,${0.9 - i*0.25})`,
            animation: `spin ${1.2 + i*0.6}s linear infinite ${i%2 ? "reverse" : ""}`,
          }}/>
        ))}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: "26px", animation: "breathe 2.5s ease-in-out infinite",
        }}>🌿</div>
      </div>

      <h2 style={{ color: "#FAF8F5", fontSize: "20px", marginBottom: "40px", fontWeight: "200", letterSpacing: "-0.5px", textAlign: "center" }}>
        מעצבים את הגינה שלך
      </h2>

      <div style={{ width: "100%", maxWidth: "300px" }}>
        {STEPS.map((s, i) => {
          const isDone    = i < step;
          const isActive  = i === step;
          const isPending = i > step;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "14px",
              marginBottom: "18px",
              opacity: isPending ? 0.25 : 1,
              transition: "opacity 0.5s ease",
            }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isDone ? "13px" : "16px",
                background: isDone ? "#7AA870" : isActive ? "rgba(122,168,112,0.15)" : "transparent",
                border: isDone ? "none" : `1.5px solid ${isActive ? "rgba(122,168,112,0.5)" : "rgba(255,255,255,0.1)"}`,
                color: isDone ? "#1a3a18" : "white",
                animation: isActive ? "spin 1.5s linear infinite" : "none",
                fontWeight: "700",
              }}>
                {isDone ? "✓" : isActive ? "↻" : "○"}
              </div>
              <span style={{ color: isDone ? "#7AA870" : isActive ? "#d0f0c8" : "#5a7258", fontSize: "14px", flex: 1 }}>
                {s.label}
              </span>
              {isActive && <span style={{ fontSize: "10px", color: "#7AA870" }}>{s.time}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Overlay visualization ─────────────────────────────
function BalconyOverlay({ imageUrl, placements }: { imageUrl: string | null; placements: PlacedProduct[] }) {
  return (
    <div style={{ position: "relative", width: "100%", borderRadius: "16px", overflow: "hidden", boxShadow: "0 6px 24px rgba(0,0,0,0.15)" }}>

      {/* שרטוט קווי — רקע */}
      {imageUrl ? (
        <img src={imageUrl} alt="שרטוט המרפסת" style={{ width: "100%", display: "block" }} />
      ) : (
        // Fallback אם אין שרטוט
        <div style={{ width: "100%", paddingBottom: "75%", background: "#F5F0E8", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#C4B8A8", fontSize: "13px" }}>
            שרטוט לא זמין
          </div>
        </div>
      )}

      {/* overlay מוצרים */}
      {placements.map((p, i) => (
        <img
          key={i}
          src={p.productUrl}
          alt={p.name}
          title={p.label}
          style={{
            position:  "absolute",
            left:      `${p.x}%`,
            top:       `${p.y}%`,
            width:     `${p.width}%`,
            height:    "auto",
            filter:    "drop-shadow(0 4px 8px rgba(0,0,0,0.25))",
            transition: "opacity 0.3s",
          }}
        />
      ))}

      {/* תווית HiBloom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "10px 16px",
        background: "linear-gradient(to top, rgba(26,23,20,0.7), transparent)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
      }}>
        <span style={{ color: "rgba(250,248,245,0.6)", fontSize: "10px", letterSpacing: "2px" }}>HIBLOOM</span>
        <span style={{ color: "rgba(250,248,245,0.8)", fontSize: "11px" }}>
          {placements.length} אלמנטים
        </span>
      </div>
    </div>
  );
}

// ── Results ───────────────────────────────────────────
function ResultsScreen({ result, onReset }: { result: ApiResult; onReset: () => void }) {
  const [ordered,   setOrdered]   = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const SUN: Record<string, string> = {
    "שמש מלאה": "☀️", "חצי צל": "⛅", "צל": "🌑",
  };

  return (
    <div dir="rtl" style={{ background: "#FAF7F2", minHeight: "100vh", fontFamily: "sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#1A1714", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#FAF7F2", fontSize: "16px", fontWeight: "300", letterSpacing: "2px" }}>HIBLOOM</span>
        <span style={{ color: "rgba(250,247,242,0.4)", fontSize: "12px" }}>הגינה שלך</span>
      </div>

      <div style={{ padding: "16px" }}>

        {/* Overlay visualization */}
        <div style={{ marginBottom: "16px" }}>
          <BalconyOverlay imageUrl={result.imageUrl} placements={result.placements} />
        </div>

        {/* ניתוח */}
        <div style={{
          background: "#fff", borderRadius: "14px", padding: "14px",
          marginBottom: "12px", boxShadow: "0 1px 0 rgba(139,125,107,0.1), 0 4px 16px rgba(26,23,20,0.04)",
        }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              `${SUN[result.analysis.sun_exposure] || ""} ${result.analysis.sun_exposure}`,
              `📐 ${result.analysis.width_m}×${result.analysis.depth_m} מ׳`,
              `🎨 ${result.analysis.style}`,
            ].map((tag, i) => (
              <span key={i} style={{
                background: "#F5F0E8", color: "#5C4A35",
                padding: "5px 11px", borderRadius: "20px",
                fontSize: "12px", fontWeight: "500",
              }}>{tag}</span>
            ))}
          </div>
          {result.analysis.notes && (
            <p style={{ margin: "10px 0 0", color: "#8B7D6B", fontSize: "12px", lineHeight: "1.6" }}>
              {result.analysis.notes}
            </p>
          )}
        </div>

        {/* רשימת מוצרים */}
        {result.placements.length > 0 && (
          <div style={{
            background: "#fff", borderRadius: "14px", padding: "14px",
            marginBottom: "12px", boxShadow: "0 1px 0 rgba(139,125,107,0.1), 0 4px 16px rgba(26,23,20,0.04)",
          }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: "600", color: "#1A1714", letterSpacing: "0.3px" }}>
              הערכה שנבחרה עבורך
            </h3>
            <p style={{ margin: "0 0 14px", color: "#8B7D6B", fontSize: "11px" }}>
              {result.placements.length} פריטים · מותאמים אישית
            </p>

            {result.placements.map((p, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "10px 0", borderBottom: "1px solid #F5F0E8",
              }}>
                <div style={{
                  width: "52px", height: "52px", borderRadius: "10px", flexShrink: 0,
                  background: "#F5F0E8", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <img src={p.productUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", fontSize: "14px", color: "#1A1714" }}>{p.name}</div>
                  <div style={{ fontSize: "11px", color: "#8B7D6B", marginTop: "2px" }}>{p.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* הזמנה */}
        {!ordered ? (
          <button onClick={() => setOrdered(true)} style={{
            width: "100%", padding: "17px", background: "#1A1714", color: "#FAF7F2",
            border: "none", borderRadius: "14px", fontSize: "15px", fontWeight: "600",
            fontFamily: "sans-serif", cursor: "pointer", marginBottom: "10px",
            letterSpacing: "0.3px",
          }}>
            הזמן ערכה
          </button>
        ) : (
          <div style={{
            padding: "20px", background: "#F5F0E8", border: "1px solid rgba(139,125,107,0.2)",
            borderRadius: "14px", textAlign: "center", marginBottom: "10px",
          }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>🎉</div>
            <div style={{ color: "#1A1714", fontWeight: "600", fontSize: "15px" }}>ההזמנה התקבלה!</div>
            <div style={{ color: "#8B7D6B", fontSize: "12px", marginTop: "4px" }}>המשתלה תיצור קשר בקרוב</div>
          </div>
        )}

        <button onClick={onReset} style={{
          width: "100%", padding: "13px", background: "transparent",
          color: "#8B7D6B", border: "1px solid rgba(139,125,107,0.25)",
          borderRadius: "12px", fontSize: "13px", cursor: "pointer", marginBottom: "12px",
          fontFamily: "sans-serif",
        }}>
          ← נסה עם תמונה אחרת
        </button>

        {/* Debug */}
        {result.debug?.log && (
          <div style={{ marginBottom: "24px" }}>
            <button onClick={() => setShowDebug(!showDebug)} style={{
              width: "100%", padding: "8px", background: "transparent",
              color: "#C4B8A8", border: "1px dashed rgba(139,125,107,0.2)",
              borderRadius: "8px", fontSize: "11px", cursor: "pointer", fontFamily: "sans-serif",
            }}>
              {showDebug ? "▲ הסתר לוגים" : "▼ הצג לוגים"}
            </button>
            {showDebug && (
              <div style={{
                background: "#1A1714", borderRadius: "8px", padding: "12px",
                marginTop: "8px", maxHeight: "220px", overflowY: "auto",
              }}>
                {result.debug.log.map((line, i) => (
                  <div key={i} style={{ fontFamily: "monospace", fontSize: "11px", color: "#88ff88", marginBottom: "3px" }}>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────
export default function Home() {
  const [state,    setState]    = useState<AppState>("idle");
  const [step,     setStep]     = useState(0);
  const [result,   setResult]   = useState<ApiResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setState("loading");
    setStep(0);

    try {
      const base64Full = await compressImage(file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Full.split(",")[1],
          mimeType: file.type || "image/jpeg",
          nursery: "Bloom_Demo",
        }),
      });

      if (!res.body) throw new Error("אין תגובה מהשרת");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let event: Record<string, unknown>;
          try { event = JSON.parse(jsonStr); } catch { continue; }

          if (event.type === "step") {
            setStep(event.step as number);
          } else if (event.type === "done") {
            setResult(event as unknown as ApiResult);
            setState("results");
          } else if (event.type === "error") {
            throw new Error(event.message as string);
          }
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "שגיאה לא ידועה");
      setState("error");
    }
  };

  if (state === "loading") return <LoadingScreen step={step} />;
  if (state === "results" && result) {
    return <ResultsScreen result={result} onReset={() => { setState("idle"); setResult(null); }} />;
  }

  return (
    <div dir="rtl" style={{
      background: "linear-gradient(180deg, #1A1714 0%, #2C2420 40%, #FAF7F2 40%)",
      minHeight: "100vh", fontFamily: "sans-serif",
    }}>
      <div style={{ textAlign: "center", padding: "52px 24px 60px", color: "#FAF7F2" }}>
        <div style={{ fontSize: "11px", letterSpacing: "4px", opacity: 0.4, marginBottom: "14px", fontWeight: "400" }}>
          H I B L O O M
        </div>
        <h1 style={{ margin: "0 0 10px", fontSize: "36px", fontWeight: "200", letterSpacing: "-1px", lineHeight: 1.1 }}>
          הגינה שתמיד<br />דמיינת
        </h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.45, fontWeight: "300" }}>
          צלם את המרפסת שלך
        </p>
      </div>

      <div style={{ padding: "0 16px 32px" }}>
        <div style={{
          background: "#fff", borderRadius: "20px", padding: "28px 20px",
          boxShadow: "0 8px 32px rgba(26,23,20,0.12)",
        }}>

          {state === "error" && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA",
              borderRadius: "10px", padding: "12px 16px", marginBottom: "18px",
              color: "#DC2626", fontSize: "13px",
            }}>❌ {errorMsg}</div>
          )}

          <div onClick={() => fileRef.current?.click()} style={{
            border: "1.5px dashed rgba(139,125,107,0.3)", borderRadius: "14px",
            padding: "44px 20px", textAlign: "center", cursor: "pointer",
            background: "#FAF7F2", marginBottom: "24px",
          }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📸</div>
            <p style={{ margin: "0 0 5px", fontWeight: "600", color: "#1A1714", fontSize: "16px" }}>
              צלם את המרפסת שלך
            </p>
            <p style={{ margin: 0, color: "#8B7D6B", fontSize: "13px" }}>
              או לחץ לבחור תמונה מהגלריה
            </p>
          </div>

          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            style={{ display: "none" }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

          <div style={{ display: "flex", justifyContent: "space-around" }}>
            {[["📸","מצלם"],["✦","מנתח"],["🌿","הגינה שלך"]].map(([icon,label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "20px", color: "#8B7D6B" }}>{icon}</div>
                <div style={{ fontSize: "10px", color: "#C4B8A8", marginTop: "4px", letterSpacing: "0.5px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: "center", color: "rgba(139,125,107,0.4)", fontSize: "10px", marginTop: "18px", letterSpacing: "2px" }}>
          HIBLOOM · BALCONY DESIGN
        </p>
      </div>
    </div>
  );
}
