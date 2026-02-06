// import React, { useEffect, useState } from "react";
// import { listUserDocuments } from "../lib/apiClient";
// // import { DefaultButton, PrimaryButton } from "@fluentui/react";
// import { PrimaryButton } from "@fluentui/react";
// import { Link } from "react-router-dom";

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

// src/screens/ProjectHome.tsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listUserDocuments } from "../lib/apiClient";
import { PrimaryButton } from "@fluentui/react";

interface ProjectHomeProps {
  userId: string;
}

type MapProjects = Record<string, string[]>;

export default function ProjectHome({ userId }: ProjectHomeProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<MapProjects>({});

  useEffect(() => {
    (async () => {
      const docs = await listUserDocuments(userId);
      const grouped: MapProjects = {};
      for (const d of docs) {
        if (!grouped[d.projectId]) grouped[d.projectId] = [];
        grouped[d.projectId].push(d.fileName);
      }
      setProjects(grouped);
    })();
  }, [userId]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Projects</h1>

      <PrimaryButton
        text="Create new project"
        onClick={() => {
          const id = crypto.randomUUID();
          navigate(`/project/${id}`);
        }}
      />

      <div style={{ marginTop: 24 }}>
        {Object.entries(projects).length === 0 && <div>No projects yet.</div>}
        {Object.entries(projects).map(([pid, files]) => (
          <div key={pid} style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>
              <Link to={`/project/${pid}`}>{pid}</Link>
            </h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {files.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}