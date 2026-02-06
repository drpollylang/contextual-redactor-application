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
    if (!res.ok) {
      console.warn("[loadProjects] listProjects returned", res.status);
      return [];
    }
    // Be resilient if empty body accidentally returned
    const text = await res.text();
    const json = text ? JSON.parse(text) : { projects: [] as string[] };

    const ids = (json?.projects ?? []) as string[];

    // Combine with local names if present
    const locals = await db.table("projects").toArray();
    const nameMap = new Map(locals.map((p: any) => [p.id, p.name]));

    const merged: ProjectRecord[] = ids.map((id) => ({
      id,
      name: nameMap.get(id) ?? id
    }));

    // Ensure Dexie reflects blob set
    for (const p of merged) {
      await db.table("projects").put(p);
    }

    return merged;
  } catch (e) {
    console.error("[loadProjects] failed", e);
    return [];
  }
}


export async function createProject(userId: string, name: string): Promise<ProjectRecord | null> {
  // const name = prompt("Enter project name:");
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