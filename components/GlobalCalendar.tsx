import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task, Project, Habit } from '../types';
import { ChevronRightIcon, ChevronLeftIcon, PlusIcon, DownloadIcon, ImageIcon, ViewDayIcon, CalendarDaysIcon, SparklesIcon, CheckCircleIcon, ViewWeekIcon } from './IconComponents';
import TaskItem from './TaskItem';
import Spinner from './Spinner';
import { useProject } from '../contexts/ProjectContext';
import { useHabit } from '../contexts/HabitContext';
import { generateFocusPlan, AIFocusPlan } from '../services/geminiService';
import { useDownloadImage } from '../hooks/useDownloadImage';

// --- Type Definitions ---
type CalendarDisplayMode = 'month' | 'week' | 'day';

interface PrioritizedTask {
    task: GlobalCalendarTask;
    reason: string;
}

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
}

interface GlobalCalendarTask extends Task {
    projectId: string;
    startDateObj: Date;
    endDateObj: Date;
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
const GlobalCalendar: React.FC = () => {
    const { visibleProjects, projects, projectGroups, addTask, updateTask, deleteTask, addSubtask, moveTask } = useProject();
    const { habits } = useHabit();
    const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>('month');
    const [currentDate, setCurrentDate] = useState(() => normalizeDate(new Date()));
    const [focusedTask, setFocusedTask] = useState<GlobalCalendarTask | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportDateRange, setExportDateRange] = useState<{start: Date, end: Date}>({start: new Date(), end: new Date()});

    const allTasks = useMemo(() => {
        const flattened: GlobalCalendarTask[] = [];
        visibleProjects.forEach(project => {
            const flatten = (tasks: Task[], projectId: string) => {
                tasks.forEach(task => {
                    const startDateObj = parseDate(task.startDate);
                    
                    // Only include tasks that have a valid start date.
                    if (!isNaN(startDateObj.getTime())) {
                        let endDateObj = parseDate(task.endDate);
                        // If end date is invalid, default it to the start date.
                        if (isNaN(endDateObj.getTime())) {
                            endDateObj = startDateObj;
                        }
                        flattened.push({ ...task, projectId, startDateObj, endDateObj });
                    }

                    if (task.subtasks) {
                        flatten(task.subtasks, projectId);
                    }
                });
            };
            flatten(project.tasks, project.id);
        });
        return flattened;
    }, [visibleProjects]);
    
    const onUpdateTask = (projectId: string) => async (updatedTask: Task) => {
        await updateTask(projectId, updatedTask);
    };
    const onDeleteTask = (projectId: string) => async (taskId: string) => {
        await deleteTask(projectId, taskId);
    };
    const onAddSubtask = (projectId: string) => async (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => {
        const newSubtask: Task = { id: `task-${Date.now()}`, name: subtaskName, completed: false, description: '', subtasks: [], startDate, endDate };
        await addSubtask(projectId, parentId, newSubtask);
    };
    const onMoveProject = async (sourceProjectId: string, targetProjectId: string, task: Task) => {
        await moveTask(sourceProjectId, targetProjectId, task);
        setFocusedTask(null);
    };
    
    const handleSetDisplayMode = (mode: CalendarDisplayMode) => {
        setDisplayMode(mode);
        if (mode === 'day') {
            setCurrentDate(normalizeDate(new Date()));
        }
    };

    return (
        <div className="h-full flex flex-col bg-card-background rounded-lg">
            {displayMode === 'month' && (
                <MonthView 
                    allTasks={allTasks}
                    currentDate={currentDate}
                    setCurrentDate={setCurrentDate}
                    setFocusedTask={setFocusedTask}
                    onSetDisplayMode={handleSetDisplayMode}
                    onExport={(range) => { setExportDateRange(range); setIsExportModalOpen(true); }}
                />
            )}
            {displayMode === 'week' && (
                <WeekView 
                    allTasks={allTasks}
                    currentDate={currentDate}
                    setCurrentDate={setCurrentDate}
                    setFocusedTask={setFocusedTask}
                    onSetDisplayMode={handleSetDisplayMode}
                    onExport={(range) => { setExportDateRange(range); setIsExportModalOpen(true); }}
                />
            )}
            {displayMode === 'day' && (
                <DayView 
                    selectedDate={currentDate}
                    setSelectedDate={setCurrentDate}
                    allTasks={allTasks}
                    setFocusedTask={setFocusedTask}
                    onSetDisplayMode={handleSetDisplayMode}
                    onExport={(range) => { setExportDateRange(range); setIsExportModalOpen(true); }}
                />
            )}
            {isExportModalOpen && (
                <AchievementsExportModal 
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    startDate={exportDateRange.start}
                    endDate={exportDateRange.end}
                />
            )}
            {focusedTask && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setFocusedTask(null)}>
                    <div className="bg-card-background rounded-lg shadow-xl p-4 md:p-6 w-full max-w-2xl mx-2" onClick={e => e.stopPropagation()}>
                        <div className="max-h-[80vh] overflow-y-auto">
                           <TaskItem 
                                task={focusedTask}
                                level={0}
                                onUpdate={async (updatedTask) => {
                                    await onUpdateTask(focusedTask.projectId)(updatedTask);
                                    const refreshedTask = allTasks.find(t => t.id === updatedTask.id);
                                    if (refreshedTask) setFocusedTask(t => ({...t!, ...refreshedTask}));
                                }}
                                onDelete={async (taskId) => {
                                    await onDeleteTask(focusedTask.projectId)(taskId);
                                    setFocusedTask(null);
                                }}
                                onAddSubtask={onAddSubtask(focusedTask.projectId)}
                                projects={projects}
                                currentProjectId={focusedTask.projectId}
                                onMoveProject={(targetProjectId) => onMoveProject(focusedTask.projectId, targetProjectId, focusedTask)}
                           />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Achievements Export Modal ---
const AchievementsExportModal: React.FC<{isOpen: boolean; onClose: () => void; startDate: Date; endDate: Date;}> = ({ isOpen, onClose, startDate, endDate }) => {
    const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
    const { visibleProjects } = useProject();
    const { habits } = useHabit();

    const { completedTasks, completedHabits } = useMemo(() => {
        const tasks: Task[] = [];
        const taskCompletionsInRange = (task: Task) => {
            const completionDate = task.completionDate ? parseDate(task.completionDate) : null;
            if (completionDate && completionDate >= startDate && completionDate <= endDate) {
                tasks.push(task);
            }
            if (task.subtasks) task.subtasks.forEach(taskCompletionsInRange);
        };
        visibleProjects.forEach(p => p.tasks.forEach(taskCompletionsInRange));

        const habitsInRange = habits.map(habit => {
            const completions = Object.keys(habit.completions).filter(dateStr => {
                const d = parseDate(dateStr);
                return habit.completions[dateStr] && d >= startDate && d <= endDate;
            });
            return { name: habit.name, count: completions.length, color: habit.color };
        }).filter(h => h.count > 0);

        return { completedTasks: tasks, completedHabits: habitsInRange };
    }, [visibleProjects, habits, startDate, endDate]);

    if (!isOpen) return null;
    
    const title = dayDiff(startDate, endDate) > 0 
        ? `${startDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric', timeZone: 'UTC'})} - ${endDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric', timeZone: 'UTC'})}`
        : startDate.toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC'});

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-card-background rounded-2xl shadow-xl w-full max-w-3xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div ref={downloadRef} className="p-8 bg-app-background">
                    <h2 className="text-2xl font-bold text-center text-text-primary">Achievements</h2>
                    <p className="text-center text-text-secondary mb-6">{title}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold text-lg mb-3">Tasks Completed</h3>
                            {completedTasks.length > 0 ? (
                                <ul className="space-y-2">{completedTasks.map(t => <li key={t.id} className="flex items-center gap-2"><CheckCircleIcon className="w-5 h-5 text-accent-green"/><span>{t.name}</span></li>)}</ul>
                            ) : <p className="text-text-secondary">No tasks completed.</p>}
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg mb-3">Habits Honored</h3>
                            {completedHabits.length > 0 ? (
                                <ul className="space-y-2">{completedHabits.map(h => <li key={h.name} className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${h.color}`}/><span>{h.name} ({h.count}x)</span></li>)}</ul>
                            ) : <p className="text-text-secondary">No habits completed.</p>}
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-card-background border-t border-border-color flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-app-background rounded-lg hover:bg-border-color">Close</button>
                    <button onClick={() => downloadImage(`achievements-${formatDate(startDate)}.png`)} disabled={isDownloading} className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg disabled:opacity-50"><DownloadIcon className="w-5 h-5"/>{isDownloading ? 'Exporting...' : 'Export Image'}</button>
                </div>
            </div>
        </div>
    );
};

// --- Day Planner View Sub-Component ---
interface DayViewProps {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    allTasks: GlobalCalendarTask[];
    setFocusedTask: (task: GlobalCalendarTask | null) => void;
    onSetDisplayMode: (mode: CalendarDisplayMode) => void;
    onExport: (range: {start: Date, end: Date}) => void;
}
const DayView: React.FC<DayViewProps> = ({ selectedDate, setSelectedDate, allTasks, setFocusedTask, onSetDisplayMode, onExport }) => {
    const { visibleProjects, updateTask } = useProject();
    const { habits } = useHabit();
    const [priorities, setPriorities] = useState<PrioritizedTask[]>([]);
    const [isLoadingPriorities, setIsLoadingPriorities] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    const allTasksMap = useMemo(() => new Map(allTasks.map(t => [t.id, t])), [allTasks]);

    useEffect(() => {
        const getFocusPlan = async () => {
            setIsLoadingPriorities(true); setError(null);
            try {
                if (visibleProjects.length === 0 && habits.length === 0) { setPriorities([]); return; }
                const plan = await generateFocusPlan(visibleProjects, habits);
                const resolvedPriorities: PrioritizedTask[] = plan.priorities.map(p => {
                    const taskInfo = allTasksMap.get(p.taskId);
                    return taskInfo ? { task: taskInfo, reason: p.reason } : null;
                }).filter((p): p is PrioritizedTask => p !== null && !p.task.completed);
                setPriorities(resolvedPriorities);
            } catch (err: any) { setError(err.message || 'Could not load focus plan.');
            } finally { setIsLoadingPriorities(false); }
        };
        getFocusPlan();
    }, [visibleProjects, habits, allTasksMap]);

    const changeDay = (amount: number) => {
        const newDate = new Date(selectedDate);
        newDate.setUTCDate(newDate.getUTCDate() + amount);
        setSelectedDate(newDate);
    };

    const headerTitle = useMemo(() => selectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }), [selectedDate]);

    const tasksForDay = useMemo(() => allTasks.filter(task => areDatesEqual(task.startDateObj, selectedDate)), [allTasks, selectedDate]);
    const scheduledTasks = useMemo(() => tasksForDay.filter(t => t.startTime), [tasksForDay]);
    const unscheduledTasks = useMemo(() => tasksForDay.filter(t => !t.startTime), [tasksForDay]);
    
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        const task = allTasks.find(t => t.id === taskId);
        if (!task || !timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const dropY = e.clientY - rect.top;
        const totalMinutes = (dropY / rect.height) * (23 - 6) * 60;
        const hour = Math.floor(totalMinutes / 60) + 6;
        const minute = Math.round((totalMinutes % 60) / 30) * 30;

        const newStartTime = `${String(hour).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
        const newDuration = task.duration || 60;

        updateTask(task.projectId, { ...task, startTime: newStartTime, duration: newDuration });
    };

    const handleTaskUpdateOnTimeline = (taskId: string, updates: { startTime?: string, duration?: number }) => {
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
            updateTask(task.projectId, { ...task, ...updates });
        }
    };
    
    return (
        <div className="h-full flex flex-col">
             <header className="flex items-center justify-between p-4 border-b border-border-color shrink-0 flex-wrap gap-2">
                <div className="flex items-center space-x-2"><button onClick={() => changeDay(-1)} aria-label="Previous day" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronLeftIcon className="w-5 h-5"/></button><button onClick={() => setSelectedDate(normalizeDate(new Date()))} className="px-3 py-1 text-sm rounded bg-app-background hover:bg-border-color">Today</button><button onClick={() => changeDay(1)} aria-label="Next day" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronRightIcon className="w-5 h-5"/></button></div>
                <h2 className="text-lg md:text-xl font-bold text-center order-first w-full md:w-auto md:order-none">{headerTitle}</h2>
                <div className="flex items-center gap-2">
                    <div className="bg-app-background p-1 rounded-lg flex space-x-1"><button onClick={() => onSetDisplayMode('month')} className="p-1.5 rounded-md hover:bg-card-background" title="Month View"><CalendarDaysIcon className="w-5 h-5 text-text-primary" /></button><button onClick={() => onSetDisplayMode('week')} className="p-1.5 rounded-md hover:bg-card-background" title="Week View"><ViewWeekIcon className="w-5 h-5 text-text-primary" /></button><button onClick={() => onSetDisplayMode('day')} className="p-1.5 rounded-md bg-accent-blue" title="Day View"><ViewDayIcon className="w-5 h-5 text-white" /></button></div>
                    <button onClick={() => onExport({start: selectedDate, end: selectedDate})} className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-app-background text-text-secondary rounded-lg hover:bg-border-color"><DownloadIcon className="w-4 h-4" /><span>Export Achievements</span></button>
                </div>
            </header>
            <div className="flex-grow overflow-auto grid grid-cols-1 md:grid-cols-4 bg-app-background">
                <div className="md:col-span-3 flex">
                    <div className="w-16 shrink-0 text-right pr-2 text-xs text-text-secondary py-2">{Array.from({length: 18}).map((_, i) => <div key={i} className="h-16 flex items-start justify-end">{i+6}:00</div>)}</div>
                    <div ref={timelineRef} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="flex-grow relative bg-card-background border-l border-border-color">{Array.from({length: 34}).map((_, i) => <div key={i} className="h-8 border-b border-border-color"></div>)}
                    {scheduledTasks.map(task => <ScheduledTaskItem key={task.id} task={task} onUpdate={handleTaskUpdateOnTimeline} onClick={() => setFocusedTask(task)} />)}
                    </div>
                </div>
                <div className="md:col-span-1 p-4 space-y-4 border-l border-border-color">
                    <div><h3 className="font-semibold mb-2">Unscheduled</h3>
                        <div className="space-y-2">{unscheduledTasks.map(task => <UnscheduledTaskItem key={task.id} task={task} onClick={() => setFocusedTask(task)} />)}
                            {unscheduledTasks.length === 0 && <p className="text-xs text-text-secondary">No unscheduled tasks for today.</p>}
                        </div>
                    </div>
                    <div><h3 className="font-semibold mb-2 text-accent-blue flex items-center gap-2"><SparklesIcon className="w-4 h-4"/>AI Priorities</h3>
                        {isLoadingPriorities ? <Spinner/> : error ? <p className="text-xs text-accent-red">{error}</p> :
                        <div className="space-y-2">{priorities.map(p => <UnscheduledTaskItem key={p.task.id} task={p.task} onClick={() => setFocusedTask(p.task)} reason={p.reason}/>)}
                            {priorities.length === 0 && <p className="text-xs text-text-secondary">No AI suggestions for today.</p>}
                        </div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

const UnscheduledTaskItem: React.FC<{task: GlobalCalendarTask, onClick: () => void, reason?: string}> = ({ task, onClick, reason }) => {
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
    };
    return (
        <div draggable onDragStart={handleDragStart} onClick={onClick} className={`p-2 rounded-lg cursor-pointer bg-card-background border border-border-color shadow-sm ${reason ? 'border-accent-blue/50' : ''}`}>
            <p className="text-sm font-medium">{task.name}</p>
            {reason && <p className="text-xs text-text-secondary italic mt-1">"{reason}"</p>}
        </div>
    );
};

const ScheduledTaskItem: React.FC<{task: GlobalCalendarTask, onUpdate: (id: string, updates: { startTime?: string, duration?: number }) => void, onClick: () => void}> = ({ task, onUpdate, onClick }) => {
    const [isResizing, setIsResizing] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);
    const resizeStartRef = useRef({ y: 0, height: 0 });

    const [top, height] = useMemo(() => {
        // Robustness check: Ensure startTime is a valid HH:mm string
        if (!task.startTime || !/^\d{2}:\d{2}$/.test(task.startTime)) {
            return [null, null]; 
        }

        const [hour, minute] = task.startTime.split(':').map(Number);

        // Robustness check: Ensure parsing worked
        if (isNaN(hour) || isNaN(minute)) {
            return [null, null];
        }

        const startMinutes = (hour - 6) * 60 + minute;
        const duration = task.duration || 60;
        const topPercent = (startMinutes / ((23 - 6) * 60)) * 100;
        const heightPercent = (duration / ((23 - 6) * 60)) * 100;
        
        // Ensure values are within reasonable bounds to prevent style errors
        if (topPercent < 0 || topPercent > 100) return [null, null];

        return [topPercent, heightPercent];
    }, [task.startTime, task.duration]);
    
    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        setIsResizing(true);
        resizeStartRef.current = { y: e.clientY, height: elementRef.current?.offsetHeight || 0 };
    };
    
    useEffect(() => {
        if (!isResizing) return;
        const handleMouseMove = (e: MouseEvent) => {
            const dy = e.clientY - resizeStartRef.current.y;
            const timelineHeight = elementRef.current?.parentElement?.offsetHeight || 1;
            const minutesPerPixel = ((23-6)*60) / timelineHeight;
            const minuteChange = dy * minutesPerPixel;
            
            let newDuration = Math.round(((task.duration || 60) + minuteChange) / 15) * 15;
            newDuration = Math.max(15, newDuration);
            onUpdate(task.id, { duration: newDuration });
        };
        const handleMouseUp = () => setIsResizing(false);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
    }, [isResizing, task.id, task.duration, onUpdate]);

    // If data is invalid, don't render the item on the timeline to prevent crashes
    if (top === null || height === null) {
        return null;
    }

    return (
        <div ref={elementRef} style={{ top: `${top}%`, height: `${height}%` }} className="absolute w-full px-1">
            <div onClick={onClick} className={`h-full bg-accent-blue text-white rounded-lg p-1 text-xs overflow-hidden relative flex flex-col cursor-pointer ${task.completed ? 'opacity-60' : ''}`}>
                <strong className="truncate">{task.name}</strong>
                <p className="truncate">{task.startTime} - {(() => { 
                    const [h,m] = task.startTime.split(':').map(Number); 
                    const d = task.duration||60; 
                    const endM = (h*60+m+d); 
                    return `${String(Math.floor(endM/60) % 24).padStart(2,'0')}:${String(endM%60).padStart(2,'0')}`
                })()}</p>
                <div onMouseDown={handleResizeMouseDown} className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize" />
            </div>
        </div>
    );
};


// --- Week View Sub-Component ---
const WeekView: React.FC<Omit<MonthViewProps, 'onSetDisplayMode'> & { onSetDisplayMode: (mode: CalendarDisplayMode) => void }> = ({ allTasks, currentDate, setCurrentDate, setFocusedTask, onSetDisplayMode, onExport }) => {
    const { projects, projectGroups, updateTask, addTask } = useProject();
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    const { weekDates, weekStartDate, weekEndDate } = useMemo(() => {
        const d = new Date(currentDate);
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday to start on monday
        const start = new Date(d.setUTCDate(diff));
        const dates = Array.from({length: 7}).map((_, i) => { const nextDay = new Date(start); nextDay.setUTCDate(start.getUTCDate() + i); return nextDay; });
        return { weekDates: dates, weekStartDate: start, weekEndDate: dates[6] };
    }, [currentDate]);

    const changeWeek = (amount: number) => {
        const newDate = new Date(currentDate);
        newDate.setUTCDate(newDate.getUTCDate() + (amount * 7));
        setCurrentDate(newDate);
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
            const { projectId, startDateObj, endDateObj, ...originalTask } = task;
            await updateTask(projectId, { ...originalTask, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) });
        }
        setDraggedTaskId(null);
    };

    const headerTitle = `${weekStartDate.toLocaleDateString('default', { month: 'long', day: 'numeric', timeZone: 'UTC' })} - ${weekEndDate.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;

    return (
        <div className="h-full flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-border-color shrink-0 flex-wrap gap-2">
                <div className="flex items-center space-x-2"><button onClick={() => changeWeek(-1)} aria-label="Previous week" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronLeftIcon className="w-5 h-5"/></button><button onClick={() => setCurrentDate(normalizeDate(new Date()))} className="px-3 py-1 text-sm rounded bg-app-background hover:bg-border-color">Today</button><button onClick={() => changeWeek(1)} aria-label="Next week" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronRightIcon className="w-5 h-5"/></button></div>
                <h2 className="text-lg md:text-xl font-bold text-center order-first w-full md:w-auto md:order-none">{headerTitle}</h2>
                <div className="flex items-center gap-2">
                    <div className="bg-app-background p-1 rounded-lg flex space-x-1"><button onClick={() => onSetDisplayMode('month')} className="p-1.5 rounded-md hover:bg-card-background" title="Month View"><CalendarDaysIcon className="w-5 h-5 text-text-primary" /></button><button onClick={() => onSetDisplayMode('week')} className="p-1.5 rounded-md bg-accent-blue" title="Week View"><ViewWeekIcon className="w-5 h-5 text-white" /></button><button onClick={() => onSetDisplayMode('day')} className="p-1.5 rounded-md hover:bg-card-background" title="Day View"><ViewDayIcon className="w-5 h-5 text-text-primary" /></button></div>
                    <button onClick={() => onExport({start: weekStartDate, end: weekEndDate})} className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-app-background text-text-secondary rounded-lg hover:bg-border-color"><DownloadIcon className="w-4 h-4" /><span>Export Achievements</span></button>
                </div>
            </header>
            <div className="flex-grow overflow-auto flex flex-col bg-app-background">
                <div className="grid grid-cols-7 flex-grow">
                    {weekDates.map((day, index) => {
                        const tasksForDay = allTasks.filter(task => !isNaN(task.startDateObj.getTime()) && day >= task.startDateObj && day <= task.endDateObj);
                        const isToday = areDatesEqual(day, normalizeDate(new Date()));
                        return (
                            <div key={index} className={`relative border-r border-border-color p-2 flex flex-col group`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, day)}>
                                <div className="flex justify-between items-center mb-2"><span className={`text-sm font-semibold ${isToday ? 'bg-accent-blue text-white rounded-full flex items-center justify-center w-6 h-6' : 'text-text-primary'}`}>{day.getUTCDate()}</span><span className="text-sm font-semibold text-text-secondary">{day.toLocaleDateString('default', { weekday: 'short', timeZone: 'UTC' })}</span></div>
                                <div className="flex-grow space-y-1.5 overflow-y-auto mt-1">{tasksForDay.map(task => {
                                    const project = projects.find(p => p.id === task.projectId);
                                    const group = project ? projectGroups.find(g => g.id === project.groupId) : undefined;
                                    return (<div key={task.id} title={task.name} draggable onDragStart={(e) => {e.dataTransfer.setData('text/plain', task.id); setDraggedTaskId(task.id)}} onClick={() => setFocusedTask(task)} className={`text-white text-xs rounded px-1.5 py-1 cursor-pointer flex items-center ${task.completed ? 'opacity-50 bg-gray-600' : ''} ${draggedTaskId === task.id ? 'opacity-30' : ''} ${group?.color || 'bg-gray-500'}`}><div className="flex items-center min-w-0"><span className={`truncate ${task.completed ? 'line-through' : ''}`}>{task.name}</span></div></div>);
                                })}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- Month View Sub-Component ---
interface MonthViewProps {
    allTasks: GlobalCalendarTask[];
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    setFocusedTask: (task: GlobalCalendarTask | null) => void;
    onSetDisplayMode: (mode: CalendarDisplayMode) => void;
    onExport: (range: {start: Date, end: Date}) => void;
}
const MonthView: React.FC<MonthViewProps> = ({ allTasks, currentDate, setCurrentDate, setFocusedTask, onSetDisplayMode, onExport }) => {
    const { projects, projectGroups, updateTask, addTask } = useProject();
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [addingTaskTo, setAddingTaskTo] = useState<Date | null>(null);
    const [newTaskName, setNewTaskName] = useState("");
    const [newTaskProjectId, setNewTaskProjectId] = useState(projects[0]?.id || "");
    const newTaskInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if(addingTaskTo && newTaskInputRef.current) newTaskInputRef.current.focus(); }, [addingTaskTo]);

    const calendarGrid = useMemo(() => {
        const year = currentDate.getUTCFullYear(); const month = currentDate.getUTCMonth();
        const firstDayOfMonth = new Date(Date.UTC(year, month, 1)); const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
        const startDate = new Date(firstDayOfMonth); startDate.setUTCDate(startDate.getUTCDate() - startDate.getUTCDay());
        const endDate = new Date(lastDayOfMonth); endDate.setUTCDate(endDate.getUTCDate() + (6 - endDate.getUTCDay()));
        const grid: CalendarDay[] = []; const today = normalizeDate(new Date()); let d = new Date(startDate);
        while (d <= endDate) { grid.push({ date: new Date(d), isCurrentMonth: d.getUTCMonth() === month, isToday: areDatesEqual(d, today) }); d.setUTCDate(d.getUTCDate() + 1); }
        return grid;
    }, [currentDate]);

    const changeMonth = (amount: number) => {
        setAddingTaskTo(null);
        const newDate = new Date(currentDate); newDate.setUTCMonth(newDate.getUTCMonth() + amount); setCurrentDate(newDate);
    };
    
    const handleStartAddTask = (date: Date) => {
        setAddingTaskTo(date); setNewTaskName("");
        if(projects.length > 0) setNewTaskProjectId(projects[0].id);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); const taskName = newTaskName.trim(); const taskDate = addingTaskTo;
        if (taskDate && taskName && newTaskProjectId) {
            const dateStr = formatDate(taskDate);
            const newTask: Task = { id: `task-${Date.now()}`, name: taskName, completed: false, description: '', subtasks: [], startDate: dateStr, endDate: dateStr };
            await addTask(newTaskProjectId, newTask);
        }
        setAddingTaskTo(null); setNewTaskName("");
    };

    const handleDrop = async (e: React.DragEvent, dropDate: Date) => {
        e.preventDefault(); const taskId = e.dataTransfer.getData('text/plain'); const task = allTasks.find(t => t.id === taskId);
        if (task) {
            const duration = dayDiff(task.startDateObj, task.endDateObj); const newStartDate = new Date(dropDate);
            const newEndDate = new Date(newStartDate); newEndDate.setUTCDate(newEndDate.getUTCDate() + duration);
            const { projectId, startDateObj, endDateObj, ...originalTask } = task;
            await updateTask(projectId, { ...originalTask, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) });
        }
        setDraggedTaskId(null);
    };

    const headerTitle = currentDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const numWeeks = calendarGrid.length / 7;

    return (
        <div className="h-full flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-border-color shrink-0 flex-wrap gap-2">
                <div className="flex items-center space-x-2"><button onClick={() => changeMonth(-1)} aria-label="Previous month" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronLeftIcon className="w-5 h-5"/></button><button onClick={() => setCurrentDate(normalizeDate(new Date()))} className="px-3 py-1 text-sm rounded bg-app-background hover:bg-border-color">Today</button><button onClick={() => changeMonth(1)} aria-label="Next month" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronRightIcon className="w-5 h-5"/></button></div>
                <h2 className="text-lg md:text-xl font-bold text-center order-first w-full md:w-auto md:order-none">{headerTitle}</h2>
                <div className="flex items-center gap-2">
                    <div className="bg-app-background p-1 rounded-lg flex space-x-1"><button onClick={() => onSetDisplayMode('month')} className="p-1.5 rounded-md bg-accent-blue" title="Month View"><CalendarDaysIcon className="w-5 h-5 text-white" /></button><button onClick={() => onSetDisplayMode('week')} className="p-1.5 rounded-md hover:bg-card-background" title="Week View"><ViewWeekIcon className="w-5 h-5 text-text-primary" /></button><button onClick={() => onSetDisplayMode('day')} className="p-1.5 rounded-md hover:bg-card-background" title="Day View"><ViewDayIcon className="w-5 h-5 text-text-primary" /></button></div>
                    <button onClick={() => onExport({start: calendarGrid[0].date, end: calendarGrid[calendarGrid.length-1].date})} className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-app-background text-text-secondary rounded-lg hover:bg-border-color"><DownloadIcon className="w-4 h-4" /><span>Export Achievements</span></button>
                </div>
            </header>
            <div className="flex-grow overflow-auto flex flex-col bg-app-background">
                <div className="grid grid-cols-7 shrink-0">{weekdays.map(day => <div key={day} className="text-center font-semibold text-sm text-text-secondary p-2 border-b border-r border-border-color bg-card-background">{day}</div>)}</div>
                <div className={`grid grid-cols-7 flex-grow`} style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(0, 1fr))` }}>
                    {calendarGrid.map((day, index) => {
                        const tasksForDay = allTasks.filter(task => !isNaN(task.startDateObj.getTime()) && day.date >= task.startDateObj && day.date <= task.endDateObj);
                        return (
                            <div key={index} className={`relative border-b border-r border-border-color p-1 flex flex-col group ${!day.isCurrentMonth ? 'bg-app-background/50' : 'bg-card-background hover:bg-app-background'}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, day.date)}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-sm ${day.isToday ? 'bg-accent-blue text-white rounded-full flex items-center justify-center w-6 h-6' : 'text-text-primary'}`}>{day.date.getUTCDate()}</span>
                                    {addingTaskTo === null && (<button onClick={() => handleStartAddTask(day.date)} className="opacity-0 group-hover:opacity-100 transition-opacity text-accent-blue hover:text-blue-400" aria-label={`Add task for ${day.date.toISOString().slice(0,10)}`}><PlusIcon className="w-4 h-4"/></button>)}
                                </div>
                                <div className="flex-grow space-y-1 overflow-y-auto mt-1">{tasksForDay.map(task => {
                                    const project = projects.find(p => p.id === task.projectId); const group = project ? projectGroups.find(g => g.id === project.groupId) : undefined;
                                    return (<div key={task.id} title={`${task.name}\nProject: ${project?.name || 'N/A'}`} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); setDraggedTaskId(task.id)}} onClick={() => setFocusedTask(task)} className={`text-white text-xs rounded px-1.5 py-1 cursor-pointer flex items-center ${task.completed ? 'opacity-50 bg-gray-600' : ''} ${draggedTaskId === task.id ? 'opacity-30' : ''} ${group?.color || 'bg-gray-500'}`}><div className="flex items-center min-w-0"><span className={`truncate ${task.completed ? 'line-through' : ''}`}>{task.name}</span></div></div>);
                                })}
                                {addingTaskTo && areDatesEqual(addingTaskTo, day.date) && (
                                    <form onSubmit={handleFormSubmit} className="bg-app-background p-2 rounded-lg space-y-2 relative z-10">
                                        <input ref={newTaskInputRef} type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="New task..." className="w-full bg-card-background border border-accent-blue rounded p-1 text-xs focus:outline-none" />
                                        <select value={newTaskProjectId} onChange={e => setNewTaskProjectId(e.target.value)} className="w-full bg-card-background border border-border-color rounded p-1 text-xs">{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                        <div className="flex justify-end gap-1"><button type="button" onClick={() => setAddingTaskTo(null)} className="px-2 py-0.5 text-xs bg-gray-600 rounded">Cancel</button><button type="submit" className="px-2 py-0.5 text-xs bg-accent-blue text-white rounded">Add</button></div>
                                    </form>
                                )}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default GlobalCalendar;