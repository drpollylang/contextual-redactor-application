import React, { useState } from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProjectHome from "./screens/ProjectHome";
import ProjectWorkspace from "./screens/ProjectWorkspace";
import SettingsPage, { STATIC_AI_RULES } from "./screens/SettingsPage";
import { 
  loadProjects, 
  createProject, 
  deleteProject,
  loadProjectSummary,
  uploadDocuments,
  downloadAll
 } from "./helpers/projectHelpers"
import { initializeIcons } from "@fluentui/react";

const userId = "anonymous"; // or from auth - TODO wire real identity
const userName = "A Nonymous"; // or from auth - TODO wire real identity
initializeIcons();

// Use StrictMode for debugging
// ReactDOM.createRoot(document.getElementById("root")!).render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>,
// );

function Root() {
  // const [aiRules, setAiRules] = React.useState<string[]>([]);
  const [aiRules, setAiRules] = useState<string[]>(
      STATIC_AI_RULES.map(r => r.description) // ⬅ ALL selected by default
    );
  const [userInstructions, setUserInstructions] = React.useState("");
  return (
    <BrowserRouter>
    <Routes>
      {/* <Route path="/" element={<ProjectHome userId={userId} />} /> */}
      <Route path="/" element={
        <ProjectHome 
          userId={userId} 
          userName={userName} 
          loadProjects={loadProjects} 
          createProject={createProject} 
          deleteProject={deleteProject}
          loadProjectSummary={loadProjectSummary}
          uploadDocuments={uploadDocuments}
          downloadAll={downloadAll}
          aiRules={aiRules}
          setAiRules={setAiRules}
          userInstructions={userInstructions}
          setUserInstructions={setUserInstructions}
        />
      }
      />

      <Route 
        path="/project/:projectId" 
        element={
          <ProjectWorkspace 
            userId={userId}
            aiRules={aiRules}
            setAiRules={setAiRules}
            userInstructions={userInstructions}
            setUserInstructions={setUserInstructions}
          />
        } 
      />
      
      <Route
        path="/settings"
        element={
          <SettingsPage
            rules={aiRules}
            setRules={setAiRules}
            userInstructions={userInstructions}
            setUserInstructions={setUserInstructions}
            availableCategories={[]} // or real categories
          />
        }
      />
    </Routes>
  </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);