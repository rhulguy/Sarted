import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';
import HabitTracker from './HabitTracker';
import { Habit } from '../types';
import { HabitContext } from '../contexts/HabitContext';

const mockHabits: Habit[] = [
  {
    id: 'habit-1',
    name: 'Daily Meditation',
    frequency: 'daily',
    color: 'bg-teal-500',
    completions: { '2024-07-28': true },
    createdAt: '2024-07-01',
  },
  {
    id: 'habit-2',
    name: 'Weekly Jogging',
    frequency: 'weekly',
    daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    color: 'bg-orange-500',
    completions: {},
    createdAt: '2024-07-01',
  }
];

describe('HabitTracker component', () => {
  // Fix: The context now uses specific functions instead of a generic dispatch.
  const mockAddHabit = vi.fn();
  const mockUpdateHabit = vi.fn();
  const mockDeleteHabit = vi.fn();
  // FIX: Add missing mock function for importAndOverwriteHabits
  const mockImportAndOverwriteHabits = vi.fn();
  const mockOnNewHabit = vi.fn();

  // Helper to render the component with a mock context
  const renderComponent = (habits: Habit[] = mockHabits) => {
    return render(
      // FIX: Add missing 'loading' property to the mock context value.
      <HabitContext.Provider value={{ habits, loading: false, addHabit: mockAddHabit, updateHabit: mockUpdateHabit, deleteHabit: mockDeleteHabit, importAndOverwriteHabits: mockImportAndOverwriteHabits }}>
        <HabitTracker onNewHabit={mockOnNewHabit} />
      </HabitContext.Provider>
    );
  };

  beforeEach(() => {
    // Set a fixed date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-07-30T10:00:00Z')); // A Tuesday
    mockAddHabit.mockClear();
    mockUpdateHabit.mockClear();
    mockDeleteHabit.mockClear();
    // FIX: Clear the new mock function before each test
    mockImportAndOverwriteHabits.mockClear();
    mockOnNewHabit.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders habits and the correct week header', () => {
    renderComponent();
    expect(screen.getByText('Daily Meditation')).toBeInTheDocument();
    expect(screen.getByText('Weekly Jogging')).toBeInTheDocument();
    // Week of Tuesday, July 30, 2024 is July 28 - Aug 3
    expect(screen.getByText(/Jul 28.*Aug 3, 2024/)).toBeInTheDocument();
  });

  it('shows a placeholder when there are no habits', () => {
    renderComponent([]);
    expect(screen.getByText('No habits yet.')).toBeInTheDocument();
  });

  it('toggles a daily habit completion status', () => {
    renderComponent();
    // Tuesday, July 30, 2024
    const dailyHabitCheckbox = screen.getByLabelText('Mark Daily Meditation as complete for 2024-07-30');
    fireEvent.click(dailyHabitCheckbox);

    // Fix: Assert that updateHabit was called with the correct payload.
    expect(mockUpdateHabit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'habit-1',
        completions: {
          '2024-07-28': true, // Existing completion
          '2024-07-30': true, // New completion
        },
      }),
    );
  });

  it('only shows checkboxes for weekly habits on their scheduled days', () => {
    renderComponent();
    // Check for Monday (scheduled)
    const mondayCheckbox = screen.queryByLabelText('Mark Weekly Jogging as complete for 2024-07-29');
    expect(mondayCheckbox).toBeInTheDocument();

    // Check for Tuesday (not scheduled)
    const tuesdayCheckbox = screen.queryByLabelText('Mark Weekly Jogging as complete for 2024-07-30');
    expect(tuesdayCheckbox).not.toBeInTheDocument();
  });
  
  it('navigates to the next and previous week', () => {
    renderComponent();
    const nextButton = screen.getByLabelText('Next week');
    fireEvent.click(nextButton);
    expect(screen.getByText(/Aug 4.*Aug 10, 2024/)).toBeInTheDocument();
    
    const prevButton = screen.getByLabelText('Previous week');
    fireEvent.click(prevButton); // Back to current
    fireEvent.click(prevButton); // To previous
    expect(screen.getByText(/Jul 21.*Jul 27, 2024/)).toBeInTheDocument();
  });

  it('calls onNewHabit when the new habit button is clicked', () => {
    renderComponent();
    const newHabitButton = screen.getByRole('button', { name: /New Habit/i });
    fireEvent.click(newHabitButton);
    expect(mockOnNewHabit).toHaveBeenCalledTimes(1);
  });

  it('deletes a habit when delete button is clicked', () => {
    renderComponent();
    // Note: The delete button is only visible on hover, but fireEvent works without simulating hover
    const deleteButton = screen.getByTitle('Delete habit: Daily Meditation');
    fireEvent.click(deleteButton);
    // Fix: Assert that deleteHabit was called with the correct habit ID.
    expect(mockDeleteHabit).toHaveBeenCalledWith('habit-1');
  });
});