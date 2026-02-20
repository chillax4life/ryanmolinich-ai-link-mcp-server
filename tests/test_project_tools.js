import { projectTools, handleProjectTool } from '../project_tools.js';

async function test() {
    console.log("Testing Project Tools...");

    // 1. List Projects
    console.log("\n--- Testing list_projects ---");
    const listResult = await handleProjectTool('list_projects', {});
    console.log(listResult.content[0].text);

    // 2. Search Project (Flash SDK)
    console.log("\n--- Testing search_project (flash-sdk) ---");
    try {
        const searchResult = await handleProjectTool('search_project', {
            projectName: 'flash-sdk',
            query: 'FlashTrade',
            filePattern: '*.rs'
        });
        console.log("Search matches (first 100 chars):", searchResult.content[0].text.substring(0, 100) + "...");
    } catch (e) {
        console.error("Search failed:", e);
    }

    // 3. Get Project Structure (Flash SDK)
    console.log("\n--- Testing get_project_structure (flash-sdk) ---");
    try {
        const treeResult = await handleProjectTool('get_project_structure', {
            projectName: 'flash-sdk',
            depth: 1
        });
        console.log(treeResult.content[0].text);
    } catch (e) {
        console.error("Tree failed:", e);
    }

    // 4. Read File (Read Cargo.toml from flash-sdk)
    console.log("\n--- Testing read_project_file (flash-sdk/Cargo.toml) ---");
    try {
        const fileResult = await handleProjectTool('read_project_file', {
            projectName: 'flash-sdk',
            filePath: 'Cargo.toml'
        });
        console.log("File content (first 5 lines):");
        console.log(fileResult.content[0].text.split('\n').slice(0, 5).join('\n'));
    } catch (e) {
        console.error("Read file failed:", e);
    }
}

test();
