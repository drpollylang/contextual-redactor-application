import { ScaledPosition } from "../../../src/types";

export function scaledToViewportRect(scaled: ScaledPosition["boundingRect"]) {
  return {
    left: scaled.x1,
    top: scaled.y1,
    width: scaled.x2 - scaled.x1,
    height: scaled.y2 - scaled.y1,
    pageNumber: scaled.pageNumber
  };
}

export function scaledRectToViewportRect(rect: any) {
  return {
    left: rect.x1,
    top: rect.y1,
    width: rect.x2 - rect.x1,
    height: rect.y2 - rect.y1,
    pageNumber: rect.pageNumber
  };
}