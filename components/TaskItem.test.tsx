import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import TaskItem from './TaskItem';
import { Task } from '../types';

// Mock Task data for testing
const mockTask: Task = {
  id: 'task-1',
  name: 'Test Parent Task',
  description: 'Parent Description',
  completed: false,
  startDate: '2024-01-01',
  endDate: '2024-01-05',
  subtasks: [
    {
      id: 'subtask-1',
      name: 'Test Subtask',
      description: 'Subtask Description',
      completed: false,
      subtasks: [],
      startDate: '2024-01-02',
      endDate: '2024-01-03',
    },
  ],
};

const taskWithNoSubtasks: Task = {
    ...mockTask,
    subtasks: [],
};


describe('TaskItem component', () => {
  const mockOnUpdate = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnAddSubtask = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test
    mockOnUpdate.mockClear();
    mockOnDelete.mockClear();
    mockOnAddSubtask.mockClear();
  });

  it('renders the task name', () => {
    render(
      <TaskItem
        task={mockTask}
        level={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onAddSubtask={mockOnAddSubtask}
      />
    );
    expect(screen.getByText('Test Parent Task')).toBeInTheDocument();
  });

  it('toggles task completion and cascades to subtasks', async () => {
    render(
      <TaskItem
        task={mockTask}
        level={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onAddSubtask={mockOnAddSubtask}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    const updatedTask = mockOnUpdate.mock.calls[0][0];

    // Check parent task
    expect(updatedTask.completed).toBe(true);

    // Check if subtask completion was also toggled
    expect(updatedTask.subtasks[0].completed).toBe(true);
  });
  
  it('deletes a task when the delete icon is clicked', async () => {
    render(
        <TaskItem
          task={mockTask}
          level={0}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          onAddSubtask={mockOnAddSubtask}
        />
      );

    const deleteButton = screen.getByTitle('Delete task');
    fireEvent.click(deleteButton);
    
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith(mockTask.id);
  });

  describe('Sub-task creation', () => {
    it('shows an input form and calls onAddSubtask on valid submit', async () => {
        render(
            <TaskItem
              task={mockTask}
              level={0}
              onUpdate={mockOnUpdate}
              onDelete={mockOnDelete}
              onAddSubtask={mockOnAddSubtask}
            />
          );
    
        const addSubtaskButton = screen.getByTitle('Add sub-task');
        fireEvent.click(addSubtaskButton);
        
        const subtaskInput = screen.getByPlaceholderText('New sub-task name...');
        expect(subtaskInput).toBeInTheDocument();
        
        fireEvent.change(subtaskInput, { target: { value: 'My new subtask' } });
        
        const submitButton = screen.getByText('Add Sub-task');
        fireEvent.click(submitButton);
    
        await waitFor(() => {
            expect(mockOnAddSubtask).toHaveBeenCalledTimes(1);
            expect(mockOnAddSubtask).toHaveBeenCalledWith(
              mockTask.id, // parentId
              'My new subtask', // subtaskName
              expect.any(String), // startDate
              expect.any(String)  // endDate
            );
        });
        expect(screen.queryByPlaceholderText('New sub-task name...')).not.toBeInTheDocument();
    });

    it('hides the subtask form when cancel is clicked', () => {
        render(
            <TaskItem
              task={mockTask}
              level={0}
              onUpdate={mockOnUpdate}
              onDelete={mockOnDelete}
              onAddSubtask={mockOnAddSubtask}
            />
        );
        const addSubtaskButton = screen.getByTitle('Add sub-task');
        fireEvent.click(addSubtaskButton);
        
        const subtaskInput = screen.getByPlaceholderText('New sub-task name...');
        expect(subtaskInput).toBeInTheDocument();
        
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);
    
        expect(screen.queryByPlaceholderText('New sub-task name...')).not.toBeInTheDocument();
        expect(mockOnAddSubtask).not.toHaveBeenCalled();
    });

    it('does not call onAddSubtask if the name is empty or whitespace', () => {
        render(
            <TaskItem
              task={mockTask}
              level={0}
              onUpdate={mockOnUpdate}
              onDelete={mockOnDelete}
              onAddSubtask={mockOnAddSubtask}
            />
        );
        const addSubtaskButton = screen.getByTitle('Add sub-task');
        fireEvent.click(addSubtaskButton);
        
        const subtaskInput = screen.getByPlaceholderText('New sub-task name...');
        const submitButton = screen.getByRole('button', { name: 'Add Sub-task' });

        // Submit with empty value
        fireEvent.click(submitButton);
        expect(mockOnAddSubtask).not.toHaveBeenCalled();

        // Submit with whitespace
        fireEvent.change(subtaskInput, { target: { value: '   ' } });
        fireEvent.click(submitButton);
        expect(mockOnAddSubtask).not.toHaveBeenCalled();

        // Form should still be visible because submit was invalid
        expect(screen.getByPlaceholderText('New sub-task name...')).toBeInTheDocument();
    });
  });


  describe('Detail Editing', () => {
    it('expands to show details and calls onUpdate when description is changed', async () => {
        render(
            <TaskItem
              task={mockTask}
              level={0}
              onUpdate={mockOnUpdate}
              onDelete={mockOnDelete}
              onAddSubtask={mockOnAddSubtask}
            />
          );
          
        const editButton = screen.getByTitle('Edit details');
        fireEvent.click(editButton);
    
        const descriptionTextarea = screen.getByLabelText('Description');
        expect(descriptionTextarea).toBeInTheDocument();
        expect(descriptionTextarea).toHaveValue('Parent Description');
    
        fireEvent.change(descriptionTextarea, { target: { value: 'New Updated Description' } });
        fireEvent.blur(descriptionTextarea);
        
        expect(mockOnUpdate).toHaveBeenCalledTimes(1);
        const updatedTask = mockOnUpdate.mock.calls[0][0];
        expect(updatedTask.description).toBe('New Updated Description');
    });
      
    it('updates start and end dates when changed', async () => {
        render(
            <TaskItem
              task={mockTask}
              level={0}
              onUpdate={mockOnUpdate}
              onDelete={mockOnDelete}
              onAddSubtask={mockOnAddSubtask}
            />
          );
          
        const taskNameSpan = screen.getByText(mockTask.name);
        fireEvent.click(taskNameSpan);
    
        const startDateInput = screen.getByLabelText('Start Date');
        const endDateInput = screen.getByLabelText('End Date');
        
        expect(startDateInput).toHaveValue('2024-01-01');
        expect(endDateInput).toHaveValue('2024-01-05');
    
        fireEvent.change(startDateInput, { target: { value: '2024-01-02' } });
        fireEvent.blur(startDateInput);
    
        expect(mockOnUpdate).toHaveBeenCalledTimes(1);
        expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2024-01-02' }));
        
        fireEvent.change(endDateInput, { target: { value: '2024-01-06' } });
        fireEvent.blur(endDateInput);
    
        expect(mockOnUpdate).toHaveBeenCalledTimes(2);
        expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({ endDate: '2024-01-06' }));
    });
    
    it('does not call onUpdate if details are not changed on blur', () => {
        render(
            <TaskItem
              task={mockTask}
              level={0}
              onUpdate={mockOnUpdate}
              onDelete={mockOnDelete}
              onAddSubtask={mockOnAddSubtask}
            />
          );
        const editButton = screen.getByTitle('Edit details');
        fireEvent.click(editButton);
    
        const descriptionTextarea = screen.getByLabelText('Description');
        fireEvent.blur(descriptionTextarea);
        
        expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  describe('UI State', () => {
    it('expands and collapses the subtask list', () => {
        render(
            <TaskItem
              task={mockTask}
              level={0}
              onUpdate={mockOnUpdate}
              onDelete={mockOnDelete}
              onAddSubtask={mockOnAddSubtask}
            />
        );
        
        expect(screen.getByText('Test Subtask')).toBeInTheDocument();
    
        const parentDiv = screen.getByText('Test Parent Task').closest('div');
        const chevronButton = parentDiv!.querySelector('button');
        fireEvent.click(chevronButton!);
        
        expect(screen.queryByText('Test Subtask')).not.toBeInTheDocument();
    
        fireEvent.click(chevronButton!);
        expect(screen.getByText('Test Subtask')).toBeInTheDocument();
    });

    it('hides the expand/collapse chevron if there are no subtasks', () => {
        render(
            <TaskItem
              task={taskWithNoSubtasks}
              level={0}
              onUpdate={mockOnUpdate}
              onDelete={mockOnDelete}
              onAddSubtask={mockOnAddSubtask}
            />
        );
        
        const parentDiv = screen.getByText(taskWithNoSubtasks.name).closest('div');
        // The first button in the item is the chevron
        const chevronButton = parentDiv!.querySelector('button');
        
        expect(chevronButton).toHaveClass('invisible');
    });

    it('applies correct indentation based on level', () => {
        render(
          <TaskItem
            task={mockTask}
            level={3} // A deeper level
            onUpdate={mockOnUpdate}
            onDelete={mockOnDelete}
            onAddSubtask={mockOnAddSubtask}
          />
        );
    
        // The main container div for the task item
        const taskItemContainer = screen.getByText(mockTask.name).closest('div.flex.items-center');
        expect(taskItemContainer).toHaveStyle('padding-left: 6.5rem'); // 3 * 2rem + 0.5rem
    });
  });
});
