import { MasterAgent } from '../agents/MasterAgent.js';

async function runTest() {
    console.log("🧠 Testing Master Agent (The Brain)...");

    const mockClient = {
        callTool: async (tool) => {
            if (tool.name === 'register_ai') return { content: [{ text: 'OK' }] };
            if (tool.name === 'read_messages') return { content: [{ text: JSON.stringify({ messageCount: 0 }) }] };
            if (tool.name === 'send_message') {
                console.log(`[MockNetwork] Message sent to ${tool.arguments.toAiId}: "${tool.arguments.message}"`);
                return { content: [{ text: 'OK' }] };
            }
            return { content: [{ text: 'OK' }] };
        }
    };

    const agent = new MasterAgent({
        aiId: 'master-1',
        name: 'Master Brain',
        geminiApiKey: 'mock-key' // Fake key to trigger LLM path
    });

    // MOCK LLM
    // We overwrite the model to avoid hitting Google API during test
    agent.model = {
        generateContent: async (prompt) => {
            const p = prompt.toString().toLowerCase();
            console.log(`[MockLLM] Received Prompt: "${p.substring(0, 50)}..."`);

            // Simulation Logic
            // Check for explicit user intent words to distinct from system prompt text
            if (p.includes('user request: "open a long')) {
                return {
                    response: {
                        text: () => JSON.stringify({
                            action: "delegate",
                            targetAiId: "drift-1",
                            message: "Long SOL 0.1"
                        })
                    }
                };
            }

            if (p.includes('user request: "check the price')) {
                return {
                    response: {
                        text: () => JSON.stringify({
                            action: "delegate",
                            targetAiId: "oracle-1",
                            message: "Check price of SOL"
                        })
                    }
                };
            }
            return { response: { text: () => JSON.stringify({ message: "I don't understand." }) } };
        }
    };

    try {
        await agent.initialize(mockClient);

        console.log("\n1. Testing Oracle Delegation...");
        const res1 = await agent.processRequest("Check the price of SOL");
        console.log(`Result: ${res1}`);
        if (res1.includes("Delegated task to oracle-1")) console.log("✅ Oracle Delegation Passed");
        else console.error("❌ Oracle Delegation Failed");

        console.log("\n2. Testing Drift Delegation...");
        const res2 = await agent.processRequest("Open a Long position on SOL");
        console.log(`Result: ${res2}`);
        if (res2.includes("Delegated task to drift-1")) console.log("✅ Drift Delegation Passed");
        else console.error("❌ Drift Delegation Failed");

        console.log("\n3. Testing Regex Fallback (Simulate no model)...");
        agent.model = null; // Disable LLM
        const res3 = await agent.processRequest("Check price");
        console.log(`Result: ${res3}`);
        if (res3.includes("Routed request to oracle-1")) console.log("✅ Regex Fallback Passed");
        else console.error("❌ Regex Fallback Failed");

    } catch (e) {
        console.error("❌ Test Failed:", e);
    }
}

runTest();
