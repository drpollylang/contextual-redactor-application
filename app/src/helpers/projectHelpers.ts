import { db } from "../storage";
import { v4 as uuidv4 } from "uuid";

import {
  listUserDocuments,
  getDownloadSas 
} from "../lib/apiClient";
import { saveOriginalPdfToBlob } from "../lib/blobPersist";

export interface ProjectRecord {
  id: string;
  name: string;
}

type HighlightsPayload = {
  pdfId: string;
  fileName: string;
  allHighlights: any[];
  activeHighlights: string[];
  savedAt?: string;
};

export async function loadProjectSummary(userId: string, projectId: string) {
  const all = await listUserDocuments(userId);
  const docs = all.filter(d => d.projectId === projectId);

  const documents = [];

  for (const d of docs) {
    let redactions = 0;

    if (d.highlightsPath) {
      const { downloadUrl } = await getDownloadSas({
        containerName: "files",
        blobPath: d.highlightsPath,
        ttlMinutes: 5
      });

      const url = downloadUrl.replace(/&amp;amp;amp;/g, "&").replace(/&amp;amp;/g, "&");
      const res = await fetch(url);

      if (res.ok) {
        const json = (await res.json()) as HighlightsPayload;
        redactions = (json.activeHighlights ?? []).length;
      }
    }

    documents.push({
      id: d.fileName,
      name: d.fileName,
      redactions
    });
  }

  return {
    project: { id: projectId, name: projectId },
    documents
  };
}

/** Upload one or more documents to a project using EXACT ProjectWorkspace logic */
export async function uploadDocuments(
  userId: string,
  projectId: string,
  files: File[]
) {
  for (const file of files) {
    await saveOriginalPdfToBlob(userId, projectId, file);
  }
}

/** Download all documents in a project as individual files (same logic as Workspace) */
export async function downloadAll(
  userId: string,
  projectId: string
): Promise<Blob> 
{
  const docs = await listUserDocuments(userId);
  const docsForProject = docs.filter(d => d.projectId === projectId);

  // Build a ZIP file dynamically
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const d of docsForProject) {
    const { originalPath, workingPath } = d;

    const blobPath = workingPath || originalPath;
    if (!blobPath) continue;

    // Same code your Workspace uses
    const { downloadUrl } = await getDownloadSas({
      containerName: "files",
      blobPath,
      ttlMinutes: 10
    });

    const realUrl = downloadUrl.replace(/&amp;amp;amp;/g, "&").replace(/&amp;amp;/g, "&");
    const res = await fetch(realUrl);
    const blob = await res.blob();

    zip.file(d.fileName, blob);
  }

  return await zip.generateAsync({ type: "blob" });
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

