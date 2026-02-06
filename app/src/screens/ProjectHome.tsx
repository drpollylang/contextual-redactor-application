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
import React, { useEffect, useState } from "react";
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
  // ContextualMenu,
  IContextualMenuProps,
  // MessageBar,
  MessageBarType
} from "@fluentui/react";

import { useNavigate } from "react-router-dom";
import {ProjectRecord } from "../helpers/projectHelpers";
import Toast from "../components/Toast";

interface Project {
  id: string;
  name: string;
}

interface HomePageProps {
  userId: string;
  userName: string;
  loadProjects: (userId: string) => Promise<ProjectRecord[]>;
  createProject: (userId: string, name: string) => Promise<ProjectRecord | null>;
  deleteProject: (userId: string, projectId: string) => Promise<void>;
}

// export default function HomePage({ userId, loadProjects, createProject, deleteProject }) {
export default function ProjectHome({
  userId,
  userName,
  loadProjects,
  createProject,
  deleteProject
}: HomePageProps) {

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const navigate = useNavigate();

  // Dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Toast state
  const [toast, setToast] = useState<null | { message: string; type: MessageBarType }>(null);

  // Load projects
  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await loadProjects(userId); // external function you pass in
      setProjects(result);
      setLoading(false);
    })();
  }, [userId]);

  
  // const handleCreateProject = () => createProject(userId);
  const handleDeleteProject = (id: string) => deleteProject(userId, id);

  const openDeleteDialog = (proj: Project) => {
    setSelectedProject(proj);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedProject) {
      // await deleteProject(selectedProject.id);
      await handleDeleteProject(selectedProject.id);
      setProjects(prev => prev.filter(p => p.id !== selectedProject.id));
      setToast({
            message: `Deleted project "${selectedProject.name}".`,
            type: MessageBarType.warning,
          });
    }
    setConfirmDeleteOpen(false);
    setSelectedProject(null);
  };

  const projectMenu = (proj: Project): IContextualMenuProps => ({
    items: [
      {
        key: "open",
        text: "Open project",
        iconProps: { iconName: "OpenFolderHorizontal" },
        onClick: async () => navigate(`/project/${proj.id}`)
      },
      {
        key: "delete",
        text: "Delete project",
        iconProps: { iconName: "Delete" },
        onClick: () => openDeleteDialog(proj)
      }
    ]
  });

  return (
    <div style={{ height: "100vh", padding: "20px", position: "relative" }}>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Spinner overlay */}
      {loading && (
        <div style={{
          position: "absolute",
          top: 0, left: 0,
          width: "100%", height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "rgba(255,255,255,0.7)",
          zIndex: 999
        }}>
          <Spinner size={SpinnerSize.large} label="Loading your projects…" />
        </div>
      )}

      {/* Top bar */}
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center" styles={{ root: { marginBottom: 30 } }}>
        
        {/* Left spacer: keeps "Create Project" centered */}
        <div style={{ width: 100 }}></div>

        {/* Centered Create Project */}
        <DefaultButton
          text="Create New Project"
          iconProps={{ iconName: "Add" }}
          // onClick={handleCreateProject}
          onClick={() => setIsCreateDialogOpen(true)}
          styles={{ root: { height: 40, fontSize: 16, padding: "0 20px" } }}
        />

        {/* User + settings */}
        <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
          
          <IconButton
            iconProps={{ iconName: "Settings" }}
            title="Settings"
            ariaLabel="Settings"
            onClick={() => navigate("/settings")}
          />

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
        <div style={{
          textAlign: "center",
          marginTop: 100,
          opacity: 0.5,
          fontSize: 18
        }}>
          No projects yet. Create your first project to begin.
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "24px",
          padding: "10px"
        }}>
          {projects.map(proj => (
            <div key={proj.id}
              style={{
                background: "white",
                borderRadius: 8,
                padding: 14,
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                position: "relative"
              }}
            >
              {/* Three-dot menu */}
              <IconButton
                iconProps={{ iconName: "MoreVertical" }}
                styles={{
                  root: {
                    position: "absolute",
                    top: 6, right: 6
                  }
                }}
                menuProps={projectMenu(proj)}
              />

              {/* Project Thumbnail / Icon */}
              <div style={{
                width: "100%",
                height: 110,
                background: "#f3f2f1",
                borderRadius: 6,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: 28,
                color: "#605e5c"
              }}>
                📁
              </div>

              {/* Project name */}
              <div style={{
                marginTop: 10,
                textAlign: "center",
                fontSize: 15,
                fontWeight: 500
              }}>
                {proj.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        hidden={!confirmDeleteOpen}
        onDismiss={() => setConfirmDeleteOpen(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: "Delete Project?",
          subText:
            selectedProject ?
            `Are you sure you want to delete project "${selectedProject.name}"? This action cannot be undone.`: 
            "Are you sure you want to delete this project? This action cannot be undone.",
        }}
        modalProps={{ isBlocking: true }}
      >
        <DialogFooter>
          <PrimaryButton text="Delete" onClick={confirmDelete} />
          <SecondaryButton text="Cancel" onClick={() => setConfirmDeleteOpen(false)} />
        </DialogFooter>
      </Dialog>

      {/* Create project dialog */}
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
        }}
      >
        <input
          autoFocus
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            fontSize: 14,
            marginBottom: 10,
          }}
          placeholder="Project name"
        />

        <DialogFooter>
          <PrimaryButton
            text="Create Project"
            disabled={!newProjectName.trim()}
            onClick={async () => {
              const proj = await createProject(userId, newProjectName.trim());
              if (proj) {
                setProjects((prev) => [...prev, proj]);

                // Show success toast
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

              setNewProjectName("");
              setIsCreateDialogOpen(false);
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

    </div>
  );
}