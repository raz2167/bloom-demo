"use client";
import { useState, useRef } from "react";
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

interface AnalysisResult {
  analysis: Analysis;
  recommendations: Product[];
  imageUrl: string | null;
}

const STEPS = [
  "מנתח את התמונה...",
  "מזהה תנאים ועיצוב...",
  "מעצב את הגינה...",
  "בוחר צמחים מתאימים...",
];

// ── ויזואליזציית מרפסת ─────────────────────────────────
function BalconyVisualization({
  recommendations,
  analysis,
}: {
  recommendations: Product[];
  analysis: Analysis;
}) {
  const plants = recommendations.filter((p) => p.category === "צמחייה");
  const pots = recommendations.filter((p) => p.category === "אדניות");
  const soil = recommendations.filter((p) => p.category === "אדמה");

  const total = recommendations.reduce((s, p) => s + p.price, 0);

  const skyGradient =
    {
      "שמש מלאה": "linear-gradient(180deg, #0d7bb5 0%, #56b4e0 55%, #b8dce8 100%)",
      "חצי צל": "linear-gradient(180deg, #4a6980 0%, #7a9aaa 55%, #b0c8d8 100%)",
      צל: "linear-gradient(180deg, #3a4a58 0%, #5a6a7a 55%, #8a9aaa 100%)",
    }[analysis?.sun_exposure] ??
    "linear-gradient(180deg, #0d7bb5 0%, #56b4e0 100%)";

  const sunIcon =
    { "שמש מלאה": "☀️", "חצי צל": "⛅", צל: "🌤️" }[analysis?.sun_exposure] ??
    "☀️";

  // חלוקת מוצרים לפי מיקום
  const hangingPlants = plants.slice(0, 3);
  const railingPots = pots.slice(0, 2);
  const floorPlants = plants.slice(3);
  const floorPots = pots.slice(2, 4);

  return (
    <div
      style={{
        borderRadius: "20px",
        overflow: "hidden",
        marginBottom: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        direction: "rtl",
      }}
    >
      {/* שמיים */}
      <div
        style={{
          background: skyGradient,
          padding: "14px 20px 20px",
          minHeight: "70px",
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "#fff",
            fontWeight: "600",
            background: "rgba(0,0,0,0.22)",
            padding: "4px 10px",
            borderRadius: "20px",
          }}
        >
          {sunIcon} {analysis?.sun_exposure}
        </span>
        <span style={{ fontSize: "28px" }}>{sunIcon}</span>
      </div>

      {/* קיר + צמחים תלויים */}
      <div
        style={{
          background: "linear-gradient(180deg, #ede0cc 0%, #e0d0b8 100%)",
          padding: "0 20px",
          minHeight: "80px",
          display: "flex",
          justifyContent:
            hangingPlants.length > 0 ? "space-around" : "center",
          alignItems: "flex-end",
          gap: "8px",
        }}
      >
        {hangingPlants.length > 0 ? (
          hangingPlants.map((plant) => (
            <div key={plant.id} style={{ textAlign: "center", flexShrink: 0 }}>
              {/* חוט */}
              <div
                style={{
                  width: "2px",
                  height: "28px",
                  background: "#8B6914",
                  margin: "0 auto",
                }}
              />
              {/* עציץ תלוי */}
              <div
                style={{
                  background: plant.bg + "55",
                  border: `2px solid ${plant.bg}99`,
                  borderRadius: "0 0 50% 50%",
                  width: "44px",
                  height: "38px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  margin: "0 auto",
                }}
              >
                {plant.emoji}
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#555",
                  marginTop: "3px",
                  fontWeight: "600",
                  maxWidth: "56px",
                  lineHeight: "1.2",
                  margin: "3px auto 6px",
                }}
              >
                {plant.name.split(" ")[0]}
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: "#bbb", fontSize: "13px", padding: "20px" }}>
            🌿
          </div>
        )}
      </div>

      {/* מעקה */}
      <div
        style={{
          background: "#a08870",
          height: "10px",
          position: "relative",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        {/* עמודי מעקה */}
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: "3px",
              height: "36px",
              background: "#7a6050",
              position: "absolute",
              bottom: 0,
              left: `${i * 5.8}%`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>

      {/* רצועת אדניות מעל הרצפה */}
      <div
        style={{
          background: "linear-gradient(180deg, #c8b89a 0%, #b8a888 100%)",
          padding: "14px 20px 18px",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "flex-end",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {/* אדניות על הרצפה */}
        {railingPots.map((pot) => (
          <div key={pot.id} style={{ textAlign: "center" }}>
            <div
              style={{
                background: pot.bg + "44",
                border: `2px solid ${pot.bg}88`,
                borderRadius: "6px 6px 10px 10px",
                width: "52px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
                margin: "0 auto",
              }}
            >
              {pot.emoji}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "#444",
                marginTop: "4px",
                fontWeight: "600",
                maxWidth: "60px",
                lineHeight: "1.2",
              }}
            >
              {pot.name.split(" ").slice(0, 3).join(" ")}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#2d5a27",
                fontWeight: "800",
                marginTop: "2px",
              }}
            >
              ₪{pot.price}
            </div>
          </div>
        ))}

        {/* צמחים ברצפה */}
        {floorPlants.slice(0, 2).map((plant) => (
          <div key={plant.id} style={{ textAlign: "center" }}>
            <div
              style={{
                background: plant.bg + "44",
                border: `2px solid ${plant.bg}99`,
                borderRadius: "50%",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
                margin: "0 auto",
              }}
            >
              {plant.emoji}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "#444",
                marginTop: "4px",
                fontWeight: "600",
              }}
            >
              {plant.name.split(" ")[0]}
            </div>
            <div
              style={{ fontSize: "12px", color: "#2d5a27", fontWeight: "800" }}
            >
              ₪{plant.price}
            </div>
          </div>
        ))}

        {/* שק אדמה */}
        {soil.length > 0 && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                background: "#6d4c41",
                borderRadius: "6px",
                width: "44px",
                height: "52px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                margin: "0 auto",
              }}
            >
              {soil[0].emoji}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "#444",
                marginTop: "4px",
                fontWeight: "600",
                maxWidth: "56px",
              }}
            >
              {soil[0].name.split(" ").slice(0, 2).join(" ")}
            </div>
            <div
              style={{ fontSize: "12px", color: "#2d5a27", fontWeight: "800" }}
            >
              ₪{soil[0].price}
            </div>
          </div>
        )}
      </div>

      {/* פוטר */}
      <div
        style={{
          background: "#2d5a27",
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: "#a8d5a2", fontSize: "13px" }}>
          🌿 הגינה שלך — {recommendations.length} פריטים
        </span>
        <span style={{ color: "#fff", fontWeight: "800", fontSize: "16px" }}>
          ₪{total}
        </span>
      </div>
    </div>
  );
}

// ── עמוד טעינה ──────────────────────────────────────────
function LoadingScreen({ step }: { step: number }) {
  return (
    <div
      dir="rtl"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f5f3ef",
        padding: "32px 24px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: "40px", marginBottom: "12px" }}>🌿</div>
      <h2
        style={{
          color: "#2d5a27",
          fontSize: "20px",
          marginBottom: "40px",
          fontWeight: "700",
        }}
      >
        bloom עובד בשבילך...
      </h2>
      {STEPS.map((s, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "20px",
            width: "100%",
            maxWidth: "320px",
            opacity: i <= step ? 1 : 0.3,
            transition: "opacity 0.6s ease",
          }}
        >
          <span style={{ fontSize: "22px" }}>
            {i < step ? "✅" : i === step ? "⏳" : "⭕"}
          </span>
          <span style={{ color: "#333", fontSize: "16px" }}>{s}</span>
        </div>
      ))}
      <p style={{ marginTop: "32px", color: "#aaa", fontSize: "13px" }}>
        זה לוקח כ-15 שניות...
      </p>
    </div>
  );
}

// ── עמוד תוצאות ─────────────────────────────────────────
function ResultsScreen({
  result,
  onReset,
}: {
  result: AnalysisResult;
  onReset: () => void;
}) {
  const [ordered, setOrdered] = useState(false);
  const total = result.recommendations.reduce((sum, p) => sum + p.price, 0);

  const SUN_LABEL: Record<string, string> = {
    "שמש מלאה": "☀️ שמש מלאה",
    "חצי צל": "⛅ חצי צל",
    צל: "🌑 צל",
  };

  return (
    <div
      dir="rtl"
      style={{ background: "#f5f3ef", minHeight: "100vh", fontFamily: "sans-serif" }}
    >
      {/* Header */}
      <div
        style={{
          background: "#2d5a27",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: "#fff", fontSize: "20px", fontWeight: "800" }}>
          🌿 bloom
        </span>
        <span style={{ color: "#a8d5a2", fontSize: "13px" }}>
          הגינה שלך מוכנה!
        </span>
      </div>

      <div style={{ padding: "16px" }}>

        {/* ויזואליזציית מרפסת */}
        <BalconyVisualization
          recommendations={result.recommendations}
          analysis={result.analysis}
        />

        {/* ניתוח */}
        <div
          style={{
            background: "#fff",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "14px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px",
              color: "#2d5a27",
              fontSize: "15px",
              fontWeight: "700",
            }}
          >
            ניתוח המרפסת שלך
          </h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              SUN_LABEL[result.analysis.sun_exposure],
              `📐 מרפסת ${result.analysis.balcony_size}`,
              `🎨 ${result.analysis.style}`,
            ]
              .filter(Boolean)
              .map((tag, i) => (
                <span
                  key={i}
                  style={{
                    background: "#f0f7ee",
                    color: "#2d5a27",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  {tag}
                </span>
              ))}
          </div>
          {result.analysis.notes && (
            <p
              style={{
                margin: "12px 0 0",
                color: "#666",
                fontSize: "13px",
                lineHeight: "1.5",
              }}
            >
              💡 {result.analysis.notes}
            </p>
          )}
        </div>

        {/* רשימת מוצרים */}
        <div
          style={{
            background: "#fff",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "14px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h3
            style={{
              margin: "0 0 4px",
              color: "#2d5a27",
              fontSize: "15px",
              fontWeight: "700",
            }}
          >
            🛒 הערכה שלך
          </h3>
          <p style={{ margin: "0 0 14px", color: "#999", fontSize: "12px" }}>
            {result.recommendations.length} פריטים שנבחרו במיוחד למרפסת שלך
          </p>

          {result.recommendations.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 0",
                borderBottom: "1px solid #f5f5f5",
              }}
            >
              <span
                style={{
                  fontSize: "26px",
                  background: p.bg + "22",
                  borderRadius: "10px",
                  width: "46px",
                  height: "46px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {p.emoji}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontWeight: "600", fontSize: "14px", color: "#222" }}
                >
                  {p.name}
                </div>
                <div style={{ fontSize: "12px", color: "#999" }}>
                  {p.category}
                  {p.size ? ` · ${p.size}` : ""}
                </div>
              </div>
              <div
                style={{
                  fontWeight: "700",
                  color: "#2d5a27",
                  fontSize: "15px",
                  flexShrink: 0,
                }}
              >
                ₪{p.price}
              </div>
            </div>
          ))}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "14px",
              padding: "14px",
              background: "#f0f7ee",
              borderRadius: "10px",
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: "700",
                  color: "#2d5a27",
                  fontSize: "15px",
                }}
              >
                סה״כ ערכה
              </div>
              <div style={{ color: "#999", fontSize: "12px" }}>
                כולל אדמה וניקוז
              </div>
            </div>
            <div
              style={{ fontWeight: "800", color: "#2d5a27", fontSize: "22px" }}
            >
              ₪{total}
            </div>
          </div>
        </div>

        {/* כפתור הזמנה */}
        {!ordered ? (
          <button
            onClick={() => setOrdered(true)}
            style={{
              width: "100%",
              padding: "18px",
              background: "#2d5a27",
              color: "#fff",
              border: "none",
              borderRadius: "14px",
              fontSize: "17px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(45,90,39,0.35)",
              marginBottom: "12px",
            }}
          >
            הזמן ערכה · ₪{total}
          </button>
        ) : (
          <div
            style={{
              padding: "20px",
              background: "#f0f7ee",
              border: "2px solid #2d5a27",
              borderRadius: "14px",
              textAlign: "center",
              marginBottom: "12px",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>🎉</div>
            <div
              style={{
                color: "#2d5a27",
                fontWeight: "700",
                fontSize: "16px",
              }}
            >
              ההזמנה התקבלה!
            </div>
            <div style={{ color: "#666", fontSize: "13px", marginTop: "4px" }}>
              המשתלה תיצור קשר בקרוב
            </div>
          </div>
        )}

        <button
          onClick={onReset}
          style={{
            width: "100%",
            padding: "14px",
            background: "transparent",
            color: "#888",
            border: "1px solid #ddd",
            borderRadius: "12px",
            fontSize: "14px",
            cursor: "pointer",
            marginBottom: "24px",
          }}
        >
          ← נסה עם תמונה אחרת
        </button>
      </div>
    </div>
  );
}

// ── עמוד ראשי ───────────────────────────────────────────
export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setState("loading");
    setStep(0);

    // כיווץ תמונה לפני שליחה
    const base64Full = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 800;
        let { width, height } = img;
        if (width > height && width > MAX) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else if (height > MAX) {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });

    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 3000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Full.split(",")[1],
          mimeType: file.type || "image/jpeg",
        }),
      });

      clearInterval(interval);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "שגיאת שרת");
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setResult(data);
      setState("results");
    } catch (err: unknown) {
      clearInterval(interval);
      const msg = err instanceof Error ? err.message : "שגיאה לא ידועה";
      setErrorMsg(msg);
      setState("error");
    }
  };

  const handleReset = () => {
    setState("idle");
    setResult(null);
    setErrorMsg("");
    setStep(0);
  };

  if (state === "loading") return <LoadingScreen step={step} />;
  if (state === "results" && result)
    return <ResultsScreen result={result} onReset={handleReset} />;

  return (
    <div
      dir="rtl"
      style={{
        background:
          "linear-gradient(180deg, #1a3a18 0%, #2d5a27 40%, #f5f3ef 40%)",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "48px 24px 56px",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: "36px", marginBottom: "10px" }}>🌿</div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "32px",
            fontWeight: "800",
            letterSpacing: "-1px",
          }}
        >
          bloom
        </h1>
        <p style={{ margin: 0, fontSize: "16px", opacity: 0.85 }}>
          גלה מה המרפסת שלך יכולה להיות
        </p>
      </div>

      <div style={{ padding: "0 16px 32px" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: "20px",
            padding: "32px 24px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
        >
          {state === "error" && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: "10px",
                padding: "12px 16px",
                marginBottom: "20px",
                color: "#dc2626",
                fontSize: "14px",
              }}
            >
              ❌ {errorMsg}
            </div>
          )}

          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: "2px dashed #c8e6c9",
              borderRadius: "14px",
              padding: "40px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: "#f9fdf9",
              marginBottom: "20px",
            }}
          >
            <div style={{ fontSize: "44px", marginBottom: "12px" }}>📸</div>
            <p
              style={{
                margin: "0 0 6px",
                fontWeight: "700",
                color: "#2d5a27",
                fontSize: "17px",
              }}
            >
              צלם את המרפסת שלך
            </p>
            <p style={{ margin: 0, color: "#999", fontSize: "14px" }}>
              או לחץ לבחור תמונה מהגלריה
            </p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) =>
              e.target.files?.[0] && handleFile(e.target.files[0])
            }
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              marginTop: "8px",
            }}
          >
            {[
              { icon: "📸", label: "מצלם" },
              { icon: "🤖", label: "AI מנתח" },
              { icon: "🌿", label: "גינה מוכנה" },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px" }}>{item.icon}</div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#999",
                    marginTop: "4px",
                  }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "#aaa",
            fontSize: "12px",
            marginTop: "20px",
          }}
        >
          Powered by bloom 🌿
        </p>
      </div>
    </div>
  );
}
