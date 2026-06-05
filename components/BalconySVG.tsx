"use client";
// components/BalconySVG.tsx
// שרטוט אדריכלי של מרפסת עם 5 זוגות קבועים

interface Analysis {
  sun_exposure: string;
  balcony_size?: string;
  style?: string;
}

export default function BalconySVG({ analysis }: { analysis: Analysis }) {
  const W = 360;
  const H = 280;

  const sun = analysis?.sun_exposure ?? "חצי צל";

  const skyTop =
    sun === "שמש מלאה" ? "#0d7bb5"
    : sun === "חצי צל"  ? "#4a6980"
    : "#3a4a58";
  const skyBot =
    sun === "שמש מלאה" ? "#87ceeb"
    : sun === "חצי צל"  ? "#7a9aaa"
    : "#5a6a7a";

  // חישוב ניצני שמש
  const sunRays = [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x1: 330 + 16 * Math.cos(rad),
      y1: 22  + 16 * Math.sin(rad),
      x2: 330 + 23 * Math.cos(rad),
      y2: 22  + 23 * Math.sin(rad),
    };
  });

  return (
    <div
      style={{
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
        direction: "ltr",
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", width: "100%" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ── GRADIENTS ────────────────────────────── */}
        <defs>
          <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={skyTop} />
            <stop offset="100%" stopColor={skyBot} />
          </linearGradient>
          <linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f0e8d8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ddd0be" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="floorG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#c8ba9a" />
            <stop offset="100%" stopColor="#b4a888" />
          </linearGradient>
        </defs>

        {/* ── BACKGROUND ───────────────────────────── */}
        <rect x={0} y={0}   width={W} height={165} fill="url(#skyG)"   />
        <rect x={0} y={0}   width={W} height={165} fill="url(#wallG)"  />
        <rect x={0} y={165} width={W} height={H - 165} fill="url(#floorG)" />

        {/* Floor tiles */}
        {[0,1,2,3,4,5].map((i) => (
          <line key={`fh${i}`} x1={0} y1={165 + i * 19} x2={W} y2={165 + i * 19}
            stroke="#9a8868" strokeWidth="0.4" opacity="0.35" />
        ))}
        {[0,1,2,3,4,5,6,7].map((i) => (
          <line key={`fv${i}`} x1={i * 52} y1={165} x2={i * 52} y2={H - 10}
            stroke="#9a8868" strokeWidth="0.4" opacity="0.35" />
        ))}

        {/* ── PAIR 1 — לבנדר + טרקוטה M (x=68) ─── */}
        {/* Stem */}
        <line x1={68} y1={200} x2={68} y2={158} stroke="#5a8a30" strokeWidth="1.5" opacity="0.5" />
        {/* Foliage */}
        <ellipse cx={68} cy={158} rx={30} ry={26} fill="#c39bd3" opacity="0.28" />
        <ellipse cx={55} cy={162} rx={20} ry={20} fill="#9b59b6" opacity="0.38" />
        <ellipse cx={81} cy={160} rx={18} ry={19} fill="#8e44ad" opacity="0.38" />
        <ellipse cx={68} cy={150} rx={22} ry={17} fill="#a569bd" opacity="0.44" />
        {/* Lavender spikes */}
        <line x1={58} y1={158} x2={52} y2={135} stroke="#7d3c98" strokeWidth="1.5" opacity="0.6" />
        <line x1={68} y1={152} x2={68} y2={126} stroke="#9b59b6" strokeWidth="1.5" opacity="0.7" />
        <line x1={78} y1={156} x2={84} y2={133} stroke="#7d3c98" strokeWidth="1.5" opacity="0.6" />
        <ellipse cx={52} cy={133} rx={5} ry={8} fill="#9b59b6" opacity="0.75" />
        <ellipse cx={68} cy={124} rx={5} ry={9} fill="#a569bd" opacity="0.8"  />
        <ellipse cx={84} cy={131} rx={5} ry={8} fill="#9b59b6" opacity="0.75" />
        {/* Pot */}
        <path d="M 37,228 L 99,228 L 94,200 L 42,200 Z" fill="#d4a574" stroke="#b8845a" strokeWidth="1.5" />
        <rect x={35} y={196} width={66} height={7} rx={2} fill="#c8905c" />
        <ellipse cx={68} cy={204} rx={27} ry={5} fill="#7a4020" opacity="0.38" />
        {/* Labels */}
        <text x={68} y={245} textAnchor="middle" fontSize="9" fill="#3a2810" fontFamily="sans-serif">לבנדר</text>
        <text x={68} y={257} textAnchor="middle" fontSize="9" fill="#2d5a27" fontFamily="sans-serif" fontWeight="bold">₪88</text>

        {/* ── PAIR 2 — גרניום + טרקוטה S (x=183) ── */}
        <line x1={183} y1={200} x2={183} y2={162} stroke="#a0180a" strokeWidth="1.5" opacity="0.5" />
        <ellipse cx={183} cy={168} rx={28} ry={24} fill="#f1948a" opacity="0.28" />
        <ellipse cx={173} cy={172} rx={19} ry={18} fill="#e74c3c" opacity="0.38" />
        <ellipse cx={193} cy={170} rx={17} ry={17} fill="#c0392b" opacity="0.38" />
        <ellipse cx={183} cy={163} rx={20} ry={16} fill="#e74c3c" opacity="0.44" />
        {/* Flowers */}
        {[[173,158],[185,153],[178,148],[193,160]] .map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r={4.5} fill="#e74c3c" opacity="0.78" />
        ))}
        <path d="M 158,225 L 208,225 L 204,200 L 162,200 Z" fill="#e8c4a0" stroke="#c4885c" strokeWidth="1.5" />
        <rect x={156} y={196} width={50} height={7} rx={2} fill="#d8a870" />
        <ellipse cx={183} cy={204} rx={22} ry={4} fill="#7a4020" opacity="0.38" />
        <text x={183} y={242} textAnchor="middle" fontSize="9" fill="#3a2810" fontFamily="sans-serif">גרניום</text>
        <text x={183} y={254} textAnchor="middle" fontSize="9" fill="#2d5a27" fontFamily="sans-serif" fontWeight="bold">₪54</text>

        {/* ── PAIR 3 — רוזמרין + פלסטיק 60 (x=295) ── */}
        {[280, 295, 310].map((sx) => (
          <line key={sx} x1={sx} y1={199} x2={sx} y2={118} stroke="#196f3d" strokeWidth="1.8" opacity="0.6" />
        ))}
        {[130, 145, 160, 175, 190].map((y, i) => (
          <g key={y}>
            <ellipse cx={280 + (i%2 ? 10 : -10)} cy={y} rx={8} ry={3}
              fill="#27ae60" opacity="0.65"
              transform={`rotate(${i%2 ? 20 : -20} ${280+(i%2?10:-10)} ${y})`} />
            <ellipse cx={295 + (i%2 ? -9 : 9)} cy={y - 3} rx={8} ry={3}
              fill="#2ecc71" opacity="0.6"
              transform={`rotate(${i%2 ? -15 : 15} ${295+(i%2?-9:9)} ${y-3})`} />
          </g>
        ))}
        {[[280,135],[295,122],[310,130]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r={3} fill="#8e44ad" opacity="0.6" />
        ))}
        <path d="M 260,226 L 332,226 L 332,200 L 260,200 Z" fill="#90a0b0" stroke="#607888" strokeWidth="1.5" />
        <rect x={258} y={196} width={76} height={7} rx={1} fill="#7a8ea0" />
        <ellipse cx={295} cy={204} rx={33} ry={4.5} fill="#5a3a10" opacity="0.32" />
        <text x={295} y={243} textAnchor="middle" fontSize="9" fill="#3a2810" fontFamily="sans-serif">רוזמרין</text>
        <text x={295} y={255} textAnchor="middle" fontSize="9" fill="#2d5a27" fontFamily="sans-serif" fontWeight="bold">₪88</text>

        {/* ── RAILING ─────────────────────────────── */}
        {Array.from({ length: 22 }).map((_, i) => (
          <rect key={i} x={i * 16.5} y={130} width={4} height={36} fill="#8a7860" opacity="0.78" />
        ))}
        <rect x={0} y={128} width={W} height={7}  rx={1} fill="#a09070" />
        <rect x={0} y={160} width={W} height={7}  rx={1} fill="#907860" />

        {/* ── PAIR 4 — פוטוס + תלויה (x=112) ─────── */}
        <line x1={112} y1={0}  x2={112} y2={68} stroke="#6a4c0a" strokeWidth="1.5" />
        <path d="M 95,68 L 129,68 L 124,93 L 100,93 Z" fill="#b8860b" stroke="#8a6008" strokeWidth="1.5" />
        <rect x={93} y={65} width={38} height={6} rx={2} fill="#c89a1c" />
        <ellipse cx={112} cy={71} rx={16} ry={4} fill="#5a3810" opacity="0.42" />
        {/* Trailing vines */}
        <path d="M 102,92 Q 80,110 68,132 Q 62,148 70,162"  stroke="#27ae60" strokeWidth="2.2" fill="none" opacity="0.8" />
        <path d="M 112,93 Q 105,115 98,138 Q 95,152 100,167" stroke="#2ecc71" strokeWidth="2"   fill="none" opacity="0.75" />
        <path d="M 122,92 Q 135,108 138,128 Q 140,145 132,158" stroke="#27ae60" strokeWidth="2"   fill="none" opacity="0.75" />
        <path d="M 107,93 Q 88,112 82,130"                    stroke="#1e8a40" strokeWidth="1.5" fill="none" opacity="0.6"  />
        {[[78,122],[65,135],[98,130],[130,115],[136,138]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r={5} fill="#2ecc71" opacity="0.65" />
        ))}
        <text x={112} y={107} textAnchor="middle" fontSize="9" fill="#3a2810" fontFamily="sans-serif">פוטוס</text>

        {/* ── PAIR 5 — מרווה + תלויה (x=248) ──────── */}
        <line x1={248} y1={0}  x2={248} y2={62} stroke="#6a4c0a" strokeWidth="1.5" />
        <path d="M 231,62 L 265,62 L 260,87 L 236,87 Z" fill="#c87840" stroke="#a06020" strokeWidth="1.5" />
        <rect x={229} y={59} width={38} height={6} rx={2} fill="#d8884a" />
        <ellipse cx={248} cy={65} rx={16} ry={4} fill="#5a3810" opacity="0.42" />
        {/* Bushy sage foliage */}
        <ellipse cx={248} cy={28}  rx={34} ry={32} fill="#c39bd3" opacity="0.18" />
        <ellipse cx={235} cy={34}  rx={23} ry={22} fill="#9b59b6" opacity="0.3"  />
        <ellipse cx={261} cy={32}  rx={22} ry={21} fill="#8e44ad" opacity="0.3"  />
        <ellipse cx={248} cy={22}  rx={25} ry={22} fill="#a569bd" opacity="0.36" />
        <ellipse cx={240} cy={14}  rx={9}  ry={11} fill="#9b59b6" opacity="0.62" />
        <ellipse cx={257} cy={12}  rx={9}  ry={11} fill="#8e44ad" opacity="0.62" />
        <ellipse cx={248} cy={5}   rx={8}  ry={8}  fill="#a569bd" opacity="0.68" />
        <text x={248} y={100} textAnchor="middle" fontSize="9" fill="#3a2810" fontFamily="sans-serif">מרווה</text>

        {/* ── SUN / WEATHER ────────────────────────── */}
        {sun === "שמש מלאה" && (
          <g>
            <circle cx={330} cy={22} r={13} fill="#FFD700" opacity="0.95" />
            {sunRays.map((r, i) => (
              <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
                stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
            ))}
          </g>
        )}
        {sun === "חצי צל" && (
          <g>
            <circle cx={325} cy={24} r={11} fill="#FFD700" opacity="0.7" />
            <ellipse cx={338} cy={20} rx={13} ry={10} fill="#ddd" opacity="0.92" />
            <ellipse cx={332} cy={26} rx={10} ry={8}  fill="#fff" opacity="0.88" />
          </g>
        )}
        {sun === "צל" && (
          <g>
            <ellipse cx={328} cy={20} rx={14} ry={11} fill="#c0c8d0" opacity="0.9" />
            <ellipse cx={336} cy={16} rx={11} ry={9}  fill="#d0d8e0" opacity="0.9" />
            <ellipse cx={322} cy={25} rx={12} ry={9}  fill="#e0e8f0" opacity="0.85" />
          </g>
        )}

        {/* ── BOTTOM BAR ───────────────────────────── */}
        <rect x={0} y={265} width={W} height={15} fill="#2d5a27" opacity="0.88" />
        <text x={W - 12} y={276} textAnchor="end"   fontSize="9.5" fill="white"   fontFamily="sans-serif" fontWeight="bold">₪394 :סה״כ</text>
        <text x={14}     y={276} textAnchor="start" fontSize="9"   fill="#a8d5a2" fontFamily="sans-serif">🌿 bloom</text>
      </svg>
    </div>
  );
}
