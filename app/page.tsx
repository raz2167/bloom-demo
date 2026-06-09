"use client";
// app/page.tsx

import { useState, useRef, useEffect } from "react";

type AppState = "idle" | "analyzing" | "confirm" | "details" | "waiting" | "blueprint" | "error";

interface Analysis {
  balcony_size?:  string;
  width_m?:       number;
  depth_m?:       number;
  sun_direction?: string;
  sun_exposure?:  string;
  railing?:       string;
  style?:         string;
  notes?:         string;
}

interface UserData {
  width_m:      number;
  depth_m:      number;
  direction:    string;
  sun_pct:      number;
  has_drain:    boolean | null;
  has_power:    boolean | null;
  garden_style: string;
}

interface PlacementZone { x: number; y: number; width: number; height: number; }
interface Placement {
  potLeft:   PlacementZone;
  planter1:  PlacementZone;
  planter2:  PlacementZone;
  potRight:  PlacementZone;
  imageWidth: number;
  imageHeight: number;
}

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

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div style={{ background: "#1A1714", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "#FAF7F2", fontSize: "15px", fontWeight: "300", letterSpacing: "3px" }}>HIBLOOM</span>
      <span style={{ color: "rgba(250,247,242,0.35)", fontSize: "11px" }}>{subtitle}</span>
    </div>
  );
}

function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "17px",
      background: disabled ? "#C4B8A8" : "#1A1714", color: "#FAF7F2",
      border: "none", borderRadius: "14px", fontSize: "15px", fontWeight: "600",
      fontFamily: "sans-serif", cursor: disabled ? "not-allowed" : "pointer", transition: "background 0.2s",
    }}>{label}</button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: "14px", padding: "16px", marginBottom: "12px", boxShadow: "0 1px 0 rgba(139,125,107,0.1), 0 4px 16px rgba(26,23,20,0.04)" }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: "0 0 14px", fontSize: "13px", fontWeight: "600", color: "#1A1714" }}>{children}</h3>;
}

function Slider({ label, value, min, max, step = 0.5, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "13px", color: "#5C4A35" }}>{label}</span>
        <span style={{ fontSize: "13px", fontWeight: "600", color: "#1A1714" }}>{value} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "#1A1714" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
        <span style={{ fontSize: "10px", color: "#C4B8A8" }}>{min} {unit}</span>
        <span style={{ fontSize: "10px", color: "#C4B8A8" }}>{max} {unit}</span>
      </div>
    </div>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void; }) {
  const btn = (val: boolean, txt: string) => (
    <button onClick={() => onChange(val)} style={{
      flex: 1, padding: "10px", border: "1.5px solid",
      borderColor: value === val ? "#1A1714" : "rgba(139,125,107,0.2)",
      background: value === val ? "#1A1714" : "transparent",
      color: value === val ? "#FAF7F2" : "#8B7D6B",
      borderRadius: "10px", fontSize: "13px", cursor: "pointer",
      fontFamily: "sans-serif", fontWeight: value === val ? "600" : "400",
    }}>{txt}</button>
  );
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ fontSize: "13px", color: "#5C4A35", marginBottom: "8px" }}>{label}</div>
      <div style={{ display: "flex", gap: "8px" }}>{btn(true, "כן")}{btn(false, "לא")}</div>
    </div>
  );
}

function LoadingScreen({ step }: { step: number }) {
  const steps = [
    { label: "מנתח את המרפסת...", time: "~10 שנ׳" },
    { label: "מכין ניתוח...",     time: "~3 שנ׳"  },
  ];
  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "radial-gradient(ellipse at 50% 40%, #2A3828 0%, #111 70%)", padding: "40px 24px", fontFamily: "sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`}</style>
      <div style={{ position: "relative", width: "90px", height: "90px", marginBottom: "36px" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ position: "absolute", inset: `${i*11}px`, borderRadius: "50%", border: "2px solid transparent", borderTopColor: `rgba(122,168,112,${0.9-i*0.25})`, animation: `spin ${1.2+i*0.6}s linear infinite ${i%2?"reverse":""}` }} />
        ))}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", animation: "breathe 2.5s ease-in-out infinite" }}>🌿</div>
      </div>
      <h2 style={{ color: "#FAF8F5", fontSize: "18px", marginBottom: "36px", fontWeight: "200", textAlign: "center" }}>מנתח את המרפסת שלך</h2>
      <div style={{ width: "100%", maxWidth: "290px" }}>
        {steps.map((s, i) => {
          const isDone = i < step, isActive = i === step;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", opacity: i > step ? 0.25 : 1, transition: "opacity 0.5s" }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isDone?"12px":"14px", background: isDone?"#7AA870":"transparent", border: isDone?"none":`1.5px solid ${isActive?"rgba(122,168,112,0.5)":"rgba(255,255,255,0.1)"}`, color: isDone?"#1a3a18":"white", animation: isActive?"spin 1.5s linear infinite":"none", fontWeight: "700" }}>
                {isDone?"✓":isActive?"↻":"○"}
              </div>
              <span style={{ color: isDone?"#7AA870":isActive?"#d0f0c8":"#5a7258", fontSize: "13px", flex: 1 }}>{s.label}</span>
              {isActive && <span style={{ fontSize: "10px", color: "#7AA870" }}>{s.time}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const GARDEN_TIPS = [
  { emoji: "🌿", text: "צמחים ירוקים מפחיתים מתח ומשפרים מצב רוח — מחקרים מראים ירידה של 37% ברמות קורטיזול" },
  { emoji: "☀️", text: "מרפסת דרומית מקבלת שמש כל היום — מושלמת לעגבניות, תותים, ועשבי תיבול" },
  { emoji: "💧", text: "השקיה בשעות הבוקר המוקדמות מפחיתה אידוי ב-40% לעומת השקיה בצהריים" },
  { emoji: "🪴", text: "אדנית של 60 ס״מ יכולה להכיל עד 3 צמחים בינוניים — המפתח הוא ניקוז טוב בתחתית" },
  { emoji: "🌸", text: "לבנדר, רוזמרין ומנטה עובדים מצוין על מרפסות ישראליות — עמידים לחום ומריחים נפלא" },
  { emoji: "🌱", text: "צמחים טרופיים כמו מוּסָה ופילודנדרון מתאימים לצל חלקי ויוצרים תחושת ג׳ונגל עירוני" },
  { emoji: "🏙️", text: "גינת מרפסת מוסיפה בממוצע 8% לערך הנכס — ומשפרת משמעותית את איכות החיים" },
  { emoji: "🦋", text: "פרחי בר מקומיים מושכים פרפרים ודבורים — ומחייאים את המרפסת בצבע ותנועה" },
  { emoji: "🌡️", text: "צמחייה על מרפסת מורידה את טמפרטורת האוויר הסמוך ב-3-5 מעלות בקיץ הישראלי" },
  { emoji: "🫙", text: "שתילה בשכבות — צמחים גבוהים מאחור, נמוכים מלפנים — יוצרת עומק ויזואלי מרשים" },
  { emoji: "🌾", text: "עשבי תיבול כמו בזיליקום ופטרוזיליה גדלים מצוין בעציצים קטנים ומוסיפים ריח נפלא למרפסת" },
  { emoji: "🪷", text: "גרניום הוא אחד הצמחים הכי קלים לגידול בישראל — פורח כמעט כל השנה ועמיד לחום" },
  { emoji: "💨", text: "מסך ירוק — טפסנים כמו פסיפלורה ויסמין — מספק הצללה טבעית ומפחית חדירת רוח" },
  { emoji: "🌙", text: "יסמין לילי ומורינדה פורחים בלילה ומפיצים ניחוח — מהפכה בחוויית המרפסת בשעות הערב" },
  { emoji: "🐝", text: "גידול צמחים עם פרחים פתוחים תומך במערכת האיזון האקולוגית הסביבתית של השכונה" },
  { emoji: "♻️", text: "קומפוסט ביתי מגרוטאות מטבח מספק דשן אורגני מושלם לאדניות מרפסת — חינמי ואפקטיבי" },
];

function WaitingScreen() {
  const [tipIndex, setTipIndex] = useState(0);
  const [visible,  setVisible]  = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setTipIndex(i => (i+1) % GARDEN_TIPS.length); setVisible(true); }, 400);
    }, 6000);
    return () => clearInterval(interval);
  }, []);
  const tip = GARDEN_TIPS[tipIndex];
  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "radial-gradient(ellipse at 50% 40%, #2A3828 0%, #111 70%)", padding: "40px 24px", fontFamily: "sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ position: "relative", width: "90px", height: "90px", marginBottom: "28px" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ position: "absolute", inset: `${i*11}px`, borderRadius: "50%", border: "2px solid transparent", borderTopColor: `rgba(122,168,112,${0.9-i*0.25})`, animation: `spin ${1.2+i*0.6}s linear infinite ${i%2?"reverse":""}` }} />
        ))}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", animation: "breathe 2.5s ease-in-out infinite" }}>✦</div>
      </div>
      <h2 style={{ color: "#FAF8F5", fontSize: "18px", marginBottom: "4px", fontWeight: "200", textAlign: "center" }}>המרפסת שלך בתכנון</h2>
      <p style={{ color: "rgba(250,248,245,0.3)", fontSize: "12px", marginBottom: "36px", textAlign: "center" }}>עוד רגע קט והכל יהיה מוכן</p>
      <div style={{ width: "100%", maxWidth: "320px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(122,168,112,0.2)", borderRadius: "16px", padding: "20px", opacity: visible ? 1 : 0, transition: "opacity 0.3s", minHeight: "100px" }}>
        <div style={{ fontSize: "28px", marginBottom: "10px", textAlign: "center" }}>{tip.emoji}</div>
        <p style={{ margin: 0, color: "rgba(250,248,245,0.8)", fontSize: "14px", lineHeight: "1.7", textAlign: "center", fontWeight: "300" }}>{tip.text}</p>
      </div>
      <div style={{ display: "flex", gap: "6px", marginTop: "20px" }}>
        {GARDEN_TIPS.map((_, i) => (
          <div key={i} style={{ width: i===tipIndex?"16px":"6px", height: "6px", borderRadius: "3px", transition: "all 0.3s", background: i===tipIndex?"#7AA870":"rgba(122,168,112,0.25)" }} />
        ))}
      </div>
    </div>
  );
}

function ConfirmScreen({ photoDataUrl, analysis, userData, setUserData, onNext }: {
  photoDataUrl: string; analysis: Analysis; userData: UserData; setUserData: (u: UserData) => void; onNext: () => void;
}) {
  const SUN: Record<string,string> = { "שמש מלאה":"☀️","חצי צל":"⛅","צל":"🌑" };
  const tags = [
    analysis.sun_exposure ? `${SUN[analysis.sun_exposure]??""} ${analysis.sun_exposure}` : null,
    analysis.style        ? `🎨 ${analysis.style}` : null,
    analysis.railing      ? `🪟 מעקה ${analysis.railing}` : null,
  ].filter(Boolean) as string[];
  return (
    <div dir="rtl" style={{ background: "#FAF7F2", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <Header subtitle="ניתוח מרפסת" />
      <div style={{ padding: "16px" }}>
        <div style={{ marginBottom: "14px", borderRadius: "16px", overflow: "hidden", boxShadow: "0 6px 24px rgba(0,0,0,0.12)" }}>
          <img src={photoDataUrl} alt="המרפסת שלך" style={{ width: "100%", display: "block" }} />
        </div>
        {tags.length > 0 && (
          <Card>
            <SectionTitle>מה ראיתי</SectionTitle>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: analysis.notes?"12px":0 }}>
              {tags.map((tag,i) => <span key={i} style={{ background: "#F5F0E8", color: "#5C4A35", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "500" }}>{tag}</span>)}
            </div>
            {analysis.notes && <p style={{ margin: 0, color: "#8B7D6B", fontSize: "13px", lineHeight: "1.7" }}>{analysis.notes}</p>}
          </Card>
        )}
        <Card>
          <SectionTitle>מידות המרפסת — תקן אם צריך</SectionTitle>
          <Slider label="רוחב" value={userData.width_m} min={1} max={12} step={0.5} unit="מ׳" onChange={v => setUserData({...userData, width_m: v})} />
          <Slider label="עומק" value={userData.depth_m} min={0.5} max={6} step={0.5} unit="מ׳" onChange={v => setUserData({...userData, depth_m: v})} />
          <div style={{ background: "#F5F0E8", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", color: "#8B7D6B", textAlign: "center" }}>
            שטח משוער: <strong style={{ color: "#1A1714" }}>{(userData.width_m * userData.depth_m).toFixed(1)} מ״ר</strong>
          </div>
        </Card>
        <PrimaryButton label="המשך ←" onClick={onNext} />
      </div>
    </div>
  );
}

function DetailsScreen({ userData, setUserData, onNext }: {
  userData: UserData; setUserData: (u: UserData) => void; onNext: () => void;
}) {
  const DIRECTIONS = ["צפון","דרום","מזרח","מערב"];
  const STYLES = [
    { id: "modern",        emoji: "◻️", label: "מודרני",       desc: "נקי, גיאומטרי, מינימליסטי" },
    { id: "mediterranean", emoji: "🫙", label: "ים-תיכוני",    desc: "חם, צבעוני, ריחני" },
    { id: "jungle",        emoji: "🌿", label: "טבעי-ג׳ונגל", desc: "פראי, ירוק, טרופי" },
  ];
  const canContinue = userData.direction !== "" && userData.has_drain !== null && userData.has_power !== null && userData.garden_style !== "";
  return (
    <div dir="rtl" style={{ background: "#FAF7F2", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <Header subtitle="פרטי הגינה" />
      <div style={{ padding: "16px" }}>
        <Card>
          <SectionTitle>לאיזה כיוון פונה המרפסת?</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {DIRECTIONS.map(d => (
              <button key={d} onClick={() => setUserData({...userData, direction: d})} style={{ padding: "12px", border: "1.5px solid", borderColor: userData.direction===d?"#1A1714":"rgba(139,125,107,0.2)", background: userData.direction===d?"#1A1714":"transparent", color: userData.direction===d?"#FAF7F2":"#8B7D6B", borderRadius: "10px", fontSize: "14px", cursor: "pointer", fontFamily: "sans-serif", fontWeight: userData.direction===d?"600":"400" }}>{d}</button>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle>כמה שמש מקבלת המרפסת?</SectionTitle>
          <Slider label="אחוז שמש ביום רגיל" value={userData.sun_pct} min={20} max={100} step={10} unit="%" onChange={v => setUserData({...userData, sun_pct: v})} />
          <div style={{ background: "#F5F0E8", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", color: "#8B7D6B", textAlign: "center" }}>
            {userData.sun_pct<=30?"🌑 בעיקר צל — מתאים לצמחי צל":userData.sun_pct<=60?"⛅ חצי צל — מגוון רחב של צמחים":"☀️ שמש מלאה — צמחי שמש ועמידי חום"}
          </div>
        </Card>
        <Card>
          <YesNo label="האם יש ניקוז במרפסת?" value={userData.has_drain} onChange={v => setUserData({...userData, has_drain: v})} />
          <YesNo label="האם יש נקודת חשמל?" value={userData.has_power} onChange={v => setUserData({...userData, has_power: v})} />
        </Card>
        <Card>
          <SectionTitle>איזה סגנון גינה אתה מחפש?</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {STYLES.map(s => (
              <button key={s.id} onClick={() => setUserData({...userData, garden_style: s.id})} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px", border: "1.5px solid", textAlign: "right", borderColor: userData.garden_style===s.id?"#1A1714":"rgba(139,125,107,0.2)", background: userData.garden_style===s.id?"#1A1714":"transparent", borderRadius: "12px", cursor: "pointer", fontFamily: "sans-serif" }}>
                <span style={{ fontSize: "22px" }}>{s.emoji}</span>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: userData.garden_style===s.id?"#FAF7F2":"#1A1714" }}>{s.label}</div>
                  <div style={{ fontSize: "11px", marginTop: "2px", color: userData.garden_style===s.id?"rgba(250,247,242,0.55)":"#8B7D6B" }}>{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>
        <PrimaryButton label="המשך ←" onClick={onNext} disabled={!canContinue} />
        {!canContinue && <p style={{ textAlign: "center", fontSize: "11px", color: "#C4B8A8", marginTop: "8px" }}>יש למלא את כל השדות להמשך</p>}
      </div>
    </div>
  );
}

function IdleScreen({ onFile, errorMsg, fileRef }: {
  onFile: (f: File) => void; errorMsg: string; fileRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div dir="rtl" style={{ background: "linear-gradient(180deg, #1A1714 0%, #2C2420 40%, #FAF7F2 40%)", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center", padding: "52px 24px 60px", color: "#FAF7F2" }}>
        <div style={{ fontSize: "10px", letterSpacing: "4px", opacity: 0.35, marginBottom: "14px" }}>H I B L O O M</div>
        <h1 style={{ margin: "0 0 10px", fontSize: "34px", fontWeight: "200", letterSpacing: "-1px", lineHeight: 1.1 }}>הגינה שתמיד<br />דמיינת</h1>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.4, fontWeight: "300" }}>צלם את המרפסת שלך</p>
      </div>
      <div style={{ padding: "0 16px 32px" }}>
        <div style={{ background: "#fff", borderRadius: "20px", padding: "28px 20px", boxShadow: "0 8px 32px rgba(26,23,20,0.12)" }}>
          {errorMsg && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "18px", color: "#DC2626", fontSize: "13px" }}>❌ {errorMsg}</div>}
          <div onClick={() => fileRef.current?.click()} style={{ border: "1.5px dashed rgba(139,125,107,0.3)", borderRadius: "14px", padding: "44px 20px", textAlign: "center", cursor: "pointer", background: "#FAF7F2", marginBottom: "24px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📸</div>
            <p style={{ margin: "0 0 5px", fontWeight: "600", color: "#1A1714", fontSize: "16px" }}>צלם את המרפסת שלך</p>
            <p style={{ margin: 0, color: "#8B7D6B", fontSize: "13px" }}>או לחץ לבחור תמונה מהגלריה</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            {[["📸","מצלם"],["✦","מנתח"],["🌿","גינה שלך"]].map(([icon,label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "18px", color: "#8B7D6B" }}>{icon}</div>
                <div style={{ fontSize: "10px", color: "#C4B8A8", marginTop: "4px", letterSpacing: "0.5px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <p style={{ textAlign: "center", color: "rgba(139,125,107,0.3)", fontSize: "10px", marginTop: "18px", letterSpacing: "2px" }}>HIBLOOM · BALCONY DESIGN</p>
      </div>
    </div>
  );
}

// ── Blueprint screen עם CSS overlay ──────────────────
function BlueprintScreen({ blueprintUrl, photoDataUrl, confirmedWidth, confirmedDepth, onReset }: {
  blueprintUrl: string; photoDataUrl: string; confirmedWidth: number; confirmedDepth: number; onReset: () => void;
}) {
  const [placement,       setPlacement]       = useState<Placement | null>(null);
  const [combo1Url,       setCombo1Url]       = useState<string>("");
  const [combo2Url,       setCombo2Url]       = useState<string>("");
  const [potUrl,          setPotUrl]          = useState<string>("");
  const [placingPlanters, setPlacingPlanters] = useState(false);
  const [placeError,      setPlaceError]      = useState("");

  const handlePlacePlanters = async () => {
    setPlacingPlanters(true);
    setPlaceError("");
    try {
      const res  = await fetch("/api/place-planters", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ blueprintUrl }),
      });
      const data = await res.json();
      if (data.placement) {
        setPlacement(data.placement);
        setCombo1Url(data.combo1Url);
        setCombo2Url(data.combo2Url);
        setPotUrl(data.potUrl ?? "");
      } else {
        setPlaceError(data.error || "שגיאה בחישוב המיקום");
      }
    } catch {
      setPlaceError("שגיאת רשת");
    } finally {
      setPlacingPlanters(false);
    }
  };

  // חישוב אחוזים לפי מידות התמונה המקורית
  const toPercent = (zone: PlacementZone, imgW: number, imgH: number) => ({
    left:   `${(zone.x / imgW) * 100}%`,
    top:    `${(zone.y / imgH) * 100}%`,
    width:  `${(zone.width  / imgW) * 100}%`,
    height: `${(zone.height / imgH) * 100}%`,
  });

  return (
    <div dir="rtl" style={{ background: "#FAF7F2", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <Header subtitle="שרטוט המרפסת" />
      <div style={{ padding: "16px" }}>

        {/* תמונה מקורית */}
        <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#8B7D6B", fontWeight: "600" }}>המרפסת שלך</p>
        <div style={{ marginBottom: "16px", borderRadius: "16px", overflow: "hidden", boxShadow: "0 6px 24px rgba(0,0,0,0.12)" }}>
          <img src={photoDataUrl} alt="המרפסת המקורית" style={{ width: "100%", display: "block" }} />
        </div>

        {/* בלופרינט עם overlay אדניות */}
        <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#8B7D6B", fontWeight: "600" }}>
          {placement ? "הצעת מיקום האדניות" : "השרטוט האדריכלי"}
        </p>
        <div style={{ marginBottom: "14px", borderRadius: "16px", overflow: "visible", boxShadow: "0 6px 24px rgba(0,0,0,0.12)", position: "relative" }}>
          <img src={blueprintUrl} alt="שרטוט המרפסת" style={{ width: "100%", display: "block" }} />
          {placement && (
            <>
              <img src={potUrl}    alt="כד שמאל"  style={{ position: "absolute", objectFit: "contain", ...toPercent(placement.potLeft,  placement.imageWidth, placement.imageHeight) }} />
              <img src={combo1Url} alt="אדנית 1"  style={{ position: "absolute", objectFit: "contain", ...toPercent(placement.planter1, placement.imageWidth, placement.imageHeight) }} />
              <img src={combo2Url} alt="אדנית 2"  style={{ position: "absolute", objectFit: "contain", ...toPercent(placement.planter2, placement.imageWidth, placement.imageHeight) }} />
              <img src={potUrl}    alt="כד ימין"  style={{ position: "absolute", objectFit: "contain", ...toPercent(placement.potRight, placement.imageWidth, placement.imageHeight) }} />
            </>
          )}
        </div>

        {placeError && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "12px", color: "#DC2626", fontSize: "13px" }}>
            ❌ {placeError}
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: "14px", padding: "16px", marginBottom: "12px", boxShadow: "0 1px 0 rgba(139,125,107,0.1), 0 4px 16px rgba(26,23,20,0.04)" }}>
          <p style={{ margin: 0, color: "#8B7D6B", fontSize: "13px", lineHeight: "1.7", textAlign: "center" }}>
            {placement
              ? "✦ האדניות מוקמו — מוכן לשלב הבא"
              : "✦ השרטוט מוכן — עכשיו נתכנן את הגינה שלך"}
          </p>
        </div>

        <PrimaryButton
          label={placingPlanters ? "מחשב מיקום..." : placement ? "המשך לשלב הבא ←" : "בנה לי גינה ←"}
          disabled={placingPlanters}
          onClick={placement ? () => alert("השלב הבא: compose 🌿") : handlePlacePlanters}
        />
        <div style={{ height: "12px" }} />
        <button onClick={onReset} style={{ width: "100%", padding: "14px", background: "transparent", color: "#8B7D6B", border: "1px solid rgba(139,125,107,0.25)", borderRadius: "12px", fontSize: "13px", cursor: "pointer", fontFamily: "sans-serif" }}>← התחל מחדש</button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────
export default function Home() {
  const [state,        setState]        = useState<AppState>("idle");
  const [step,         setStep]         = useState(0);
  const [analysis,     setAnalysis]     = useState<Analysis | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [errorMsg,     setErrorMsg]     = useState("");
  const [userData,     setUserData]     = useState<UserData>({
    width_m: 4, depth_m: 2.5, direction: "", sun_pct: 50,
    has_drain: null, has_power: null, garden_style: "",
  });
  const [blueprintUrl, setBlueprintUrl] = useState<string | null>(null);

  const blueprintPromiseRef = useRef<Promise<string | null> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null!);

  const handleFile = async (file: File) => {
    setState("analyzing");
    setStep(0);
    setErrorMsg("");
    try {
      const dataUrl = await compressImage(file);
      setPhotoDataUrl(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const mime   = file.type || "image/jpeg";

      blueprintPromiseRef.current = fetch("/api/blueprint", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
      }).then(r => r.json()).then(d => (d.blueprintUrl as string) || null).catch(() => null);

      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: mime, nursery: "Bloom_Demo" }),
      });
      if (!res.body) throw new Error("אין תגובה מהשרת");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
          let event: Record<string,unknown>;
          try { event = JSON.parse(jsonStr); } catch { continue; }
          if (event.type === "step") {
            setStep(event.step as number);
            if (event.analysis) {
              const a = event.analysis as Analysis;
              setAnalysis(a);
              setUserData(prev => ({ ...prev, width_m: a.width_m ?? prev.width_m, depth_m: a.depth_m ?? prev.depth_m }));
            }
          } else if (event.type === "done") {
            const a = (event.analysis as Analysis) || null;
            setAnalysis(a);
            if (a?.width_m) setUserData(prev => ({ ...prev, width_m: a.width_m!, depth_m: a.depth_m ?? prev.depth_m }));
            setState("confirm");
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

  const handleDetailsComplete = async () => {
    const url = await Promise.race([
      blueprintPromiseRef.current ?? Promise.resolve(null),
      new Promise<null>(r => setTimeout(() => r(null), 100)),
    ]);
    if (url) {
      setBlueprintUrl(url);
      setState("blueprint");
    } else {
      setState("waiting");
      const arrived = await blueprintPromiseRef.current;
      if (arrived) { setBlueprintUrl(arrived); setState("blueprint"); }
      else { setErrorMsg("לא הצלחנו ליצור את השרטוט, נסה שוב"); setState("error"); }
    }
  };

  const handleReset = () => {
    setState("idle"); setAnalysis(null); setPhotoDataUrl(null);
    setErrorMsg(""); setBlueprintUrl(null); blueprintPromiseRef.current = null;
    setUserData({ width_m: 4, depth_m: 2.5, direction: "", sun_pct: 50, has_drain: null, has_power: null, garden_style: "" });
    if (fileRef.current) fileRef.current.value = "";
  };

  if (state === "analyzing") return <LoadingScreen step={step} />;
  if (state === "waiting")   return <WaitingScreen />;

  if (state === "blueprint" && blueprintUrl && photoDataUrl) {
    return <BlueprintScreen blueprintUrl={blueprintUrl} photoDataUrl={photoDataUrl} confirmedWidth={userData.width_m} confirmedDepth={userData.depth_m} onReset={handleReset} />;
  }

  if (state === "confirm" && analysis && photoDataUrl) {
    return <ConfirmScreen photoDataUrl={photoDataUrl} analysis={analysis} userData={userData} setUserData={setUserData} onNext={() => setState("details")} />;
  }

  if (state === "details") {
    return <DetailsScreen userData={userData} setUserData={setUserData} onNext={handleDetailsComplete} />;
  }

  return <IdleScreen onFile={handleFile} errorMsg={state === "error" ? errorMsg : ""} fileRef={fileRef} />;
}
