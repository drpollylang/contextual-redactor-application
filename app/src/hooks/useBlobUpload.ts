import * as React from "react";
import { getUploadSas, GetUploadSasResponse } from "../lib/apiClient";
import { uploadFileToBlob } from "../lib/blobUpload";

type UploadArgs = {
  file: File;
  container: string;
  blobPath: string;  // raw path is fine; server will normalize/return a raw path
};

export function useBlobUpload() {
  const [isUploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const upload = React.useCallback(async ({ file, container, blobPath }: UploadArgs) => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // 1) Ask the server for SAS (container- or blob-level)
      const resp: GetUploadSasResponse = await getUploadSas({
        containerName: container,
        blobPath,
      });

      // 2) Narrow the union response
      let uploadBase: string | undefined;
      let uploadUrl: string | undefined;
      let effectiveBlobPath = blobPath;

      if ("uploadUrl" in resp) {
        uploadUrl = resp.uploadUrl;
        if (resp.blobPath) effectiveBlobPath = resp.blobPath; // server-normalized path if provided
      } else if ("uploadBase" in resp) {
        uploadBase = resp.uploadBase;
        effectiveBlobPath = resp.blobPath; // required in this branch
      } else {
        throw new Error("Invalid getUploadSas response shape.");
      }

      // 3) Upload to Blob
      await uploadFileToBlob({
        uploadBase,
        uploadUrl,
        blobPath: effectiveBlobPath,  // raw path OK
        file,
        onProgress: (bytes) => setProgress(bytes),
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
      throw e; // surface it if caller needs to react
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, isUploading, progress, error };
}