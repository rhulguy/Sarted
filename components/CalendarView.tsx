import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task } from '../types';
import { ChevronRightIcon, ChevronLeftIcon, PlusIcon } from './IconComponents';
import { useProject } from '../contexts/ProjectContext';

// --- Type Definitions ---
interface CalendarViewProps {
  onAddTask: (taskName: string, startDate?: string, endDate?: string) => Promise<void>;
  onUpdateTask: (updatedTask: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAddSubtask: (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => Promise<void>;
}

interface CalendarTask extends Task {
    startDateObj: Date;
    endDateObj: Date;
}

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
}

// --- Date Helper Functions (UTC-based) ---
const parseDate = (dateStr: string | undefined): Date => {
  if (!dateStr) return new Date(NaN);
  return new Date(dateStr + 'T00:00:00Z');
};

const formatDate = (date: Date): string => {
    return date.toISOString().slice(0, 10);
};

const dayDiff = (startDate: Date, endDate: Date): number => {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const startUTC = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
    const endUTC = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
    return Math.round((endUTC - startUTC) / MS_PER_DAY);
}

const areDatesEqual = (d1: Date, d2: Date): boolean => {
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
}

const normalizeDate = (date: Date): Date => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

// --- Main Component ---
const CalendarView: React.FC<CalendarViewProps> = ({ onAddTask, onUpdateTask }) => {
    const { selectedProject } = useProject();
    const project = selectedProject!;

    const [currentDate, setCurrentDate] = useState(() => normalizeDate(new Date()));
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [addingTaskTo, setAddingTaskTo] = useState<Date | null>(null);
    const [newTaskName, setNewTaskName] = useState("");
    const newTaskInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (addingTaskTo && newTaskInputRef.current) {
            newTaskInputRef.current.focus();
        }
    }, [addingTaskTo]);
    
    const allTasks = useMemo((): CalendarTask[] => {
        const flattened: CalendarTask[] = [];
        const flatten = (tasks: Task[]) => {
            tasks.forEach(task => {
                const startDateObj = parseDate(task.startDate);
                if (!isNaN(startDateObj.getTime())) {
                    let endDateObj = parseDate(task.endDate);
                    if (isNaN(endDateObj.getTime())) {
                        endDateObj = startDateObj;
                    }
                    flattened.push({ ...task, startDateObj, endDateObj });
                }
                if (task.subtasks) {
                    flatten(task.subtasks);
                }
            });
        };
        flatten(project.tasks);
        return flattened;
    }, [project.tasks]);

    const calendarGrid = useMemo(() => {
        const year = currentDate.getUTCFullYear();
        const month = currentDate.getUTCMonth();
        const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
        const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
        const startDate = new Date(firstDayOfMonth);
        startDate.setUTCDate(startDate.getUTCDate() - startDate.getUTCDay());
        const endDate = new Date(lastDayOfMonth);
        endDate.setUTCDate(endDate.getUTCDate() + (6 - endDate.getUTCDay()));
        const grid: CalendarDay[] = [];
        const today = normalizeDate(new Date());
        let d = new Date(startDate);
        while (d <= endDate) {
            grid.push({
                date: new Date(d),
                isCurrentMonth: d.getUTCMonth() === month,
                isToday: areDatesEqual(d, today)
            });
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return grid;
    }, [currentDate]);

    const changeMonth = (amount: number) => {
        setAddingTaskTo(null);
        const newDate = new Date(currentDate);
        newDate.setUTCMonth(newDate.getUTCMonth() + amount);
        setCurrentDate(newDate);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const taskName = newTaskName.trim();
        const taskDate = addingTaskTo;
        if (taskDate && taskName) {
            const dateStr = formatDate(taskDate);
            await onAddTask(taskName, dateStr, dateStr);
        }
        setAddingTaskTo(null);
        setNewTaskName("");
    };

    const handleDrop = async (e: React.DragEvent, dropDate: Date) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
            const duration = dayDiff(task.startDateObj, task.endDateObj);
            const newStartDate = new Date(dropDate);
            const newEndDate = new Date(newStartDate);
            newEndDate.setUTCDate(newEndDate.getUTCDate() + duration);
            const { startDateObj, endDateObj, ...originalTask } = task;
            await onUpdateTask({ ...originalTask, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) });
        }
        setDraggedTaskId(null);
    };

    const headerTitle = currentDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="h-full flex flex-col">
            <header className="flex items-center justify-between p-2 border-b border-border-color shrink-0">
                <div className="flex items-center space-x-2">
                    <button onClick={() => changeMonth(-1)} aria-label="Previous period" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronLeftIcon className="w-5 h-5"/></button>
                    <button onClick={() => setCurrentDate(normalizeDate(new Date()))} className="px-3 py-1 text-sm rounded bg-app-background hover:bg-border-color">Today</button>
                    <button onClick={() => changeMonth(1)} aria-label="Next period" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronRightIcon className="w-5 h-5"/></button>
                </div>
                <h2 className="text-lg font-bold">{headerTitle}</h2>
            </header>
            <div className="grid grid-cols-7 shrink-0">
                {weekdays.map(day => <div key={day} className="text-center font-semibold text-sm text-text-secondary p-2 border-b border-r border-border-color">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 grid-rows-6 flex-grow overflow-auto">
                {calendarGrid.map((day, index) => {
                    const tasksForDay = allTasks.filter(task => day.date >= task.startDateObj && day.date <= task.endDateObj);
                    return (
                        <div 
                            key={index}
                            className={`relative border-b border-r border-border-color p-1 flex flex-col group ${!day.isCurrentMonth ? 'bg-app-background' : ''}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, day.date)}
                        >
                            <div className="flex justify-between items-center">
                                <span className={`text-sm ${day.isToday ? 'bg-accent-blue text-white rounded-full flex items-center justify-center w-6 h-6' : 'text-text-primary'}`}>{day.date.getUTCDate()}</span>
                                {!addingTaskTo && (
                                    <button onClick={() => setAddingTaskTo(day.date)} className="opacity-0 group-hover:opacity-100 transition-opacity text-accent-blue" aria-label={`Add task for ${formatDate(day.date)}`}>
                                        <PlusIcon className="w-4 h-4"/>
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1 mt-1 overflow-y-auto">
                                {tasksForDay.map(task => (
                                    <div 
                                        key={task.id}
                                        draggable
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                                        className={`bg-accent-blue text-white text-xs rounded px-1 py-0.5 cursor-pointer truncate ${task.completed ? 'line-through opacity-70' : ''}`}
                                    >
                                        {task.name}
                                    </div>
                                ))}
                                {addingTaskTo && areDatesEqual(addingTaskTo, day.date) && (
                                    <form onSubmit={handleFormSubmit}>
                                        <input
                                            ref={newTaskInputRef}
                                            type="text"
                                            value={newTaskName}
                                            onChange={(e) => setNewTaskName(e.target.value)}
                                            onBlur={handleFormSubmit}
                                            placeholder="New task..."
                                            className="w-full bg-card-background border border-accent-blue rounded p-1 text-xs"
                                        />
                                    </form>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarView;
