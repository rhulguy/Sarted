import { Task, Habit, Project } from '../types';

// This file now acts as a client-side interface to our secure backend proxy.
// It no longer imports or uses @google/genai directly.

// --- Type Definitions for AI Response (matching frontend needs) ---
export interface AIGeneratedTask {
    name: string;
    description: string;
    startDate?: string;
    endDate?: string;
    subtasks?: AIGeneratedTask[];
}

export interface AIProjectPlan {
    tasks: AIGeneratedTask[];
}

export interface AIFocusPlan {
    priorities: {
        taskId: string;
        reason: string;
    }[];
}

export interface AIScheduledTask {
    id: string;
    startDate: string;
    endDate: string;
}


// --- Helper Function to Call the Secure API Proxy ---
async function callApiProxy(action: string, payload: any) {
    try {
        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `API call for action '${action}' failed with status ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error calling API proxy for action '${action}':`, error);
        throw error; // Re-throw the error to be caught by the calling function
    }
}


// --- Refactored API Calls ---

export const generateProjectPlan = async (goal: string): Promise<AIGeneratedTask[]> => {
    try {
        const result: AIProjectPlan = await callApiProxy('generateProjectPlan', { goal });
        if (result?.tasks) return result.tasks;
        throw new Error("API response did not match expected structure for project plan.");
    } catch (error) {
        throw new Error(`Failed to generate project plan. ${error instanceof Error ? error.message : 'Please check the console for details.'}`);
    }
};

export const generateFocusPlan = async (projects: Project[], habits: Habit[]): Promise<AIFocusPlan> => {
    try {
        const result: AIFocusPlan = await callApiProxy('generateFocusPlan', { projects, habits });
        if (result?.priorities) return result;
        throw new Error("API response did not match focus plan structure.");
    } catch (error) {
        throw new Error(`Failed to generate today's focus plan. ${error instanceof Error ? error.message : ''}`);
    }
};

export const generateNewSchedule = async (tasks: Task[], delayedTaskId: string): Promise<AIScheduledTask[]> => {
    try {
        const result = await callApiProxy('generateNewSchedule', { tasks, delayedTaskId });
        if (result?.updatedTasks) return result.updatedTasks;
        throw new Error("API response did not match schedule update structure.");
    } catch (error) {
        throw new Error(`Failed to generate a new schedule. ${error instanceof Error ? error.message : ''}`);
    }
};

export const generateWeeklySummary = async (completedTasks: Task[], completedHabits: { name: string, count: number }[]): Promise<string> => {
    try {
        const result = await callApiProxy('generateWeeklySummary', { completedTasks, completedHabits });
        return result?.summary || "Could not generate your weekly summary, but keep up the great work!";
    } catch (error) {
        console.error("Error generating weekly summary:", error);
        return "Could not generate your weekly summary, but keep up the great work!";
    }
};

export const generateImageForTask = async (prompt: string): Promise<string> => {
    try {
        const result = await callApiProxy('generateImageForTask', { prompt });
        if (result?.imageUrl) return result.imageUrl;
        throw new Error("No image URL was returned by the API.");
    } catch (error) {
        throw new Error(`Failed to generate image. ${error instanceof Error ? error.message : 'Please check your API key permissions and try again.'}`);
    }
};
