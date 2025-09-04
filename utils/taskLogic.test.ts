import { describe, it, expect, beforeEach } from 'vitest';
import { Task } from '../types';
import {
  updateTaskInTree,
  deleteTaskFromTree,
  addSubtaskToTree,
  calculateProgress,
  updateTasksInTree,
} from './taskUtils';

// A deep-nested task structure for robust testing
const createMockTasks = (): Task[] => [
  {
    id: '1',
    name: 'Parent 1',
    completed: false,
    description: '',
    subtasks: [
      {
        id: '1-1',
        name: 'Child 1-1',
        completed: false,
        description: '',
        subtasks: [
          { id: '1-1-1', name: 'Grandchild 1-1-1', completed: false, description: '', subtasks: [] },
        ],
      },
      { id: '1-2', name: 'Child 1-2', completed: true, description: '', subtasks: [] },
    ],
  },
  { id: '2', name: 'Parent 2', completed: false, description: '', subtasks: [] },
];

describe('Task Logic Utilities', () => {
  let mockTasks: Task[];

  beforeEach(() => {
    mockTasks = createMockTasks();
  });

  describe('updateTaskInTree', () => {
    it('should update a top-level task', () => {
      const updatedTask = { ...mockTasks[1], name: 'Updated Parent 2' };
      const result = updateTaskInTree(mockTasks, updatedTask);
      expect(result[1].name).toBe('Updated Parent 2');
      expect(result[0]).toEqual(mockTasks[0]); // Ensure other tasks are untouched
    });

    it('should update a deeply nested subtask', () => {
      const updatedTask: Task = {
        id: '1-1-1',
        name: 'Updated Grandchild',
        completed: true,
        description: '',
        subtasks: [],
      };
      const result = updateTaskInTree(mockTasks, updatedTask);
      expect(result[0].subtasks[0].subtasks[0].name).toBe('Updated Grandchild');
      expect(result[0].subtasks[0].subtasks[0].completed).toBe(true);
    });

    it('should not mutate the original array', () => {
      const updatedTask = { ...mockTasks[1], name: 'Updated' };
      const originalTasksJson = JSON.stringify(mockTasks);
      updateTaskInTree(mockTasks, updatedTask);
      expect(JSON.stringify(mockTasks)).toEqual(originalTasksJson);
    });

    it('should return the original tree if the task is not found', () => {
        const nonExistentTask: Task = { id: '999', name: 'Non-existent', completed: false, description: '', subtasks: [] };
        const result = updateTaskInTree(mockTasks, nonExistentTask);
        expect(result).toEqual(mockTasks);
    });
  });

  describe('deleteTaskFromTree', () => {
    it('should delete a top-level task', () => {
      const result = deleteTaskFromTree(mockTasks, '2');
      expect(result.length).toBe(1);
      expect(result.find(t => t.id === '2')).toBeUndefined();
    });

    it('should delete a nested subtask', () => {
      const result = deleteTaskFromTree(mockTasks, '1-1');
      expect(result[0].subtasks.length).toBe(1);
      expect(result[0].subtasks[0].id).toBe('1-2');
    });

    it('should not mutate the original array on deletion', () => {
        const originalTasksJson = JSON.stringify(mockTasks);
        deleteTaskFromTree(mockTasks, '1-2');
        expect(JSON.stringify(mockTasks)).toEqual(originalTasksJson);
    });

    it('should return the original tree if task ID is not found', () => {
        const result = deleteTaskFromTree(mockTasks, '999');
        expect(result).toEqual(mockTasks);
    });
  });

  describe('addSubtaskToTree', () => {
    const newSubtask: Task = { id: '3', name: 'New Subtask', completed: false, description: '', subtasks: [] };

    it('should add a subtask to a top-level parent', () => {
      const result = addSubtaskToTree(mockTasks, '2', newSubtask);
      expect(result[1].subtasks.length).toBe(1);
      expect(result[1].subtasks[0].name).toBe('New Subtask');
    });

    it('should add a subtask to a nested parent', () => {
      const result = addSubtaskToTree(mockTasks, '1-1', newSubtask);
      expect(result[0].subtasks[0].subtasks.length).toBe(2);
      expect(result[0].subtasks[0].subtasks[1].id).toBe('3');
    });

    it('should not mutate the original array on addition', () => {
        const originalTasksJson = JSON.stringify(mockTasks);
        addSubtaskToTree(mockTasks, '2', newSubtask);
        expect(JSON.stringify(mockTasks)).toEqual(originalTasksJson);
    });

    it('should return the original tree if parent ID is not found', () => {
        const result = addSubtaskToTree(mockTasks, '999', newSubtask);
        expect(result).toEqual(mockTasks);
    });
  });

  describe('calculateProgress', () => {
    it('should correctly calculate progress for a nested structure', () => {
      // From mock data: 1 completed ('1-2') out of 5 total tasks in the tree
      const result = calculateProgress(mockTasks);
      expect(result.total).toBe(5);
      expect(result.completed).toBe(1);
    });

    it('should return 0 for an empty array', () => {
      const result = calculateProgress([]);
      expect(result.total).toBe(0);
      expect(result.completed).toBe(0);
    });

    it('should calculate correctly when all tasks are complete', () => {
        const allCompleteTasks: Task[] = [
            { id: '1', name: 'T1', completed: true, description: '', subtasks: [
                { id: '1-1', name: 'T1-1', completed: true, description: '', subtasks: [] }
            ]}
        ];
        const result = calculateProgress(allCompleteTasks);
        expect(result.total).toBe(2);
        expect(result.completed).toBe(2);
    });

    it('should count a completed parent even if its children are not complete', () => {
        const tasksWithCompletedParent: Task[] = [
          {
            id: '1',
            name: 'Completed Parent',
            completed: true,
            description: '',
            subtasks: [
              { id: '1-1', name: 'Incomplete Child', completed: false, description: '', subtasks: [] },
            ],
          },
        ];
        const result = calculateProgress(tasksWithCompletedParent);
        expect(result.total).toBe(2);
        expect(result.completed).toBe(1); // Only the parent is complete
    });
  });

  describe('updateTasksInTree', () => {
    it('should update multiple tasks at different levels', () => {
        const updates: Task[] = [
            { ...mockTasks[1], name: 'Parent 2 Updated' }, // Top level
            { ...mockTasks[0].subtasks[0].subtasks[0], completed: true }, // Nested
        ];

        const result = updateTasksInTree(mockTasks, updates);

        // Check top-level update
        expect(result[1].name).toBe('Parent 2 Updated');
        // Check nested update
        expect(result[0].subtasks[0].subtasks[0].completed).toBe(true);
        // Check that other properties are preserved
        expect(result[0].subtasks[0].name).toBe('Child 1-1');
    });

    it('should not mutate the original task tree', () => {
        const updates: Task[] = [{ ...mockTasks[1], name: 'Changed' }];
        const originalTasksJson = JSON.stringify(mockTasks);
        
        updateTasksInTree(mockTasks, updates);
        
        expect(JSON.stringify(mockTasks)).toEqual(originalTasksJson);
    });

    it('should handle an empty updates array without changing anything', () => {
        const result = updateTasksInTree(mockTasks, []);
        expect(result).toEqual(mockTasks);
    });

    it('should only update tasks that exist in the tree', () => {
        const updates: Task[] = [
            { ...mockTasks[1], name: 'Parent 2 Updated' }, // Exists
            { id: '999', name: 'Non-existent', completed: false, description: '', subtasks: [] }, // Does not exist
        ];

        const result = updateTasksInTree(mockTasks, updates);
        
        const countNodes = (tasks: Task[]): number => tasks.reduce((sum, task) => sum + 1 + countNodes(task.subtasks || []), 0);

        // Check that the existing task was updated
        expect(result[1].name).toBe('Parent 2 Updated');
        // Check that the tree structure is otherwise the same
        expect(result[0]).toEqual(mockTasks[0]);
        // A simple way to check the non-existent task wasn't added is to check lengths
        expect(countNodes(result)).toBe(countNodes(mockTasks));
    });
  });
});