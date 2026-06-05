"use client";
// app/page.tsx

import { useState, useRef } from "react";
import BalconySVG from "@/components/BalconySVG";
import type { Product } from "@/lib/catalog";

type AppState = "idle" | "loading" | "results" | "error";

interface Analysis {
  balcony_size: string;
  sun_exposure: string;
  style: string;
  railing: string;
  floor_color: string;
  notes: string;
}

interface ApiResult {
  analysis: Analysis;
  recommendations: Product[];
  imageUrl: string | null;
  debug?: { log: string[] };
}

const STEPS = [
  "מנתח את התמונה...",
  "מזהה תנאים ועיצוב...",
  "מעצב את הגינה...",
  "בוחר צמחים מתאימים...",
];

// ── Loading ───────────────────────────────────────────
function LoadingScreen({ step }: { step: number }) {
  return (
    <div dir="rtl" style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh",
      background: "#1a3a18", padding: "40px 24px", fontFamily: "sans-serif",
    }}>
      {/* Animated rings */}
      <div style={{ position: "relative", width: "100px", height: "100px", marginBottom: "32px" }}>
        {[0,1,2].map((i) => (
          <div key={i} style={{
            position: "absolute", inset: `${i * 12}px`,
            borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: `rgba(123,196,122,${0.9 - i * 0.25})`,
            animation: `spin ${1.2 + i * 0.6}s linear infinite ${i % 2 ? "reverse" : ""}`,
          }} />
        ))}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: "28px",
        }}>🌿</div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <h2 style={{ color: "#fff", fontSize: "20px", marginBottom: "36px", fontWeight: "700" }}>
        bloom מעצב את הגינה שלך
      </h2>

      {STEPS.map((s, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: "14px",
          marginBottom: "18px", width: "100%", maxWidth: "300px",
          opacity: i <= step ? 1 : 0.3, transition: "opacity 0.6s ease",
        }}>
          <span style={{ fontSize: "20px" }}>
            {i < step ? "✅" : i === step ? "⏳" : "⭕"}
          </span>
          <span style={{ color: "#d0f0c8", fontSize: "15px" }}>{s}</span>
          {i === step && (
            <span style={{ fontSize: "11px", color: "#7bc47a", marginRight: "auto" }}>
              {i === 2 ? "~20 שנ׳" : "~5 שנ׳"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Results ───────────────────────────────────────────
function ResultsScreen({ result, onReset }: { result: ApiResult; onReset: () => void }) {
  const [ordered, setOrdered] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const total = result.recommendations.reduce((s, p) => s + p.price, 0);

  const SUN: Record<string, string> = {
    "שמש מלאה": "☀️ שמש מלאה",
    "חצי צל":   "⛅ חצי צל",
    "צל":       "🌑 צל",
  };

  return (
    <div dir="rtl" style={{ background: "#f5f3ef", minHeight: "100vh", fontFamily: "sans-serif" }}>

      {/* Header */}
      <div style={{
        background: "#2d5a27", padding: "14px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: "#fff", fontSize: "20px", fontWeight: "800" }}>🌿 bloom</span>
        <span style={{ color: "#a8d5a2", fontSize: "13px" }}>הגינה שלך מוכנה!</span>
      </div>

      <div style={{ padding: "16px" }}>

        {/* DALL-E Image (אם יש) */}
        {result.imageUrl && (
          <div style={{ marginBottom: "14px" }}>
            <p style={{ fontSize: "11px", color: "#999", marginBottom: "6px", textAlign: "center" }}>
              הדמיית AI — איך הגינה יכולה להיראות
            </p>
            <div style={{ borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
              <img src={result.imageUrl} alt="הדמיית הגינה" style={{ width: "100%", display: "block" }} />
            </div>
          </div>
        )}

        {/* BalconySVG — תכנית המוצרים */}
        <div style={{ marginBottom: "14px" }}>
          <p style={{ fontSize: "11px", color: "#999", marginBottom: "6px", textAlign: "center" }}>
            {result.imageUrl ? "המוצרים שיהיו בגינה שלך" : "הגינה שלך עם המוצרים"}
          </p>
          <BalconySVG analysis={result.analysis} />
        </div>

        {/* ניתוח */}
        <div style={{
          background: "#fff", borderRadius: "14px", padding: "14px",
          marginBottom: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <h3 style={{ margin: "0 0 10px", color: "#2d5a27", fontSize: "14px", fontWeight: "700" }}>
            ניתוח המרפסת שלך
          </h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              SUN[result.analysis.sun_exposure],
              `📐 מרפסת ${result.analysis.balcony_size}`,
              `🎨 ${result.analysis.style}`,
            ].map((tag, i) => (
              <span key={i} style={{
                background: "#f0f7ee", color: "#2d5a27",
                padding: "5px 11px", borderRadius: "20px",
                fontSize: "12px", fontWeight: "600",
              }}>{tag}</span>
            ))}
          </div>
          {result.analysis.notes && (
            <p style={{ margin: "10px 0 0", color: "#666", fontSize: "12px", lineHeight: "1.5" }}>
              💡 {result.analysis.notes}
            </p>
          )}
        </div>

        {/* רשימת מוצרים */}
        <div style={{
          background: "#fff", borderRadius: "14px", padding: "14px",
          marginBottom: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <h3 style={{ margin: "0 0 4px", color: "#2d5a27", fontSize: "14px", fontWeight: "700" }}>
            🛒 הערכה שלך
          </h3>
          <p style={{ margin: "0 0 12px", color: "#999", fontSize: "11px" }}>
            {result.recommendations.length} פריטים שנבחרו למרפסת שלך
          </p>

          {result.recommendations.map((p) => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "9px 0", borderBottom: "1px solid #f5f5f5",
            }}>
              <span style={{
                fontSize: "24px", background: p.bg + "22", borderRadius: "8px",
                width: "42px", height: "42px", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>{p.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "600", fontSize: "13px", color: "#222" }}>{p.name}</div>
                <div style={{ fontSize: "11px", color: "#999" }}>
                  {p.category}{p.size ? ` · ${p.size}` : ""}
                </div>
              </div>
              <div style={{ fontWeight: "700", color: "#2d5a27", fontSize: "14px" }}>₪{p.price}</div>
            </div>
          ))}

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: "12px", padding: "12px", background: "#f0f7ee", borderRadius: "10px",
          }}>
            <div>
              <div style={{ fontWeight: "700", color: "#2d5a27", fontSize: "14px" }}>סה״כ ערכה</div>
              <div style={{ color: "#999", fontSize: "11px" }}>כולל אדמה וניקוז</div>
            </div>
            <div style={{ fontWeight: "800", color: "#2d5a27", fontSize: "20px" }}>₪{total}</div>
          </div>
        </div>

        {/* כפתור הזמנה */}
        {!ordered ? (
          <button onClick={() => setOrdered(true)} style={{
            width: "100%", padding: "17px", background: "#2d5a27", color: "#fff",
            border: "none", borderRadius: "14px", fontSize: "16px", fontWeight: "700",
            cursor: "pointer", boxShadow: "0 4px 16px rgba(45,90,39,0.35)", marginBottom: "10px",
          }}>
            הזמן ערכה · ₪{total}
          </button>
        ) : (
          <div style={{
            padding: "18px", background: "#f0f7ee", border: "2px solid #2d5a27",
            borderRadius: "14px", textAlign: "center", marginBottom: "10px",
          }}>
            <div style={{ fontSize: "26px", marginBottom: "6px" }}>🎉</div>
            <div style={{ color: "#2d5a27", fontWeight: "700", fontSize: "15px" }}>ההזמנה התקבלה!</div>
            <div style={{ color: "#666", fontSize: "12px", marginTop: "4px" }}>המשתלה תיצור קשר בקרוב</div>
          </div>
        )}

        <button onClick={onReset} style={{
          width: "100%", padding: "13px", background: "transparent",
          color: "#888", border: "1px solid #ddd", borderRadius: "12px",
          fontSize: "13px", cursor: "pointer", marginBottom: "12px",
        }}>
          ← נסה עם תמונה אחרת
        </button>

        {/* Debug Log (מכובה כברירת מחדל) */}
        {result.debug?.log && (
          <div style={{ marginBottom: "24px" }}>
            <button onClick={() => setShowDebug(!showDebug)} style={{
              width: "100%", padding: "8px", background: "transparent",
              color: "#bbb", border: "1px dashed #ddd", borderRadius: "8px",
              fontSize: "11px", cursor: "pointer",
            }}>
              {showDebug ? "▲ הסתר לוגים" : "▼ הצג לוגים (debug)"}
            </button>
            {showDebug && (
              <div style={{
                background: "#1a1a1a", borderRadius: "8px", padding: "12px",
                marginTop: "8px", maxHeight: "200px", overflowY: "auto",
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
  const [state, setState] = useState<AppState>("idle");
  const [step,  setStep]  = useState(0);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setState("loading");
    setStep(0);

    // כיווץ תמונה
    const base64Full = await new Promise<string>((resolve, reject) => {
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

    const interval = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 3500);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Full.split(",")[1], mimeType: file.type || "image/jpeg" }),
      });

      clearInterval(interval);

      const data: ApiResult & { error?: string } = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "שגיאת שרת");
      }

      setResult(data);
      setState("results");

    } catch (err: unknown) {
      clearInterval(interval);
      setErrorMsg(err instanceof Error ? err.message : "שגיאה לא ידועה");
      setState("error");
    }
  };

  if (state === "loading") return <LoadingScreen step={step} />;
  if (state === "results" && result) return <ResultsScreen result={result} onReset={() => { setState("idle"); setResult(null); }} />;

  // Idle / Error
  return (
    <div dir="rtl" style={{
      background: "linear-gradient(180deg, #1a3a18 0%, #2d5a27 40%, #f5f3ef 40%)",
      minHeight: "100vh", fontFamily: "sans-serif",
    }}>
      <div style={{ textAlign: "center", padding: "48px 24px 56px", color: "#fff" }}>
        <div style={{ fontSize: "36px", marginBottom: "10px" }}>🌿</div>
        <h1 style={{ margin: "0 0 8px", fontSize: "32px", fontWeight: "800", letterSpacing: "-1px" }}>bloom</h1>
        <p style={{ margin: 0, fontSize: "16px", opacity: 0.85 }}>גלה מה המרפסת שלך יכולה להיות</p>
      </div>

      <div style={{ padding: "0 16px 32px" }}>
        <div style={{ background: "#fff", borderRadius: "20px", padding: "28px 20px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>

          {state === "error" && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fca5a5",
              borderRadius: "10px", padding: "12px 16px", marginBottom: "18px",
              color: "#dc2626", fontSize: "13px",
            }}>❌ {errorMsg}</div>
          )}

          <div onClick={() => fileRef.current?.click()} style={{
            border: "2px dashed #c8e6c9", borderRadius: "14px", padding: "40px 20px",
            textAlign: "center", cursor: "pointer", background: "#f9fdf9", marginBottom: "20px",
          }}>
            <div style={{ fontSize: "44px", marginBottom: "12px" }}>📸</div>
            <p style={{ margin: "0 0 5px", fontWeight: "700", color: "#2d5a27", fontSize: "17px" }}>
              צלם את המרפסת שלך
            </p>
            <p style={{ margin: 0, color: "#999", fontSize: "13px" }}>או לחץ לבחור תמונה מהגלריה</p>
          </div>

          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

          <div style={{ display: "flex", justifyContent: "space-around" }}>
            {[["📸","מצלם"],["🤖","AI מנתח"],["🌿","גינה מוכנה"]].map(([icon,label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px" }}>{icon}</div>
                <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: "center", color: "#aaa", fontSize: "11px", marginTop: "18px" }}>
          Powered by bloom 🌿
        </p>
      </div>
    </div>
  );
}
