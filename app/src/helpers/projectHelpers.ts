import { db } from "../storage";
import { v4 as uuidv4 } from "uuid";

export interface ProjectRecord {
  id: string;
  name: string;
}

export async function loadProjects(userId: string): Promise<ProjectRecord[]> {
  try {
    // 1) Load from Blob Storage
    const res = await fetch(`/api/listProjects?userId=${encodeURIComponent(userId)}`);
    const json = await res.json();
    const projectIds = json.projects as string[];

    // 2) For each project ID, look for its stored name in Dexie (fallback to ID)
    const localProjects = await db.table("projects").toArray();
    const map = new Map(localProjects.map(p => [p.id, p.name]));

    const merged = projectIds.map(id => ({
      id,
      name: map.get(id) ?? id   // fallback
    }));

    // 3) Ensure Dexie knows about all Blob projects
    for (const p of merged) {
      await db.table("projects").put(p);
    }

    return merged;

  } catch (e) {
    console.error("[loadProjects] failed", e);
    return [];
  }
}


export async function createProject(userId: string): Promise<ProjectRecord | null> {
  const name = prompt("Enter project name:");
  if (!name || !name.trim()) return null;

  const projectId = uuidv4();

  try {
    // 1) Create folder in Blob Storage
    await fetch("/api/createProjectFolder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        projectId
      })
    });

    // 2) Store metadata locally
    const project: ProjectRecord = { id: projectId, name: name.trim() };
    await db.table("projects").put(project);

    return project;

  } catch (e) {
    console.error("[createProject] failed", e);
    return null;
  }
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  try {
    // 1) Move project folder to /discarded
    await fetch("/api/deleteProjectFolder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projectId })
    });

    // 2) Delete local metadata
    await db.table("projects").delete(projectId);

    // 3) Delete all PDFs belonging to this project
    const pdfs = await db.pdfs.toArray();
    const toRemove = pdfs.filter(p => p.id.startsWith(projectId + "::"));
    for (const pdf of toRemove) {
      await db.pdfs.delete(pdf.id);
    }

  } catch (e) {
    console.error("[deleteProject] failed", e);
  }
}