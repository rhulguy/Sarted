import React, { useState, useMemo } from 'react';
import { Habit } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon, CheckCircleIcon, FolderIcon } from './IconComponents';
import { useHabit } from '../contexts/HabitContext';
import { useProject } from '../contexts/ProjectContext';
import { COLOR_MAP } from '../constants';
import ExportDropdown from './ExportDropdown';
import { exportHabitsToCsv, exportHabitsToDoc } from '../utils/exportUtils';
import { Skeleton } from './Skeleton';

interface HabitTrackerProps {
  onNewHabit: () => void;
}

const HabitTrackerSkeleton: React.FC = () => (
    <div className="h-full flex flex-col p-4 md:p-6 animate-pulse">
        <header className="flex flex-col md:flex-row items-center justify-between pb-6 shrink-0 gap-4">
            <Skeleton className="h-9 w-48" />
            <div className="flex items-center space-x-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-7 w-64 rounded" />
                <Skeleton className="h-5 w-5 rounded" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-24 rounded-lg" />
                <Skeleton className="h-10 w-36 rounded-lg" />
            </div>
        </header>
        <div className="flex-grow overflow-auto bg-card-background rounded-2xl border border-border-color shadow-card">
            <div className="min-w-[700px]">
                <div className="grid grid-cols-[2fr_repeat(7,1fr)] gap-2 sticky top-0 p-2 border-b">
                    <Skeleton className="h-12 w-3/4" />
                    {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
                <div className="grid grid-cols-[2fr_repeat(7,1fr)] gap-2 p-2">
                    {[...Array(3)].map((_, i) => (
                        <React.Fragment key={i}>
                            <div className="flex items-center space-x-3 pr-4 h-16">
                                <Skeleton className="w-2 h-10 rounded" />
                                <div className="flex-grow space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                            {[...Array(7)].map((_, j) => (
                                <div key={j} className="flex items-center justify-center h-16">
                                    <Skeleton className="h-12 w-12 rounded-lg" />
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    </div>
);


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
    if (habit.frequency === 'weekly') {
        return Object.values(habit.completions).filter(Boolean).length;
    }
    
    let streak = 0;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); 
    
    const completedDates = Object.keys(habit.completions)
      .filter(dateStr => habit.completions[dateStr])
      .sort((a, b) => b.localeCompare(a));

    if (completedDates.length === 0) return 0;
    
    const mostRecentCompletion = new Date(completedDates[0] + 'T00:00:00Z');
    const diffFromToday = (today.getTime() - mostRecentCompletion.getTime()) / (1000 * 3600 * 24);

    if (diffFromToday > 1) return 0;

    let currentDate = new Date(mostRecentCompletion);
    
    for (const dateStr of completedDates) {
        const completionDate = new Date(dateStr + 'T00:00:00Z');
        const diff = (currentDate.getTime() - completionDate.getTime()) / (1000 * 3600 * 24);
        
        if (diff <= 1) { // It's either the same day or the previous day
            streak++;
            currentDate = completionDate;
        } else {
            break; 
        }
    }
    return streak;
};


const HabitTracker: React.FC<HabitTrackerProps> = ({ onNewHabit }) => {
  const { habits, loading, updateHabit, deleteHabit } = useHabit();
  const { projects, projectGroups } = useProject();
  const [currentDate, setCurrentDate] = useState(new Date());

  const { weekDates, weekStartDate, weekEndDate } = useMemo(() => {
    const start = getWeekStartDate(currentDate);
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      return d;
    });
    return { weekDates: dates, weekStartDate: start, weekEndDate: dates[6] };
  }, [currentDate]);

  const habitStreaks = useMemo(() => {
    return new Map(habits.map(habit => [habit.id, calculateStreak(habit)]));
  }, [habits]);

  const changeWeek = (amount: number) => {
    const newDate = new Date(currentDate);
    newDate.setUTCDate(newDate.getUTCDate() + amount * 7);
    setCurrentDate(newDate);
  };

  const handleToggleCompletion = (habit: Habit, date: Date) => {
    const dateString = formatDate(date);
    const newCompletions = { ...habit.completions, [dateString]: !habit.completions[dateString] };
    updateHabit({ ...habit, completions: newCompletions });
  };
  
  const isHabitScheduledForDay = (habit: Habit, date: Date): boolean => {
      if (habit.frequency === 'daily') return true;
      return habit.daysOfWeek?.includes(date.getUTCDay()) ?? false;
  }
  
  const handleExport = (type: 'csv' | 'doc') => {
      if (type === 'csv') {
          exportHabitsToCsv(habits, weekDates);
      } else if (type === 'doc') {
          exportHabitsToDoc(habits, weekDates);
      }
  };

  if (loading) {
      return <HabitTrackerSkeleton />;
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
        <div className="flex items-center gap-2">
            <ExportDropdown 
                onExportCsv={() => handleExport('csv')}
                onExportDoc={() => handleExport('doc')}
                onExportImage={() => { /* Not Available */ }}
            />
            <button 
              onClick={onNewHabit}
              className="flex items-center space-x-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:opacity-90 transition-colors duration-200"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="hidden md:inline">New Habit</span>
            </button>
        </div>
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
                  {habits.length === 0 ? (
                      <div className="col-span-8 text-center text-text-secondary py-16">
                          <h3 className="text-lg font-semibold">No habits yet.</h3>
                          <p>Click "New Habit" to start building a new routine.</p>
                      </div>
                  ) : habits.map(habit => {
                    const project = habit.projectId ? projects.find(p => p.id === habit.projectId) : null;
                    const group = habit.projectGroupId ? projectGroups.find(g => g.id === habit.projectGroupId) : null;
                    const streakLabel = habit.frequency === 'weekly' ? 'completions' : 'day streak';

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
                              <p className="text-sm text-text-secondary">{habitStreaks.get(habit.id) || 0} {streakLabel}</p>
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