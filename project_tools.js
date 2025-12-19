import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Load registry
const REGISTRY_PATH = path.resolve('./project_registry.json');
let projectRegistry = {};

try {
    if (fs.existsSync(REGISTRY_PATH)) {
        projectRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    } else {
        console.warn("[ProjectTools] project_registry.json not found.");
    }
} catch (e) {
    console.error("[ProjectTools] Failed to load registry:", e);
}

export const projectTools = [
    {
        name: 'list_projects',
        description: 'List all registered external projects and their paths.',
        inputSchema: {
            type: 'object',
            properties: {},
        }
    },
    {
        name: 'get_project_structure',
        description: 'Get a directory listing of a specific project. Use this to explore the codebase.',
        inputSchema: {
            type: 'object',
            properties: {
                projectName: { type: 'string', description: 'Name of the project from list_projects' },
                relativePath: { type: 'string', description: 'Subdirectory to list, defaults to root' },
                depth: { type: 'number', description: 'Depth of recursion, default 2' }
            },
            required: ['projectName']
        }
    },
    {
        name: 'read_project_file',
        description: 'Read the content of a specific file within a project.',
        inputSchema: {
            type: 'object',
            properties: {
                projectName: { type: 'string' },
                filePath: { type: 'string', description: 'Relative path to the file from project root' }
            },
            required: ['projectName', 'filePath']
        }
    },
    {
        name: 'search_project',
        description: 'Search for a string pattern (grep) within a project.',
        inputSchema: {
            type: 'object',
            properties: {
                projectName: { type: 'string' },
                query: { type: 'string', description: 'The search term or regex' },
                filePattern: { type: 'string', description: 'Optional glob pattern for files (e.g. "*.rs")' }
            },
            required: ['projectName', 'query']
        }
    }
];

export async function handleProjectTool(name, args) {
    switch (name) {
        case 'list_projects':
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(projectRegistry, null, 2)
                }]
            };

        case 'get_project_structure': {
            const { projectName, relativePath = '.', depth = 2 } = args;
            const rootPath = projectRegistry[projectName];
            if (!rootPath) throw new Error(`Project "${projectName}" not found.`);

            const targetPath = path.resolve(rootPath, relativePath);
            // Security check: ensure targetPath is still inside rootPath
            if (!targetPath.startsWith(rootPath)) {
                throw new Error("Access denied: Cannot access files outside project root.");
            }

            try {
                // Use 'tree' command if available, or 'find'
                // Fallback to simple recursive ls with node if needed, but let's try 'find' for portability on mac/linux
                // Mac doesn't always have 'tree'.
                // Let's use 'find' with maxdepth.
                const cmd = `cd "${targetPath}" && find . -maxdepth ${depth} -not -path '*/.*'`;
                const { stdout } = await execPromise(cmd);
                return { content: [{ type: 'text', text: stdout }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `Error listing directory: ${e.message}` }], isError: true };
            }
        }

        case 'read_project_file': {
            const { projectName, filePath } = args;
            const rootPath = projectRegistry[projectName];
            if (!rootPath) throw new Error(`Project "${projectName}" not found.`);

            const targetPath = path.resolve(rootPath, filePath);
            if (!targetPath.startsWith(rootPath)) {
                throw new Error("Access denied: Cannot access files outside project root.");
            }

            if (!fs.existsSync(targetPath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            if (fs.statSync(targetPath).isDirectory()) {
                throw new Error(`Path is a directory, not a file: ${filePath}`);
            }

            const content = fs.readFileSync(targetPath, 'utf-8');
            return { content: [{ type: 'text', text: content }] };
        }

        case 'search_project': {
            const { projectName, query, filePattern } = args;
            const rootPath = projectRegistry[projectName];
            if (!rootPath) throw new Error(`Project "${projectName}" not found.`);

            // Use git grep if it's a git repo (faster), else grep
            // We know they are git repos mostly.
            const isGit = fs.existsSync(path.join(rootPath, '.git'));

            try {
                let cmd;
                if (isGit) {
                    const include = filePattern ? `-- "${filePattern}"` : '';
                    cmd = `cd "${rootPath}" && git grep -n "${query}" ${include} | head -n 20`;
                } else {
                    const include = filePattern ? `--include="${filePattern}"` : '';
                    // recursive grep, line number, max 20 matches
                    cmd = `cd "${rootPath}" && grep -rn "${query}" ${include} . | head -n 20`;
                }

                const { stdout } = await execPromise(cmd);
                if (!stdout) return { content: [{ type: 'text', text: "No matches found." }] };

                return { content: [{ type: 'text', text: stdout }] };
            } catch (e) {
                // git grep returns exit code 1 if no matches, which throws error in execPromise
                if (e.code === 1) return { content: [{ type: 'text', text: "No matches found." }] };
                return { content: [{ type: 'text', text: `Search error: ${e.message}` }], isError: true };
            }
        }

        default:
            throw new Error(`Unknown project tool: ${name}`);
    }
}
