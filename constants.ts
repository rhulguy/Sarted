import { ProjectGroup, Project, Habit, Resource } from './types';

export const COLOR_PALETTE = [
  'bg-red-500', 'bg-orange-500', 'bg-yellow-500',
  'bg-green-500', 'bg-teal-500', 'bg-blue-500',
  'bg-indigo-500', 'bg-purple-500', 'bg-pink-500',
];

export const INITIAL_PROJECT_GROUPS: ProjectGroup[] = [
  { id: '1', name: '1', color: 'bg-red-500' },
  { id: '2', name: '2', color: 'bg-orange-500' },
  { id: '3', name: '3', color: 'bg-yellow-500' },
  { id: '4', name: '4', color: 'bg-green-500' },
  { id: '5', name: '5', color: 'bg-teal-500' },
  { id: '6', name: '6', color: 'bg-indigo-500' },
  { id: '7', name: '7', color: 'bg-purple-500' },
];

export const INITIAL_PROJECTS: Project[] = [
  // Group 1
  { id: 'proj-network', name: 'Network', groupId: '1', tasks: [], isHidden: false, icon: '🌐' },
  { id: 'proj-family', name: 'Family', groupId: '1', tasks: [], isHidden: false, icon: '❤️' },
  { id: 'proj-jas', name: 'Jas', groupId: '1', tasks: [], isHidden: false, icon: '😊' },
  // Group 2
  { id: 'proj-nutrition', name: 'Nutrition', groupId: '2', tasks: [], isHidden: false, icon: '🥗' },
  // Group 3
  { id: 'proj-physiology', name: 'Physiology (all)', groupId: '3', tasks: [], isHidden: false, icon: '💪' },
  { id: 'proj-cycling', name: 'Cycling', groupId: '3', tasks: [], isHidden: false, icon: '🚲' },
  { id: 'proj-weight-training', name: 'Weight Training', groupId: '3', tasks: [], isHidden: false, icon: '🏋️' },
  // Group 4
  { id: 'proj-home', name: 'Home', groupId: '4', tasks: [], isHidden: false, icon: '🏠' },
  { id: 'proj-cars', name: 'Cars/Driving', groupId: '4', tasks: [], isHidden: false, icon: '🚗' },
  { id: 'proj-travel', name: 'Travel', groupId: '4', tasks: [], isHidden: false, icon: '✈️' },
  // Group 5
  { id: 'proj-rdi', name: 'RDI', groupId: '5', tasks: [], isHidden: false, icon: '💼' },
  { id: 'proj-swapmoo', name: 'SwapMoo', groupId: '5', tasks: [], isHidden: false, icon: '🔄' },
  { id: 'proj-complor', name: 'Complor', groupId: '5', tasks: [], isHidden: false, icon: '📊' },
  { id: 'proj-bidape', name: 'BidApe', groupId: '5', tasks: [], isHidden: false, icon: '🦍' },
  { id: 'proj-other', name: 'Other', groupId: '5', tasks: [], isHidden: false, icon: '📁' },
  // Group 6
  { id: 'proj-adventure', name: 'Adventure', groupId: '6', tasks: [], isHidden: false, icon: '🗺️' },
  // Group 7
  { id: 'proj-focus', name: 'Focus', groupId: '7', tasks: [], isHidden: false, icon: '🎯' },
  { id: 'proj-organisation', name: 'Organisation', groupId: '7', tasks: [], isHidden: false, icon: '⚙️' },
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

export const INITIAL_RESOURCES: Resource[] = [
    {
        id: 'res-1',
        url: 'https://react.dev/',
        title: 'react.dev',
        notes: 'The new official React documentation.',
        thumbnailUrl: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IlBsYWNlaG9sZGVyOiBUaHVtYm5haWwiIHByZXNlcnZlQXNwZWN0UmF0aW89InhNaWRZTWlkIHNsaWNlIiBmb2N1c2FibGU9ImZhbHNlIj48dGl0bGU+UGxhY2Vob2xkZXI8L3RpdGxlPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiM4NjhlOTYiPjwvcmVjdD48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2RlZTJlNiIgZHk9Ii4zZW0iIHRleHQtYW5jaG9yPSJtaWRkbGUiPnJlYWN0LmRldjwvdGV4dD48L3N2Zz4=`,
        projectGroupId: '5',
        projectIds: ['proj-rdi'],
        isPinned: true,
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    },
    {
        id: 'res-2',
        url: 'https://tailwindcss.com/',
        title: 'tailwindcss.com',
        notes: '',
        thumbnailUrl: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IlBsYWNlaG9sZGVyOiBUaHVtYm5haWwiIHByZXNlcnZlQXNwZWN0UmF0aW89InhNaWRZTWlkIHNsaWNlIiBmb2N1c2FibGU9ImZhbHNlIj48dGl0bGU+UGxhY2Vob2xkZXI8L3RpdGxlPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiM4NjhlOTYiPjwvcmVjdD48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2RlZTJlNiIgZHk9Ii4zZW0iIHRleHQtYW5jaG9yPSJtaWRkbGUiPnRhaWx3aW5kY3NzLmNvbTwvdGV4dD48L3N2Zz4=`,
        projectGroupId: '5',
        projectIds: [],
        isPinned: false,
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 1,
    }
];