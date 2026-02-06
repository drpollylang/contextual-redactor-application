import React from "react";
// import App from "./App";
import ReactDOM from "react-dom/client";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProjectHome from "./screens/ProjectHome";
import ProjectWorkspace from "./screens/ProjectWorkspace";

import { initializeIcons } from "@fluentui/react";

const userId = "anonymous"; // or from auth - TODO wire real identity
initializeIcons();

// Use StrictMode for debugging
// ReactDOM.createRoot(document.getElementById("root")!).render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>,
// );


ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<ProjectHome userId={userId} />} />
      <Route path="/project/:projectId" element={<ProjectWorkspace userId={userId} />} />
    </Routes>
  </BrowserRouter>
);
