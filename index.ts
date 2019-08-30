import {parseArgv} from "./argsParser";
import {downloadManga} from "./downloadManga";

parseArgv(process.argv)
    .then(downloadManga)
    .then(() => new Promise(resolve => {
        console.log("Wait for pdf file stream is closed...");
        setTimeout(() => resolve(), 3000);
    }))
    .then(() => process.exit(0))
    .catch(err => {
        if (err) {
            console.error(err);
            process.exit(1);
        } else {
            process.exit(0);
        }
    });
