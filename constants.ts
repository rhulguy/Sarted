import { ProjectGroup, Project, Habit, Resource } from './types';

export const COLOR_PALETTE = [
  'bg-brand-teal', 'bg-brand-orange', 'bg-brand-purple',
  'bg-brand-pink', 'bg-accent-blue', 'bg-accent-green',
  'bg-accent-yellow', 'bg-accent-red', 'bg-indigo-500',
];

export const COLOR_MAP: { [key: string]: string } = {
  'bg-brand-teal': '#14B8A6',
  'bg-brand-orange': '#F97316',
  'bg-brand-purple': '#8B5CF6',
  'bg-brand-pink': '#EC4899',
  'bg-accent-blue': '#3B82F6',
  'bg-accent-green': '#10B981',
  'bg-accent-yellow': '#FBBF24',
  'bg-accent-red': '#EF4444',
  'bg-indigo-500': '#6366F1',
};

export const GROUP_ICON_OPTIONS = ['💼', '👥', '💡', '💰', '📈', '🏠', '❤️', '💊', '🗺️', '🏋️', '🧘', '🌐', '📚', '🎨', '🚀'];


export const INITIAL_PROJECT_GROUPS: ProjectGroup[] = [
  { id: 'group-1', name: 'Work', color: 'bg-accent-blue', order: 0, icon: '💼' },
  { id: 'group-2', name: 'Personal', color: 'bg-brand-purple', order: 1, icon: '👥' },
  { id: 'group-3', name: 'Learning', color: 'bg-accent-green', order: 2, icon: '📚' },
  { id: 'group-4', name: 'Health & Fitness', color: 'bg-brand-orange', order: 3, icon: '❤️' },
  { id: 'group-5', name: 'Home & Errands', color: 'bg-accent-yellow', order: 4, icon: '🏠' },
];

export const INITIAL_PROJECTS: Project[] = [
  // Work
  { id: 'proj-1', name: 'Q4 Marketing Plan', groupId: 'group-1', tasks: [], isArchived: false, icon: '📈' },
  { 
    id: 'proj-2', 
    name: 'Website Redesign', 
    groupId: 'group-1', 
    tasks: [
        { id: 'task-2-1', name: 'Phase 1: Research', completed: true, description: 'Analyze competitor sites and user feedback.', startDate: '2024-08-01', endDate: '2024-08-07', subtasks: [
            { id: 'task-2-1-1', name: 'User Persona Interviews', completed: true, description: '', subtasks: [], startDate: '2024-08-01', endDate: '2024-08-03' },
            { id: 'task-2-1-2', name: 'Competitor Analysis', completed: true, description: '', subtasks: [], startDate: '2024-08-04', endDate: '2024-08-07' },
        ]},
        { id: 'task-2-2', name: 'Phase 2: Design', completed: false, description: 'Create wireframes and mockups.', startDate: '2024-08-08', endDate: '2024-08-21', subtasks: [
             { id: 'task-2-2-1', name: 'Homepage Wireframe', completed: true, description: '', subtasks: [], startDate: '2024-08-08', endDate: '2024-08-14' },
             { id: 'task-2-2-2', name: 'Final Mockups', completed: false, description: '', subtasks: [], startDate: '2024-08-15', endDate: '2024-08-21' },
        ]},
        { id: 'task-2-3', name: 'Phase 3: Development', completed: false, description: 'Build and deploy the new website.', startDate: '2024-08-22', endDate: '2024-09-12', subtasks: []},
    ], 
    isArchived: false, 
    icon: '🎨' 
  },
  // Personal
  { 
    id: 'proj-3', 
    name: 'Vacation Planning', 
    groupId: 'group-2', 
    tasks: [
        { id: 'task-3-1', name: 'Book Flights', completed: false, description: 'Find best deals for flights to Hawaii.', startDate: '2024-09-01', endDate: '2024-09-05', subtasks: [] },
        { id: 'task-3-2', name: 'Book Hotel', completed: false, description: 'Reserve beachfront hotel.', startDate: '2024-09-06', endDate: '2024-09-10', subtasks: [] },
        { id: 'task-3-3', name: 'Plan Itinerary', completed: false, description: 'List out daily activities and tours.', startDate: '2024-09-11', endDate: '2024-09-15', subtasks: [] },
    ], 
    isArchived: false, 
    icon: '✈️' 
  },
  { id: 'proj-4', name: 'Side Project: "sarted"', groupId: 'group-2', tasks: [], isArchived: false, icon: '🚀' },
  // Learning
  { id: 'proj-5', name: 'Learn TypeScript', groupId: 'group-3', tasks: [], isArchived: false, icon: '📚' },
  // Health & Fitness
  { id: 'proj-6', name: 'Marathon Training', groupId: 'group-4', tasks: [], isArchived: false, icon: '🏃' },
  // Home & Errands
  { id: 'proj-7', name: 'Garden Overhaul', groupId: 'group-5', tasks: [], isArchived: false, icon: '🌿' },
];


export const INITIAL_HABITS: Habit[] = [
  {
    id: 'habit-1',
    name: 'Read for 15 minutes',
    frequency: 'daily',
    color: 'bg-brand-teal',
    completions: { '2024-07-25': true, '2024-07-26': true, '2024-07-27': false },
    createdAt: '2024-07-01',
    projectId: 'proj-5',
    projectGroupId: undefined,
  },
  {
    id: 'habit-2',
    name: 'Go for a run',
    frequency: 'weekly',
    daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    color: 'bg-brand-orange',
    completions: { '2024-07-26': true },
    createdAt: '2024-07-01',
    projectId: undefined,
    projectGroupId: 'group-4',
  }
];

export const INITIAL_RESOURCES: Resource[] = [
    {
        id: 'res-1',
        url: 'https://react.dev/',
        title: 'react.dev',
        notes: 'The new official React documentation.',
        thumbnailUrl: `https://www.google.com/s2/favicons?sz=128&domain=react.dev`,
        projectGroupId: 'group-3',
        projectIds: ['proj-5'],
        isPinned: true,
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    },
    {
        id: 'res-2',
        url: 'https://tailwindcss.com/',
        title: 'tailwindcss.com',
        notes: 'A utility-first CSS framework for rapid UI development.',
        thumbnailUrl: `https://www.google.com/s2/favicons?sz=128&domain=tailwindcss.com`,
        projectGroupId: 'group-1',
        projectIds: ['proj-2'],
        isPinned: false,
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 1,
    }
];