import { app } from '@azure/functions';

// import "./functions/ping";          // minimal test function
import "./functions/getUploadSas";  // your SAS upload function
import "./functions/getDownloadSas";// your SAS download function
import "./functions/listUserDocuments";// list docs in Blob Storage for given userId/projectId
import "./functions/startRedaction";// calls the redaction-backend-func Functions App to initialise and enact the AI suggestions pipeline

app.setup({
    enableHttpStream: true,
});
