import { app } from '@azure/functions';

// import "./functions/ping";          // minimal test function
import "./functions/getUploadSas";  // your SAS upload function
import "./functions/getDownloadSas";// your SAS download function

app.setup({
    enableHttpStream: true,
});
