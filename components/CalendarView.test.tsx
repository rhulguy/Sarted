import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';
import CalendarView from './CalendarView';
import { ProjectContext } from '../contexts/ProjectContext';
import { Project, ProjectGroup } from '../types';

// Mock project data for testing
// FIX: Replaced non-existent 'isHidden' property with 'isArchived' to match the Project type.
const mockProject: Project = {
  id: 'proj-1',
  name: 'Calendar Test Project',
  groupId: 'work',
  tasks: [
    {
      id: 'task-1',
      name: 'Single Day Task',
      completed: false,
      description: '',
      subtasks: [],
      startDate: '2024-07-15',
      endDate: '2024-07-15',
    },
    {
      id: 'task-2',
      name: 'Multi-day Task',
      completed: false,
      description: '',
      subtasks: [],
      startDate: '2024-07-16',
      endDate: '2024-07-18',
    },
  ],
  isArchived: false,
};

// FIX: Add the required 'order' property to the mock ProjectGroup.
const mockProjectGroups: ProjectGroup[] = [{ id: 'work', name: 'Work', color: 'bg-blue-500', order: 0 }];

describe('CalendarView component', () => {
  const mockOnAddTask = vi.fn();
  const mockOnUpdateTask = vi.fn();
  const mockOnDeleteTask = vi.fn();
  const mockOnAddSubtask = vi.fn();

  const renderComponent = (project: Project | null = mockProject) => {
    return render(
      <ProjectContext.Provider
        // FIX: Provide a complete mock context that matches the ProjectContextType interface
        value={{
          projects: project ? [project] : [],
          visibleProjects: project ? [project] : [],
          archivedProjects: [],
          projectGroups: mockProjectGroups,
          selectedProjectId: project?.id || null,
          selectedProject: project,
          loading: false,
          selectProject: vi.fn(),
          addProject: vi.fn(),
          updateProject: vi.fn(),
          deleteProject: vi.fn(),
          archiveProject: vi.fn(),
          unarchiveProject: vi.fn(),
          addProjectGroup: vi.fn(),
          updateProjectGroup: vi.fn(),
          deleteProjectGroup: vi.fn(),
          // FIX: Add the missing 'reorderProjectGroups' function to the mock context value.
          reorderProjectGroups: vi.fn(),
          addTask: vi.fn(),
          // FIX: Add missing 'addMultipleTasks' to mock context
          addMultipleTasks: vi.fn(),
          addSubtask: vi.fn(),
          updateTask: vi.fn(),
          updateMultipleTasks: vi.fn(),
          deleteTask: vi.fn(),
          moveTask: vi.fn(),
          reparentTask: vi.fn(),
          // FIX: Add missing importAndOverwriteProjectsAndGroups to mock context
          importAndOverwriteProjectsAndGroups: vi.fn(),
        }}
      >
        <CalendarView
          onAddTask={mockOnAddTask}
          onUpdateTask={mockOnUpdateTask}
          onDeleteTask={mockOnDeleteTask}
          onAddSubtask={mockOnAddSubtask}
        />
      </ProjectContext.Provider>
    );
  };

  beforeEach(() => {
    // Set a fixed date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-07-15T10:00:00Z')); // A Monday
    mockOnAddTask.mockClear();
    mockOnUpdateTask.mockClear();
    mockOnDeleteTask.mockClear();
    mockOnAddSubtask.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the correct month header and highlights today', () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: /July 2024/i })).toBeInTheDocument();
    
    // Check for "today" highlight
    const todayCell = screen.getByText('15');
    expect(todayCell).toHaveClass('bg-accent-blue');
  });

  it('renders tasks correctly on the calendar', () => {
    renderComponent();
    expect(screen.getByText('Single Day Task')).toBeInTheDocument();
    
    // Fix: The component renders multi-day tasks in each cell they occupy.
    // The test should expect to find the task on each day it spans.
    expect(screen.getAllByText('Multi-day Task').length).toBe(3);
  });

  it('navigates between months and returns to today', () => {
    renderComponent();
    
    const nextButton = screen.getByLabelText('Next period');
    fireEvent.click(nextButton);
    expect(screen.getByRole('heading', { name: /August 2024/i })).toBeInTheDocument();

    const prevButton = screen.getByLabelText('Previous period');
    fireEvent.click(prevButton); // back to July
    fireEvent.click(prevButton); // to June
    expect(screen.getByRole('heading', { name: /June 2024/i })).toBeInTheDocument();

    const todayButton = screen.getByRole('button', { name: 'Today' });
    fireEvent.click(todayButton);
    expect(screen.getByRole('heading', { name: /July 2024/i })).toBeInTheDocument();
  });

  it('allows creating a new task via inline input', async () => {
    renderComponent();
    const dayCell = screen.getByText('20').closest('.group'); // The container div for day 20
    expect(dayCell).not.toBeNull();

    const addButton = screen.getByLabelText('Add task for 2024-07-20');
    fireEvent.click(addButton);

    const input = screen.getByPlaceholderText('New task...');
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: 'New Event' } });
    fireEvent.blur(input); // Submits on blur

    await waitFor(() => {
      expect(mockOnAddTask).toHaveBeenCalledWith(
          'New Event',
          '2024-07-20',
          '2024-07-20'
      );
    });
  });

  it('opens a detail modal when a task is clicked', async () => {
    const { baseElement } = renderComponent();
    expect(screen.getAllByText('Single Day Task').length).toBe(1);
    
    const taskElement = screen.getByText('Single Day Task');
    fireEvent.click(taskElement);
    
    await waitFor(() => {
        expect(baseElement.querySelector('.fixed.inset-0')).toBeInTheDocument();
    });

    // The modal also contains the task name
    expect(screen.getAllByText('Single Day Task').length).toBe(1); // Should not find a second one
  });

  it('reschedules a task on drag and drop', () => {
    renderComponent();
    const taskToDrag = screen.getByText('Single Day Task');
    const dropTarget = screen.getByText('22').closest('div[class*="border-b"]'); // Day 22 cell
    
    expect(dropTarget).not.toBeNull();
    
    // Simulate drag and drop
    const dataTransfer = {
        setData: vi.fn(),
        getData: vi.fn(() => 'task-1'), // Return the dragged task's ID
      };
      
    fireEvent.dragStart(taskToDrag, { dataTransfer });
    fireEvent.drop(dropTarget!, { dataTransfer });

    expect(mockOnUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        startDate: '2024-07-22',
        endDate: '2024-07-22',
      })
    );
  });
});