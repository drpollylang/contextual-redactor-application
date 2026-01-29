import { app } from '@azure/functions';

// import "./functions/ping";          // minimal test function
import "./functions/getUploadSas";  // your SAS upload function
import "./functions/getDownloadSas";// your SAS download function
import "./functions/listUserDocuments";// list docs in Blob Storage for given userId/projectId

app.setup({
    enableHttpStream: true,
});
