import React, { useState, useMemo } from 'react';
import { Habit } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon, CheckCircleIcon } from './IconComponents';
import { useHabit } from '../contexts/HabitContext';

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
    const sortedDates = Object.keys(habit.completions).sort().reverse();
    
    let currentDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    if (habit.frequency === 'daily') {
        for (const dateStr of sortedDates) {
            if (habit.completions[dateStr]) {
                const completionDate = new Date(dateStr + 'T00:00:00Z');
                // Allow today or yesterday to count for current streak
                const diff = (currentDate.getTime() - completionDate.getTime()) / (1000 * 3600 * 24);
                if (diff <= 1) {
                    streak++;
                    currentDate = completionDate;
                    currentDate.setUTCDate(currentDate.getUTCDate() - 1);
                } else {
                    break;
                }
            }
        }
    } else { // weekly
        const todayDay = today.getUTCDay();
        let weekChecked = false;

        for (const dateStr of sortedDates) {
            if (habit.completions[dateStr] && habit.daysOfWeek) {
                 const completionDate = new Date(dateStr + 'T00:00:00Z');
                 const completionDay = completionDate.getUTCDay();

                 // Check if this completion is in the current week
                 if (!weekChecked) {
                     const weekStart = getWeekStartDate(today);
                     if (completionDate >= weekStart) {
                         streak++;
                     }
                     weekChecked = true;
                     continue;
                 }
                 
                 // How to check for consecutive weeks for weekly habits is more complex and can be improved.
                 // This is a simplified version just counting total completions.
            }
        }
        if (streak > 0) return streak; // Simple version for weekly
        return Object.values(habit.completions).filter(Boolean).length;
    }
    return streak;
};

const HabitTracker: React.FC<HabitTrackerProps> = ({ onNewHabit }) => {
  const { habits, updateHabit, deleteHabit } = useHabit();
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
    <div className="h-full flex flex-col">
      <header className="flex flex-col md:flex-row items-center justify-between p-4 border-b border-border-color shrink-0 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Habit Tracker</h1>
        <div className="flex items-center space-x-2">
          <button onClick={() => changeWeek(-1)} aria-label="Previous week" className="p-1 rounded text-text-secondary hover:bg-highlight"><ChevronLeftIcon className="w-5 h-5"/></button>
          <span className="text-base md:text-lg font-semibold w-64 text-center">
              {weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}
              {' - '}
              {weekEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
          </span>
          <button onClick={() => changeWeek(1)} aria-label="Next week" className="p-1 rounded text-text-secondary hover:bg-highlight"><ChevronRightIcon className="w-5 h-5"/></button>
        </div>
        <button 
          onClick={onNewHabit}
          className="flex items-center space-x-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-500 transition-colors duration-200"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="hidden md:inline">New Habit</span>
        </button>
      </header>
      
      <div className="flex-grow overflow-auto p-2 md:p-6">
        <div className="overflow-x-auto">
            <div className="min-w-[700px]">
                <div className="grid grid-cols-[2fr_repeat(7,1fr)] gap-2">
                <div className="font-semibold text-text-secondary sticky left-0 bg-primary py-2 z-10 pl-2">Habit</div>
                {weekDates.map(date => (
                    <div key={date.toISOString()} className="font-semibold text-text-secondary text-center sticky top-0 bg-primary py-2 z-10">
                    <div>{date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}</div>
                    <div className="text-2xl">{date.getUTCDate()}</div>
                    </div>
                ))}

                {habits.length === 0 && (
                    <div className="col-span-8 text-center text-text-secondary py-16">
                        <h3 className="text-lg font-semibold">No habits yet.</h3>
                        <p>Click "New Habit" to start building a new routine.</p>
                    </div>
                )}

                {habits.map(habit => (
                    <React.Fragment key={habit.id}>
                    <div className="flex items-center space-x-3 group pr-4 min-h-[4rem] sticky left-0 bg-primary">
                        <div className={`w-2 h-8 rounded shrink-0 ${habit.color}`}></div>
                        <div className="flex-grow">
                            <p className="font-semibold text-text-primary">{habit.name}</p>
                            <p className="text-sm text-text-secondary">{habitStreaks.get(habit.id) || 0} day streak</p>
                        </div>
                        <button onClick={() => deleteHabit(habit.id)} title={`Delete habit: ${habit.name}`} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                    {weekDates.map(date => {
                        const dateString = formatDate(date);
                        const isCompleted = habit.completions[dateString];
                        const isScheduled = isHabitScheduledForDay(habit, date);

                        return (
                            <div key={dateString} className="flex items-center justify-center min-h-[4rem]">
                                {isScheduled && (
                                    <button 
                                        onClick={() => handleToggleCompletion(habit, date)}
                                        className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center transition-colors
                                            ${isCompleted ? `${habit.color} text-white` : 'bg-highlight hover:bg-border-color'}`}
                                        aria-label={`Mark ${habit.name} as ${isCompleted ? 'incomplete' : 'complete'} for ${dateString}`}
                                    >
                                        {isCompleted && <CheckCircleIcon className="w-7 h-7" />}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    </React.Fragment>
                ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default HabitTracker;