"use client";
// app/page.tsx

import { useState, useRef } from "react";

type AppState = "idle" | "loading" | "results" | "error";

// הגדרת הטיפוסים ישירות כאן (לא מיובא מ-route)
interface PlacedProduct {
  productId:  string;
  productUrl: string;
  name:       string;
  x:          number;
  y:          number;
  width:      number;
  label:      string;
}

interface Analysis {
  balcony_size:  string;
  width_m?:      number;
  depth_m?:      number;
  sun_exposure:  string;
  style:         string;
  railing:       string;
  notes?:        string;
}

interface ApiResult {
  analysis:    Analysis;
  placements:  PlacedProduct[];
  imageUrl:    string | null;
  debug?:      { log: string[] };
}

const STEPS = [
  { label: "מנתח את המרפסת...",        time: "~10 שנ׳" },
  { label: "מזהה תנאים ועיצוב...",     time: "~3 שנ׳"  },
  { label: "טוען קטלוג מוצרים...",     time: "~3 שנ׳"  },
  { label: "מתכנן את הגינה...",        time: "~5 שנ׳"  },
  { label: "מעצב שרטוט...",            time: "~25 שנ׳" },
];

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 800;
      let { width, height } = img;
      if (width > height && width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
      else if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
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
      `}</style>
      <div style={{ position: "relative", width: "90px", height: "90px", marginBottom: "36px" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            position: "absolute", inset: `${i*11}px`, borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: `rgba(122,168,112,${0.9 - i*0.25})`,
            animation: `spin ${1.2 + i*0.6}s linear infinite ${i%2 ? "reverse" : ""}`,
          }}/>
        ))}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: "24px", animation: "breathe 2.5s ease-in-out infinite",
        }}>🌿</div>
      </div>
      <h2 style={{ color: "#FAF8F5", fontSize: "18px", marginBottom: "36px", fontWeight: "200", textAlign: "center" }}>
        מעצבים את הגינה שלך
      </h2>
      <div style={{ width: "100%", maxWidth: "290px" }}>
        {STEPS.map((s, i) => {
          const isDone   = i < step;
          const isActive = i === step;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px",
              opacity: i > step ? 0.25 : 1, transition: "opacity 0.5s",
            }}>
              <div style={{
                width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isDone ? "12px" : "14px",
                background: isDone ? "#7AA870" : "transparent",
                border: isDone ? "none" : `1.5px solid ${isActive ? "rgba(122,168,112,0.5)" : "rgba(255,255,255,0.1)"}`,
                color: isDone ? "#1a3a18" : "white",
                animation: isActive ? "spin 1.5s linear infinite" : "none",
                fontWeight: "700",
              }}>
                {isDone ? "✓" : isActive ? "↻" : "○"}
              </div>
              <span style={{ color: isDone ? "#7AA870" : isActive ? "#d0f0c8" : "#5a7258", fontSize: "13px", flex: 1 }}>
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

// ── Overlay ───────────────────────────────────────────
function BalconyOverlay({ imageUrl, placements }: { imageUrl: string | null; placements: PlacedProduct[] }) {
  const safePlacements = placements || [];

  return (
    <div style={{ position: "relative", width: "100%", borderRadius: "16px", overflow: "hidden", boxShadow: "0 6px 24px rgba(0,0,0,0.15)" }}>
      {imageUrl ? (
        <img src={imageUrl} alt="שרטוט" style={{ width: "100%", display: "block" }} />
      ) : (
        <div style={{ width: "100%", paddingBottom: "75%", background: "#F5F0E8", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#C4B8A8", fontSize: "13px" }}>
            שרטוט בהכנה...
          </div>
        </div>
      )}

      {safePlacements.map((p, i) => (
        p.productUrl ? (
          <img
            key={i}
            src={p.productUrl}
            alt={p.name || ""}
            style={{
              position:  "absolute",
              left:      `${p.x || 0}%`,
              top:       `${p.y || 60}%`,
              width:     `${p.width || 25}%`,
              height:    "auto",
              filter:    "drop-shadow(0 4px 8px rgba(0,0,0,0.2))",
            }}
          />
        ) : null
      ))}

      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "8px 14px",
        background: "linear-gradient(to top, rgba(26,23,20,0.6), transparent)",
        display: "flex", justifyContent: "space-between",
      }}>
        <span style={{ color: "rgba(250,248,245,0.5)", fontSize: "9px", letterSpacing: "2px" }}>HIBLOOM</span>
        {safePlacements.length > 0 && (
          <span style={{ color: "rgba(250,248,245,0.7)", fontSize: "10px" }}>
            {safePlacements.length} אלמנטים
          </span>
        )}
      </div>
    </div>
  );
}

// ── Results ───────────────────────────────────────────
function ResultsScreen({ result, onReset }: { result: ApiResult; onReset: () => void }) {
  const [ordered,   setOrdered]   = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // הגנה מפני undefined
  const analysis   = result.analysis   || {};
  const placements = result.placements || [];

  const SUN: Record<string, string> = {
    "שמש מלאה": "☀️", "חצי צל": "⛅", "צל": "🌑",
  };

  const tags = [
    analysis.sun_exposure ? `${SUN[analysis.sun_exposure] || ""} ${analysis.sun_exposure}` : null,
    analysis.width_m && analysis.depth_m ? `📐 ${analysis.width_m}×${analysis.depth_m} מ׳` : null,
    analysis.style ? `🎨 ${analysis.style}` : null,
  ].filter(Boolean) as string[];

  return (
    <div dir="rtl" style={{ background: "#FAF7F2", minHeight: "100vh", fontFamily: "sans-serif" }}>

      <div style={{ background: "#1A1714", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#FAF7F2", fontSize: "15px", fontWeight: "300", letterSpacing: "3px" }}>HIBLOOM</span>
        <span style={{ color: "rgba(250,247,242,0.35)", fontSize: "11px" }}>הגינה שלך</span>
      </div>

      <div style={{ padding: "16px" }}>

        {/* Overlay */}
        <div style={{ marginBottom: "14px" }}>
          <BalconyOverlay imageUrl={result.imageUrl} placements={placements} />
        </div>

        {/* ניתוח */}
        {tags.length > 0 && (
          <div style={{
            background: "#fff", borderRadius: "14px", padding: "14px",
            marginBottom: "12px", boxShadow: "0 1px 0 rgba(139,125,107,0.1), 0 4px 16px rgba(26,23,20,0.04)",
          }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {tags.map((tag, i) => (
                <span key={i} style={{
                  background: "#F5F0E8", color: "#5C4A35",
                  padding: "5px 11px", borderRadius: "20px",
                  fontSize: "12px", fontWeight: "500",
                }}>{tag}</span>
              ))}
            </div>
            {analysis.notes && (
              <p style={{ margin: "10px 0 0", color: "#8B7D6B", fontSize: "12px", lineHeight: "1.6" }}>
                {analysis.notes}
              </p>
            )}
          </div>
        )}

        {/* מוצרים */}
        {placements.length > 0 && (
          <div style={{
            background: "#fff", borderRadius: "14px", padding: "14px",
            marginBottom: "12px", boxShadow: "0 1px 0 rgba(139,125,107,0.1), 0 4px 16px rgba(26,23,20,0.04)",
          }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "600", color: "#1A1714" }}>
              הערכה שנבחרה עבורך
            </h3>
            <p style={{ margin: "0 0 12px", color: "#8B7D6B", fontSize: "11px" }}>
              {placements.length} פריטים · מותאמים אישית
            </p>

            {placements.map((p, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "10px 0", borderBottom: "1px solid #F5F0E8",
              }}>
                {p.productUrl && (
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "10px",
                    background: "#F5F0E8", overflow: "hidden", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <img src={p.productUrl} alt={p.name || ""} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", fontSize: "14px", color: "#1A1714" }}>{p.name || ""}</div>
                  <div style={{ fontSize: "11px", color: "#8B7D6B", marginTop: "2px" }}>{p.label || ""}</div>
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
          borderRadius: "12px", fontSize: "13px", cursor: "pointer",
          fontFamily: "sans-serif", marginBottom: "12px",
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
              {showDebug ? "▲ הסתר לוגים" : "▼ הצג לוגים (debug)"}
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
          if (event.type === "step")  setStep(event.step as number);
          else if (event.type === "done") {
            const r: ApiResult = {
              analysis:   (event.analysis  as Analysis)       || {},
              placements: (event.placements as PlacedProduct[]) || [],
              imageUrl:   (event.imageUrl   as string | null)  || null,
              debug:      event.debug as { log: string[] } | undefined,
            };
            setResult(r);
            setState("results");
          }
          else if (event.type === "error") throw new Error(event.message as string);
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
        <div style={{ fontSize: "10px", letterSpacing: "4px", opacity: 0.35, marginBottom: "14px" }}>
          H I B L O O M
        </div>
        <h1 style={{ margin: "0 0 10px", fontSize: "34px", fontWeight: "200", letterSpacing: "-1px", lineHeight: 1.1 }}>
          הגינה שתמיד<br />דמיינת
        </h1>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.4, fontWeight: "300" }}>
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
            {[["📸","מצלם"],["✦","מנתח"],["🌿","גינה שלך"]].map(([icon,label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "18px", color: "#8B7D6B" }}>{icon}</div>
                <div style={{ fontSize: "10px", color: "#C4B8A8", marginTop: "4px", letterSpacing: "0.5px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <p style={{ textAlign: "center", color: "rgba(139,125,107,0.3)", fontSize: "10px", marginTop: "18px", letterSpacing: "2px" }}>
          HIBLOOM · BALCONY DESIGN
        </p>
      </div>
    </div>
  );
}
