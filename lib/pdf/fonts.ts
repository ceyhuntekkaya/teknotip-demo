import { Font } from "@react-pdf/renderer";

let registered = false;

export function registerPdfFonts(origin: string): void {
  if (registered) return;
  const base = origin.replace(/\/$/, "");
  Font.register({
    family: "IBM Plex Sans",
    fonts: [
      { src: `${base}/fonts/IBMPlexSans-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/fonts/IBMPlexSans-Bold.ttf`, fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
