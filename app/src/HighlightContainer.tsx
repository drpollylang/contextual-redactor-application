// import React, { MouseEvent } from "react";
// import HighlightPopup from "./HighlightPopup";
// import {
//   AreaHighlight,
//   MonitoredHighlightContainer,
//   TextHighlight,
//   Tip,
//   ViewportHighlight,
//   useHighlightContainerContext,
//   usePdfHighlighterContext,
// } from "./react-pdf-highlighter-extended";
// import { CommentedHighlight } from "./types";

// interface HighlightContainerProps {
//   editHighlight: (
//     idToUpdate: string,
//     edit: Partial<CommentedHighlight>,
//   ) => void;
//   onContextMenu?: (
//     event: MouseEvent<HTMLDivElement>,
//     highlight: ViewportHighlight<CommentedHighlight>,
//   ) => void;
// }

// const HighlightContainer = ({
//   editHighlight,
//   onContextMenu,
// }: HighlightContainerProps) => {
//   const {
//     highlight,
//     viewportToScaled,
//     screenshot,
//     isScrolledTo,
//     highlightBindings,
//   } = useHighlightContainerContext<CommentedHighlight>();

//   const { toggleEditInProgress } = usePdfHighlighterContext();

//   const component = highlight.type === "text" ? (
//     <TextHighlight
//       isScrolledTo={isScrolledTo}
//       highlight={highlight}
//       onContextMenu={(event) =>
//         onContextMenu && onContextMenu(event, highlight)
//       }
//     />
//   ) : (
//     <AreaHighlight
//       isScrolledTo={isScrolledTo}
//       highlight={highlight}
//       onChange={(boundingRect) => {
//         const edit = {
//           position: {
//             boundingRect: viewportToScaled(boundingRect),
//             rects: [],
//           },
//           content: {
//             image: screenshot(boundingRect),
//           },
//         };

//         editHighlight(highlight.id, edit);
//         toggleEditInProgress(false);
//       }}
//       bounds={highlightBindings.textLayer}
//       onContextMenu={(event) =>
//         onContextMenu && onContextMenu(event, highlight)
//       }
//       onEditStart={() => toggleEditInProgress(true)}
//     />
//   );

//   const highlightTip: Tip = {
//     position: highlight.position,
//     content: <HighlightPopup highlight={highlight} />,
//   };

//   return (
//     <MonitoredHighlightContainer
//       highlightTip={highlightTip}
//       key={highlight.id}
//       children={component}
//     />
//   );
// };

// export default HighlightContainer;

import React, { MouseEvent } from "react";
import HighlightPopup from "./HighlightPopup";
// import {
//   AreaHighlight,
//   MonitoredHighlightContainer,
//   TextHighlight,
//   Tip,
//   ViewportHighlight,
//   useHighlightContainerContext,
//   usePdfHighlighterContext,
// } from "./react-pdf-highlighter-extended";

import {
  MonitoredHighlightContainer,
  Tip,
  ViewportHighlight,
  useHighlightContainerContext,
  usePdfHighlighterContext,
} from "./react-pdf-highlighter-extended";

import { AreaHighlight } from "../../src/components/AreaHighlight";
import { TextHighlight } from "../../src/components/TextHighlight";

import type { CommentedHighlight } from "./types";

// IMPORTANT: The highlight in this container is ALWAYS a
// ViewportHighlight<CommentedHighlight>, NOT a CommentedHighlight.
// That means: boundingRect has {left, top, width, height}, not x1/x2/y1/y2.

interface HighlightContainerProps {
  editHighlight: (
    idToUpdate: string,
    edit: Partial<CommentedHighlight>,
  ) => void;

  onContextMenu?: (
    event: MouseEvent<HTMLDivElement>,
    highlight: ViewportHighlight<CommentedHighlight>,
  ) => void;
}

const HighlightContainer = ({
  editHighlight,
  onContextMenu,
}: HighlightContainerProps) => {
  const {
    highlight,            // THIS IS ViewportHighlight<CommentedHighlight>
    viewportToScaled,
    screenshot,
    isScrolledTo,
    highlightBindings,
  } = useHighlightContainerContext<CommentedHighlight>();

  const { toggleEditInProgress } = usePdfHighlighterContext();

  // Text vs Area highlight type
  const component =
    highlight.type === "text" ? (
      <TextHighlight
        isScrolledTo={isScrolledTo}
        highlight={highlight}      // <-- correct type
        onContextMenu={(event) =>
          onContextMenu && onContextMenu(event, highlight)
        }
      />
    ) : (
      <AreaHighlight
        isScrolledTo={isScrolledTo}
        highlight={highlight}       // <-- correct type
        onChange={(boundingRect) => {
          const edit = {
            position: {
              boundingRect: viewportToScaled(boundingRect),
              rects: [],
            },
            content: {
              image: screenshot(boundingRect),
            },
          };

          editHighlight(highlight.id, edit);
          toggleEditInProgress(false);
        }}
        bounds={highlightBindings.textLayer}
        onContextMenu={(event) =>
          onContextMenu && onContextMenu(event, highlight)
        }
        onEditStart={() => toggleEditInProgress(true)}
      />
    );

  // Tooltip support
  const highlightTip: Tip = {
    position: highlight.position,         // ViewportPosition OK
    content: <HighlightPopup highlight={highlight} />,
  };

  return (
    <MonitoredHighlightContainer
      highlightTip={highlightTip}
      key={highlight.id}
    >
      {component}
    </MonitoredHighlightContainer>
  );
};

export default HighlightContainer;