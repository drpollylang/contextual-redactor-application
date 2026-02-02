import React, { CSSProperties, MouseEvent } from "react";

import "../style/TextHighlight.css";

import type { ViewportHighlight } from "../types";

import { getHighlightColor } from "../../app/src/helpers/color";

// import { Tip } from "../../app/src/react-pdf-highlighter-extended"; 
import type { CommentedHighlight } from "../../app/src/types";
import { scaledRectToViewportRect } from "../../app/src/helpers/convertScaledToViewport";
/**
 * The props type for {@link TextHighlight}.
 *
 * @category Component Properties
 */
export interface TextHighlightProps {
  /**
   * Highlight to render over text.
   */
  highlight: ViewportHighlight;

  /**
   * Callback triggered whenever the user clicks on the part of a highlight.
   *
   * @param event - Mouse event associated with click.
   */
  onClick?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Callback triggered whenever the user enters the area of a text highlight.
   *
   * @param event - Mouse event associated with movement.
   */
  onMouseOver?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Callback triggered whenever the user leaves  the area of a text highlight.
   *
   * @param event - Mouse event associated with movement.
   */
  onMouseOut?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Indicates whether the component is autoscrolled into view, affecting
   * default theming.
   */
  isScrolledTo: boolean;

  /**
   * Callback triggered whenever the user tries to open context menu on highlight.
   *
   * @param event - Mouse event associated with click.
   */
  onContextMenu?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Optional CSS styling applied to each TextHighlight part.
   */
  style?: CSSProperties;
}

/**
 * A component for displaying a highlighted text area.
 *
 * @category Component
 */
// export const TextHighlight = ({
//   highlight,
//   onClick,
//   onMouseOver,
//   onMouseOut,
//   isScrolledTo,
//   onContextMenu,
//   style,
// }: TextHighlightProps) => {
//   const highlightClass = isScrolledTo ? "TextHighlight--scrolledTo" : "";
//   const { rects } = highlight.position;

//   return (
//     <div
//       className={`TextHighlight ${highlightClass}`}
//       onContextMenu={onContextMenu}
//     >
//       <div className="TextHighlight__parts">
//         {rects.map((rect, index) => (
//           <div
//             onMouseOver={onMouseOver}
//             onMouseOut={onMouseOut}
//             onClick={onClick}
//             key={index}
//             style={{ ...rect, ...style }}
//             className={`TextHighlight__part`}
//           />
//         ))}
//       </div>
//     </div>
//   );
// };

export const TextHighlight = ({
  highlight,
  onClick,
  onMouseOver,
  onMouseOut,
  isScrolledTo,
  onContextMenu,
  style,
}: {
  highlight: CommentedHighlight;
  onClick: any;
  onMouseOver: any;
  onMouseOut: any;
  isScrolledTo: boolean;
  onContextMenu: any;
  style: React.CSSProperties;
}) => {
  const highlightClass = isScrolledTo ? "TextHighlight--scrolledTo" : "";
  const { rects } = highlight.position;

  return (
    <div
      className={`TextHighlight ${highlightClass}`}
      onContextMenu={onContextMenu}
    >
      <div className="TextHighlight__parts">
        {rects.map((r, index) => {
          const vp = scaledRectToViewportRect(r);
          const color = getHighlightColor(highlight);

          // Create tooltip content using label
        //   const tip: Tip = {
        //     position: highlight.position,
        //     content: (
        //       <div
        //         style={{
        //           background: "white",
        //           padding: "6px 10px",
        //           borderRadius: 4,
        //           boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        //           maxWidth: 300,
        //         }}
        //       >
        //         {highlight.label ?? highlight.comment ?? ""}
        //       </div>
        //     ),
        //   };

        //   return (
        //     <div
        //       key={index}
        //       onMouseOver={(e) => {
        //         onMouseOver && onMouseOver({ tip });
        //       }}
        //       onMouseOut={onMouseOut}
        //       onClick={onClick}
        //       style={{
        //         position: "absolute",
        //         left: r.left,
        //         top: r.top,
        //         width: r.width,
        //         height: r.height,
        //         background: color,
        //         opacity: 0.35,
        //         borderRadius: 2,
        //         ...style,
        //       }}
        //       className="TextHighlight__part"
        //     />
        //   );
        // })
        
          return (
            <div
              key={index}
              onMouseOver={onMouseOver}
              onMouseOut={onMouseOut}
              onClick={onClick}
              className="TextHighlight__part"
              style={{
                position: "absolute",
                left: vp.left,
                top: vp.top,
                width: vp.width,
                height: vp.height,
                background: color,
                opacity: 0.35,
                borderRadius: 2,
                ...style
              }}
            />
          );
        })};
      </div>
    </div>
  );
};