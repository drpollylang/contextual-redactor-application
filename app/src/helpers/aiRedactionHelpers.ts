// src/helpers/aiRedactionHelpers.ts

/**
 * Trigger AI redaction suggestions for a single PDF in storage.
 * This does NOT apply results. It only starts the Durable orchestration.
 */
export async function startAiRedactionOrchestration({
  userId,
  projectId,
  fileName,
  aiRules,
  userInstructions
}: {
  userId: string;
  projectId: string;
  fileName: string;
  aiRules: string[];
  userInstructions: string;
}) {
  const blobPath = `files/${userId}/${projectId}/original/${fileName}`;

  const res = await fetch("/api/start-redaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blobName: blobPath,        // SAME as Workspace
      rules: aiRules,
      userInstructions
    })
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = await res.json();

  return {
    instanceId: data.id,
    statusQueryGetUri: data.statusQueryGetUri
  };
}


/**
 * Trigger AI redaction suggestions for ALL PDFs in a project.
 * Sequential for safety (Durable Functions handles queueing).
 */
export async function startAiRedactionForProject({
  userId,
  projectId,
  documents,
  aiRules,
  userInstructions,
  onProgress
}: {
  userId: string;
  projectId: string;
  documents: string[];     // array of fileNames e.g. ["doc1.pdf"]
  aiRules: string[];
  userInstructions: string;
  onProgress?: (info: { fileName: string; index: number; total: number }) => void;
}) {
  const total = documents.length;

  for (let i = 0; i < total; i++) {
    const fileName = documents[i];

    onProgress?.({ fileName, index: i + 1, total });

    await startAiRedactionOrchestration({
      userId,
      projectId,
      fileName,
      aiRules,
      userInstructions
    });
  }
}