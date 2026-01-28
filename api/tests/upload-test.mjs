// quick node script: upload-test.ts
// To get uploadUrl, Use curl -X POST http://localhost:7071/api/getUploadSas -H "Content-Type: application/json" -d '{ "containerName":"files", "blobPath":"user123/fileA/original/test.pdf", "ttlMinutes":10 }'
// Use reponse url as argument to this script
// E.g. node api/tests/upload-test.mjs "<uploadUrl>"

import { BlockBlobClient } from "@azure/storage-blob";
import { readFileSync } from "node:fs";

const uploadUrl = process.argv[2];          // pass the SAS URL as argv[2]
const buffer = readFileSync("./api/tests/local-test.pdf");

(async () => {
  const client = new BlockBlobClient(uploadUrl);
  await client.uploadData(buffer, { blockSize: 4 * 1024 * 1024 });
  console.log("Upload OK");
})();
