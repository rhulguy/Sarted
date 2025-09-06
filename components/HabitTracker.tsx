import React, { useState, useMemo } from 'react';
import { Habit } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon, CheckCircleIcon, FolderIcon } from './IconComponents';
import { useHabit } from '../contexts/HabitContext';
import { useProject } from '../contexts/ProjectContext';
import { COLOR_MAP } from '../constants';

interface HabitTrackerProps {
  onNewHabit: () => void;
}

// --- Date Helper Functions (UTC-based for consistency) ---
const getWeekStartDate = (date: Date): Date => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day; // Adjust to Sunday
  return new Date(d.setUTCDate(diff));
};

const formatDate = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

const calculateStreak = (habit: Habit): number => {
    let streak = 0;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normalize today to UTC midnight
    
    // Get sorted completion dates
    const completedDates = Object.keys(habit.completions)
      .filter(dateStr => habit.completions[dateStr])
      .sort((a, b) => b.localeCompare(a)); // Newest first

    if (completedDates.length === 0) return 0;
    
    let currentDate = new Date(today);
    
    // Check if today or yesterday counts for the streak
    const mostRecentCompletion = new Date(completedDates[0] + 'T00:00:00Z');
    const diffFromToday = (currentDate.getTime() - mostRecentCompletion.getTime()) / (1000 * 3600 * 24);

    if (diffFromToday > 1) {
        // Streak is broken if the last completion was more than a day ago
        return 0;
    }

    // Iterate backwards from the most recent completion
    for (const dateStr of completedDates) {
        const completionDate = new Date(dateStr + 'T00:00:00Z');
        const diff = (currentDate.getTime() - completionDate.getTime()) / (1000 * 3600 * 24);
        
        if (habit.frequency === 'daily') {
            if (diff < 2) { // Allow for a one-day gap (e.g., today and yesterday)
                streak++;
                currentDate = completionDate;
            } else {
                break; // Gap is too large, streak is broken
            }
        }
        // Weekly streak logic is complex, so we'll stick to a simpler "total completions" for now.
    }

    if (habit.frequency === 'weekly') {
        return completedDates.length;
    }
    
    return streak;
};


const HabitTracker: React.FC<HabitTrackerProps> = ({ onNewHabit }) => {
  const { habits, updateHabit, deleteHabit } = useHabit();
  const { projects, projectGroups } = useProject();
  const [currentDate, setCurrentDate] = useState(new Date());

  const { weekDates, weekStartDate, weekEndDate } = useMemo(() => {
    const start = getWeekStartDate(currentDate);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(d);
    }
    return { weekDates: dates, weekStartDate: start, weekEndDate: dates[6] };
  }, [currentDate]);

  const habitStreaks = useMemo(() => {
    const streaks = new Map<string, number>();
    habits.forEach(habit => {
        streaks.set(habit.id, calculateStreak(habit));
    });
    return streaks;
  }, [habits]);

  const changeWeek = (amount: number) => {
    const newDate = new Date(currentDate);
    newDate.setUTCDate(newDate.getUTCDate() + amount * 7);
    setCurrentDate(newDate);
  };

  const handleToggleCompletion = (habit: Habit, date: Date) => {
    const dateString = formatDate(date);
    const currentStatus = habit.completions[dateString] || false;
    const newCompletions = { ...habit.completions, [dateString]: !currentStatus };
    updateHabit({ ...habit, completions: newCompletions });
  };
  
  const isHabitScheduledForDay = (habit: Habit, date: Date): boolean => {
      if (habit.frequency === 'daily') return true;
      if (habit.frequency === 'weekly' && habit.daysOfWeek) {
          return habit.daysOfWeek.includes(date.getUTCDay());
      }
      return false;
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      <header className="flex flex-col md:flex-row items-center justify-between pb-6 shrink-0 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Habit Tracker</h1>
        <div className="flex items-center space-x-2">
          <button onClick={() => changeWeek(-1)} aria-label="Previous week" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronLeftIcon className="w-5 h-5"/></button>
          <span className="text-base md:text-lg font-semibold w-64 text-center">
              {weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}
              {' - '}
              {weekEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
          </span>
          <button onClick={() => changeWeek(1)} aria-label="Next week" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronRightIcon className="w-5 h-5"/></button>
        </div>
        <button 
          onClick={onNewHabit}
          className="flex items-center space-x-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:opacity-90 transition-colors duration-200"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="hidden md:inline">New Habit</span>
        </button>
      </header>
      
      <div className="flex-grow overflow-auto bg-card-background rounded-2xl border border-border-color shadow-card">
        <div className="overflow-x-auto">
            <div className="min-w-[700px]">
                <div className="grid grid-cols-[2fr_repeat(7,1fr)] gap-2 sticky top-0 bg-card-background z-10 p-2 border-b border-border-color">
                  <div className="font-semibold text-text-secondary">Habit</div>
                  {weekDates.map(date => (
                      <div key={date.toISOString()} className="font-semibold text-text-secondary text-center">
                      <div>{date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}</div>
                      <div className="text-2xl">{date.getUTCDate()}</div>
                      </div>
                  ))}
                </div>

                <div className="grid grid-cols-[2fr_repeat(7,1fr)] gap-2 p-2">
                  {habits.length === 0 && (
                      <div className="col-span-8 text-center text-text-secondary py-16">
                          <h3 className="text-lg font-semibold">No habits yet.</h3>
                          <p>Click "New Habit" to start building a new routine.</p>
                      </div>
                  )}

                  {habits.map(habit => {
                    const project = habit.projectId ? projects.find(p => p.id === habit.projectId) : null;
                    const group = habit.projectGroupId ? projectGroups.find(g => g.id === habit.projectGroupId) : null;

                    return (
                      <React.Fragment key={habit.id}>
                      <div className="flex items-center space-x-3 group pr-4 min-h-[4rem]">
                          <div className={`w-2 h-10 rounded shrink-0`} style={{ backgroundColor: COLOR_MAP[habit.color] || habit.color }}></div>
                          <div className="flex-grow">
                              <p className="font-semibold text-text-primary">{habit.name}</p>
                              {(project || group) && (
                                <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                                    {project ? <FolderIcon className="w-3 h-3"/> : <div className={`w-2 h-2 rounded-full ${group?.color}`}/>}
                                    <span>{project?.name || group?.name}</span>
                                </div>
                              )}
                              <p className="text-sm text-text-secondary">{habitStreaks.get(habit.id) || 0} day streak</p>
                          </div>
                          <button onClick={() => deleteHabit(habit.id)} title={`Delete habit: ${habit.name}`} className="text-accent-red opacity-0 group-hover:opacity-100 transition-opacity">
                              <TrashIcon className="w-4 h-4" />
                          </button>
                      </div>
                      {weekDates.map(date => {
                          const dateString = formatDate(date);
                          const isCompleted = habit.completions[dateString];
                          const isScheduled = isHabitScheduledForDay(habit, date);
                          const habitColorHex = COLOR_MAP[habit.color] || '#6B7280';

                          return (
                              <div key={dateString} className="flex items-center justify-center min-h-[4rem]">
                                  {isScheduled ? (
                                      <button 
                                          onClick={() => handleToggleCompletion(habit, date)}
                                          className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-blue`}
                                          style={isCompleted ? { backgroundColor: habitColorHex } : { borderColor: habitColorHex, borderWidth: '2px', backgroundColor: 'transparent' }}
                                          aria-label={`Mark ${habit.name} as ${isCompleted ? 'incomplete' : 'complete'} for ${dateString}`}
                                      >
                                          {isCompleted && <CheckCircleIcon className="w-7 h-7 text-white" />}
                                      </button>
                                  ) : (
                                    <div className="w-2 h-2 bg-border-color rounded-full"></div>
                                  )}
                              </div>
                          );
                      })}
                      </React.Fragment>
                  )})}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default HabitTracker;