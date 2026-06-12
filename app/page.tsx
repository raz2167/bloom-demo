"use client";
// app/page.tsx
import { useState, useRef, useEffect } from "react";

type AppState = "idle"|"analyzing"|"confirm"|"details"|"waiting"|"planning"|"composing"|"result"|"order"|"error";

interface Analysis {
  width_m?: number; depth_m?: number;
  sun_exposure?: string; railing?: string; style?: string; notes?: string;
  floor_color?: string; wall_color?: string; railing_color?: string;
}
interface Analysis {
  width_m?: number; depth_m?: number; wall_height_m?: number;
  sun_exposure?: string; railing?: string; style?: string; notes?: string;
  floor_color?: string; wall_color?: string; railing_color?: string;
}
interface ProductItem { name: string; qty: number; unitPrice: number; total: number; }
interface Products { items: ProductItem[]; grandTotal: number; }
interface AppError { message: string; step?: string; route?: string; log?: string[]; }
interface Timings { analyzeMs: number; blueprintMs: number; planMs: number; composeMs: number; }

const NURSERY_FACTS = [
  "משתלת רז בהרצליה פעילה כבר מעל 20 שנה ומתמחה בצמחי מרפסת ים-תיכוניים",
  "הצוות של משתלת רז ליווה מאות פרויקטי גינון בבתים פרטיים באזור השרון",
  "משתלת רז מציעה מעל 300 זני צמחים המותאמים לאקלים הישראלי",
  "כל הצמחים במשתלת רז גדלו בתנאי חום ולחות ישראליים ומוכנים לשתילה ישירה",
  "משתלת רז מתמחה בצמחים עמידי בצורת שחוסכים עד 60 אחוז מים",
  "הצוות המקצועי של משתלת רז זמין לייעוץ אישי לכל לקוח"
];

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 800; let { width, height } = img;
      if (width > height && width > MAX) { height = Math.round(height*MAX/width); width = MAX; }
      else if (height > MAX) { width = Math.round(width*MAX/height); height = MAX; }
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
    <div style={{ background:"#1A1714", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ color:"#FAF7F2", fontSize:"15px", fontWeight:"300", letterSpacing:"3px" }}>משתלת רז</span>
      <span style={{ color:"rgba(250,247,242,0.35)", fontSize:"11px" }}>{subtitle}</span>
    </div>
  );
}
function PrimaryButton({ label, onClick, disabled }: { label:string; onClick:()=>void; disabled?:boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width:"100%", padding:"17px", background:disabled?"#C4B8A8":"#1A1714", color:"#FAF7F2", border:"none", borderRadius:"14px", fontSize:"15px", fontWeight:"600", fontFamily:"sans-serif", cursor:disabled?"not-allowed":"pointer" }}>
      {label}
    </button>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background:"#fff", borderRadius:"14px", padding:"16px", marginBottom:"12px", boxShadow:"0 1px 0 rgba(139,125,107,0.1),0 4px 16px rgba(26,23,20,0.04)" }}>{children}</div>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin:"0 0 14px", fontSize:"13px", fontWeight:"600", color:"#1A1714" }}>{children}</h3>;
}
function Slider({ label, value, min, max, step=0.5, unit, onChange }: { label:string; value:number; min:number; max:number; step?:number; unit:string; onChange:(v:number)=>void }) {
  return (
    <div style={{ marginBottom:"16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
        <span style={{ fontSize:"13px", color:"#5C4A35" }}>{label}</span>
        <span style={{ fontSize:"13px", fontWeight:"600", color:"#1A1714" }}>{value} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} style={{ width:"100%", accentColor:"#1A1714" }} />
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:"4px" }}>
        <span style={{ fontSize:"10px", color:"#C4B8A8" }}>{min} {unit}</span>
        <span style={{ fontSize:"10px", color:"#C4B8A8" }}>{max} {unit}</span>
      </div>
    </div>
  );
}
function YesNo({ label, value, onChange }: { label:string; value:boolean|null; onChange:(v:boolean)=>void }) {
  const btn = (val:boolean, txt:string) => (
    <button onClick={()=>onChange(val)} style={{ flex:1, padding:"10px", border:"1.5px solid", borderColor:value===val?"#1A1714":"rgba(139,125,107,0.2)", background:value===val?"#1A1714":"transparent", color:value===val?"#FAF7F2":"#8B7D6B", borderRadius:"10px", fontSize:"13px", cursor:"pointer", fontFamily:"sans-serif", fontWeight:value===val?"600":"400" }}>{txt}</button>
  );
  return (
    <div style={{ marginBottom:"14px" }}>
      <div style={{ fontSize:"13px", color:"#5C4A35", marginBottom:"8px" }}>{label}</div>
      <div style={{ display:"flex", gap:"8px" }}>{btn(true,"כן")}{btn(false,"לא")}</div>
    </div>
  );
}

const SPIN_CSS = `@keyframes spin{to{transform:rotate(360deg)}}@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`;
function Spinner({ emoji }: { emoji:string }) {
  return (
    <div style={{ position:"relative", width:"90px", height:"90px", marginBottom:"28px" }}>
      <style>{SPIN_CSS}</style>
      {[0,1,2].map(i=>(
        <div key={i} style={{ position:"absolute", inset:`${i*11}px`, borderRadius:"50%", border:"2px solid transparent", borderTopColor:`rgba(122,168,112,${0.9-i*0.25})`, animation:`spin ${1.2+i*0.6}s linear infinite ${i%2?"reverse":""}` }} />
      ))}
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px", animation:"breathe 2.5s ease-in-out infinite" }}>{emoji}</div>
    </div>
  );
}

function NurseryFactsTicker() {
  const [idx, setIdx] = useState(0);
  const [vis, setVis] = useState(true);
  useEffect(()=>{
    const t = setInterval(()=>{
      setVis(false);
      setTimeout(()=>{ setIdx(i=>(i+1)%NURSERY_FACTS.length); setVis(true); }, 400);
    }, 5000);
    return ()=>clearInterval(t);
  }, []);
  return (
    <p style={{ margin:0, color:"rgba(250,248,245,0.8)", fontSize:"14px", lineHeight:"1.7", textAlign:"center", fontWeight:"300", opacity:vis?1:0, transition:"opacity 0.3s" }}>
      {NURSERY_FACTS[idx]}
    </p>
  );
}

function TipsScreen({ title, subtitle, facts, imageUrl, imageCaption, intervalMs }: { title:string; subtitle:string; facts:string[]; imageUrl?:string; imageCaption?:string; intervalMs?:number }) {
  const [idx, setIdx] = useState(0);
  const [vis, setVis] = useState(true);
  const interval = intervalMs ?? 5000;
  useEffect(()=>{
    if (!facts.length) return;
    const t = setInterval(()=>{
      setVis(false);
      setTimeout(()=>{ setIdx(i=>(i+1)%facts.length); setVis(true); }, 400);
    }, interval);
    return ()=>clearInterval(t);
  }, [facts, interval]);
  return (
    <div dir="rtl" style={{ display:"flex", flexDirection:"column", alignItems:"center", minHeight:"100vh", background:"radial-gradient(ellipse at 50% 40%,#2A3828 0%,#111 70%)", fontFamily:"sans-serif" }}>
      {imageUrl && (
        <div style={{ width:"100%", position:"relative" }}>
          <img src={imageUrl} alt="" style={{ width:"100%", objectFit:"cover", maxHeight:"240px", opacity:0.85, display:"block" }} />
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"60px", background:"linear-gradient(to bottom, transparent, #111)" }} />
          {imageCaption && (
            <div style={{ position:"absolute", bottom:"10px", right:0, left:0, textAlign:"center" }}>
              <span style={{ fontSize:"11px", color:"rgba(250,248,245,0.55)", letterSpacing:"1px", fontWeight:"300" }}>{imageCaption}</span>
            </div>
          )}
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, padding:"32px 24px 40px" }}>
        <Spinner emoji="✦" />
        <h2 style={{ color:"#FAF8F5", fontSize:"18px", marginBottom:"4px", fontWeight:"200", textAlign:"center" }}>{title}</h2>
        <p style={{ color:"rgba(250,248,245,0.3)", fontSize:"12px", marginBottom:"32px", textAlign:"center" }}>{subtitle}</p>
        {facts.length > 0 && (
          <div style={{ width:"100%", maxWidth:"320px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(122,168,112,0.2)", borderRadius:"16px", padding:"20px", opacity:vis?1:0, transition:"opacity 0.3s", minHeight:"100px" }}>
            <div style={{ fontSize:"28px", marginBottom:"10px", textAlign:"center" }}>🌿</div>
            <p style={{ margin:0, color:"rgba(250,248,245,0.8)", fontSize:"14px", lineHeight:"1.7", textAlign:"center", fontWeight:"300" }}>{facts[idx]}</p>
          </div>
        )}
        <div style={{ display:"flex", gap:"5px", marginTop:"20px", flexWrap:"wrap", justifyContent:"center" }}>
          {facts.map((_,i)=>(
            <div key={i} style={{ width:i===idx?"14px":"5px", height:"5px", borderRadius:"3px", transition:"all 0.3s", background:i===idx?"#7AA870":"rgba(122,168,112,0.25)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({ step }: { step:number }) {
  const steps = [{ label:"בוחנים את המרפסת שלך...", time:"~10 שנ׳" },{ label:"מכינים ניתוח מפורט...", time:"~3 שנ׳" }];
  return (
    <div dir="rtl" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"radial-gradient(ellipse at 50% 40%,#2A3828 0%,#111 70%)", padding:"40px 24px", fontFamily:"sans-serif" }}>
      <Spinner emoji="🌿" />
      <h2 style={{ color:"#FAF8F5", fontSize:"18px", marginBottom:"36px", fontWeight:"200", textAlign:"center" }}>בוחנים את המרפסת שלך</h2>
      <div style={{ width:"100%", maxWidth:"290px" }}>
        {steps.map((s,i)=>{
          const isDone=i<step, isActive=i===step;
          return (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px", opacity:i>step?0.25:1, transition:"opacity 0.5s" }}>
              <div style={{ width:"30px", height:"30px", borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:isDone?"12px":"14px", background:isDone?"#7AA870":"transparent", border:isDone?"none":`1.5px solid ${isActive?"rgba(122,168,112,0.5)":"rgba(255,255,255,0.1)"}`, color:isDone?"#1a3a18":"white", animation:isActive?"spin 1.5s linear infinite":"none", fontWeight:"700" }}>
                {isDone?"✓":isActive?"↻":"○"}
              </div>
              <span style={{ color:isDone?"#7AA870":isActive?"#d0f0c8":"#5a7258", fontSize:"13px", flex:1 }}>{s.label}</span>
              {isActive&&<span style={{ fontSize:"10px", color:"#7AA870" }}>{s.time}</span>}
            </div>
          );
        })}
      </div>
      <div style={{ width:"100%", maxWidth:"320px", marginTop:"32px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(122,168,112,0.2)", borderRadius:"16px", padding:"20px", minHeight:"80px" }}>
        <div style={{ fontSize:"28px", marginBottom:"10px", textAlign:"center" }}>🌱</div>
        <NurseryFactsTicker />
      </div>
    </div>
  );
}

function ConfirmScreen({ photoDataUrl, analysis, userData, setUserData, onNext }: { photoDataUrl:string; analysis:Analysis; userData:UserData; setUserData:(u:UserData)=>void; onNext:()=>void }) {
  const SUN: Record<string,string> = {"שמש מלאה":"☀️","חצי צל":"⛅","צל":"🌑"};
  const tags = [
    analysis.sun_exposure?`${SUN[analysis.sun_exposure]??""} ${analysis.sun_exposure}`:null,
    analysis.style?`🎨 ${analysis.style}`:null,
    analysis.railing?`🪟 מעקה ${analysis.railing}`:null,
  ].filter(Boolean) as string[];
  return (
    <div dir="rtl" style={{ background:"#FAF7F2", minHeight:"100vh", fontFamily:"sans-serif" }}>
      <Header subtitle="ניתוח מרפסת" />
      <div style={{ padding:"16px" }}>
        <div style={{ marginBottom:"14px", borderRadius:"16px", overflow:"hidden", boxShadow:"0 6px 24px rgba(0,0,0,0.12)" }}>
          <img src={photoDataUrl} alt="המרפסת שלך" style={{ width:"100%", display:"block" }} />
        </div>
        {tags.length>0&&(
          <Card>
            <SectionTitle>מה ראיתי</SectionTitle>
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:analysis.notes?"12px":0 }}>
              {tags.map((t,i)=><span key={i} style={{ background:"#F5F0E8", color:"#5C4A35", padding:"6px 12px", borderRadius:"20px", fontSize:"12px", fontWeight:"500" }}>{t}</span>)}
            </div>
            {analysis.notes&&<p style={{ margin:0, color:"#8B7D6B", fontSize:"13px", lineHeight:"1.7" }}>{analysis.notes}</p>}
          </Card>
        )}
        <Card>
          <SectionTitle>מידות המרפסת - תקן אם צריך</SectionTitle>
          <Slider label="רוחב" value={userData.width_m} min={1} max={12} step={0.5} unit="מ׳" onChange={v=>setUserData({...userData,width_m:v})} />
          <Slider label="עומק" value={userData.depth_m} min={0.5} max={6} step={0.5} unit="מ׳" onChange={v=>setUserData({...userData,depth_m:v})} />
          <div style={{ background:"#F5F0E8", borderRadius:"10px", padding:"10px 14px", fontSize:"12px", color:"#8B7D6B", textAlign:"center" }}>
            שטח משוער: <strong style={{ color:"#1A1714" }}>{(userData.width_m*userData.depth_m).toFixed(1)} מ״ר</strong>
          </div>
        </Card>
        <PrimaryButton label="המשך ←" onClick={onNext} />
      </div>
    </div>
  );
}

function DetailsScreen({ userData, setUserData, onNext }: { userData:UserData; setUserData:(u:UserData)=>void; onNext:()=>void }) {
  const DIRS = ["צפון","דרום","מזרח","מערב"];
  const STYLES = [
    { id:"modern", emoji:"◻️", label:"מודרני", desc:"נקי, גיאומטרי, מינימליסטי" },
    { id:"mediterranean", emoji:"🫙", label:"ים-תיכוני", desc:"חם, צבעוני, ריחני" },
    { id:"jungle", emoji:"🌿", label:"טבעי-ג׳ונגל", desc:"פראי, ירוק, טרופי" },
  ];
  const ok = userData.direction!==""&&userData.has_drain!==null&&userData.has_power!==null&&userData.garden_style!=="";
  return (
    <div dir="rtl" style={{ background:"#FAF7F2", minHeight:"100vh", fontFamily:"sans-serif" }}>
      <Header subtitle="פרטי הגינה" />
      <div style={{ padding:"16px" }}>
        <Card>
          <SectionTitle>לאיזה כיוון פונה המרפסת?</SectionTitle>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
            {DIRS.map(d=>(
              <button key={d} onClick={()=>setUserData({...userData,direction:d})} style={{ padding:"12px", border:"1.5px solid", borderColor:userData.direction===d?"#1A1714":"rgba(139,125,107,0.2)", background:userData.direction===d?"#1A1714":"transparent", color:userData.direction===d?"#FAF7F2":"#8B7D6B", borderRadius:"10px", fontSize:"14px", cursor:"pointer", fontFamily:"sans-serif", fontWeight:userData.direction===d?"600":"400" }}>{d}</button>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle>כמה שמש מקבלת המרפסת?</SectionTitle>
          <Slider label="אחוז שמש ביום רגיל" value={userData.sun_pct} min={20} max={100} step={10} unit="%" onChange={v=>setUserData({...userData,sun_pct:v})} />
          <div style={{ background:"#F5F0E8", borderRadius:"10px", padding:"10px 14px", fontSize:"12px", color:"#8B7D6B", textAlign:"center" }}>
            {userData.sun_pct<=30?"🌑 בעיקר צל":userData.sun_pct<=60?"⛅ חצי צל":"☀️ שמש מלאה"}
          </div>
        </Card>
        <Card>
          <YesNo label="האם יש ניקוז במרפסת?" value={userData.has_drain} onChange={v=>setUserData({...userData,has_drain:v})} />
          <YesNo label="האם יש נקודת חשמל?" value={userData.has_power} onChange={v=>setUserData({...userData,has_power:v})} />
        </Card>
        <Card>
          <SectionTitle>איזה סגנון גינה אתה מחפש?</SectionTitle>
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {STYLES.map(s=>(
              <button key={s.id} onClick={()=>setUserData({...userData,garden_style:s.id})} style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px", border:"1.5px solid", textAlign:"right", borderColor:userData.garden_style===s.id?"#1A1714":"rgba(139,125,107,0.2)", background:userData.garden_style===s.id?"#1A1714":"transparent", borderRadius:"12px", cursor:"pointer", fontFamily:"sans-serif" }}>
                <span style={{ fontSize:"22px" }}>{s.emoji}</span>
                <div>
                  <div style={{ fontSize:"14px", fontWeight:"600", color:userData.garden_style===s.id?"#FAF7F2":"#1A1714" }}>{s.label}</div>
                  <div style={{ fontSize:"11px", marginTop:"2px", color:userData.garden_style===s.id?"rgba(250,247,242,0.55)":"#8B7D6B" }}>{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>
        <PrimaryButton label="עצב לי גינה ←" onClick={onNext} disabled={!ok} />
        {!ok&&<p style={{ textAlign:"center", fontSize:"11px", color:"#C4B8A8", marginTop:"8px" }}>יש למלא את כל השדות</p>}
      </div>
    </div>
  );
}

function IdleScreen({ onFile, errorMsg, fileRef }: { onFile:(f:File)=>void; errorMsg:string; fileRef:React.RefObject<HTMLInputElement> }) {
  return (
    <div dir="rtl" style={{ background:"linear-gradient(180deg,#1A1714 0%,#2C2420 40%,#FAF7F2 40%)", minHeight:"100vh", fontFamily:"sans-serif" }}>
      <div style={{ textAlign:"center", padding:"52px 24px 60px", color:"#FAF7F2" }}>
        <div style={{ fontSize:"10px", letterSpacing:"4px", opacity:0.35, marginBottom:"14px" }}>מ ש ת ל ת  ר ז</div>
        <h1 style={{ margin:"0 0 10px", fontSize:"34px", fontWeight:"200", letterSpacing:"-1px", lineHeight:1.1 }}>הגינה שתמיד<br />דמיינת</h1>
        <p style={{ margin:0, fontSize:"14px", opacity:0.4, fontWeight:"300" }}>צלם את המרפסת שלך</p>
      </div>
      <div style={{ padding:"0 16px 32px" }}>
        <div style={{ background:"#fff", borderRadius:"20px", padding:"28px 20px", boxShadow:"0 8px 32px rgba(26,23,20,0.12)" }}>
          {errorMsg&&<div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"10px", padding:"12px 16px", marginBottom:"18px", color:"#DC2626", fontSize:"13px" }}>❌ {errorMsg}</div>}
          <div onClick={()=>fileRef.current?.click()} style={{ border:"1.5px dashed rgba(139,125,107,0.3)", borderRadius:"14px", padding:"44px 20px", textAlign:"center", cursor:"pointer", background:"#FAF7F2", marginBottom:"24px" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>📸</div>
            <p style={{ margin:"0 0 5px", fontWeight:"600", color:"#1A1714", fontSize:"16px" }}>צלם את המרפסת שלך</p>
            <p style={{ margin:0, color:"#8B7D6B", fontSize:"13px" }}>או לחץ לבחור תמונה מהגלריה</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={e=>e.target.files?.[0]&&onFile(e.target.files[0])} />
          <div style={{ display:"flex", justifyContent:"space-around" }}>
            {[["📸","מצלם"],["✦","מנתח"],["🌿","גינה שלך"]].map(([icon,label])=>(
              <div key={label} style={{ textAlign:"center" }}>
                <div style={{ fontSize:"18px", color:"#8B7D6B" }}>{icon}</div>
                <div style={{ fontSize:"10px", color:"#C4B8A8", marginTop:"4px", letterSpacing:"0.5px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <p style={{ textAlign:"center", color:"rgba(139,125,107,0.3)", fontSize:"10px", marginTop:"18px", letterSpacing:"2px" }}>משתלת רז · Powered by Bloom</p>
      </div>
    </div>
  );
}

function ResultScreen({ composedUrl, products, onOrder, onReset }: { composedUrl:string; products:Products; onOrder:()=>void; onReset:()=>void }) {
  return (
    <div dir="rtl" style={{ background:"#FAF7F2", minHeight:"100vh", fontFamily:"sans-serif" }}>
      <Header subtitle="הגינה שלך מוכנה" />
      <div style={{ padding:"16px" }}>
        <div style={{ marginBottom:"16px", borderRadius:"16px", overflow:"hidden", boxShadow:"0 6px 24px rgba(0,0,0,0.12)" }}>
          <img src={composedUrl} alt="הגינה" style={{ width:"100%", display:"block" }} />
        </div>
        <Card>
          <SectionTitle>רשימת הקנייה שלך</SectionTitle>
          {products.items.map((item,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:i<products.items.length-1?"1px solid rgba(139,125,107,0.1)":"none" }}>
              <div>
                <div style={{ fontSize:"13px", color:"#1A1714", fontWeight:"500" }}>{item.name}</div>
                <div style={{ fontSize:"11px", color:"#8B7D6B", marginTop:"2px" }}>{item.qty} x {item.unitPrice}</div>
              </div>
              <div style={{ fontSize:"14px", fontWeight:"600", color:"#1A1714" }}>₪{item.total}</div>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"14px", paddingTop:"14px", borderTop:"2px solid #1A1714" }}>
            <span style={{ fontSize:"15px", fontWeight:"700", color:"#1A1714" }}>סה״כ לתשלום</span>
            <span style={{ fontSize:"18px", fontWeight:"700", color:"#1A1714" }}>₪{products.grandTotal}</span>
          </div>
        </Card>
        <PrimaryButton label="לתשלום ←" onClick={onOrder} />
        <div style={{ height:"12px" }} />
        <button onClick={onReset} style={{ width:"100%", padding:"14px", background:"transparent", color:"#8B7D6B", border:"1px solid rgba(139,125,107,0.25)", borderRadius:"12px", fontSize:"13px", cursor:"pointer", fontFamily:"sans-serif" }}>התחל מחדש</button>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onReset }: { error: AppError; onReset: () => void }) {
  const [showLog, setShowLog] = useState(false);
  return (
    <div dir="rtl" style={{ background:"#FAF7F2", minHeight:"100vh", fontFamily:"sans-serif" }}>
      <div style={{ background:"#1A1714", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ color:"#FAF7F2", fontSize:"15px", fontWeight:"300", letterSpacing:"3px" }}>משתלת רז</span>
        <span style={{ color:"rgba(250,247,242,0.35)", fontSize:"11px" }}>שגיאה</span>
      </div>
      <div style={{ padding:"24px 16px" }}>
        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          <div style={{ fontSize:"48px", marginBottom:"12px" }}>⚠️</div>
          <h2 style={{ fontSize:"20px", fontWeight:"300", color:"#1A1714", margin:"0 0 8px" }}>משהו השתבש</h2>
          <p style={{ fontSize:"13px", color:"#8B7D6B", margin:0 }}>אנחנו כבר על זה</p>
        </div>
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"12px", padding:"16px", marginBottom:"16px" }}>
          {error.route && <div style={{ fontSize:"11px", color:"#DC2626", fontWeight:"600", marginBottom:"6px" }}>ROUTE: {error.route.toUpperCase()}</div>}
          {error.step && <div style={{ fontSize:"11px", color:"#DC2626", fontWeight:"600", marginBottom:"8px" }}>STEP: {error.step}</div>}
          <div style={{ fontSize:"13px", color:"#DC2626", lineHeight:"1.6", wordBreak:"break-word" }}>{error.message}</div>
        </div>
        {error.log && error.log.length > 0 && (
          <div style={{ marginBottom:"16px" }}>
            <button onClick={() => setShowLog(v => !v)} style={{ background:"transparent", border:"1px solid rgba(139,125,107,0.3)", borderRadius:"8px", padding:"8px 14px", fontSize:"12px", color:"#8B7D6B", cursor:"pointer", fontFamily:"sans-serif", width:"100%" }}>
              {showLog ? "הסתר לוגים" : "הצג לוגים טכניים"}
            </button>
            {showLog && (
              <div style={{ marginTop:"8px", background:"#1A1714", borderRadius:"10px", padding:"12px", maxHeight:"200px", overflowY:"auto" }}>
                {error.log.map((line, i) => <div key={i} style={{ fontSize:"11px", color:"#7AA870", fontFamily:"monospace", lineHeight:"1.8" }}>{line}</div>)}
              </div>
            )}
          </div>
        )}
        <button onClick={onReset} style={{ width:"100%", padding:"17px", background:"#1A1714", color:"#FAF7F2", border:"none", borderRadius:"14px", fontSize:"15px", fontWeight:"600", fontFamily:"sans-serif", cursor:"pointer" }}>
          נסה שוב
        </button>
      </div>
    </div>
  );
}

function OrderScreen({ timings }: { timings: Timings | null }) {
  const fmt = (ms: number) => (ms / 1000).toFixed(1) + "s";
  const totalWait = timings ? timings.analyzeMs + timings.planMs + timings.composeMs : 0;
  return (
    <div dir="rtl" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#FAF7F2", padding:"40px 24px", fontFamily:"sans-serif", textAlign:"center" }}>
      <div style={{ fontSize:"64px", marginBottom:"24px" }}>🌿</div>
      <h1 style={{ fontSize:"28px", fontWeight:"200", color:"#1A1714", marginBottom:"12px" }}>הזמנתך התקבלה!</h1>
      <p style={{ fontSize:"15px", color:"#8B7D6B", lineHeight:"1.7", maxWidth:"280px" }}>הגינה שלך בדרך אליך.</p>
      {timings && (
        <div style={{ marginTop:"32px", width:"100%", maxWidth:"320px", background:"#1A1714", borderRadius:"14px", padding:"16px", textAlign:"right" }}>
          <div style={{ fontSize:"10px", color:"rgba(250,247,242,0.4)", letterSpacing:"2px", marginBottom:"12px", textAlign:"center" }}>DEBUG TIMINGS</div>
          {[
            { label:"Claude Vision (ניתוח)", ms:timings.analyzeMs },
            { label:"DALL-E Blueprint (מקביל)", ms:timings.blueprintMs },
            { label:"Claude Haiku (תכנון)", ms:timings.planMs },
            { label:"DALL-E Compose (עיצוב)", ms:timings.composeMs },
          ].map(({ label, ms }) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ fontSize:"12px", color:"rgba(250,247,242,0.5)" }}>{label}</span>
              <span style={{ fontSize:"12px", color:"#7AA870", fontFamily:"monospace", fontWeight:"600" }}>{fmt(ms)}</span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", paddingTop:"10px", marginTop:"4px" }}>
            <span style={{ fontSize:"12px", color:"rgba(250,247,242,0.7)", fontWeight:"600" }}>סה"כ המתנה נראית</span>
            <span style={{ fontSize:"13px", color:"#FAF7F2", fontFamily:"monospace", fontWeight:"700" }}>{fmt(totalWait)}</span>
          </div>
        </div>
      )}
      <p style={{ fontSize:"11px", color:"#C4B8A8", marginTop:"24px", letterSpacing:"2px" }}>משתלת רז · Powered by Bloom</p>
    </div>
  );
}

export default function Home() {
  const [state,         setState]         = useState<AppState>("idle");
  const [step,          setStep]          = useState(0);
  const [analysis,      setAnalysis]      = useState<Analysis|null>(null);
  const [photoDataUrl,  setPhotoDataUrl]  = useState<string|null>(null);
  const [appError,      setAppError]      = useState<AppError|null>(null);
  const [errorMsg,      setErrorMsg]      = useState("");
  const [userData,      setUserData]      = useState<UserData>({ width_m:4, depth_m:2.5, direction:"", sun_pct:50, has_drain:null, has_power:null, garden_style:"" });
  const [blueprintUrl,  setBlueprintUrl]  = useState<string|null>(null);
  const [composedUrl,   setComposedUrl]   = useState<string|null>(null);
  const [products,      setProducts]      = useState<Products|null>(null);
  const [waitingFacts,  setWaitingFacts]  = useState<string[]>([]);
  const [planningFacts, setPlanningFacts] = useState<string[]>([]);
  const [timings,       setTimings]       = useState<Timings|null>(null);

  const blueprintPromiseRef = useRef<Promise<string|null>|null>(null);
  const blueprintStartRef   = useRef<number>(0);
  const analyzeStartRef     = useRef<number>(0);
  const fileRef = useRef<HTMLInputElement>(null!);

  useEffect(()=>{ window.scrollTo(0,0); }, [state]);

  const handleFile = async (file: File) => {
    setState("analyzing"); setStep(0); setErrorMsg("");
    setComposedUrl(null); setProducts(null); setWaitingFacts([]); setPlanningFacts([]); setTimings(null);
    try {
      const dataUrl = await compressImage(file);
      setPhotoDataUrl(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const mime   = file.type||"image/jpeg";

      // Start blueprint timer and wrap promise to record duration
      blueprintStartRef.current = Date.now();
      blueprintPromiseRef.current = fetch("/api/blueprint", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ imageBase64:base64, mimeType:mime }),
      }).then(r=>r.json()).then(d=>{
        const bpMs = Date.now() - blueprintStartRef.current;
        setTimings(prev => prev ? { ...prev, blueprintMs:bpMs } : { analyzeMs:0, blueprintMs:bpMs, planMs:0, composeMs:0 });
        return (d.blueprintUrl as string)||null;
      }).catch(()=>null);

      // Start analyze timer
      analyzeStartRef.current = Date.now();
      const res = await fetch("/api/analyze", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ imageBase64:base64, mimeType:mime }),
      });
      if (!res.body) throw new Error("no response body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream:true });
        const lines = buf.split("\n"); buf = lines.pop()??"";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let ev: Record<string,unknown> = {};
          try { ev = JSON.parse(line.slice(6).trim()); } catch { continue; }
          if (ev.type==="step") {
            setStep(ev.step as number);
            if (ev.analysis) {
              const a = ev.analysis as Analysis;
              setAnalysis(a);
              setUserData(prev=>({ ...prev, width_m:a.width_m??prev.width_m, depth_m:a.depth_m??prev.depth_m }));
            }
          } else if (ev.type==="done") {
            const analyzeMs = Date.now() - analyzeStartRef.current;
            setTimings(prev => prev ? { ...prev, analyzeMs } : { analyzeMs, blueprintMs:0, planMs:0, composeMs:0 });
            const a = (ev.analysis as Analysis)||null;
            setAnalysis(a);
            if (a?.width_m) setUserData(prev=>({ ...prev, width_m:a.width_m!, depth_m:a.depth_m??prev.depth_m }));
            setState("confirm");
          } else if (ev.type==="error") {
            throw new Error(ev.message as string);
          }
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "error");
      setState("error");
    }
  };

  const getDebugLog = (data: Record<string,unknown>): string[] => {
    const debug = data.debug as Record<string,unknown>|undefined;
    return Array.isArray(debug?.log) ? debug.log as string[] : [];
  };

  const handleDesign = async (urlOverride?: string) => {
    const url = urlOverride ?? blueprintUrl;
    if (!url) return;
    setState("planning");

    const factsPromise = fetch("/api/facts", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ width_m:userData.width_m, depth_m:userData.depth_m, direction:userData.direction, sun_pct:userData.sun_pct, garden_style:userData.garden_style }),
    }).then(r=>r.json()).then(d=>d.facts as string[]).catch(()=>[] as string[]);

    factsPromise.then(facts => { if (facts.length) setPlanningFacts(facts); });

    let dallePrompt = "";
    try {
      const planStart = Date.now();
      const res = await fetch("/api/plan", {
        method:"POST", headers:{"Content-Type":"application/json"},
body: JSON.stringify({ blueprintUrl:url, width_m:userData.width_m, depth_m:userData.depth_m, direction:userData.direction, sun_pct:userData.sun_pct, garden_style:userData.garden_style, floor_color:analysis?.floor_color??"gray", wall_color:analysis?.wall_color??"white", railing_color:analysis?.railing_color??"gray", wall_height_m:analysis?.wall_height_m??2.6 }),      });
      let data: Record<string,unknown> = {};
      try { data = await res.json(); } catch { setAppError({ message:"plan: invalid JSON (status "+res.status+")", route:"/api/plan", step:"parse" }); setState("error"); return; }
      if (!data.dallePrompt) { setAppError({ message:String(data.error||"no dallePrompt"), route:"/api/plan", step:String(data.step||"unknown"), log:getDebugLog(data) }); setState("error"); return; }
      const planMs = Date.now() - planStart;
      setTimings(prev => prev ? { ...prev, planMs } : { analyzeMs:0, blueprintMs:0, planMs, composeMs:0 });
      dallePrompt = data.dallePrompt as string;
      setWaitingFacts((data.waitingFacts as string[])||[]);
      setProducts(data.products as Products);
    } catch (err: unknown) {
      setAppError({ message:err instanceof Error?err.message:"network error", route:"/api/plan", step:"fetch" });
      setState("error"); return;
    }

    setState("composing");
    try {
      const composeStart = Date.now();
      const res = await fetch("/api/compose", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ blueprintUrl:url, dallePrompt }),
      });
      if (!res.ok || !res.body) {
        setAppError({ message:"compose status " + res.status, route:"/api/compose", step:"http" });
        setState("error"); return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let lastPartialUrl: string|null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream:true });
        const lines = buf.split("\n"); buf = lines.pop()??"";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let ev: Record<string,unknown> = {};
          try { ev = JSON.parse(line.slice(6).trim()); } catch { continue; }
          if (ev.type === "partial" && ev.imageUrl) {
            lastPartialUrl = ev.imageUrl as string;
            setComposedUrl(lastPartialUrl);
          }
          if (ev.type === "done") {
            const composeMs = Date.now() - composeStart;
            setTimings(prev => prev ? { ...prev, composeMs } : { analyzeMs:0, blueprintMs:0, planMs:0, composeMs });
            const finalUrl = (ev.imageUrl as string|null) ?? lastPartialUrl;
            if (finalUrl) { setComposedUrl(finalUrl); setState("result"); }
            else { setAppError({ message:"no imageUrl in compose response", route:"/api/compose", step:"done", log:ev.log as string[] }); setState("error"); }
          }
          if (ev.type === "error") {
            setAppError({ message:String(ev.message||"compose error"), route:"/api/compose", step:"stream", log:ev.log as string[] });
            setState("error");
          }
        }
      }
    } catch (err: unknown) {
      setAppError({ message:err instanceof Error?err.message:"network error", route:"/api/compose", step:"fetch" });
      setState("error");
    }
  };

  const handleDetailsComplete = async () => {
    setState("waiting");
    const arrived = await blueprintPromiseRef.current;
    if (!arrived) {
      setAppError({ message:"blueprint generation failed", route:"/api/blueprint", step:"generate" });
      setState("error");
      return;
    }
    setBlueprintUrl(arrived);
    await handleDesign(arrived);
  };

  const handleReset = () => {
    setState("idle"); setAnalysis(null); setPhotoDataUrl(null); setErrorMsg("");
    setBlueprintUrl(null); setComposedUrl(null); setProducts(null);
    setWaitingFacts([]); setPlanningFacts([]); setTimings(null);
    setAppError(null); blueprintPromiseRef.current = null;
    setUserData({ width_m:4, depth_m:2.5, direction:"", sun_pct:50, has_drain:null, has_power:null, garden_style:"" });
    if (fileRef.current) fileRef.current.value = "";
  };

  if (state==="analyzing") return <LoadingScreen step={step} />;
  if (state==="waiting")   return <TipsScreen title="מכינים את המרפסת שלך" subtitle="עוד רגע ומתחילים לתכנן" facts={NURSERY_FACTS} imageUrl={photoDataUrl??undefined} imageCaption="המרפסת שלך" />;
  if (state==="planning")  return <TipsScreen title="צוות התכנון עובד על הגינה שלך" subtitle="בוחרים צמחים ומחשבים את הפריסה המושלמת" facts={planningFacts.length ? planningFacts : NURSERY_FACTS} imageUrl={photoDataUrl??undefined} imageCaption="המרפסת שלך" />;
  if (state==="composing") return <TipsScreen title="מעצבים את הגינה שלך" subtitle="כמעט מוכן..." facts={waitingFacts.length ? waitingFacts : NURSERY_FACTS} imageUrl={blueprintUrl??undefined} imageCaption="ניקינו את המרפסת — עכשיו מציירים את הגינה" intervalMs={6000} />;
  if (state==="order")     return <OrderScreen timings={timings} />;
  if (state==="error")     return <ErrorScreen error={appError??{ message:errorMsg||"unknown error" }} onReset={handleReset} />;
  if (state==="result"&&composedUrl&&products) return <ResultScreen composedUrl={composedUrl} products={products} onOrder={()=>setState("order")} onReset={handleReset} />;
  if (state==="confirm"&&analysis&&photoDataUrl) return <ConfirmScreen photoDataUrl={photoDataUrl} analysis={analysis} userData={userData} setUserData={setUserData} onNext={()=>setState("details")} />;
  if (state==="details") return <DetailsScreen userData={userData} setUserData={setUserData} onNext={handleDetailsComplete} />;
  return <IdleScreen onFile={handleFile} errorMsg={errorMsg} fileRef={fileRef} />;
}
