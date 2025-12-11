
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
    console.log("Attempting to require @drift-labs/sdk...");
    const sdk = require('@drift-labs/sdk');
    console.log("Success! Keys:", Object.keys(sdk));
} catch (e) {
    console.error("FAIL:", e);
    console.error("Message:", e.message);
    if (e.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
        console.error("Path not exported!");
    }
}
