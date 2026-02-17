import { app } from '@azure/functions';

// import "./functions/ping";          // minimal test function
import "./functions/getUploadSas";  // your SAS upload function
import "./functions/getDownloadSas";// your SAS download function
import "./functions/listUserDocuments";// list docs in Blob Storage for given userId/projectId
import "./functions/startRedaction";// calls the redaction-backend-func Functions App to initialise and enact the AI suggestions pipeline
import "./functions/listProjects"; // lists all projects under files/userId/ from Blob Storage
import "./functions/createProjectFolders"; // creates a project folder in Blob storage
import "./functions/deleteProjectFolders"; // deletes a project folder in Blob storage (moves it to /discarded/, which is deleted every 30 days unless it is edited)
import "./functions/debugApi"; 

app.setup({
    enableHttpStream: true,
});
