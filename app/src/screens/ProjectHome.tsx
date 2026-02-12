// import React, { useEffect, useState } from "react";
// import { listUserDocuments } from "../lib/apiClient";
// // import { DefaultButton, PrimaryButton } from "@fluentui/react";
// import { PrimaryButton } from "@fluentui/react";
// import { Link } from "react-router-dom";

// v0
// export default function ProjectHome({ userId }: { userId: string }) {
//   const [projects, setProjects] = useState<Record<string, string[]>>({});

//   useEffect(() => {
//     (async () => {
//       const docs = await listUserDocuments(userId);

//       const grouped: Record<string, string[]> = {};
//       for (const doc of docs) {
//         const pid = doc.projectId;
//         if (!grouped[pid]) grouped[pid] = [];
//         grouped[pid].push(doc.fileName);
//       }
//       setProjects(grouped);
//     })();
//   }, [userId]);

//   return (
//     <div style={{ padding: 32 }}>
//       <h1>Your Projects</h1>

//       <PrimaryButton
//         text="Create New Project"
//         onClick={() => {
//           const id = crypto.randomUUID();
//           window.location.href = `/project/${id}`;
//         }}
//       />

//       <div style={{ marginTop: 32 }}>
//         {Object.entries(projects).map(([projectId, files]) => (
//           <div key={projectId} style={{ marginBottom: 24 }}>
//             <h3>
//               <Link to={`/project/${projectId}`}>{projectId}</Link>
//             </h3>
//             <ul>
//               {files.map((f) => (
//                 <li key={f}>{f}</li>
//               ))}
//             </ul>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// v1
// src/screens/ProjectHome.tsx
// import React, { useEffect, useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { listUserDocuments } from "../lib/apiClient";
// import { PrimaryButton } from "@fluentui/react";

// interface ProjectHomeProps {
//   userId: string;
// }

// type MapProjects = Record<string, string[]>;

// export default function ProjectHome({ userId }: ProjectHomeProps) {
//   const navigate = useNavigate();
//   const [projects, setProjects] = useState<MapProjects>({});

//   useEffect(() => {
//     (async () => {
//       const docs = await listUserDocuments(userId);
//       const grouped: MapProjects = {};
//       for (const d of docs) {
//         if (!grouped[d.projectId]) grouped[d.projectId] = [];
//         grouped[d.projectId].push(d.fileName);
//       }
//       setProjects(grouped);
//     })();
//   }, [userId]);

//   return (
//     <div style={{ padding: 24 }}>
//       <h1>Projects</h1>

//       <PrimaryButton
//         text="Create new project"
//         onClick={() => {
//           const id = crypto.randomUUID();
//           navigate(`/project/${id}`);
//         }}
//       />

//       <div style={{ marginTop: 24 }}>
//         {Object.entries(projects).length === 0 && <div>No projects yet.</div>}
//         {Object.entries(projects).map(([pid, files]) => (
//           <div key={pid} style={{ marginBottom: 16 }}>
//             <h3 style={{ marginBottom: 4 }}>
//               <Link to={`/project/${pid}`}>{pid}</Link>
//             </h3>
//             <ul style={{ margin: 0, paddingLeft: 18 }}>
//               {files.map((f) => (
//                 <li key={f}>{f}</li>
//               ))}
//             </ul>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// v2
// import React, { useEffect, useState } from "react";
// import {
//   Stack,
//   DefaultButton,
//   IconButton,
//   Persona,
//   PersonaSize,
//   Dialog,
//   DialogType,
//   DialogFooter,
//   PrimaryButton,
//   DefaultButton as SecondaryButton,
//   Spinner,
//   SpinnerSize,
//   // ContextualMenu,
//   IContextualMenuProps,
//   // MessageBar,
//   MessageBarType
// } from "@fluentui/react";

// import { useNavigate } from "react-router-dom";
// import {ProjectRecord } from "../helpers/projectHelpers";
// import Toast from "../components/Toast";

// interface Project {
//   id: string;
//   name: string;
// }

// interface HomePageProps {
//   userId: string;
//   userName: string;
//   loadProjects: (userId: string) => Promise<ProjectRecord[]>;
//   createProject: (userId: string, name: string) => Promise<ProjectRecord | null>;
//   deleteProject: (userId: string, projectId: string) => Promise<void>;
// }

// // export default function HomePage({ userId, loadProjects, createProject, deleteProject }) {
// export default function ProjectHome({
//   userId,
//   userName,
//   loadProjects,
//   createProject,
//   deleteProject
// }: HomePageProps) {

//   const [projects, setProjects] = useState<Project[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedProject, setSelectedProject] = useState<Project | null>(null);
//   const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

//   const navigate = useNavigate();

//   // Dialog state
//   const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
//   const [newProjectName, setNewProjectName] = useState("");

//   // Toast state
//   const [toast, setToast] = useState<null | { message: string; type: MessageBarType }>(null);

//   // Load projects
//   useEffect(() => {
//     (async () => {
//       setLoading(true);
//       const result = await loadProjects(userId); // external function you pass in
//       setProjects(result);
//       setLoading(false);
//     })();
//   }, [userId]);

  
//   // const handleCreateProject = () => createProject(userId);
//   const handleDeleteProject = (id: string) => deleteProject(userId, id);

//   const openDeleteDialog = (proj: Project) => {
//     setSelectedProject(proj);
//     setConfirmDeleteOpen(true);
//   };

//   const confirmDelete = async () => {
//     if (selectedProject) {
//       // await deleteProject(selectedProject.id);
//       await handleDeleteProject(selectedProject.id);
//       setProjects(prev => prev.filter(p => p.id !== selectedProject.id));
//       setToast({
//             message: `Deleted project "${selectedProject.name}".`,
//             type: MessageBarType.warning,
//           });
//     }
//     setConfirmDeleteOpen(false);
//     setSelectedProject(null);
//   };

//   const projectMenu = (proj: Project): IContextualMenuProps => ({
//     items: [
//       {
//         key: "open",
//         text: "Open project",
//         iconProps: { iconName: "OpenFolderHorizontal" },
//         onClick: async () => navigate(`/project/${proj.id}`)
//       },
//       {
//         key: "delete",
//         text: "Delete project",
//         iconProps: { iconName: "Delete" },
//         onClick: () => openDeleteDialog(proj)
//       }
//     ]
//   });

//   return (
//     <div style={{ height: "100vh", padding: "20px", position: "relative" }}>

//       {toast && (
//         <Toast
//           message={toast.message}
//           type={toast.type}
//           onDismiss={() => setToast(null)}
//         />
//       )}

//       {/* Spinner overlay */}
//       {loading && (
//         <div style={{
//           position: "absolute",
//           top: 0, left: 0,
//           width: "100%", height: "100%",
//           display: "flex",
//           justifyContent: "center",
//           alignItems: "center",
//           background: "rgba(255,255,255,0.7)",
//           zIndex: 999
//         }}>
//           <Spinner size={SpinnerSize.large} label="Loading your projects…" />
//         </div>
//       )}

//       {/* Top bar */}
//       <Stack horizontal horizontalAlign="space-between" verticalAlign="center" styles={{ root: { marginBottom: 30 } }}>
        
//         {/* Left spacer: keeps "Create Project" centered */}
//         <div style={{ width: 100 }}></div>

//         {/* Centered Create Project */}
//         <DefaultButton
//           text="Create New Project"
//           iconProps={{ iconName: "Add" }}
//           // onClick={handleCreateProject}
//           onClick={() => setIsCreateDialogOpen(true)}
//           styles={{ root: { height: 40, fontSize: 16, padding: "0 20px" } }}
//         />

//         {/* User + settings */}
//         <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
          
//           <IconButton
//             iconProps={{ iconName: "Settings" }}
//             title="Settings"
//             ariaLabel="Settings"
//             onClick={() => navigate("/settings")}
//           />

//           <Persona
//             text={userName}
//             size={PersonaSize.size32}
//             hidePersonaDetails={true}
//             imageInitials={userName?.charAt(0)?.toUpperCase()}
//           />
//         </Stack>
//       </Stack>

//       {/* Project Grid */}
//       {projects.length === 0 && !loading ? (
//         <div style={{
//           textAlign: "center",
//           marginTop: 100,
//           opacity: 0.5,
//           fontSize: 18
//         }}>
//           No projects yet. Create your first project to begin.
//         </div>
//       ) : (
//         <div style={{
//           display: "grid",
//           gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
//           gap: "24px",
//           padding: "10px"
//         }}>
//           {projects.map(proj => (
//             <div key={proj.id}
//               style={{
//                 background: "white",
//                 borderRadius: 8,
//                 padding: 14,
//                 boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
//                 position: "relative"
//               }}
//             >
//               {/* Three-dot menu */}
//               <IconButton
//                 iconProps={{ iconName: "MoreVertical" }}
//                 styles={{
//                   root: {
//                     position: "absolute",
//                     top: 6, right: 6
//                   }
//                 }}
//                 menuProps={projectMenu(proj)}
//               />

//               {/* Project Thumbnail / Icon */}
//               <div style={{
//                 width: "100%",
//                 height: 110,
//                 background: "#f3f2f1",
//                 borderRadius: 6,
//                 display: "flex",
//                 justifyContent: "center",
//                 alignItems: "center",
//                 fontSize: 28,
//                 color: "#605e5c"
//               }}>
//                 📁
//               </div>

//               {/* Project name */}
//               <div style={{
//                 marginTop: 10,
//                 textAlign: "center",
//                 fontSize: 15,
//                 fontWeight: 500
//               }}>
//                 {proj.name}
//               </div>
//             </div>
//           ))}
//         </div>
//       )}

//       {/* Delete confirmation dialog */}
//       <Dialog
//         hidden={!confirmDeleteOpen}
//         onDismiss={() => setConfirmDeleteOpen(false)}
//         dialogContentProps={{
//           type: DialogType.normal,
//           title: "Delete Project?",
//           subText:
//             selectedProject ?
//             `Are you sure you want to delete project "${selectedProject.name}"? This action cannot be undone.`: 
//             "Are you sure you want to delete this project? This action cannot be undone.",
//         }}
//         modalProps={{ isBlocking: true }}
//       >
//         <DialogFooter>
//           <PrimaryButton text="Delete" onClick={confirmDelete} />
//           <SecondaryButton text="Cancel" onClick={() => setConfirmDeleteOpen(false)} />
//         </DialogFooter>
//       </Dialog>

//       {/* Create project dialog */}
//       <Dialog
//         hidden={!isCreateDialogOpen}
//         onDismiss={() => setIsCreateDialogOpen(false)}
//         dialogContentProps={{
//           type: DialogType.normal,
//           title: "Create New Project",
//           subText: "Enter a name for your new project.",
//         }}
//         modalProps={{
//           isBlocking: false,
//         }}
//       >
//         <input
//           autoFocus
//           value={newProjectName}
//           onChange={(e) => setNewProjectName(e.target.value)}
//           style={{
//             width: "100%",
//             padding: "8px",
//             fontSize: 14,
//             marginBottom: 10,
//           }}
//           placeholder="Project name"
//         />

//         <DialogFooter>
//           <PrimaryButton
//             text="Create Project"
//             disabled={!newProjectName.trim()}
//             onClick={async () => {
//               const proj = await createProject(userId, newProjectName.trim());
//               if (proj) {
//                 setProjects((prev) => [...prev, proj]);

//                 // Show success toast
//                 setToast({
//                   message: `Project "${proj.name}" created successfully.`,
//                   type: MessageBarType.success,
//                 });
//               } else {
//                 setToast({
//                   message: "Failed to create project.",
//                   type: MessageBarType.error,
//                 });
//               }

//               setNewProjectName("");
//               setIsCreateDialogOpen(false);
//             }}
//           />

//           <DefaultButton
//             text="Cancel"
//             onClick={() => {
//               setNewProjectName("");
//               setIsCreateDialogOpen(false);
//             }}
//           />
//         </DialogFooter>
//       </Dialog>

//     </div>
//   );
// }

// v3
// src/screens/ProjectHome.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Stack,
  DefaultButton,
  IconButton,
  Persona,
  PersonaSize,
  Dialog,
  DialogType,
  DialogFooter,
  PrimaryButton,
  DefaultButton as SecondaryButton,
  Spinner,
  SpinnerSize,
  // IContextualMenuProps,
  MessageBarType,
  Text,
  DetailsList,
  IColumn,
  // SelectionMode,
  // Separator,
  useTheme,
  mergeStyleSets,
  TooltipHost,
  Panel,
  PanelType,
  Pivot,
  PivotItem,
  MessageBar,
  ProgressIndicator,
  // TextField,
  Dropdown,
} from "@fluentui/react";
// import { DropZone } from "@fluentui/react-components";
// import { TabList, Tab } from "@fluentui/react-components";
import { Search20Regular } from "@fluentui/react-icons";
import { Input } from "@fluentui/react-components";
// import { Card, CardHeader, CardPreview } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { ProjectRecord } from "../helpers/projectHelpers";
import { removeDocument, downloadDocument } from "../helpers/documentHelpers";
import { 
  // runAiRedactionForProject, 
  runAiRedactionForProjectParallel,
  // applyAiRedactionsToWorkingFile 
  } from "../helpers/aiRedactionHelpers";
import Toast from "../components/Toast";
import JSZip from "jszip";

import { AiJobStatus } from "../mytypes/ai";

// Needed for redaction + download
import { 
  getDownloadSas,
  listUserDocuments
} from "../lib/apiClient";

import { 
  buildRedactedBlobFromPdfjsDoc,
  groupActiveRectsByPage
} from "../lib/pdfRedactor";

import { loadPdfDocumentFromUrl, downloadBlob, redactedName } from "../screens/ProjectWorkspace"; // IF exposed, otherwise see below
import SettingsPage from "../screens/SettingsPage";
// import { downloadBlob, redactedName } from "../lib/blobPersist";

/** --- Types --- */

interface Project {
  id: string;
  name: string;
  createdAt?: string; // ISO string, optional if some records don’t have it
}

interface DocumentSummary {
  id: string;
  name: string;
  redactions: number; // current redaction count
}

interface ProjectSummary {
  project: Project;
  documents: DocumentSummary[];
}

interface HomePageProps {
  userId: string;
  userName: string;

  /** Existing functions you already have or can provide */
  loadProjects: (userId: string) => Promise<ProjectRecord[]>;
  createProject: (userId: string, name: string) => Promise<ProjectRecord | null>;
  deleteProject: (userId: string, projectId: string) => Promise<void>;

  
  aiRules: string[];
  setAiRules: React.Dispatch<React.SetStateAction<string[]>>;

  userInstructions: string;
  setUserInstructions: React.Dispatch<React.SetStateAction<string>>;

  /** New helpers you’ll wire up to your backend */
  loadProjectSummary: (
    userId: string,
    projectId: string
  ) => Promise<ProjectSummary>;
  uploadDocuments: (
    userId: string,
    projectId: string,
    files: File[]
  ) => Promise<void>;
  downloadAll: (
    userId: string,
    projectId: string
  ) => Promise<Blob | ArrayBuffer | void>; // Return a Blob for us to trigger a download
}

export default function ProjectHome({
  userId,
  userName,
  loadProjects,
  createProject,
  deleteProject,
  loadProjectSummary,
  uploadDocuments,
  downloadAll,
  aiRules,
  userInstructions,
  setAiRules,
  setUserInstructions
}: HomePageProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [projectDocumentsRaw, setProjectDocumentsRaw] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"name" | "date">("name");

  const [isAiBatchRunning, setIsAiBatchRunning] = useState(false);
  const [aiBatchStatus, setAiBatchStatus] = useState("");

  const [showSettings, setShowSettings] = useState(false);

  // Toast
  const [toast, setToast] = useState<null | { message: string; type: MessageBarType }>(null);

  // Create project dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Delete confirmation dialog
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null);

  // Project details dialog (open on card click)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // per-document statuses
  const [aiStatusMap, setAiStatusMap] = useState<Record<string, AiJobStatus>>({});

  // batch-level info
  const [aiBatchProgress, setAiBatchProgress] = useState(0); // 0..1
  const [aiBatchMessage, setAiBatchMessage] = useState("");
  const [aiBatchHistory, setAiBatchHistory] = useState<
    { fileName: string; timestamp: number; status: AiJobStatus }[]
  >([]);

  // cancellation support
  const aiBatchAbort = useRef<AbortController | null>(null);
    
  // Strongly typed guard: never navigate with undefined
  const openWorkspace = (projectId: string) => navigate(`/project/${projectId}`);

  // Sync wrapper so Fluent UI menu callbacks don't return Promises
  const menuAsync = (fn: () => Promise<void>) => () => {
    fn();      // fire & forget
    return;    // MUST return void (not Promise, not null)
  };

  const showToast = (message: string, type: MessageBarType = MessageBarType.success) => {
    setToast({ message, type });
  };

  /** Load all user projects */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await loadProjects(userId);
        setProjects(result.map(p => ({
          id: p.id,
          name: p.name,
          createdAt: (p as any).createdAt ?? undefined          
        })));
      } catch (err) {
        setToast({
          message: "Failed to load projects.",
          type: MessageBarType.error,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, loadProjects]);


  /** Styles */
  const classes = useMemo(
    () =>
      mergeStyleSets({
        page: {
          height: "100vh",
          padding: 20,
          position: "relative",
          background: theme.palette.white,
        },
        grid: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "32px",
          padding: "0 40px 60px 40px",
          justifyItems: "center",
          alignItems: "start"
        },
        card: {
          background: theme.palette.white,
          borderRadius: 8,
          padding: 14,
          boxShadow: theme.effects.elevation8,
          position: "relative",
          cursor: "pointer",
          selectors: {
            "&:hover": {
              boxShadow: theme.effects.elevation16,
            },
            "&:focus-within": {
              outline: `2px solid ${theme.palette.themePrimary}`,
            },
          },
        },
        thumbnail: {
          width: "100%",
          height: 120,
          // background: theme.palette.neutralLighter,
          // borderRadius: 6,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          // fontSize: 32,
          // color: theme.palette.neutralPrimary,
          flexGrow: 1,
          background: "#faf9f8",
          borderRadius: 10,
          fontSize: 48,
          color: "#d89e00"
        },
        cardTitle: {
          marginTop: 10,
          textAlign: "center",
          fontSize: 17,
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
        topBar: {
          marginBottom: 30,
        },
        emptyState: {
          textAlign: "center",
          marginTop: 100,
          opacity: 0.6,
          fontSize: 18,
        },
      }),
    [theme]
  );

  const globalStyles = `
    @keyframes fadeInScale {
      0% { opacity: 0; transform: scale(0.92); }
      100% { opacity: 1; transform: scale(1); }
    }
    `;

    useEffect(() => {
      const style = document.createElement("style");
      style.innerHTML = globalStyles;
      document.head.appendChild(style);
      return () => style.remove();
    }, []);

  /** Contextual menu per project (3-dot icon) */
  // const projectMenu = (proj: Project): IContextualMenuProps => ({
  //   items: [
  //     {
  //       key: "open",
  //       text: "Open project",
  //       iconProps: { iconName: "OpenFolderHorizontal" },
  //       onClick: async () => navigate(`/project/${proj.id}`),
  //     },
  //     {
  //       key: "details",
  //       text: "View details",
  //       iconProps: { iconName: "Info" },
  //       onClick: () => openProjectDetails(proj),
  //     },
  //     {
  //       key: "delete",
  //       text: "Delete project",
  //       iconProps: { iconName: "Delete" },
  //       onClick: () => openDeleteDialog(proj),
  //     },
  //   ],
  // });

  function colorForProject(name: string) {
    const colors = ["#FFD700", "#FF8C00", "#4CAF50", "#2196F3", "#9C27B0"];
    const index = name.length % colors.length;
    return colors[index];
  }

  // Filter and sort projects
  const filteredProjects = projects
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      // sortMode === "date"
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da; // newest first
    });

  /** Delete helpers */
  const openDeleteDialog = (proj: Project) => {
    setProjectPendingDelete(proj);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!projectPendingDelete) return;
    try {
      await deleteProject(userId, projectPendingDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== projectPendingDelete.id));
      setToast({
        message: `Deleted project "${projectPendingDelete.name}".`,
        type: MessageBarType.warning,
      });

      // If details dialog is open for the same project, close it
      if (selectedProject?.id === projectPendingDelete.id) {
        setIsDetailsOpen(false);
        setSelectedProject(null);
        setProjectSummary(null);
      }
    } catch (err) {
      setToast({
        message: "Failed to delete project.",
        type: MessageBarType.error,
      });
    } finally {
      setConfirmDeleteOpen(false);
      setProjectPendingDelete(null);
    }
  };

  /** Drag and drop uplooad handlers */
  const handleDropUpload = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    
    if (!selectedProject) return;

    const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
    if (files.length === 0) {
      showToast("Only PDF files can be uploaded.", MessageBarType.warning);
      return;
    }

    setIsUploading(true);
   
    try {
        await uploadDocuments(userId, selectedProject.id, files);

        showToast(`${files.length} file(s) uploaded successfully`, MessageBarType.success);

        const summary = await loadProjectSummary(userId, selectedProject.id);
        setProjectSummary(summary);
      } catch (err) {
        console.error(err);
        showToast("Upload failed.", MessageBarType.error);
      }

    setIsUploading(false);

  };

  const handleAiRedactionGeneration = async () => {
    if (!selectedProject || !projectSummary) return;

    const docs = projectSummary.documents.map(d => d.name);

    setIsAiBatchRunning(true);
    setAiBatchMessage("Starting AI…");
    setAiStatusMap(Object.fromEntries(docs.map(d => [d, "pending"])));

    
    aiBatchAbort.current = new AbortController();
    const { signal } = aiBatchAbort.current;

    try {
        await runAiRedactionForProjectParallel({
          userId,
          projectId: selectedProject.id,
          fileNames: docs,
          aiRules,
          userInstructions,
          concurrency: 3,
          signal,

          onDocStatus: (fileName, status) => {
            setAiStatusMap(prev => ({ ...prev, [fileName]: status }));
            setAiBatchStatus(`AI for ${fileName}: ${status}`);
            
          },
          

          onDocComplete: async (fileName, output) => {
            setAiBatchHistory(prev => [
              ...prev,
              { fileName, status: "completed", timestamp: Date.now() }
            ]);
            showToast(`AI suggestions completed for ${fileName}`);

            // await applyAiRedactionsToWorkingFile({
            //   userId,
            //   projectId: selectedProject.id,
            //   fileName,
            //   aiPayload: output   // this is Durable output
            // });

            showToast(`AI suggestions saved for ${fileName}`);
          },

          onDocError: (fileName) => {
            setAiBatchHistory(prev => [
              ...prev,
              { fileName, status: "failed", timestamp: Date.now() }
            ]);
            showToast(`AI suggestion failed for ${fileName}`, MessageBarType.error);
          },

          onBatchProgress: (done, total) => {
            setAiBatchProgress(done / total);
            setAiBatchMessage(`Progress: ${done} / ${total}`);
          }
        });

        showToast("AI suggestions finished for all documents!");

        // optional: trigger a reload of Workspace's highlights for the project
        localStorage.setItem("aiRefreshProjectId", selectedProject.id);

      } catch (err) {
        if (signal.aborted) {
          showToast("AI batch cancelled.", MessageBarType.warning);
        } else {
          showToast("AI batch failed.", MessageBarType.error);
        }
      }

      setIsAiBatchRunning(false);
      setAiBatchMessage("");

    // await runAiRedactionForProject({
    //   userId,
    //   projectId: selectedProject.id,
    //   fileNames,
    //   aiRules,
    //   userInstructions,

    //   onDocumentStart: (name, index, total) => {
    //     setAiBatchStatus(`Starting AI for ${name} (${index}/${total})`);
    //   },

    //   onDocumentStatus: (name, status) => {
    //     setAiBatchStatus(`${name}: ${status}`);
    //   },

    //   onDocumentComplete: (name) => {
    //     setToast({
    //       message: `AI suggestions generated for ${name}`,
    //       type: MessageBarType.success
    //     });
    //   },

    //   onDocumentError: (name) => {
    //     setToast({
    //       message: `AI generation failed for ${name}`,
    //       type: MessageBarType.error
    //     });
    //   },

    //   onBatchComplete: () => {
    //     setToast({
    //       message: "AI suggestions generated for all documents.",
    //       type: MessageBarType.success
    //     });
    //     setAiBatchStatus("");
    //     setIsAiBatchRunning(false);
    //   }
    // });
  }


  // const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   setIsUploading(true);
  //   const files = Array.from(e.target.files ?? []);
  //   await uploadDocuments(userId, selectedProject!.id, files);
  //   setIsUploading(false);
  // };

  /** Open details dialog (card click) */
  const openProjectDetails = async (proj: Project) => {
    setSelectedProject(proj);
    setDetailsError(null);
    setProjectSummary(null);
    setIsDetailsOpen(true);
    setDetailsLoading(true);

    const rawDocs = await listUserDocuments(userId);
    setProjectDocumentsRaw(rawDocs.filter(d => d.projectId === proj.id));

    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const summary = await loadProjectSummary(userId, proj.id);
      setProjectSummary(summary);
    } catch (err) {
      setDetailsError("Failed to load project details.");
    } finally {
      setDetailsLoading(false);
    }
    setDetailsLoading(false);
  };

  /** Upload documents */
  // const triggerUpload = () => fileInputRef.current?.click();

  const onFilesChosen: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!selectedProject || files.length === 0) return;

    setIsUploading(true);
    try {
      await uploadDocuments(userId, selectedProject.id, files);
      setToast({
        message: `${files.length} file(s) uploaded.`,
        type: MessageBarType.success,
      });
      // Refresh details after upload
      const summary = await loadProjectSummary(userId, selectedProject.id);
      setProjectSummary(summary);
    } catch (err) {
      setToast({
        message: "Upload failed.",
        type: MessageBarType.error,
      });
    } finally {
      setIsUploading(false);
      // Clear the file input so the same files can be re-picked if desired
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /** Download all documents */
  const downloadAllRedacted = async () => {
    if (!selectedProject || !projectDocumentsRaw.length) return;

    setIsDownloading(true);

    try {
      const zip = new JSZip();
      const projectZip = zip.folder(selectedProject.name) ?? zip;

      for (const doc of projectDocumentsRaw) {
        const fileName = doc.fileName;
        const blobPath = doc.workingPath ?? doc.originalPath;
        if (!blobPath) continue;

        // 1. Fetch the PDF
        const { downloadUrl } = await getDownloadSas({
          containerName: "files",
          blobPath,
          ttlMinutes: 10
        });

        const clean = downloadUrl.replace(/&amp;amp;amp;/g, "&").replace(/&amp;amp;/g, "&");
        const pdfBlob = await (await fetch(clean)).blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // 2. Load PDF.js document
        const pdfDoc = await loadPdfDocumentFromUrl(pdfUrl);

        // 3. Fetch highlights JSON
        // let all: HighlightEntry[] = [];
        // let activeIds: string[] = [];
        let all = [];
        let activeIds = [];

        if (doc.highlightsPath) {
          const { downloadUrl: hUrl } = await getDownloadSas({
            containerName: "files",
            blobPath: doc.highlightsPath,
            ttlMinutes: 10
          });

          const clean2 = hUrl.replace(/&amp;amp;amp;/g, "&").replace(/&amp;amp;/g, "&");
          const res = await fetch(clean2);
          if (res.ok) {
            const j = await res.json();
            all = j.allHighlights ?? [];
            activeIds = j.activeHighlights ?? [];
          }
        }

        const active = all.filter((h: { id: string }) => activeIds.includes(h.id));
        const grouped = groupActiveRectsByPage(active);

        // 4. Generate redacted PDF
        const finalBlob = await buildRedactedBlobFromPdfjsDoc(pdfDoc, grouped, 2.0);

        projectZip.file(redactedName(fileName), finalBlob);

        URL.revokeObjectURL(pdfUrl);
      }

      // 5. Download ZIP
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `${selectedProject.name}.zip`);

      setToast({
        message: "Redacted ZIP downloaded successfully.",
        type: MessageBarType.success
      });

    } catch (err) {
      console.error(err);
      setToast({
        message: "Failed to build ZIP of redacted files.",
        type: MessageBarType.error
      });
    }

    setIsDownloading(false);
  };

  /** DetailsList columns for the Project Details dialog */
  const columns: IColumn[] = useMemo(
    () => [
      {
        key: "col-doc",
        name: "Document",
        fieldName: "name",
        minWidth: 350,
        maxWidth: 700,
        isResizable: true,
        isMultiline: true,
        onRender: (item?: DocumentSummary) => (
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
            <span role="img" aria-label="document" style={{ fontSize: 20}}>
              📄
            </span>
            <Text style={{ whiteSpace: "normal", fontWeight: 500 }}>{item?.name}</Text>
          </Stack>
        ),
      },
      /* per-document AI status badge */
      {
        key: "aiStatus",
        name: "AI",
        minWidth: 70,
        onRender: (doc) => {
          const status = aiStatusMap[doc.name] ?? "pending";

          const color =
            status === "completed" ? "green" :
            status === "running"   ? "orange" :
            status === "failed"    ? "red" :
            status === "cancelled" ? "gray" :
                                    "#666";

          return (
            <span style={{
              display: "inline-block",
              padding: "3px 8px",
              background: color,
              color: "white",
              borderRadius: 8,
              fontSize: 12,
              textTransform: "capitalize"
            }}>
              {status}
            </span>
          );
        }
      },
      {
        key: "col-redactions",
        name: "Redactions",
        fieldName: "redactions",
        minWidth: 100,
        maxWidth: 140,
        isResizable: true,
        onRender: (item?: DocumentSummary) => (
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
            {/* <IconButton
              iconProps={{ iconName: "Hide" }}
              disabled
              styles={{ root: { cursor: "default" } }}
              title="Redactions"
              ariaLabel="Redactions"
            /> */}            
            <span
              style={{
                marginLeft: "auto",
                background: item?.redactions ?? 0 > 0 ? "#d13438" : "#8a8886",
                color: "white",
                padding: "2px 8px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600
              }}
            >
            <Text>{item?.redactions ?? 0}</Text>
            </span>
          </Stack>
        ),
      },
      // {
      //   key: "actions",
      //   name: "",
      //   minWidth: 140,
      //   maxWidth: 180,
      //   onRender: (item) => (
      //     <DefaultButton
      //       text="View in workspace"
      //       iconProps={{ iconName: "NavigateForward" }}
      //       // onClick={() => navigate(`/project/${selectedProject?.id}`)}
      //       // onClick={() => openWorkspace(selectedProject!.id) }
      //        onClick={() => {
      //         console.log("Opening workspace for project:", selectedProject);
      //         selectedProject && openWorkspace(selectedProject.id) 
      //       }}
      //       styles={{
      //         root: {
      //           border: "none",
      //           boxShadow: "none",
      //           background: "transparent",
      //           paddingLeft: 0,
      //         },
      //         rootHovered: {
      //           background: "transparent",
      //           textDecoration: "underline",
      //         },
      //         rootPressed: {
      //           background: "transparent",
      //         }
      //       }}
      //     />
      //   ),
      // },  
      {
        key: "actions",
        name: "",
        minWidth: 80,
        onRender: (doc) => (
          <IconButton
            iconProps={{ iconName: "MoreVertical" }}
            menuProps={{
              items: [
                {
                  key: "open",
                  text: "Open in workspace",
                  iconProps: { iconName: "NavigateForward" },
                  // onClick: async () => selectedProject && openWorkspace(selectedProject.id)
                  onClick: () => {
                      if (!selectedProject) return;
                      openWorkspace(selectedProject.id);
                      // navigate(`/project/${selectedProject.id}`);
                    }
                },
                // {
                //   key: "download",
                //   text: "Download",
                //   iconProps: { iconName: "Download" },
                //   onClick: () => downloadSingleDoc(doc)
                // },
                {
                  key: "download",
                  text: "Download (original)",
                  iconProps: { iconName: "Download" },
                  onClick: () => {
                    (async () => {
                      try {
                        if (!selectedProject) return;
                        downloadDocument(userId, selectedProject.id, doc.name)
                      } catch (e) {
                        console.error("Download failed: ", e);
                      }
                    })(); 
                  }
                },
                {
                  key: "downloadFinal",
                  text: "Download final redacted",
                  iconProps: { iconName: "Download" },
                  onClick: () => {
                    (async () => {
                      try {
                        if (!selectedProject) return;
                        downloadDocument(userId, selectedProject.id, doc.name, "final")
                      } catch (e) {
                        console.error("Download failed: ", e);
                      }
                    })(); 
                  }
                },
                {
                  key: "downloadWorking",
                  text: "Download working copy",
                  iconProps: { iconName: "Download" },
                  onClick: () => {
                    (async () => {
                      try {
                        if (!selectedProject) return;
                        downloadDocument(userId, selectedProject.id, doc.name, "working")
                      } catch (e) {
                        console.error("Download failed: ", e);
                      }
                    })(); 
                  }
                },
                {
                  key: "delete",
                  text: "Delete",
                  iconProps: { iconName: "Delete" },
                    onClick: () => {
                      (async () => {
                        if (!selectedProject) return;
                        await removeDocument(userId, selectedProject.id, doc.name);

                        // Refresh project summary UI
                        const summary = await loadProjectSummary(userId, selectedProject.id);
                        setProjectSummary(summary);

                        setToast({
                          message: `Deleted ${doc.name}`,
                          type: MessageBarType.warning,
                        });
                      })();
                    } 
                }
              ]
            }}    
          />
        )
      }
    ],
    // []
    [aiStatusMap, selectedProject]
  );

  return (
    <div className={classes.page}>
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "rgba(255,255,255,0.7)",
            zIndex: 999,
          }}
        >
          <Spinner size={SpinnerSize.large} label="Loading your projects…" />
        </div>
      )}

      {/* Top bar */}
      <Stack
        horizontal
        horizontalAlign="space-between"
        verticalAlign="center"
        className={classes.topBar}
      >
        {/* Left spacer to help center the Create button */}
        <div style={{ width: 100 }} />

        {/* Centered Create Project */}
        <DefaultButton
          text="Create New Project"
          iconProps={{ iconName: "Add" }}
          onClick={() => setIsCreateDialogOpen(true)}
          styles={{ root: { height: 40, fontSize: 16, padding: "0 20px" } }}
        />

        {/* Right side: settings + user */}
        <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
          <TooltipHost content="Settings">
            <IconButton
              iconProps={{ iconName: "Settings" }}
              title="Settings"
              ariaLabel="Settings"
              // onClick={() => navigate("/settings")}
              onClick={() => setShowSettings(true)}
            />
          </TooltipHost>
          <Persona
            text={userName}
            size={PersonaSize.size32}
            hidePersonaDetails={true}
            imageInitials={userName?.charAt(0)?.toUpperCase()}
          />
        </Stack>
      </Stack>

      {/* Search and sort projects */}
      {/* <TextField
        placeholder="Search projects..."
        onChange={(_, v) => setSearchQuery(v ?? "")}
        styles={{ root: { width: 300, marginBottom: 20 } }}
        iconProps={{ iconName: "Search" }}
      /> */}

      <Input
        placeholder="Search projects"
        contentBefore={<Search20Regular />}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ width: 300, marginBottom: 16 }}
      />

      <Dropdown
        label="Sort by"
        options={[
          { key: "name", text: "Name" },
          { key: "date", text: "Created Date" },
        ]}
        selectedKey={sortMode}
        onChange={(_, option) => {
          if (!option) return;
          setSortMode(option.key as "name" | "date")
        }}
        styles={{ root: { width: 200, marginBottom: 20 } }}
      />

      

      {/* Project Grid */}
      {projects.length === 0 && !loading ? (
        <div className={classes.emptyState}>
          No projects yet. Create your first project to begin.
        </div>
      ) : (
        <div className={classes.grid} role="list">
          {filteredProjects.map((proj) => (
            // <Card
            //   onClick={() => openProjectDetails(proj)}
            //   style={{
            //     cursor: "pointer",
            //     animation: "fadeInUp 260ms ease"
            //   }}
            // >
            //   <CardPreview>
            //     <div
            //       style={{
            //         height: 160,
            //         background: colorForProject(proj.name),
            //         borderRadius: 8,
            //         display: "flex",
            //         justifyContent: "center",
            //         alignItems: "center",
            //         fontSize: 52
            //       }}
            //     >
            //       📁
            //     </div>
            //   </CardPreview>

            //   <CardHeader
            //     header={<span style={{ fontWeight: 600 }}>{proj.name}</span>}
            //   />
            // </Card>
      //        )
      //      )
      //      }
      //    </div>
      // )}
            <div
              key={proj.id}
              className={classes.card}
              role="listitem"
              tabIndex={0}
              aria-label={`Project ${proj.name}`}
              onClick={() => openProjectDetails(proj)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openProjectDetails(proj);
                }
              }}
              style={{
                  width: 240,
                  height: 240,
                  background: "white",
                  borderRadius: 16,
                  padding: 20,
                  margin: "0 auto",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.06)";
                  e.currentTarget.style.boxShadow = "0 10px 24px rgba(0,0,0,0.22)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
                }}
            >
              {/* Three-dot menu (does not trigger card click) */}
              {/* <IconButton
                iconProps={{ iconName: "MoreVertical" }}
                styles={{
                  root: { position: "absolute", top: 6, right: 6 },
                }}
                menuProps={projectMenu(proj)}
                onClick={(e) => e.stopPropagation()}
              /> */}

              {/* Project Thumbnail / Icon */}
              <div 
                className={classes.thumbnail}
                style={{
                    flexGrow: 1,
                    background: colorForProject(proj.name),
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 50,
                    color: "white",
                    textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  }}
              >
                📁
              </div> 

              {/* Project name */}
              <div 
                className={classes.cardTitle} 
                title={proj.name}
              >
                {proj.name}
              </div>
            </div>
            )
           )
           }
         </div>
      )}

      {/* --- Delete confirmation dialog --- */}
      <Dialog
        hidden={!confirmDeleteOpen}
        onDismiss={() => setConfirmDeleteOpen(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: "Delete Project?",
          subText:
            projectPendingDelete
              ? `Are you sure you want to delete project "${projectPendingDelete.name}"? This action cannot be undone.`
              : "Are you sure you want to delete this project? This action cannot be undone.",
        }}
        modalProps={{ isBlocking: true }}
      >
        <DialogFooter>
          <PrimaryButton text="Delete" onClick={confirmDelete} />
          <SecondaryButton text="Cancel" onClick={() => setConfirmDeleteOpen(false)} />
        </DialogFooter>
      </Dialog>

      {/* --- Create project dialog --- */}
      <Dialog
        hidden={!isCreateDialogOpen}
        onDismiss={() => setIsCreateDialogOpen(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: "Create New Project",
          subText: "Enter a name for your new project.",
        }}
        modalProps={{ 
          isBlocking: false,
          // styles: { main: { maxWidth: 1000, width: "90vw" } } 
        }}
      >
        <input
          autoFocus
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          style={{
            width: "100%",
            padding: 8,
            fontSize: 14,
            marginBottom: 10,
          }}
          placeholder="Project name"
          aria-label="Project name"
        />

        <DialogFooter>
          <PrimaryButton
            text="Create Project"
            disabled={!newProjectName.trim()}
            onClick={async () => {
              try {
                const proj = await createProject(userId, newProjectName.trim());
                if (proj) {
                  setProjects((prev) => [...prev, proj]);
                  setToast({
                    message: `Project "${proj.name}" created successfully.`,
                    type: MessageBarType.success,
                  });
                } else {
                  setToast({
                    message: "Failed to create project.",
                    type: MessageBarType.error,
                  });
                }
              } catch {
                setToast({
                  message: "Failed to create project.",
                  type: MessageBarType.error,
                });
              } finally {
                setNewProjectName("");
                setIsCreateDialogOpen(false);
              }
            }}
          />
          <DefaultButton
            text="Cancel"
            onClick={() => {
              setNewProjectName("");
              setIsCreateDialogOpen(false);
            }}
          />
        </DialogFooter>
      </Dialog>

      {/* --- Project details dialog (on card click) --- */}
      {/* <Dialog
        hidden={!isDetailsOpen}
        onDismiss={() => setIsDetailsOpen(false)}
        dialogContentProps={{
          type: DialogType.largeHeader,
          title: selectedProject ? selectedProject.name : "Project",
          // subText:
          //   projectSummary?.documents?.length
          //     ? "Documents and current redaction counts:"
          //     : detailsLoading
          //     ? undefined
          //     : "No documents yet. Upload to get started.",
        }}
        // modalProps={{ isBlocking: false, styles: { main: { maxWidth: 700, width: "90vw" } } }}
        modalProps={{
          isBlocking: false,
          isDarkOverlay: false,
          styles: { 
            main: { 
              width: "1500px",        // ← FORCE width
              maxWidth: "1600px",     // ← prevent shrink
              minWidth: "1500px",
              padding: "24px",
              borderRadius: 12,                    // ← rounded corners
              boxShadow: "0 12px 40px rgba(0,0,0,0.22)", // ← elegant shadow
              animation: "fadeInScale 220ms ease",      // ← animation
              position: "relative"
            } 
          }   // NEW WIDTH
        }}
      >
        */}
        {/* Top-right close button */}
        {/* <IconButton
          iconProps={{ iconName: "ChromeClose" }}
          ariaLabel="Close dialog"
          onClick={() => setIsDetailsOpen(false)}
          styles={{
            root: {
              position: "absolute",
              top: 10,
              right: 10,
              background: "transparent",
              color: "#666",
              zIndex: 10
            },
            rootHovered: {
              background: "#f3f2f1",
              color: "#333"
            }
          }}
        />
        <PrimaryButton
            text="Open Project"
            iconProps={{ iconName: "OpenFolderHorizontal" }}
            onClick={() => navigate(`/project/${selectedProject?.id}`)}
            style={{ marginBottom: 16, marginTop: 4 }}
          /> */}

          
        {/* Description text */}
        {/* <Text variant="mediumPlus" styles={{ root: { marginBottom: 12 } }}>
          Documents and current redaction counts:
        </Text> */}

        {/* Content area */}
        {/* {detailsLoading ? (
          <Spinner label="Loading project details…" />
        ) : detailsError ? (
          <Text style={{ color: theme.palette.red }}>
            {detailsError}
          </Text>
        ) : (
          <>
            {projectSummary?.documents?.length ? (
              <DetailsList
                items={projectSummary.documents}
                columns={columns}
                selectionMode={SelectionMode.none}
                styles={{
                  root: {
                    width: "100%",
                    overflowX: "visible"
                  }
                }}
                compact
              />
            ) : (
              <Text variant="small">This project has no documents yet.</Text>
            )}
          </>
        )}

        <Separator /> */}

        {/* Hidden file input for upload */}
        {/* <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={onFilesChosen}
          aria-hidden="true"
        /> */}

        {/* Actions: Open, Upload, Download, Delete, Close */}
        {/*
        <DialogFooter>
          <PrimaryButton
            text="Open Project"
            iconProps={{ iconName: "OpenFolderHorizontal" }}
            onClick={() => {
              if (selectedProject) {
                navigate(`/project/${selectedProject.id}`);
              }
            }}
          />
          <DefaultButton
            text={isUploading ? "Uploading…" : "Upload documents"}
            iconProps={{ iconName: "Upload" }}
            disabled={isUploading || detailsLoading || !selectedProject}
            onClick={triggerUpload}
          />
          <DefaultButton
            text={isDownloading ? "Preparing…" : "Download all redacted files"}
            iconProps={{ iconName: "Download" }}
            disabled={isDownloading}
            onClick={() => downloadAllRedacted()}
          />
          <DefaultButton
            text="Delete project"
            iconProps={{ iconName: "Delete" }}
            styles={{
              root: { color: theme.palette.red, borderColor: theme.palette.red },
            }}
            onClick={() => {
              if (selectedProject) {
                setIsDetailsOpen(false);
                openDeleteDialog(selectedProject);
              }
            }}
          />
          {/* <SecondaryButton text="Close" onClick={() => setIsDetailsOpen(false)} /> */}
        {/* 
        </DialogFooter>
      </Dialog> */}
      {/* <Panel
        isOpen={isDetailsOpen}
        onDismiss={() => setIsDetailsOpen(false)}
        type={PanelType.custom}
        customWidth="1000px"
        isLightDismiss
        styles={{
          main: {
            borderRadius: "12px 0 0 12px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
            animation: "fadeInPanel 220ms ease",
          }
        }}
        headerText={selectedProject?.name}
        closeButtonAriaLabel="Close"
      /> */}
      <Panel
        isOpen={isDetailsOpen && !!selectedProject}
        onDismiss={() => {
          setIsDetailsOpen(false);
          setSelectedProject(null);
        }}
        headerText={selectedProject?.name ?? ""}
        closeButtonAriaLabel="Close"
        type={PanelType.custom}
        customWidth="1000px"
        isLightDismiss
        styles={{
          main: {
            borderRadius: "12px 0 0 12px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.28)",
            animation: "fadeInPanel 220ms ease",
          },
          header: {
            // keep header compact & aligned
            padding: "12px 24px",
          },
          content: {
            padding: 0, // we’ll pad our own inner wrapper for full edge control
          },
        }}
      >

      {/* <TabList defaultSelectedValue="docs">
        <Tab value="docs">Documents</Tab>
        <Tab value="upload">Upload</Tab>
        <Tab value="stats">Stats</Tab>
      </TabList> */}

      {/* Panel Content */}
      <div style={{ padding: "16px 24px 32px 24px" }}>
        
        {/* Tabbed Interface */}
        <Pivot aria-label="Project Info Tabs">

          {/* Downloading spinner */}
          {isDownloading && (
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999
            }}>
              <Spinner size={SpinnerSize.large} label="Building ZIP…" />
            </div>
          )}

          {/* DOCUMENTS TAB */}
          <PivotItem headerText="Documents">
            <PrimaryButton
              iconProps={{ iconName: "OpenFolderHorizontal" }}
              text="Open Project Workspace"
              // onClick={() => navigate(`/project/${selectedProject?.id}`)}
              onClick={() => selectedProject && openWorkspace(selectedProject.id) }
              style={{ marginBottom: 20 }}
            />

            {detailsLoading && (
              <Spinner label="Loading documents…" style={{ marginBottom: 20 }} />
            )}
            {detailsError && (
              <MessageBar messageBarType={MessageBarType.error} style={{ marginBottom: 20 }}>
                {detailsError}
              </MessageBar>
            )}

            <DetailsList
              items={projectSummary?.documents ?? []}
              columns={columns}
              selectionMode={0}
              styles={{ root: { width: "100%" } }}
            />

            {isAiBatchRunning && (
              <div style={{ marginTop: 12, marginBottom: 12 }}>
                <ProgressIndicator
                  label={aiBatchMessage}
                  percentComplete={aiBatchProgress}
                />
              </div>
            )}

            <DefaultButton
              text={
                isAiBatchRunning
                  ? aiBatchStatus || "Generating AI Suggestions…"
                  : "Generate AI Suggestions for ALL Documents"
              }
              iconProps={{ iconName: "Robot" }}
              disabled={!selectedProject || isAiBatchRunning}
              styles={{
                root: { background: "#0078d4", color: "white", border: "none" },
                rootHovered: { background: "#106ebe" }
              }}
              onClick={menuAsync(handleAiRedactionGeneration)}
              // onClick={menuAsync(async () => {
              //   if (!selectedProject || !projectSummary) return;

              //   const docNames = projectSummary.documents.map((d) => d.name);

              //   setIsAiBatchRunning(true);

              //   try {
              //     await startAiRedactionForProject({
              //       userId,
              //       projectId: selectedProject.id,
              //       documents: docNames,
              //       aiRules, // must be passed into ProjectHome
              //       userInstructions, // also must be passed in
              //       onProgress: ({ fileName, index, total }) => {
              //         setAiBatchStatus(`Starting AI suggestions for ${fileName} (${index}/${total})…`);
              //       }
              //     });

              //     setAiBatchStatus("");
              //     setToast({
              //       message: "AI redaction suggestions generation started for all documents.",
              //       type: MessageBarType.success
              //     });
              //   } catch (err) {
              //     console.error(err);
              //     setToast({
              //       message: "Failed to start AI suggestions generation pipeline.",
              //       type: MessageBarType.error
              //     });
              //   }

              //   setIsAiBatchRunning(false);
              // })}
            />

            {isAiBatchRunning && (
              <DefaultButton
                text="Cancel"
                iconProps={{ iconName: "Cancel" }}
                onClick={() => {
                  aiBatchAbort.current?.abort();
                  setAiBatchMessage("Batch cancelled");
                  setIsAiBatchRunning(false);
                  showToast("AI batch cancelled.", MessageBarType.warning);
                }}
                styles={{ root: { marginLeft: 12 } }}
              />
            )}

            <DefaultButton
              text="Download all redacted documents"
              iconProps={{ iconName: "Download" }}
              onClick={downloadAllRedacted}
              style={{ marginTop: 20 }}
            />
          </PivotItem>

          {/* UPLOAD TAB */}
          <PivotItem headerText="Upload">
            {isUploading && (
              <Spinner label="Uploading…" style={{ marginBottom: 16 }} />
            )}
            <div
              onDrop={async (e) => handleDropUpload(e)}
              onDragOver={(e) => e.preventDefault()}
              style={{
                border: "2px dashed #888",
                borderRadius: 12,
                padding: "40px",
                textAlign: "center",
                cursor: "pointer",
                transition: "0.2s",
              }}
            >
              <span style={{ fontSize: 40 }}>📤</span>
              <h3>Drag & Drop files here</h3>
              <p>or click to browse</p>

              <input
                type="file"
                multiple
                // onChange={handleUploadFiles}
                onChange = {onFilesChosen}
                style={{ display: "none" }}
                ref={fileInputRef}
              />

              <DefaultButton
                text="Browse Files"
                onClick={() => fileInputRef.current?.click()}
              />
            </div>
          </PivotItem>

          {/* BATCH AI JOB HISTORY TAB */}
          <PivotItem headerText="AI History">
            {aiBatchHistory.length === 0 && (
              <Text>No AI tasks have been run yet.</Text>
            )}

            {aiBatchHistory.map((h, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <strong>{h.fileName}</strong> — {h.status} —{" "}
                {new Date(h.timestamp).toLocaleString()}
              </div>
            ))}
          </PivotItem>

          {/* DETAILS TAB */}
          <PivotItem headerText="Details">
            <h3>Project Summary</h3>
            <p>Total documents: {projectSummary?.documents.length ?? 0}</p>
            <p>Total redactions: {projectSummary?.documents.reduce((a, b) => a + b.redactions, 0)}</p>
          </PivotItem>
        </Pivot>

        <DefaultButton
          text="Delete project"
          iconProps={{ iconName: "Delete" }}
          styles={{ root: { color: "red", borderColor: "red", marginTop: 20 } }}
          onClick={() => openDeleteDialog(selectedProject!)}
        />
      </div>
      </Panel>

      {/* --- Settings page dialog --- */}
      {/* <Dialog
        hidden={!isSettingsOpen}
        onDismiss={() => setIsSettingsOpen(false)}
        dialogContentProps={{
          type: DialogType.largeHeader,
          title: "Settings"
        }}
        modalProps={{
          isBlocking: false,
          styles: {
            main: {
              width: "800px",
              maxWidth: "90vw",
              borderRadius: 12,
              padding: 0,
              maxHeight: "90vh",
              overflow: "hidden"
            }
          }
        }}
      >
        <IconButton
          iconProps={{ iconName: "ChromeClose" }}
          ariaLabel="Close"
          onClick={() => setIsSettingsOpen(false)}
          styles={{
            root: {
              position: "absolute",
              top: 10,
              right: 10,
              background: "transparent",
              zIndex: 10
            }
          }}
        /> */}
        {/* This wrapper gives correct padding and scroll */}
        {/* <div style={{ padding: "20px", maxHeight: "80vh", overflowY: "auto" }}>
          <SettingsPage
            rules={aiRules}
            setRules={setAiRules}
            userInstructions={userInstructions}
            setUserInstructions={setUserInstructions}
            availableCategories={[]}   // or pass real categories if desired
          />
        </div>
      </Dialog> */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 5000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              padding: "24px 28px",
              borderRadius: 8,
              width: 640,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Settings</h2>

            <SettingsPage
              rules={aiRules}
              setRules={setAiRules}
              userInstructions={userInstructions}
              setUserInstructions={setUserInstructions}
              // availableCategories={availableCategories}
            />

            <div style={{ textAlign: "right", marginTop: 16 }}>
              <DefaultButton text="Close" onClick={() => setShowSettings(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}