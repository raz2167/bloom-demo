// lib/catalog.ts
// קטלוג מוצרים bloom — 30 פריטים

export interface Product {
  id: number;
  category: "אדניות" | "צמחייה" | "אדמה";
  name: string;
  description: string;
  size?: string;
  price: number;
  sun_requirement: "שמש מלאה" | "חצי צל" | "צל חלקי" | "צל" | "כל תנאי";
  water?: string;
  balcony_sizes: ("קטנה" | "בינונית" | "גדולה")[];
  style_tags: string[];
  emoji: string;
  bg: string;
}

export const catalog: Product[] = [
  // ── אדניות ──────────────────────────────────────────────
  {
    id: 1, category: "אדניות",
    name: "אדנית טרקוטה עגולה S",
    description: "אדנית חרס קלאסית לצמחי עשבים ופרחים קטנים",
    size: "קוטר 20 ס״מ", price: 29,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["ים-תיכוני", "כפרי", "קלאסי"],
    emoji: "🏺", bg: "#e8c4a0"
  },
  {
    id: 2, category: "אדניות",
    name: "אדנית טרקוטה עגולה M",
    description: "אדנית חרס בינונית לשיחים קטנים ופרחים",
    size: "קוטר 30 ס״מ", price: 49,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["בינונית", "גדולה"],
    style_tags: ["ים-תיכוני", "כפרי", "קלאסי"],
    emoji: "🏺", bg: "#d4a574"
  },
  {
    id: 3, category: "אדניות",
    name: "אדנית טרקוטה עגולה L",
    description: "אדנית חרס גדולה לשיחים ועצים קטנים",
    size: "קוטר 40 ס״מ", price: 79,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["גדולה"],
    style_tags: ["ים-תיכוני", "כפרי", "קלאסי"],
    emoji: "🏺", bg: "#c4885c"
  },
  {
    id: 4, category: "אדניות",
    name: "אדנית פלסטיק מלבנית 60 ס״מ",
    description: "אדנית קלה ועמידה לאורך המעקה, מגוון צבעים",
    size: "60 × 20 ס״מ", price: 59,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["בינונית", "גדולה"],
    style_tags: ["מודרני", "מינימליסטי"],
    emoji: "▭", bg: "#90a0b0"
  },
  {
    id: 5, category: "אדניות",
    name: "אדנית פלסטיק מלבנית 100 ס״מ",
    description: "אדנית ארוכה לכיסוי מלא של מעקה, קלת משקל",
    size: "100 × 20 ס״מ", price: 89,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["גדולה"],
    style_tags: ["מודרני", "מינימליסטי"],
    emoji: "▭", bg: "#7a8a9a"
  },
  {
    id: 6, category: "אדניות",
    name: "אדנית בטון מלבנית",
    description: "אדנית בטון מעוצבת, עמידה לכל מזג אוויר, מראה יוקרתי",
    size: "50 × 30 ס״מ", price: 149,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["בינונית", "גדולה"],
    style_tags: ["מודרני", "אינדסטריאל", "יוקרתי"],
    emoji: "🪨", bg: "#8a8a8a"
  },
  {
    id: 7, category: "אדניות",
    name: "אדנית עץ טיק מלבנית",
    description: "אדנית עץ טיק טבעי, אסתטית ועמידה לחוץ",
    size: "60 × 25 ס״מ", price: 199,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["בינונית", "גדולה"],
    style_tags: ["כפרי", "ים-תיכוני", "בוהו"],
    emoji: "🪵", bg: "#8B4513"
  },
  {
    id: 8, category: "אדניות",
    name: "אדנית קרמיקה מעוצבת",
    description: "אדנית קרמיקה מצוירת בסגנון ים-תיכוני, כחול-לבן",
    size: "קוטר 25 ס״מ", price: 119,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["ים-תיכוני", "קלאסי", "בוהו"],
    emoji: "🎨", bg: "#4a7fa5"
  },
  {
    id: 9, category: "אדניות",
    name: "אדנית תלויה + שרשרת",
    description: "אדנית תלויה לצמחים משתלשלים, מוסיפה גובה לגינה",
    size: "קוטר 20 ס״מ", price: 45,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["בוהו", "כפרי", "ים-תיכוני"],
    emoji: "⛓️", bg: "#b8860b"
  },
  {
    id: 10, category: "אדניות",
    name: "גלינה גדולה לעץ",
    description: "גלינה רחבה ועמוקה לשתילת עצי נוי קטנים",
    size: "קוטר 50 ס״מ, עומק 40 ס״מ", price: 169,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["גדולה"],
    style_tags: ["מודרני", "ים-תיכוני", "יוקרתי"],
    emoji: "🪣", bg: "#556B2F"
  },

  // ── צמחייה ─────────────────────────────────────────────
  {
    id: 11, category: "צמחייה",
    name: "לבנדר",
    description: "צמח ריחני ים-תיכוני, פורח בסגול, מושך פרפרים",
    price: 39, sun_requirement: "שמש מלאה", water: "פעם בשבוע",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["ים-תיכוני", "כפרי", "ריחני"],
    emoji: "💜", bg: "#9b59b6"
  },
  {
    id: 12, category: "צמחייה",
    name: "רוזמרין",
    description: "עשב תיבול ונוי, עמיד מאוד לחום ויובש ישראלי",
    price: 29, sun_requirement: "שמש מלאה", water: "פעם בשבוע",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["ים-תיכוני", "כפרי", "ריחני"],
    emoji: "🌿", bg: "#27ae60"
  },
  {
    id: 13, category: "צמחייה",
    name: "גרניום אדום",
    description: "פורח כל השנה, עמיד לחום, סמל הגינה הים-תיכונית",
    price: 25, sun_requirement: "חצי צל", water: "פעמיים בשבוע",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["קלאסי", "ים-תיכוני", "צבעוני"],
    emoji: "🌹", bg: "#e74c3c"
  },
  {
    id: 14, category: "צמחייה",
    name: "גרניום ורוד",
    description: "גרניום עדין, פורח כל השנה, מתאים לחצי צל",
    price: 25, sun_requirement: "חצי צל", water: "פעמיים בשבוע",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["קלאסי", "ים-תיכוני", "רומנטי"],
    emoji: "🌸", bg: "#e91e8c"
  },
  {
    id: 15, category: "צמחייה",
    name: "סוקולנטים מיקס (מגש 6)",
    description: "שישה סוקולנטים צבעוניים, כמעט ללא טיפול",
    price: 49, sun_requirement: "שמש מלאה", water: "פעם בשבועיים",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["מודרני", "מינימליסטי", "מדברי"],
    emoji: "🌵", bg: "#95a5a6"
  },
  {
    id: 16, category: "צמחייה",
    name: "אגבה קטנה",
    description: "צמח חרב מרשים ועמיד, דורש מינימום טיפול",
    price: 55, sun_requirement: "שמש מלאה", water: "פעם בשבועיים",
    balcony_sizes: ["בינונית", "גדולה"],
    style_tags: ["מודרני", "מדברי", "מינימליסטי"],
    emoji: "🪴", bg: "#2ecc71"
  },
  {
    id: 17, category: "צמחייה",
    name: "פטוניה מיקס",
    description: "פרחים עשירים ומגוונים לאורך כל עונת הקיץ",
    price: 29, sun_requirement: "שמש מלאה", water: "פעמיים בשבוע",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["קלאסי", "צבעוני", "פרחוני"],
    emoji: "🌺", bg: "#e91e63"
  },
  {
    id: 18, category: "צמחייה",
    name: "פוטוס משתלשל",
    description: "צמח ירוק משתלשל, מושלם לאדניות תלויות ולצל",
    price: 39, sun_requirement: "צל חלקי", water: "פעם בשבוע",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["בוהו", "ירוק", "מינימליסטי"],
    emoji: "🍃", bg: "#1a5c2a"
  },
  {
    id: 19, category: "צמחייה",
    name: "עץ זית ננסי",
    description: "עץ זית מטופח, סמל ים-תיכוני מושלם, עמיד לאקלים ישראל",
    price: 149, sun_requirement: "שמש מלאה", water: "פעם בשבוע",
    balcony_sizes: ["גדולה"],
    style_tags: ["ים-תיכוני", "קלאסי", "יוקרתי"],
    emoji: "🫒", bg: "#556B2F"
  },
  {
    id: 20, category: "צמחייה",
    name: "תאנה ננסית",
    description: "עץ פרי קטן ומטופח, פרי מתוק בסוף הקיץ",
    price: 129, sun_requirement: "שמש מלאה", water: "פעם בשבוע",
    balcony_sizes: ["גדולה"],
    style_tags: ["ים-תיכוני", "כפרי"],
    emoji: "🌳", bg: "#7B3F00"
  },
  {
    id: 21, category: "צמחייה",
    name: "ציקלמן חורפי",
    description: "פורח בחורף כשהכל שקט, מתאים לצל חלקי",
    price: 35, sun_requirement: "צל חלקי", water: "פעמיים בשבוע",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["קלאסי", "פרחוני"],
    emoji: "🌷", bg: "#9b59b6"
  },
  {
    id: 22, category: "צמחייה",
    name: "בוגנוויליה",
    description: "מטפס פורח בצבעים עזים, עמיד חום קיצוני",
    price: 89, sun_requirement: "שמש מלאה", water: "פעם בשבוע",
    balcony_sizes: ["בינונית", "גדולה"],
    style_tags: ["ים-תיכוני", "צבעוני"],
    emoji: "🌸", bg: "#e74c3c"
  },
  {
    id: 23, category: "צמחייה",
    name: "כלניות (10 בצלים)",
    description: "פורחות בסוף החורף, מרהיבות ומרגשות",
    price: 39, sun_requirement: "שמש מלאה", water: "פעם בשבוע",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["קלאסי", "ים-תיכוני"],
    emoji: "🌺", bg: "#e67e22"
  },
  {
    id: 24, category: "צמחייה",
    name: "טימין נוי",
    description: "עשב תיבול ריחני, גם לבישול וגם לנוי, עמיד מאוד",
    price: 25, sun_requirement: "שמש מלאה", water: "פעם בשבוע",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["כפרי", "ריחני", "ים-תיכוני"],
    emoji: "🌿", bg: "#27ae60"
  },
  {
    id: 25, category: "צמחייה",
    name: "מרווה סגולה",
    description: "שיח ריחני פורח בסגול, מושך דבורים וצופיות",
    price: 35, sun_requirement: "שמש מלאה", water: "פעם בשבוע",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: ["ים-תיכוני", "כפרי", "ריחני"],
    emoji: "💜", bg: "#8e44ad"
  },

  // ── אדמה ────────────────────────────────────────────────
  {
    id: 26, category: "אדמה",
    name: "אדמה אוניברסלית",
    description: "אדמה עשירה ומאוזנת, מתאימה לרוב צמחי הגינה",
    size: "20 ליטר", price: 49,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: [], emoji: "🪣", bg: "#795548"
  },
  {
    id: 27, category: "אדמה",
    name: "אדמה לצמחי מרפסת",
    description: "מנוסחת במיוחד לאדניות, ניקוז מעולה, לא מתייבשת מהר",
    size: "50 ליטר", price: 89,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: [], emoji: "🪣", bg: "#6d4c41"
  },
  {
    id: 28, category: "אדמה",
    name: "אדמה לצמחים ים-תיכוניים",
    description: "יבשה ומנוקזת, מתאימה ללבנדר, רוזמרין, זית",
    size: "10 ליטר", price: 39,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: [], emoji: "🪣", bg: "#8d6e63"
  },
  {
    id: 29, category: "אדמה",
    name: "קומפוסט אורגני",
    description: "דשן אורגני לחיזוק הצמחים, מועשר בחומרים מינרלים",
    size: "20 ליטר", price: 59,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: [], emoji: "♻️", bg: "#4e342e"
  },
  {
    id: 30, category: "אדמה",
    name: "חצץ ניקוז",
    description: "לשכבת ניקוז בתחתית האדנית, מונע ריקבון שורשים",
    size: "10 ליטר", price: 29,
    sun_requirement: "כל תנאי",
    balcony_sizes: ["קטנה", "בינונית", "גדולה"],
    style_tags: [], emoji: "⚪", bg: "#9e9e9e"
  }
];

// ── פונקציית סינון ──────────────────────────────────────
export function filterProducts(analysis: {
  balcony_size: string;
  sun_exposure: string;
  style: string;
}): Product[] {
  const { sun_exposure, balcony_size, style } = analysis;

  const matchesSun = (p: Product) => {
    if (p.sun_requirement === "כל תנאי") return true;
    if (sun_exposure === "שמש מלאה") return p.sun_requirement === "שמש מלאה";
    if (sun_exposure === "חצי צל") return ["חצי צל", "צל חלקי", "כל תנאי"].includes(p.sun_requirement);
    return true; // צל — כולם מתאימים
  };

  const matchesSize = (p: Product) =>
    p.balcony_sizes.includes(balcony_size as Product["balcony_sizes"][number]);

  const styleScore = (p: Product) => (p.style_tags.includes(style) ? 1 : 0);

  const plants = catalog
    .filter(p => p.category === "צמחייה" && matchesSun(p) && matchesSize(p))
    .sort((a, b) => styleScore(b) - styleScore(a))
    .slice(0, 3);

  const pots = catalog
    .filter(p => p.category === "אדניות" && matchesSize(p))
    .sort((a, b) => styleScore(b) - styleScore(a))
    .slice(0, 2);

  const soil = catalog
    .filter(p => p.category === "אדמה")
    .slice(0, 1);

  return [...plants, ...pots, ...soil];
}
