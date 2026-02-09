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
  SelectionMode,
  Separator,
  useTheme,
  mergeStyleSets,
  TooltipHost,
} from "@fluentui/react";
import { useNavigate } from "react-router-dom";
import { ProjectRecord } from "../helpers/projectHelpers";
import Toast from "../components/Toast";
import JSZip from "jszip";

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
// import { downloadBlob, redactedName } from "../lib/blobPersist";

/** --- Types --- */

interface Project {
  id: string;
  name: string;
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
}: HomePageProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [projectDocumentsRaw, setProjectDocumentsRaw] = useState<any[]>([]);

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

  /** Load all user projects */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await loadProjects(userId);
        setProjects(result);
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
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "28px",
          padding: "0 40px 60px 40px",
          justifyItems: "center"
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

  /** Open details dialog (card click) */
  const openProjectDetails = async (proj: Project) => {
    setSelectedProject(proj);
    setDetailsError(null);
    setProjectSummary(null);
    setIsDetailsOpen(true);
    setDetailsLoading(true);

    const rawDocs = await listUserDocuments(userId);
    setProjectDocumentsRaw(rawDocs.filter(d => d.projectId === proj.id));

    try {
      const summary = await loadProjectSummary(userId, proj.id);
      setProjectSummary(summary);
    } catch (err) {
      setDetailsError("Failed to load project details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  /** Upload documents */
  const triggerUpload = () => fileInputRef.current?.click();

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
        message: "Redacted ZIP downloaded.",
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
        minWidth: 400,
        maxWidth: 700,
        isResizable: true,
        isMultiline: true,
        onRender: (item?: DocumentSummary) => (
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <span role="img" aria-label="document">
              📄
            </span>
            <Text style={{ whiteSpace: "normal" }}>{item?.name}</Text>
          </Stack>
        ),
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
            <Text>{item?.redactions ?? 0}</Text>
          </Stack>
        ),
      },
    ],
    []
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
              onClick={() => navigate("/settings")}
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

      {/* Project Grid */}
      {projects.length === 0 && !loading ? (
        <div className={classes.emptyState}>
          No projects yet. Create your first project to begin.
        </div>
      ) : (
        <div className={classes.grid} role="list">
          {projects.map((proj) => (
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
                  width: 220,
                  height: 220,
                  background: "white",
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 8px 18px rgba(0,0,0,0.18)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 4px 10px rgba(0,0,0,0.12)")}
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
              <div className={classes.thumbnail}>📁</div>

              {/* Project name */}
              <div className={classes.cardTitle} title={proj.name}>
                {proj.name}
              </div>
            </div>
          ))}
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
          styles: { main: { maxWidth: 1000, width: "90vw" } } 
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
      <Dialog
        hidden={!isDetailsOpen}
        onDismiss={() => setIsDetailsOpen(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: selectedProject ? selectedProject.name : "Project",
          subText:
            projectSummary?.documents?.length
              ? "Documents and current redaction counts:"
              : detailsLoading
              ? undefined
              : "No documents yet. Upload to get started.",
        }}
        // modalProps={{ isBlocking: false, styles: { main: { maxWidth: 700, width: "90vw" } } }}
        modalProps={{
          isBlocking: false,
          styles: { main: { maxWidth: 900, width: "90vw" } }   // NEW WIDTH
        }}
      >
        <PrimaryButton
            text="Open Project"
            iconProps={{ iconName: "OpenFolderHorizontal" }}
            onClick={() => navigate(`/project/${selectedProject?.id}`)}
            style={{ marginBottom: 16 }}
          />
        {/* Content area */}
        {detailsLoading ? (
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
                compact
              />
            ) : (
              <Text variant="small">This project has no documents yet.</Text>
            )}
          </>
        )}

        <Separator />

        {/* Hidden file input for upload */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={onFilesChosen}
          aria-hidden="true"
        />

        {/* Actions: Open, Upload, Download, Delete, Close */}
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
          <SecondaryButton text="Close" onClick={() => setIsDetailsOpen(false)} />
        </DialogFooter>
      </Dialog>
    </div>
  );
}