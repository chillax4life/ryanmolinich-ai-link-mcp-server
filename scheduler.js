import { getAllTasks, getAllAIs, saveMessage, getMessages } from './database.js';

const POLL_INTERVAL = 1000;

// Track which tasks we've already sent assignment notifications for
const assignedTaskNotifications = new Set();

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
        const allTasks = await getAllTasks();
        const pendingTasks = allTasks.filter(t => t.status === 'pending');

        if (pendingTasks.length === 0) return;

        const allAIs = await getAllAIs();

        for (const task of pendingTasks) {
            // Skip if we've already sent a notification for this task
            if (assignedTaskNotifications.has(task.taskId)) {
                continue;
            }

            const capableAgents = allAIs.filter(ai => {
                if (!task.requiredCapabilities || task.requiredCapabilities.length === 0) return true;
                return task.requiredCapabilities.every(cap => ai.capabilities.includes(cap));
            });

            if (capableAgents.length > 0) {
                const assignee = capableAgents[0];

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

                // Mark as notified to prevent duplicate assignments
                assignedTaskNotifications.add(task.taskId);
                console.error(`[Scheduler] Assigned task ${task.taskId} to ${assignee.aiId}`);
            }
        }
    }

    // Clean up completed task notifications (call this when tasks complete)
    clearTaskNotification(taskId) {
        assignedTaskNotifications.delete(taskId);
    }
}
