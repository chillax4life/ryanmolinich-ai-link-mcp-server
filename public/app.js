const API_KEY = 'ai-link-secure-key'; // Default key
const POLL_INTERVAL = 1000;

const agentsList = document.getElementById('agentsList');
const messagesContainer = document.getElementById('messagesContainer');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

// State
let lastMessageCount = 0;
let knownAgents = {};

// Headers
const headers = { 'x-api-key': API_KEY, 'Content-Type': 'application/json' };

async function init() {
    poll();
    setInterval(poll, POLL_INTERVAL);

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

async function poll() {
    await fetchAgents();
    await fetchMessages();
}

async function fetchAgents() {
    try {
        const res = await fetch('/api/agents', { headers });
        const data = await res.json();

        agentsList.innerHTML = '';
        data.agents.forEach(agent => {
            knownAgents[agent.aiId] = agent.name; // Cache names

            const card = document.createElement('div');
            card.className = 'agent-card';
            card.innerHTML = `
                <div class="agent-header">
                    <span class="agent-name">${agent.name}</span>
                    <span class="agent-role">${agent.capabilities[0] || 'Worker'}</span>
                </div>
                <div class="agent-status">${agent.aiId}</div>
            `;
            agentsList.appendChild(card);
        });
    } catch (e) {
        console.error("Agent fetch failed", e);
    }
}

async function fetchMessages() {
    try {
        // Fetch for Master Agent (who sees almost everything as router, or we filter)
        // Ideally we fetch *all* messages relevant to the user (sent by user or sent to user?)
        // The API currently fetches for a specific AI.
        // Hack: Fetch message targeting "master-1" AND messages from "master-1"? 
        // Or simply all messages in DB? 
        // The API /api/messages?aiId=master-1 returns INCOMING messages for master-1.
        // We want to see the CONVERSATION.

        // Better: Fetch messages for "master-1". The user "talks" to Master.
        const res = await fetch('/api/messages?aiId=master-1', { headers });
        const data = await res.json();

        // Only render if count changed (basic opt)
        if (data.count !== lastMessageCount) {
            renderMessages(data.messages);
            lastMessageCount = data.count;
        }
    } catch (e) {
        console.error("Message fetch failed", e);
    }
}

function renderMessages(messages) {
    // Sort by timestamp
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    messagesContainer.innerHTML = ''; // Full re-render (inefficient but safe for now)

    // Add initial system message
    messagesContainer.innerHTML += `
        <div class="message system">
            <div class="bubble">System initialized. Connected to Neural Link.</div>
        </div>
    `;

    messages.forEach(msg => {
        // Determine styling
        const isUser = msg.fromAiId === 'user' || msg.metadata?.source === 'web_dashboard';
        const senderName = isUser ? 'YOU' : (knownAgents[msg.fromAiId] || msg.fromAiId);

        const div = document.createElement('div');
        div.className = `message ${isUser ? 'user' : 'agent'}`;
        // Add data-role for specific coloring based on sender name
        if (!isUser) div.setAttribute('data-role', senderName);

        div.innerHTML = `
            <span class="sender-name">${senderName}</span>
            <div class="bubble">${formatMessage(msg.message)}</div>
        `;
        messagesContainer.appendChild(div);
    });

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatMessage(text) {
    // Basic Markdown-ish
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';

    // Optimistic UI update
    renderMessages([...document.querySelectorAll('.message')].map(el => ({
        // Reconstructing obj from DOM is hard, just let the poll catch it 1s later? 
        // No, provide immediate feedback
    })));
    // Actually, let's just wait for the poll for simplicity, or add a temp node.

    try {
        await fetch('/api/chat', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                from: 'user', // We act as "user"
                to: 'master-1', // We always talk to the Brain
                message: text
            })
        });
        // Force poll immediately
        setTimeout(poll, 100);
    } catch (e) {
        alert("Failed to send: " + e.message);
    }
}

init();
