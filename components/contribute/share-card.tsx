"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * A contributor's share card, drawn in the visitor's browser (owner's request: "cards like
 * Spotify for Instagram and other social media").
 *
 * Why the browser and not the server: Next's image generator (Satori) does not join Devanagari
 * letters correctly, while the browser shapes Nepali names perfectly with the site's own fonts.
 * Nothing is uploaded; the PNG is made on the device. Two sizes: a 1080×1920 story and a
 * 1080×1080 post. "Share" opens the phone's share sheet with the image (Instagram, WhatsApp, …)
 * where the browser supports sharing files; otherwise it downloads.
 *
 * Look: the site's ink surface, flush-left type, square corners, red only for the accent rule.
 */

export interface CardData {
  handle: string;
  name: string;
  otherName: string | null;
  roles: string;
  /** Up to two lines like ["128", "commits"]. */
  highlights: [string, string][];
  since: string;
  photo: string | null;
  initial: string;
  kicker: string;
  tagline: string;
  /** "/ne/contribute/<handle>"; the card prints it after the host the visitor is on. */
  path: string;
  shareText: string;
}

const C = { ink: "#201e1d", bg: "#f3f2f2", n300: "#d7d3d3", n400: "#bab6b6", n500: "#9b9797", n700: "#605d5d", n800: "#444141", red: "#ff563c" };

type Format = "story" | "square";
const SIZE: Record<Format, [number, number]> = { story: [1080, 1920], square: [1080, 1080] };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Wraps text into at most `maxLines` lines of `width` px; the last line gets an ellipsis if cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
    return kept;
  }
  return lines;
}

/** The photo in greyscale (memorial and contributor photos are always black and white). */
function greyscale(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  // cover-crop to a square
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
  const d = g.getImageData(0, 0, size, size);
  for (let i = 0; i < d.data.length; i += 4) {
    const y = Math.min(255, (0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2] - 128) * 1.08 + 128);
    d.data[i] = d.data[i + 1] = d.data[i + 2] = y;
  }
  g.putImageData(d, 0, 0);
  return c;
}

function stripes(g: CanvasRenderingContext2D, x: number, y: number, size: number) {
  g.save();
  g.beginPath();
  g.rect(x, y, size, size);
  g.clip();
  g.fillStyle = C.n800;
  g.fillRect(x, y, size, size);
  g.strokeStyle = "#555151";
  g.lineWidth = 4;
  for (let k = -size; k < size * 2; k += 24) {
    g.beginPath();
    g.moveTo(x + k, y + size);
    g.lineTo(x + k + size, y);
    g.stroke();
  }
  g.restore();
}

async function drawCard(canvas: HTMLCanvasElement, data: CardData, format: Format, font: string, address: string) {
  const [W, H] = SIZE[format];
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const M = 96;
  const f = (weight: number, px: number) => `${weight} ${px}px ${font}`;

  // Fonts: make sure both scripts are loaded at the weights we draw with.
  const sample = `${data.name} ${data.otherName ?? ""} ${data.roles} ${data.tagline} ${data.kicker}`;
  await Promise.all([800, 600, 400].map((w) => document.fonts.load(f(w, 48), sample)));

  g.fillStyle = C.ink;
  g.fillRect(0, 0, W, H);
  g.textBaseline = "alphabetic";

  // Brand line and the red rule.
  g.fillStyle = C.n400;
  g.font = f(600, 30);
  g.fillText("SADAK SMRITI  ·  सडक स्मृति", M, M + 30);
  g.fillStyle = C.red;
  g.fillRect(M, M + 64, 120, 10);

  const story = format === "story";
  const photoSize = story ? 440 : 300;
  const photoY = M + 130;
  if (data.photo) {
    try {
      const img = await loadImage(data.photo);
      g.drawImage(greyscale(img, photoSize), M, photoY, photoSize, photoSize);
    } catch {
      stripes(g, M, photoY, photoSize);
    }
  } else {
    stripes(g, M, photoY, photoSize);
    g.fillStyle = C.n500;
    g.font = f(800, story ? 200 : 140);
    g.fillText(data.initial, M + 24, photoY + (story ? 200 : 140));
  }

  // Kicker, name, other script, roles.
  let y = story ? photoY + photoSize + 110 : photoY + photoSize + 90;
  g.fillStyle = C.n400;
  g.font = f(600, story ? 40 : 34);
  g.fillText(data.kicker, M, y);
  y += story ? 30 : 20;
  g.fillStyle = C.bg;
  g.font = f(800, story ? 104 : 76);
  // Two lines on a story; one on the square post, which has less height.
  for (const line of wrap(g, data.name, W - 2 * M, story ? 2 : 1)) {
    y += story ? 110 : 82;
    g.fillText(line, M, y);
  }
  if (data.otherName) {
    y += story ? 66 : 52;
    g.fillStyle = C.n500;
    g.font = f(400, story ? 52 : 40);
    g.fillText(data.otherName, M, y);
  }
  y += story ? 72 : 56;
  g.fillStyle = C.red;
  g.font = f(600, story ? 40 : 32);
  g.fillText(data.roles.toUpperCase(), M, y);

  // Highlights: big numbers, like a year-in-review card.
  if (story && data.highlights.length) {
    y += 70;
    g.fillStyle = C.n700;
    g.fillRect(M, y, W - 2 * M, 2);
    for (const [num, label] of data.highlights.slice(0, 2)) {
      y += 150;
      g.fillStyle = C.bg;
      g.font = f(800, 132);
      g.fillText(num, M, y);
      const w = g.measureText(num).width;
      g.fillStyle = C.n400;
      g.font = f(600, 44);
      g.fillText(label, M + w + 28, y);
    }
  } else if (!story && data.highlights.length) {
    // On the square card, one highlight sits to the right of the photo.
    const [num, label] = data.highlights[0];
    const x = M + photoSize + 56;
    g.fillStyle = C.bg;
    g.font = f(800, 120);
    g.fillText(num, x, photoY + 150);
    g.fillStyle = C.n400;
    g.font = f(600, 38);
    for (const [i, line] of wrap(g, label, W - x - M, 2).entries()) g.fillText(line, x, photoY + 210 + i * 46);
  }

  // Footer: the map of Nepal (story only) in the space left between the content and the footer,
  // never over text; left out when there isn't room.
  if (story) {
    const top = y + 70;
    const bottom = H - M - 200;
    try {
      const map = await loadImage("/map/base-ink.svg");
      const ratio = map.naturalHeight / map.naturalWidth || 0.58;
      const mw = Math.min(W - 2 * M, (bottom - top) / ratio);
      const mh = mw * ratio;
      if (mh >= 300) {
        g.globalAlpha = 0.85;
        g.drawImage(map, M, bottom - mh, mw, mh);
        g.globalAlpha = 1;
      }
    } catch {
      /* the card works without the map */
    }
  }
  g.fillStyle = C.n700;
  g.fillRect(M, H - M - 150, W - 2 * M, 2);
  g.fillStyle = C.bg;
  g.font = f(600, story ? 38 : 32);
  g.fillText(wrap(g, data.tagline, W - 2 * M, 1)[0], M, H - M - 90);
  g.fillStyle = C.n400;
  g.font = f(400, story ? 32 : 28);
  g.fillText(`${data.since}  ·  ${address}`, M, H - M - 36);
}

export function ShareCard({ data, labels }: { data: CardData; labels: { story: string; square: string; share: string; download: string; copyLink: string; copied: string; making: string } }) {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [format, setFormat] = useState<Format>("story");
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    (async () => {
      const canvas = document.createElement("canvas");
      await drawCard(canvas, data, format, getComputedStyle(document.body).fontFamily, `${location.host}${data.path}`);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!alive || !blob) return;
      blobRef.current = blob;
      url = URL.createObjectURL(blob);
      setPreview(url);
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [data, format]);

  if (!hydrated) return null;

  const fileName = `sadak-smriti-${data.handle}-${format}.png`;
  const download = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = fileName;
    a.click();
  };
  const share = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${data.shareText} ${location.origin}${data.path}` });
      } catch {
        /* the person closed the share sheet */
      }
    } else download();
  };
  const copy = async () => {
    await navigator.clipboard.writeText(`${location.origin}${data.path}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div role="radiogroup" className="flex">
        {(["story", "square"] as Format[]).map((fm) => (
          <button
            key={fm}
            type="button"
            role="radio"
            aria-checked={format === fm}
            onClick={() => setFormat(fm)}
            className="min-h-11 border-2 border-ink px-4 text-ui font-semibold aria-checked:bg-ink aria-checked:text-bg [&+&]:border-l-0"
          >
            {fm === "story" ? labels.story : labels.square}
          </button>
        ))}
      </div>
      <div className={`mt-4 border-2 border-ink bg-ink ${format === "story" ? "aspect-[9/16] w-[240px] sm:w-[270px]" : "aspect-square w-[300px]"}`}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, not an optimisable image
          <img src={preview} alt="" className="block size-full" />
        ) : (
          <p role="status" className="p-4 text-small text-neutral-400">{labels.making}</p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={share} disabled={!preview} className="btn btn-primary disabled:opacity-60">{labels.share}</button>
        <button type="button" onClick={download} disabled={!preview} className="btn btn-secondary disabled:opacity-60">{labels.download}</button>
        <button type="button" onClick={copy} className="btn btn-secondary" aria-live="polite">{copied ? labels.copied : labels.copyLink}</button>
      </div>
    </div>
  );
}
