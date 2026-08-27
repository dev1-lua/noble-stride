"use client";
// Signature capture for the click-wrap NDA (F3.2, Aika's Draw / Type / Upload
// pattern from §2c).
//
// Whatever the tab, the output is one thing: a PNG data URL in a hidden input
// named `signatureImage`, which the server re-validates with
// isSignatureDataUrl() before storing it on the envelope. Nothing here is
// trusted — the pad is a convenience, not a gate.
//
// Everything is re-encoded through a canvas, so an uploaded JPEG becomes a PNG
// and an oversized image is caught by the same byte bound the server applies.

import { useCallback, useEffect, useRef, useState } from "react";
import { SIGNATURE_MAX_BYTES, isSignatureDataUrl } from "@/lib/nda/standard-nda";

type Tab = "draw" | "type" | "upload";

const TABS: { id: Tab; label: string }[] = [
  { id: "draw", label: "Draw" },
  { id: "type", label: "Type" },
  { id: "upload", label: "Upload" },
];

const PAD_W = 520;
const PAD_H = 160;

const TAB_BASE =
  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

/** Trim a canvas to its inked bounding box so a signature is not mostly whitespace. */
function trimmedPng(source: HTMLCanvasElement): string | null {
  const ctx = source.getContext("2d");
  if (!ctx) return null;
  const { width, height } = source;
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nothing drawn
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")?.drawImage(source, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

export function SignaturePad({ defaultName = "" }: { defaultName?: string }) {
  const [tab, setTab] = useState<Tab>("draw");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState(defaultName);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(false);

  const accept = useCallback((dataUrl: string | null) => {
    if (!dataUrl) {
      setValue("");
      return;
    }
    if (!isSignatureDataUrl(dataUrl)) {
      setValue("");
      setError(
        dataUrl.length > SIGNATURE_MAX_BYTES
          ? "That signature image is too large. Try a smaller image, or draw it instead."
          : "We couldn't read that as a signature image.",
      );
      return;
    }
    setError(null);
    setValue(dataUrl);
  }, []);

  // The canvas needs a device-pixel backing store or the stroke looks soft.
  useEffect(() => {
    if (tab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = PAD_W * ratio;
    canvas.height = PAD_H * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    inked.current = false;
  }, [tab]);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * PAD_W,
      y: ((e.clientY - rect.top) / rect.height) * PAD_H,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A tap with no movement should still leave a mark.
    ctx.lineTo(x + 0.1, y);
    ctx.stroke();
    inked.current = true;
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && inked.current) accept(trimmedPng(canvas));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    inked.current = false;
    accept(null);
    setError(null);
  }

  /** Render a typed name in a cursive stack onto an off-screen canvas. */
  function renderTyped(name: string) {
    const trimmed = name.trim();
    setTyped(name);
    if (!trimmed) {
      accept(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = PAD_W * 2;
    canvas.height = PAD_H * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = '96px "Segoe Script", "Brush Script MT", "Apple Chancery", cursive';
    ctx.fillStyle = "#111827";
    ctx.textBaseline = "middle";
    ctx.fillText(trimmed, 24, canvas.height / 2);
    accept(trimmedPng(canvas));
  }

  async function fromFile(file: File | undefined) {
    if (!file) {
      accept(null);
      return;
    }
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setValue("");
      setError("Please choose a PNG or JPEG image of your signature.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("decode"));
        el.src = url;
      });
      // Re-encode at a bounded size: this is what keeps a 4 MB photo out of a text column.
      const scale = Math.min(1, PAD_W / img.width, PAD_H / img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      accept(canvas.toDataURL("image/png"));
    } catch {
      setValue("");
      setError("We couldn't read that image.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div data-testid="signature-pad">
      <input type="hidden" name="signatureImage" value={value} />

      <div className="flex gap-1.5" role="tablist" aria-label="Signature method">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            data-testid={`sig-tab-${t.id}`}
            onClick={() => {
              setTab(t.id);
              setError(null);
              accept(null);
            }}
            className={
              TAB_BASE +
              (tab === t.id
                ? " bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
                : " border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "draw" && (
          <div>
            <canvas
              ref={canvasRef}
              data-testid="sig-canvas"
              aria-label="Signature drawing area"
              style={{ width: PAD_W, height: PAD_H, maxWidth: "100%", touchAction: "none" }}
              className="rounded-md border border-dashed border-[var(--border-strong)] bg-white"
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
              onPointerCancel={end}
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                data-testid="sig-clear"
                onClick={clear}
                className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]"
              >
                Clear
              </button>
              <span className="text-[11px] text-[var(--text-tertiary)]">Sign with a mouse, trackpad or finger.</span>
            </div>
          </div>
        )}

        {tab === "type" && (
          <div>
            <input
              type="text"
              data-testid="sig-typed"
              value={typed}
              onChange={(e) => renderTyped(e.target.value)}
              placeholder="Type your full name"
              className="w-full max-w-md rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
              Your name is rendered as a signature image. Typing it counts as your signature.
            </p>
          </div>
        )}

        {tab === "upload" && (
          <div>
            <input
              type="file"
              accept="image/png,image/jpeg"
              data-testid="sig-file"
              onChange={(e) => void fromFile(e.target.files?.[0])}
              className="text-xs text-[var(--text-secondary)]"
            />
            <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
              A PNG or JPEG of your signature. It is resized and re-saved as a PNG.
            </p>
          </div>
        )}
      </div>

      {value && (
        <div className="mt-3" data-testid="sig-preview">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Your signature</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Your signature"
            className="mt-1 max-h-20 rounded border border-[var(--border-subtle)] bg-white p-1"
          />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[var(--t-tag-text-rose)]">{error}</p>}
    </div>
  );
}
