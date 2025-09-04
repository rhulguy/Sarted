import { ProjectGroup, Project, Task, Habit } from './types';

export const COLOR_PALETTE = [
  'bg-red-500', 'bg-orange-500', 'bg-yellow-500',
  'bg-green-500', 'bg-teal-500', 'bg-blue-500',
  'bg-indigo-500', 'bg-purple-500', 'bg-pink-500',
];

export const INITIAL_PROJECT_GROUPS: ProjectGroup[] = [
  { id: 'work', name: 'Work', color: 'bg-blue-500' },
  { id: 'personal', name: 'Personal', color: 'bg-green-500' },
  { id: 'learning', name: 'Learning', color: 'bg-purple-500' },
];

const initialTasks: Task[] = [
    { 
      id: 'task-1', 
      name: 'Design application mockups', 
      description: 'Create detailed wireframes and high-fidelity mockups in Figma.', 
      completed: true,
      subtasks: [],
      startDate: '2024-07-01',
      endDate: '2024-07-05',
    },
    { 
      id: 'task-2', 
      name: 'Develop component library', 
      description: 'Build reusable React components with TypeScript and Tailwind CSS.', 
      completed: false,
      subtasks: [
        { id: 'task-2-1', name: 'Create Button component', description: '', completed: true, subtasks: [], startDate: '2024-07-06', endDate: '2024-07-07' },
        { id: 'task-2-2', name: 'Create Modal component', description: '', completed: false, subtasks: [], startDate: '2024-07-08', endDate: '2024-07-10' },
        { id: 'task-2-3', name: 'Create TaskItem component', description: '', completed: false, subtasks: [], startDate: '2024-07-11', endDate: '2024-07-13' },
      ],
      startDate: '2024-07-06',
      endDate: '2024-07-15',
    },
    { 
      id: 'task-3', 
      name: 'Set up state management', 
      description: 'Implement global state management for projects and tasks.', 
      completed: false,
      subtasks: [],
      startDate: '2024-07-16',
      endDate: '2024-07-18',
      dependencies: ['task-2'],
    },
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Synergize App Development',
    groupId: 'work',
    tasks: initialTasks,
    isHidden: false,
  },
  {
    id: 'proj-2',
    name: 'Weekend Getaway Planning',
    groupId: 'personal',
    tasks: [
        { id: 'task-p1', name: 'Book flights', description: 'Find and book round-trip tickets.', completed: false, subtasks: [], startDate: '2024-08-01', endDate: '2024-08-02' },
        { id: 'task-p2', name: 'Reserve hotel', description: 'Choose a hotel near the city center.', completed: true, subtasks: [], startDate: '2024-08-03', endDate: '2024-08-04' },
    ],
    isHidden: false,
  },
];

export const INITIAL_HABITS: Habit[] = [
  {
    id: 'habit-1',
    name: 'Read for 15 minutes',
    frequency: 'daily',
    color: 'bg-teal-500',
    completions: { '2024-07-25': true, '2024-07-26': true, '2024-07-27': false },
    createdAt: '2024-07-01',
  },
  {
    id: 'habit-2',
    name: 'Go for a run',
    frequency: 'weekly',
    daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    color: 'bg-orange-500',
    completions: { '2024-07-26': true },
    createdAt: '2024-07-01',
  }
];