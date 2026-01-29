import * as React from "react";
import { useBlobUpload } from "../hooks/useBlobUpload";

type Props = {
  container?: string;                     // default: "files"
  blobPathPrefix?: string;                // e.g., "user123/fileA/original"
  onUploaded?: (blobPath: string) => void;
};

const BlobUploader: React.FC<Props> = ({
  container = "files",
  blobPathPrefix = "user123/fileA/original",
  onUploaded,
}) => {
  const { upload, isUploading, progress, error } = useBlobUpload();
  const [file, setFile] = React.useState<File | null>(null);

  const handleUpload = async () => {
    if (!file) return;

    // Prefer raw file name; server will normalize/return raw path.
    // Avoid encodeURIComponent here to keep things simpler.
    const blobPath = `${blobPathPrefix}/${file.name}`;

    await upload({ file, container, blobPath });
    onUploaded?.(blobPath);
    alert("Upload complete");
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        disabled={isUploading}
      />
      <button onClick={handleUpload} disabled={!file || isUploading}>
        {isUploading ? "Uploading…" : "Upload to Blob"}
      </button>
      {isUploading && <small>Uploaded bytes: {progress.toLocaleString()}</small>}
      {error && <small style={{ color: "crimson" }}>Error: {error}</small>}
    </div>
  );
};

export default BlobUploader;