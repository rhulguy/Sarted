import { GoogleGenAI, Type } from "@google/genai";
import { Buffer } from 'buffer';

// This function is a Vercel Serverless Function, which runs on the server.
// It is safe to use environment variables here.
// The API key MUST be set in your Vercel project settings.
if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define schemas for validation/parsing, similar to the original geminiService
const taskSchemaProperties = {
    name: { type: Type.STRING, description: "A concise, actionable name for the task." },
    description: { type: Type.STRING, description: "A one-sentence description of the task." },
    startDate: { type: Type.STRING, description: "The estimated start date in YYYY-MM-DD format." },
    endDate: { type: Type.STRING, description: "The estimated end date in YYYY-MM-DD format." },
};
const subTaskLevel2 = { type: Type.OBJECT, properties: { ...taskSchemaProperties }, required: ["name", "description", "startDate", "endDate"] };
const subTaskLevel1 = { type: Type.OBJECT, properties: { ...taskSchemaProperties, subtasks: { type: Type.ARRAY, items: subTaskLevel2 } }, required: ["name", "description", "startDate", "endDate"] };
const projectPlanSchema = { type: Type.OBJECT, properties: { tasks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { ...taskSchemaProperties, subtasks: { type: Type.ARRAY, items: subTaskLevel1 } }, required: ["name", "description", "startDate", "endDate"] } } }, required: ["tasks"]};
const scheduleUpdateSchema = { type: Type.OBJECT, properties: { updatedTasks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, startDate: { type: Type.STRING }, endDate: { type: Type.STRING } }, required: ["id", "startDate", "endDate"] } } }, required: ["updatedTasks"] };
const textToTasksSchema = { type: Type.OBJECT, properties: { tasks: { type: Type.ARRAY, items: { type: Type.STRING, description: "A single task name." } } }, required: ["tasks"]};


// This is the single entry point for our serverless function.
// Vercel requires a default export that is a request handler.
export default async function handler(request: any, response: any) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { action, payload } = request.body;
        let result;

        switch (action) {
            case 'generateProjectPlan':
                result = await handleGenerateProjectPlan(payload);
                break;
            case 'generateNewSchedule':
                result = await handleGenerateNewSchedule(payload);
                break;
            case 'generateWeeklySummary':
                result = await handleGenerateWeeklySummary(payload);
                break;
            case 'generateImage':
                result = await handleGenerateImage(payload);
                break;
            case 'getResourceMetadata':
                result = await handleGetResourceMetadata(payload);
                break;
            case 'parseTextToTasks':
                result = await handleParseTextToTasks(payload);
                break;
            default:
                return response.status(400).json({ message: 'Invalid action' });
        }

        return response.status(200).json(result);
    } catch (error: any) {
        console.error(`Error in serverless function action:`, error);
        return response.status(500).json({ message: error.message || 'An internal server error occurred.' });
    }
}

// --- Handler Functions for each action ---

const handleParseTextToTasks = async (payload: any) => {
    const { text } = payload;
    const prompt = `Parse the following text into a JSON object containing a list of actionable tasks. Adhere strictly to the provided schema.

TEXT:
"""
${text}
"""

SCHEMA:
{"type":"OBJECT","properties":{"tasks":{"type":"ARRAY","items":{"type":"STRING"}}}}`;

    const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: textToTasksSchema },
    });

    const responseText = geminiResponse.text?.trim();
    if (!responseText) {
        throw new Error("AI returned an empty response for parsing text.");
    }
    try {
        // Handle potential markdown code blocks ```json ... ```
        const jsonString = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse Gemini JSON response for text-to-task:", responseText);
        throw new Error("AI returned an invalid data format while parsing tasks.");
    }
};

const handleGenerateProjectPlan = async (payload: any) => {
    const { goal } = payload;
    const today = new Date().toISOString().split('T')[0];
    const prompt = `You are a world-class project management assistant. Break down the user's high-level goal into a concrete, actionable project plan. Generate a hierarchical list of tasks with sub-tasks. For each task, provide a name, description, and estimated start/end dates in YYYY-MM-DD format. Assume today is ${today}. Ensure parent task dates encompass their sub-tasks. Return at least 3-4 top-level tasks. Goal: "${goal}"`;
    
    const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: projectPlanSchema },
    });
    
    const text = geminiResponse.text?.trim();
    if (!text) {
        throw new Error("AI returned an empty response.");
    }
    try {
        const jsonString = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse Gemini JSON response for project plan:", text);
        throw new Error("AI returned an invalid data format. Please try rephrasing your goal.");
    }
};

const handleGenerateNewSchedule = async (payload: any) => {
    const { tasks, delayedTaskId } = payload;
    const today = new Date().toISOString().split('T')[0];
    const prompt = `You are a project scheduling expert. The task with ID '${delayedTaskId}' is overdue. Reschedule it and all its dependent tasks to create a new, realistic plan. The delayed task must start no earlier than today, ${today}. Maintain all dependency links. Return a list of all tasks that need date changes with their new start and end dates. Project Data: ${JSON.stringify(tasks)}`;
    
    const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: scheduleUpdateSchema },
    });

    const text = geminiResponse.text?.trim();
    if (!text) {
         throw new Error("AI returned an empty response for rescheduling.");
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse Gemini JSON response for schedule update:", text);
        throw new Error("AI returned an invalid data format for the schedule update.");
    }
};

const handleGenerateWeeklySummary = async (payload: any) => {
    const { completedTasks, completedHabits } = payload;
    const prompt = `You are an encouraging productivity coach. Here is my activity from the last week: I completed ${completedTasks.length} tasks and performed these habits: ${JSON.stringify(completedHabits)}. Write a brief, positive, and motivational summary of my accomplishments (2-3 sentences). Focus on celebrating the progress.`;
    
    const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
    });
    
    return { summary: geminiResponse.text?.trim() ?? '' };
};

const handleGenerateImage = async (payload: any) => {
    const { prompt } = payload;
    const geminiResponse = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: `An inspiring, photorealistic image for a dream board about: "${prompt}".`,
        config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: '16:9' },
    });

    if (geminiResponse.generatedImages?.[0]?.image?.imageBytes) {
        return { imageUrl: `data:image/png;base64,${geminiResponse.generatedImages[0].image.imageBytes}` };
    }
    
    throw new Error("No image was generated by the API.");
};

const handleGetResourceMetadata = async (payload: any) => {
    const { url } = payload;
    if (!url) throw new Error("URL is required.");

    try {
        const urlObject = new URL(url);
        const title = urlObject.hostname.replace('www.', '');

        // A simple placeholder image using an SVG data URL
        const placeholderSvg = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Placeholder: Thumbnail" preserveAspectRatio="xMidYMid slice" focusable="false"><title>Placeholder</title><rect width="100%" height="100%" fill="#868e96"></rect><text x="50%" y="50%" fill="#dee2e6" dy=".3em" text-anchor="middle">${title}</text></svg>`;
        const thumbnailUrl = `data:image/svg+xml;base64,${Buffer.from(placeholderSvg).toString('base64')}`;

        return { title, thumbnailUrl };
    } catch (e) {
        throw new Error("Invalid URL provided.");
    }
};