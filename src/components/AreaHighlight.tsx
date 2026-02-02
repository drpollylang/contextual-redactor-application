import React, { CSSProperties, MouseEvent } from "react";

// import { getPageFromElement } from "../lib/pdfjs-dom";

import "../style/AreaHighlight.css";

import { Rnd } from "react-rnd";
// import type { LTWHP, ViewportHighlight, Tip } from "../types";
import type { LTWHP, ViewportHighlight } from "../types";
import { CommentedHighlight } from "../../app/src/types";
import { getHighlightColor } from "../../app/src/helpers/color";
import { scaledToViewportRect } from "../../app/src/helpers/convertScaledToViewport";

/**
 * The props type for {@link AreaHighlight}.
 *
 * @category Component Properties
 */
export interface AreaHighlightProps {
  /**
   * The highlight to be rendered as an {@link AreaHighlight}.
   */
  highlight: ViewportHighlight;

  /**
   * A callback triggered whenever the highlight area is either finished
   * being moved or resized.
   *
   * @param rect - The updated highlight area.
   */
  onChange?(rect: LTWHP): void;

  /**
   * Has the highlight been auto-scrolled into view? By default, this will render the highlight red.
   */
  isScrolledTo?: boolean;

  /**
   * react-rnd bounds on the highlight area. This is useful for preventing the user
   * moving the highlight off the viewer/page.  See [react-rnd docs](https://github.com/bokuweb/react-rnd).
   */
  bounds?: string | Element;

  /**
   * A callback triggered whenever a context menu is opened on the highlight area.
   *
   * @param event - The mouse event associated with the context menu.
   */
  onContextMenu?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Event called whenever the user tries to move or resize an {@link AreaHighlight}.
   */
  onEditStart?(): void;

  /**
   * Custom styling to be applied to the {@link AreaHighlight} component.
   */
  style?: CSSProperties;
}

/**
 * Renders a resizeable and interactive rectangular area for a highlight.
 *
 * @category Component
 */
// export const AreaHighlight = ({
//   highlight,
//   onChange,
//   isScrolledTo,
//   bounds,
//   onContextMenu,
//   onEditStart,
//   style,
// }: AreaHighlightProps) => {
//   const highlightClass = isScrolledTo ? "AreaHighlight--scrolledTo" : "";

//   // Generate key based on position. This forces a remount (and a defaultpos update)
//   // whenever highlight position changes (e.g., when updated, scale changes, etc.)
//   // We don't use position as state because when updating Rnd this would happen and cause flickering:
//   // User moves Rnd -> Rnd records new pos -> Rnd jumps back -> highlight updates -> Rnd re-renders at new pos
//   const key = `${highlight.position.boundingRect.width}${highlight.position.boundingRect.height}${highlight.position.boundingRect.left}${highlight.position.boundingRect.top}`;

//   return (
//     <div
//       className={`AreaHighlight ${highlightClass}`}
//       onContextMenu={onContextMenu}
//     >
//       <Rnd
//         className="AreaHighlight__part"
//         onDragStop={(_, data) => {
//           const boundingRect: LTWHP = {
//             ...highlight.position.boundingRect,
//             top: data.y,
//             left: data.x,
//           };

//           onChange && onChange(boundingRect);
//         }}
//         onResizeStop={(_mouseEvent, _direction, ref, _delta, position) => {
//           const boundingRect: LTWHP = {
//             top: position.y,
//             left: position.x,
//             width: ref.offsetWidth,
//             height: ref.offsetHeight,
//             pageNumber: getPageFromElement(ref)?.number || -1,
//           };

//           onChange && onChange(boundingRect);
//         }}
//         onDragStart={onEditStart}
//         onResizeStart={onEditStart}
//         default={{
//           x: highlight.position.boundingRect.left,
//           y: highlight.position.boundingRect.top,
//           width: highlight.position.boundingRect.width,
//           height: highlight.position.boundingRect.height,
//         }}
//         key={key}
//         bounds={bounds}
//         // Prevevent any event clicks as clicking is already used for movement
//         onClick={(event: Event) => {
//           event.stopPropagation();
//           event.preventDefault();
//         }}
//         style={style}
//       />
//     </div>
//   );
// };

export const AreaHighlight = ({
  highlight,
  onChange,
  isScrolledTo,
  bounds,
  onContextMenu,
  onEditStart,
  style,
}: {
  highlight: CommentedHighlight;
  onChange?: (rect: LTWHP) => void;
  isScrolledTo: boolean;
  bounds: any;
  onContextMenu: any;
  onEditStart: any;
  style: React.CSSProperties;
}) => {
  // const { boundingRect } = highlight.position;
  const highlightClass = isScrolledTo ? "AreaHighlight--scrolledTo" : "";
  
  // CONVERT scaled → viewport
  const vp = scaledToViewportRect(highlight.position.boundingRect);
  const color = getHighlightColor(highlight);
  // const key = `${boundingRect.width}${boundingRect.height}${boundingRect.left}${boundingRect.top}`;

  return (
      <div
        className={`AreaHighlight ${highlightClass}`}
        onContextMenu={onContextMenu}
      >
        <Rnd
          className="AreaHighlight__part"
          default={{
            x: vp.left,
            y: vp.top,
            width: vp.width,
            height: vp.height
          }}
          bounds={bounds}
          onDragStop={(_, data) => {
            onChange &&
              onChange({
                top: data.y,
                left: data.x,
                width: vp.width,
                height: vp.height,
                pageNumber: vp.pageNumber
              });
          }}
          onResizeStop={(_e, _d, ref, _delta, pos) => {
            onChange &&
              onChange({
                top: pos.y,
                left: pos.x,
                width: ref.offsetWidth,
                height: ref.offsetHeight,
                pageNumber: vp.pageNumber
              });
          }}
          onDragStart={onEditStart}
          onResizeStart={onEditStart}
          style={{
            background: color,
            opacity: 0.35,
            borderRadius: 2,
            ...style
          }}
        />
      </div>
    );

  // // Tooltip
  // const tip: Tip = {
  //   position: highlight.position,
  //   content: (
  //     <div
  //       style={{
  //         background: "white",
  //         padding: "6px 10px",
  //         borderRadius: 4,
  //         boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
  //         maxWidth: 300,
  //       }}
  //     >
  //       {highlight.label ?? highlight.comment ?? ""}
  //     </div>
  //   ),
  // };

  // return (
  //   <div
  //     className={`AreaHighlight ${highlightClass}`}
  //     onContextMenu={onContextMenu}
  //   >
  //     <Rnd
  //       className="AreaHighlight__part"
  //       onMouseEnter={() => {
  //         // Show tooltip via the same mechanism TextHighlight uses
  //         (onContextMenu as any)?.({ tip });
  //       }}
  //       onMouseLeave={() => {
  //         // hide tip
  //         (onContextMenu as any)?.({ tip: null });
  //       }}
  //       onDragStop={(_, data) => {
  //         const rect: LTWHP = {
  //           ...boundingRect,
  //           top: data.y,
  //           left: data.x,
  //         };
  //         onChange && onChange(rect);
  //       }}
  //       onResizeStop={(_e, _d, ref, _delta, pos) => {
  //         const rect: LTWHP = {
  //           top: pos.y,
  //           left: pos.x,
  //           width: ref.offsetWidth,
  //           height: ref.offsetHeight,
  //           pageNumber: getPageFromElement(ref)?.number || -1,
  //         };
  //         onChange && onChange(rect);
  //       }}
  //       onDragStart={onEditStart}
  //       onResizeStart={onEditStart}
  //       default={{
  //         x: boundingRect.left,
  //         y: boundingRect.top,
  //         width: boundingRect.width,
  //         height: boundingRect.height,
  //       }}
  //       key={key}
  //       bounds={bounds}
  //       style={{
  //         background: color,
  //         opacity: 0.35,
  //         borderRadius: 2,
  //         ...style,
  //       }}
  //     />
  //   </div>
  // );
};