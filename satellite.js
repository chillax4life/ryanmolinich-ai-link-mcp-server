
/**
 * Satellite Agent (Remote Worker)
 * Run this on your iMac / Cloud Server to join the AI Swarm.
 * 
 * Usage: 
 *   node satellite.js --master=http://<MACBOOK_IP>:3000 --name=iMac-Forge --cap=gpu-worker
 */

const fetch = global.fetch || (await import('node-fetch')).default;

// Configuration
const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split('=');
    acc[key.replace('--', '')] = value;
    return acc;
}, {});

const MASTER_URL = args.master || 'http://localhost:3000'; // Change to MacBook IP
const AGENT_NAME = args.name || `Satellite-${Math.floor(Math.random() * 1000)}`;
const API_KEY = args.key || 'ai-link-secure-key'; // Default Dev Key
const AI_ID = `satellite-${Math.random().toString(36).substring(7)}`;

const CAPABILITIES = args.cap ? args.cap.split(',') : ['manifest-validator', 'compute-node'];

console.log(`📡 Satellite Agent Starting...`);
console.log(`   ID: ${AI_ID}`);
console.log(`   Name: ${AGENT_NAME}`);
console.log(`   Target: ${MASTER_URL}`);
console.log(`   Key: ${API_KEY.substring(0, 4)}***`);

async function register() {
    try {
        console.log("Connecting to Hive Mind...");
        const res = await fetch(`${MASTER_URL}/api/register_agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify({
                aiId: AI_ID,
                name: AGENT_NAME,
                capabilities: CAPABILITIES,
                metadata: {
                    os: process.platform,
                    arch: process.arch,
                    cpu: 'Remote Worker'
                }
            })
        });

        const data = await res.json();
        if (data.success) {
            console.log(`✅ Registered! Connected to Swarm.`);
            startLoop();
        } else {
            console.error(`❌ Registration Failed: ${data.error}`);
        }
    } catch (e) {
        console.error(`❌ Connection Error: ${e.message}`);
        console.log("Retrying in 5s...");
        setTimeout(register, 5000);
    }
}

async function startLoop() {
    // Poll for messages/tasks every 1s
    setInterval(async () => {
        try {
            const res = await fetch(`${MASTER_URL}/api/messages?aiId=${AI_ID}&unreadOnly=true`);
            const data = await res.json();

            if (data.messages && data.messages.length > 0) {
                console.log(`📨 Received ${data.messages.length} Instructions`);
                for (const msg of data.messages) {
                    processMessage(msg);
                }
            }
        } catch (e) {
            // silent fail on poll
        }
    }, 1000);
}

async function processMessage(msg) {
    const { fromAiId, message } = msg;

    // Simple Command Processor
    console.log(`[MASTER SAYS]: ${message}`);

    // Simulate Work
    if (message.toLowerCase().includes('status')) {
        reply(fromAiId, `System Online. Load: Low.`);
    } else if (message.toLowerCase().includes('scan')) {
        console.log("Running Remote Scan...");
        // Here we would call the local Manifest/Rust binary on the iMac!
        reply(fromAiId, `Scan Complete. No Arb found on Remote Node.`);
    } else {
        reply(fromAiId, `Acknowledged: ${message}`);
    }
}

async function reply(toId, text) {
    try {
        await fetch(`${MASTER_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: AI_ID,
                to: toId,
                message: text,
                messageType: 'response'
            })
        });
    } catch (e) {
        console.error("Failed to reply");
    }
}

register();
