// src/lib/pdfRedactor.ts
import { PDFDocument } from "pdf-lib";

export type ViewportSize = { width: number; height: number };
export type ScaledRect = {
  x1: number; y1: number; x2: number; y2: number;
  width: number; height: number; pageNumber: number;
};
export type HighlightLike = {
  position: {
    boundingRect: ScaledRect;
    rects?: ScaledRect[];
  };
};

/**
 * Convert your ScaledPosition rect (in viewer coords) into pixel coords
 * for a given export viewport (pdf.js viewport with scale).
 */
function toPixelRect(rect: ScaledRect, exportViewport: ViewportSize) {
  const factor = exportViewport.width / rect.width; // rect.width is the viewer width the rect was created against
  const left = rect.x1 * factor;
  const top = rect.y1 * factor;
  const width = (rect.x2 - rect.x1) * factor;
  const height = (rect.y2 - rect.y1) * factor;
  return { left, top, width, height };
}

function rectsForHighlight(h: HighlightLike): ScaledRect[] {
  if (h?.position?.rects && h.position.rects.length > 0) {
    return h.position.rects;
  }
  return h?.position?.boundingRect ? [h.position.boundingRect] : [];
}

async function renderPageToCanvas(page: any, scale = 2.0): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

function paintBlackBoxes(
  ctx: CanvasRenderingContext2D,
  exportViewport: ViewportSize,
  rects: ScaledRect[]
) {
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.globalAlpha = 1.0;
  for (const r of rects) {
    const px = toPixelRect(r, exportViewport);
    // Clip to canvas bounds (safety)
    const x = Math.max(0, Math.floor(px.left));
    const y = Math.max(0, Math.floor(px.top));
    const w = Math.max(0, Math.ceil(px.width));
    const h = Math.max(0, Math.ceil(px.height));
    if (w > 0 && h > 0) ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

async function canvasesToPdf(canvases: HTMLCanvasElement[], quality = 0.92) {
  const pdf = await PDFDocument.create();

  for (const canvas of canvases) {
    // JPEG is usually smaller and sufficient for black bars + scanned look
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const bytes = atob(dataUrl.split(",")[1]);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);

    const img = await pdf.embedJpg(buf);
    const page = pdf.addPage([canvas.width, canvas.height]);
    page.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  }

    // Normalize to ArrayBuffer for BlobPart compatibility across TS versions
    const u8 = await pdf.save(); // Uint8Array

    // Create a new ArrayBuffer so TS knows it's not SharedArrayBuffer
    const ab = new ArrayBuffer(u8.length);
    new Uint8Array(ab).set(u8);

    // Now TS is happy, and BlobPart is correct
    return new Blob([ab], { type: "application/pdf" });
}

/**
 * Redact a single PDF.js document by drawing black rectangles over the active highlights,
 * rasterizing the content so underlying text is truly gone.
 *
 * @param pdfDocument  PDF.js PDFDocumentProxy
 * @param activeByPage Map of pageNumber -> list of highlight rects for that page
 * @param scale        Export scale (2.0 is a good default)
 */
export async function buildRedactedBlobFromPdfjsDoc(
  pdfDocument: any,
  activeByPage: Map<number, ScaledRect[]>,
  scale = 2.0
): Promise<Blob> {
  const pageCount = pdfDocument.numPages as number;
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await pdfDocument.getPage(pageNumber);
    const canvas = await renderPageToCanvas(page, scale);
    const ctx = canvas.getContext("2d")!;
    const exportViewport: ViewportSize = { width: canvas.width, height: canvas.height };

    const rects = activeByPage.get(pageNumber) ?? [];
    if (rects.length > 0) {
      paintBlackBoxes(ctx, exportViewport, rects);
    }
    canvases.push(canvas);
  }

  const blob = await canvasesToPdf(canvases);
  return blob;
}

/**
 * Helper to group your highlights into a page-indexed map of rects.
 */
export function groupActiveRectsByPage(highlights: HighlightLike[]) {
  const map = new Map<number, ScaledRect[]>();
  for (const h of highlights) {
    for (const r of rectsForHighlight(h)) {
      const arr = map.get(r.pageNumber) ?? [];
      arr.push(r);
      map.set(r.pageNumber, arr);
    }
  }
  return map;
}