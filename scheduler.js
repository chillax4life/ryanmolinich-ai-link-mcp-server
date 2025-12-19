import { getAllTasks, getAllAIs, saveMessage } from './database.js';

const POLL_INTERVAL = 1000; // 1 second

export class Scheduler {
    constructor() {
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.error('[Scheduler] Started Agave-style task pipeline.');
        this.loop();
    }

    stop() {
        this.isRunning = false;
    }

    async loop() {
        while (this.isRunning) {
            try {
                await this.processQueue();
            } catch (error) {
                console.error('[Scheduler] Error in loop:', error);
            }
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }
    }

    async processQueue() {
        // 1. Fetch Pending Tasks (The "Mempool")
        const allTasks = await getAllTasks();
        const pendingTasks = allTasks.filter(t => t.status === 'pending');

        if (pendingTasks.length === 0) return;

        // 2. Fetch Available Agents (The "Bank/Cluster")
        const allAIs = await getAllAIs();

        // 3. Match Tasks to Agents (The "Scheduler")
        for (const task of pendingTasks) {
            // Simple logic: Find first agent with required capabilities
            // Agave upgrade: This could be parallelized or use stake-weighting (priority)

            const capableAgents = allAIs.filter(ai => {
                if (!task.requiredCapabilities || task.requiredCapabilities.length === 0) return true;
                return task.requiredCapabilities.every(cap => ai.capabilities.includes(cap));
            });

            if (capableAgents.length > 0) {
                // Load Balance: Pick random or round-robin?
                // For now, pick the first one.
                const assignee = capableAgents[0];

                // console.error(`[Scheduler] Assigning Task ${task.taskId} to ${assignee.aiId}`);

                // 4. Dispatch Assignment (Push Notification)
                // We don't change status to 'in-progress' yet; we let the Agent claim it.
                // This ensures the Agent is actually alive to accept it.

                await saveMessage({
                    fromAiId: 'system-scheduler',
                    toAiId: assignee.aiId,
                    message: `Please work on task: ${task.taskId}`,
                    messageType: 'notification',
                    metadata: {
                        type: 'task_assignment',
                        taskId: task.taskId,
                        description: task.description
                    },
                    timestamp: new Date().toISOString(),
                    read: false
                });

                // Optimization: Mark task as 'assigning' or similar to prevent double-assignment?
                // For this MVP, we rely on the loop speed vs agent claim speed. 
                // Ideally, we'd have a localized lock or 'assigned_pending' status.
            }
        }
    }
}
