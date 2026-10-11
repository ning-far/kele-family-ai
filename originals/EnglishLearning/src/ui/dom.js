/**
 * Tiny DOM helpers — no framework, just enough sugar to keep modules readable.
 */

/** Hyperscript-lite: el('div', {class:'x'}, [child, 'text']). */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "disabled") node.disabled = !!v;
    else node.setAttribute(k, String(v));
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

let toastEl = null;
let toastTimer = null;
export function toast(msg, ms = 1800) {
  if (!toastEl) {
    toastEl = el("div", { class: "toast" });
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove("show"), ms);
}

/** 吉祥物「呱啦叽哩 Gua La Ji Li」——一只可爱的绿色小青蛙。 */
export const MASCOT = `
<svg class="mascot bob" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gua La Ji Li mascot">
  <!-- 身体 -->
  <ellipse cx="80" cy="100" rx="46" ry="38" fill="#74d39a" stroke="#5cbf86" stroke-width="3"/>
  <!-- 肚皮 -->
  <ellipse cx="80" cy="108" rx="28" ry="22" fill="#eafaef"/>
  <!-- 大眼睛 -->
  <circle cx="58" cy="54" r="18" fill="#fff" stroke="#5cbf86" stroke-width="3"/>
  <circle cx="102" cy="54" r="18" fill="#fff" stroke="#5cbf86" stroke-width="3"/>
  <circle cx="62" cy="54" r="8" fill="#4a4458"/>
  <circle cx="98" cy="54" r="8" fill="#4a4458"/>
  <circle cx="64" cy="52" r="3" fill="#fff"/>
  <circle cx="100" cy="52" r="3" fill="#fff"/>
  <!-- 腮红 -->
  <circle cx="48" cy="92" r="7" fill="#ff8fb8" opacity="0.6"/>
  <circle cx="112" cy="92" r="7" fill="#ff8fb8" opacity="0.6"/>
  <!-- 微笑 -->
  <path d="M64 84 q16 14 32 0" stroke="#4a4458" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- 头顶星星 -->
  <path d="M80 10 L85 24 L100 24 L88 33 L93 47 L80 38 L67 47 L72 33 L60 24 L75 24 Z" fill="#ffd56b" stroke="#ffb14d" stroke-width="2" stroke-linejoin="round"/>
  <!-- 小手 -->
  <ellipse cx="38" cy="100" rx="10" ry="7" fill="#74d39a" stroke="#5cbf86" stroke-width="2"/>
  <ellipse cx="122" cy="100" rx="10" ry="7" fill="#74d39a" stroke="#5cbf86" stroke-width="2"/>
</svg>`;

/** Build an option/picture card (used by listening + vocabulary). */
export function pictureCard(iconSvg, label, onClick) {
  return el("button", { class: "choice", onClick }, [
    el("div", { class: "picture", html: iconSvg }),
    label ? el("div", { class: "label", text: label }) : null,
  ]);
}
