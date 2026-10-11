/**
 * Cute inline SVG illustrations for vocabulary words.
 *
 * Each entry returns a self-contained <svg> string (viewBox 0 0 100 100),
 * drawn with soft pastel fills so no external image assets are needed
 * (keeps the project on D:, zero binary downloads). Icons are intentionally
 * simple and high-contrast so young children recognise them instantly.
 */

const wrap = (inner) =>
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;

export const ICONS = {
  apple: wrap(`
    <path d="M50 30 C40 22 26 26 26 42 C26 60 40 78 50 78 C60 78 74 60 74 42 C74 26 60 22 50 30 Z" fill="#ff7a8a"/>
    <path d="M50 30 C50 22 54 16 62 14" stroke="#7a5a3a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M58 18 C66 12 76 16 74 26 C66 28 60 24 58 18 Z" fill="#74d39a"/>
    <ellipse cx="40" cy="48" rx="6" ry="9" fill="#ffffff" opacity="0.5"/>`),

  banana: wrap(`
    <path d="M22 30 C30 60 55 80 82 74 C70 70 52 60 40 44 C32 33 26 28 22 30 Z" fill="#ffd56b"/>
    <path d="M22 30 C30 60 55 80 82 74" stroke="#e0a93b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M20 28 C18 22 22 18 28 20" stroke="#7a5a3a" stroke-width="4" fill="none" stroke-linecap="round"/>`),

  cat: wrap(`
    <path d="M28 36 L22 16 L42 30 Z" fill="#b89cff"/>
    <path d="M72 36 L78 16 L58 30 Z" fill="#b89cff"/>
    <circle cx="50" cy="54" r="26" fill="#cbb6ff"/>
    <circle cx="41" cy="50" r="4" fill="#4a4458"/><circle cx="59" cy="50" r="4" fill="#4a4458"/>
    <path d="M50 58 l-4 4 h8 z" fill="#ff8fb8"/>
    <path d="M50 62 v5" stroke="#4a4458" stroke-width="2"/>
    <path d="M30 58 h14 M30 64 h14 M70 58 h-14 M70 64 h-14" stroke="#9a8fc0" stroke-width="1.5"/>`),

  dog: wrap(`
    <path d="M26 34 C16 30 14 50 26 54 Z" fill="#d9a066"/>
    <path d="M74 34 C84 30 86 50 74 54 Z" fill="#d9a066"/>
    <circle cx="50" cy="52" r="26" fill="#e9b87d"/>
    <circle cx="41" cy="48" r="4" fill="#4a4458"/><circle cx="59" cy="48" r="4" fill="#4a4458"/>
    <ellipse cx="50" cy="60" rx="6" ry="4" fill="#4a4458"/>
    <path d="M50 64 v4" stroke="#4a4458" stroke-width="2"/>`),

  sun: wrap(`
    <g stroke="#ffce4d" stroke-width="5" stroke-linecap="round">
      <path d="M50 8 v12 M50 80 v12 M8 50 h12 M80 50 h12 M20 20 l8 8 M72 72 l8 8 M80 20 l-8 8 M28 72 l-8 8"/>
    </g>
    <circle cx="50" cy="50" r="22" fill="#ffd56b"/>`),

  star: wrap(`<path d="M50 12 L61 38 L89 40 L67 59 L75 86 L50 71 L25 86 L33 59 L11 40 L39 38 Z" fill="#ffd56b"/>`),

  book: wrap(`
    <rect x="20" y="24" width="60" height="52" rx="6" fill="#6db7ff"/>
    <rect x="20" y="24" width="12" height="52" rx="4" fill="#4f97e0"/>
    <path d="M40 40 h28 M40 50 h28 M40 60 h20" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>`),

  ball: wrap(`
    <circle cx="50" cy="50" r="28" fill="#74d39a"/>
    <path d="M50 22 a28 28 0 0 1 0 56 M50 22 a28 28 0 0 0 0 56 M22 50 h56" stroke="#ffffff" stroke-width="3" fill="none"/>`),

  car: wrap(`
    <path d="M20 60 L26 44 h34 l10 16 h10 v12 h-8 a8 8 0 0 1 -16 0 h-16 a8 8 0 0 1 -16 0 h-4 Z" fill="#ff8fb8"/>
    <circle cx="34" cy="72" r="7" fill="#4a4458"/><circle cx="66" cy="72" r="7" fill="#4a4458"/>
    <rect x="30" y="48" width="12" height="8" rx="2" fill="#cdefff"/>`),

  flower: wrap(`
    <g fill="#ff9ec4">
      <circle cx="50" cy="28" r="12"/><circle cx="72" cy="44" r="12"/>
      <circle cx="62" cy="68" r="12"/><circle cx="38" cy="68" r="12"/><circle cx="28" cy="44" r="12"/>
    </g>
    <circle cx="50" cy="50" r="12" fill="#ffd56b"/>
    <path d="M50 62 v22" stroke="#74d39a" stroke-width="5" stroke-linecap="round"/>`),

  fish: wrap(`
    <path d="M20 50 C30 34 60 34 72 50 C60 66 30 66 20 50 Z" fill="#6db7ff"/>
    <path d="M72 50 l16 -12 v24 z" fill="#4f97e0"/>
    <circle cx="34" cy="46" r="4" fill="#ffffff"/><circle cx="34" cy="46" r="2" fill="#4a4458"/>
    <path d="M40 54 q8 4 16 0" stroke="#3d7fc0" stroke-width="2" fill="none"/>`),

  cow: wrap(`
    <circle cx="50" cy="52" r="26" fill="#f4f4f4"/>
    <path d="M30 30 l-6 -12 12 6 z M70 30 l6 -12 -12 6 z" fill="#caa"/>
    <ellipse cx="40" cy="46" rx="7" ry="5" fill="#4a4458"/><ellipse cx="60" cy="46" rx="7" ry="5" fill="#4a4458"/>
    <ellipse cx="50" cy="62" rx="7" ry="5" fill="#ff9ec4"/>
    <ellipse cx="36" cy="62" rx="6" ry="5" fill="#9a8fc0"/><ellipse cx="64" cy="62" rx="6" ry="5" fill="#9a8fc0"/>`),

  bird: wrap(`
    <circle cx="48" cy="52" r="22" fill="#74d39a"/>
    <path d="M30 52 a18 18 0 0 0 36 0 z" fill="#5cbf86"/>
    <path d="M70 50 l14 -4 -14 8 z" fill="#ffb14d"/>
    <circle cx="42" cy="46" r="4" fill="#4a4458"/>
    <path d="M48 70 q10 6 18 0" stroke="#4a4458" stroke-width="2" fill="none"/>`),

  tree: wrap(`
    <path d="M50 78 v-18" stroke="#a9744f" stroke-width="7" stroke-linecap="round"/>
    <circle cx="50" cy="42" r="24" fill="#74d39a"/>
    <circle cx="34" cy="52" r="14" fill="#5cbf86"/><circle cx="66" cy="52" r="14" fill="#5cbf86"/>`),

  house: wrap(`
    <path d="M22 46 L50 22 L78 46 Z" fill="#ff8fb8"/>
    <rect x="30" y="46" width="40" height="34" rx="3" fill="#ffe3ec"/>
    <rect x="44" y="58" width="12" height="22" rx="2" fill="#b89cff"/>
    <rect x="34" y="52" width="9" height="9" rx="1" fill="#6db7ff"/>
    <rect x="57" y="52" width="9" height="9" rx="1" fill="#6db7ff"/>`),

  milk: wrap(`
    <rect x="38" y="28" width="24" height="12" rx="2" fill="#cdefff"/>
    <path d="M38 40 h24 v30 a6 6 0 0 1 -6 6 h-12 a6 6 0 0 1 -6 -6 Z" fill="#ffffff" stroke="#cdefff" stroke-width="2"/>
    <rect x="42" y="50" width="16" height="14" rx="2" fill="#6db7ff"/>`),

  water: wrap(`
    <path d="M50 18 C40 38 34 50 34 62 a16 16 0 0 0 32 0 C66 50 60 38 50 18 Z" fill="#6db7ff"/>
    <path d="M44 60 a6 6 0 0 0 6 6" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/>`),
};

export function icon(name) {
  return ICONS[name] || ICONS.star;
}
