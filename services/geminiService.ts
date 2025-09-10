import { Task, Habit, Project, ApiError } from '../types';

// This file now acts as a a client-side interface to our secure backend proxy.
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

export interface AIScheduledTask {
    id: string;
    startDate: string;
    endDate: string;
}

export interface ResourceMetadata {
    title: string;
    thumbnailUrl: string;
}


// --- Helper Function to Call the Secure API Proxy ---
async function callApiProxy(action: string, payload: any) {
    try {
        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload }),
        });

        // Read the response as text first to avoid JSON parsing errors on server failures
        const responseText = await response.text();

        if (!response.ok) {
            let errorMessage = `API call failed with status ${response.status}`;
            try {
                // Try to parse the text as JSON, it might be a structured error from our function
                const errorJson = JSON.parse(responseText);
                errorMessage = errorJson.message || errorMessage;
            } catch (e) {
                // If parsing fails, the raw text is the error message (e.g., from Vercel)
                if (responseText) {
                    errorMessage = responseText;
                }
            }
            throw new ApiError(errorMessage);
        }
        
        try {
            // Now, safely parse the successful response text
            return JSON.parse(responseText);
        } catch (e) {
            console.error(`API response for '${action}' was not valid JSON:`, responseText);
            throw new ApiError(`The server returned an invalid response for action '${action}'.`);
        }

    } catch (error) {
        console.error(`Error calling API proxy for action '${action}':`, error);
        // Re-throw ApiError as is, wrap other errors
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(`A network error occurred while trying to reach the AI service.`);
    }
}


// --- Refactored API Calls ---

export const parseTextToTasks = async (text: string): Promise<string[]> => {
    const result = await callApiProxy('parseTextToTasks', { text });
    if (result?.tasks && Array.isArray(result.tasks)) {
        return result.tasks;
    }
    throw new ApiError("AI response did not match expected structure for parsing tasks.");
};

export const generateProjectPlan = async (goal: string): Promise<AIGeneratedTask[]> => {
    const result: AIProjectPlan = await callApiProxy('generateProjectPlan', { goal });
    if (result?.tasks) return result.tasks;
    throw new ApiError("AI response did not match expected structure for project plan.");
};

export const generateNewSchedule = async (tasks: Task[], delayedTaskId: string): Promise<AIScheduledTask[]> => {
    const result = await callApiProxy('generateNewSchedule', { tasks, delayedTaskId });
    if (result?.updatedTasks) return result.updatedTasks;
    throw new ApiError("AI response did not match schedule update structure.");
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

export const generateImage = async (prompt: string): Promise<string> => {
    const result = await callApiProxy('generateImage', { prompt });
    if (result?.imageUrl) return result.imageUrl;
    throw new ApiError("No image URL was returned by the API.");
};

export const fetchResourceMetadata = async (url: string): Promise<ResourceMetadata> => {
    const result = await callApiProxy('getResourceMetadata', { url });
    if (result?.title && result?.thumbnailUrl) {
        return result;
    }
    throw new ApiError("API response did not match expected structure for resource metadata.");
};