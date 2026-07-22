import notoSansLatin from "../assets/fonts/noto-sans-latin.woff2";
import notoSerifLatin from "../assets/fonts/noto-serif-latin.woff2";

/**
 * Gates-aligned presentation tokens. These are intentionally separate from
 * the fixed scientific blue--near-white--red decision scale below.
 */
export const BRAND_COLORS = {
  parchment: "#F5F3ED",
  weatheredSlate: "#313A44",
  bloomingSaffron: "#EBCB00",
  white: "#FFFFFF",
  dvMediumOrange: "#F85C02",
  dvDarkMagenta: "#6C1446",
  dvDarkTurquoise: "#295958",
  dvDarkBlue: "#12236D",
  dvDarkOrange: "#9B320D",
  dvDarkRed: "#771109"
} as const;

/** The contract-defined R_loc color scale; do not substitute brand colors. */
export const SCIENTIFIC_SURFACE_COLORS = {
  belowThreshold: "#2166AC",
  threshold: "#F7F7F2",
  aboveThreshold: "#B2182B"
} as const;

export const BRAND_FONT_FAMILIES = {
  sans: '"Noto Sans", Arial, sans-serif',
  serif: '"Noto Serif", Georgia, serif'
} as const;

export function brandFontFaceCss(): string {
  return `@font-face{font-family:"Noto Sans";font-style:normal;font-weight:400 800;font-display:swap;src:url(${notoSansLatin}) format("woff2")}@font-face{font-family:"Noto Serif";font-style:normal;font-weight:400 600;font-display:swap;src:url(${notoSerifLatin}) format("woff2")}`;
}

export function installBrandFonts(document: Document): void {
  if (document.getElementById("brand-font-faces")) return;
  const style = document.createElement("style");
  style.id = "brand-font-faces";
  style.textContent = brandFontFaceCss();
  document.head.append(style);
}
