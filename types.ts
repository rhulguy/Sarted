export interface Task {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  subtasks: Task[];
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  dependencies?: string[];
  imageUrl?: string;
  resourceIds?: string[];
}

export interface Project {
  id:string;
  name: string;
  groupId: string;
  tasks: Task[];
  isArchived: boolean;
  icon?: string;
}

export interface ProjectGroup {
  id: string;
  name: string;
  color: string;
}

export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly';
  daysOfWeek?: number[]; // For weekly habits, 0=Sun, 6=Sat
  color: string;
  completions: { [date: string]: boolean }; // e.g., { "2024-07-28": true }
  createdAt: string; // YYYY-MM-DD
}

export interface InboxTask {
  id: string;
  name: string;
  createdAt: number; // timestamp
  isPending?: boolean;
}

export interface Resource {
  id: string;
  url: string;
  title: string;
  notes: string;
  thumbnailUrl: string; // base64 data URL
  projectGroupId: string;
  projectIds: string[];
  isPinned: boolean;
  createdAt: number; // timestamp
}

// --- Mind Map Layout Types ---
// Base node structure used for building hierarchies before layout
export interface BaseMindMapNode {
    id: string;
    name: string;
    children: BaseMindMapNode[];
    isProject: boolean;
    isCompleted: boolean;
    color?: string;
    imageUrl?: string;
    task?: Task;
}

// Node structure after layout algorithm has been applied
export interface LaidoutMindMapNode extends BaseMindMapNode {
    children: LaidoutMindMapNode[];
    x: number;
    y: number;
    // Optional properties for specific layouts
    angle?: number; 
    depth?: number;
}