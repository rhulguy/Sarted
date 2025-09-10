import React, { useState, useMemo, useRef, useEffect, forwardRef } from 'react';
import { Task } from '../types';
import { ChevronRightIcon, ChevronLeftIcon, PlusIcon, ViewDayIcon, CalendarDaysIcon, ViewWeekIcon } from './IconComponents';
import TaskItem from './TaskItem';
import { useProject } from '../contexts/ProjectContext';

// --- Type Definitions ---
interface CalendarViewProps {
  onAddTask: (taskName: string, startDate?: string, endDate?: string) => Promise<void>;
  onUpdateTask: (updatedTask: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAddSubtask: (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => Promise<void>;
}

type CalendarDisplayMode = 'month' | 'week' | 'day';

interface ProjectCalendarTask extends Task {
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
const CalendarView: React.ForwardRefRenderFunction<HTMLDivElement, CalendarViewProps> = ({ onAddTask, onUpdateTask, onDeleteTask, onAddSubtask }, ref) => {
    const { selectedProject, projects } = useProject();
    const project = selectedProject!;

    const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>('month');
    const [currentDate, setCurrentDate] = useState(() => normalizeDate(new Date()));
    const [focusedTask, setFocusedTask] = useState<ProjectCalendarTask | null>(null);

    const allTasks = useMemo((): ProjectCalendarTask[] => {
        const flattened: ProjectCalendarTask[] = [];
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

    const handleSetDisplayMode = (mode: CalendarDisplayMode) => {
        setDisplayMode(mode);
        if (mode === 'day') {
            setCurrentDate(normalizeDate(new Date()));
        }
    };

    return (
        <div ref={ref} className="h-full flex flex-col bg-card-background rounded-lg">
            {displayMode === 'month' && (
                <MonthView 
                    allTasks={allTasks}
                    currentDate={currentDate}
                    setCurrentDate={setCurrentDate}
                    setFocusedTask={setFocusedTask}
                    onSetDisplayMode={handleSetDisplayMode}
                    onAddTask={onAddTask}
                    onUpdateTask={onUpdateTask}
                />
            )}
             {displayMode === 'week' && (
                <WeekView 
                    allTasks={allTasks}
                    currentDate={currentDate}
                    setCurrentDate={setCurrentDate}
                    setFocusedTask={setFocusedTask}
                    onSetDisplayMode={handleSetDisplayMode}
                    onUpdateTask={onUpdateTask}
                />
            )}
            {displayMode === 'day' && (
                <DayView 
                    selectedDate={currentDate}
                    setSelectedDate={setCurrentDate}
                    allTasks={allTasks}
                    setFocusedTask={setFocusedTask}
                    onSetDisplayMode={handleSetDisplayMode}
                    onUpdateTask={onUpdateTask}
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
                                    await onUpdateTask(updatedTask);
                                    const refreshedTask = allTasks.find(t => t.id === updatedTask.id);
                                    if (refreshedTask) setFocusedTask(t => ({...t!, ...refreshedTask}));
                                }}
                                onDelete={async (taskId) => {
                                    await onDeleteTask(taskId);
                                    setFocusedTask(null);
                                }}
                                onAddSubtask={onAddSubtask}
                                projects={projects}
                                currentProjectId={project.id}
                           />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Day Planner View Sub-Component ---
interface DayViewProps {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    allTasks: ProjectCalendarTask[];
    setFocusedTask: (task: ProjectCalendarTask | null) => void;
    onSetDisplayMode: (mode: CalendarDisplayMode) => void;
    onUpdateTask: (task: Task) => Promise<void>;
}
const DayView: React.FC<DayViewProps> = ({ selectedDate, setSelectedDate, allTasks, setFocusedTask, onSetDisplayMode, onUpdateTask }) => {
    const timelineRef = useRef<HTMLDivElement>(null);

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

        onUpdateTask({ ...task, startTime: newStartTime, duration: newDuration });
    };

    const handleTaskUpdateOnTimeline = (taskId: string, updates: { startTime?: string, duration?: number }) => {
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
            onUpdateTask({ ...task, ...updates });
        }
    };
    
    return (
        <div className="h-full flex flex-col">
             <header className="flex items-center justify-between p-4 border-b border-border-color shrink-0 flex-wrap gap-2">
                <div className="flex items-center space-x-2"><button onClick={() => changeDay(-1)} aria-label="Previous day" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronLeftIcon className="w-5 h-5"/></button><button onClick={() => setSelectedDate(normalizeDate(new Date()))} className="px-3 py-1 text-sm rounded bg-app-background hover:bg-border-color">Today</button><button onClick={() => changeDay(1)} aria-label="Next day" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronRightIcon className="w-5 h-5"/></button></div>
                <h2 className="text-lg md:text-xl font-bold text-center order-first w-full md:w-auto md:order-none">{headerTitle}</h2>
                <div className="flex items-center gap-2">
                    <div className="bg-app-background p-1 rounded-lg flex space-x-1"><button onClick={() => onSetDisplayMode('month')} className="p-1.5 rounded-md hover:bg-card-background" title="Month View"><CalendarDaysIcon className="w-5 h-5 text-text-primary" /></button><button onClick={() => onSetDisplayMode('week')} className="p-1.5 rounded-md hover:bg-card-background" title="Week View"><ViewWeekIcon className="w-5 h-5 text-text-primary" /></button><button onClick={() => onSetDisplayMode('day')} className="p-1.5 rounded-md bg-accent-blue" title="Day View"><ViewDayIcon className="w-5 h-5 text-white" /></button></div>
                </div>
            </header>
            <div className="flex-grow overflow-auto grid grid-cols-1 md:grid-cols-3 bg-app-background">
                <div className="md:col-span-2 flex">
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
                </div>
            </div>
        </div>
    );
};

const UnscheduledTaskItem: React.FC<{task: ProjectCalendarTask, onClick: () => void}> = ({ task, onClick }) => {
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
    };
    return (
        <div draggable onDragStart={handleDragStart} onClick={onClick} className={`p-2 rounded-lg cursor-pointer bg-card-background border border-border-color shadow-sm`}>
            <p className="text-sm font-medium">{task.name}</p>
        </div>
    );
};

const ScheduledTaskItem: React.FC<{task: ProjectCalendarTask, onUpdate: (id: string, updates: { startTime?: string, duration?: number }) => void, onClick: () => void}> = ({ task, onUpdate, onClick }) => {
    const [isResizing, setIsResizing] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);
    const resizeStartRef = useRef({ y: 0, height: 0 });

    const [top, height] = useMemo(() => {
        if (!task.startTime || !/^\d{2}:\d{2}$/.test(task.startTime)) return [null, null]; 
        const [hour, minute] = task.startTime.split(':').map(Number);
        if (isNaN(hour) || isNaN(minute)) return [null, null];
        const startMinutes = (hour - 6) * 60 + minute;
        const duration = task.duration || 60;
        const topPercent = (startMinutes / ((23 - 6) * 60)) * 100;
        const heightPercent = (duration / ((23 - 6) * 60)) * 100;
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

    if (top === null || height === null) return null;

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
interface WeekViewProps {
    allTasks: ProjectCalendarTask[];
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    setFocusedTask: (task: ProjectCalendarTask | null) => void;
    onSetDisplayMode: (mode: CalendarDisplayMode) => void;
    onUpdateTask: (task: Task) => Promise<void>;
}

const WeekView: React.FC<WeekViewProps> = ({ allTasks, currentDate, setCurrentDate, setFocusedTask, onSetDisplayMode, onUpdateTask }) => {
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
            const { startDateObj, endDateObj, ...originalTask } = task;
            await onUpdateTask({ ...originalTask, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) });
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
                                <div className="flex-grow space-y-1.5 overflow-y-auto mt-1">{tasksForDay.map(task => (<div key={task.id} title={task.name} draggable onDragStart={(e) => {e.dataTransfer.setData('text/plain', task.id); setDraggedTaskId(task.id)}} onClick={() => setFocusedTask(task)} className={`bg-accent-blue text-white text-xs rounded px-1.5 py-1 cursor-pointer flex items-center ${task.completed ? 'opacity-50' : ''} ${draggedTaskId === task.id ? 'opacity-30' : ''}`}><div className="flex items-center min-w-0"><span className={`truncate ${task.completed ? 'line-through' : ''}`}>{task.name}</span></div></div>))}</div>
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
    allTasks: ProjectCalendarTask[];
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    setFocusedTask: (task: ProjectCalendarTask | null) => void;
    onSetDisplayMode: (mode: CalendarDisplayMode) => void;
    onAddTask: (taskName: string, startDate?: string, endDate?: string) => Promise<void>;
    onUpdateTask: (task: Task) => Promise<void>;
}
const MonthView: React.FC<MonthViewProps> = ({ allTasks, currentDate, setCurrentDate, setFocusedTask, onSetDisplayMode, onAddTask, onUpdateTask }) => {
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [addingTaskTo, setAddingTaskTo] = useState<Date | null>(null);
    const [newTaskName, setNewTaskName] = useState("");
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

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); const taskName = newTaskName.trim(); const taskDate = addingTaskTo;
        if (taskDate && taskName) {
            const dateStr = formatDate(taskDate);
            await onAddTask(taskName, dateStr, dateStr);
        }
        setAddingTaskTo(null); setNewTaskName("");
    };

    const handleDrop = async (e: React.DragEvent, dropDate: Date) => {
        e.preventDefault(); const taskId = e.dataTransfer.getData('text/plain'); const task = allTasks.find(t => t.id === taskId);
        if (task) {
            const duration = dayDiff(task.startDateObj, task.endDateObj); const newStartDate = new Date(dropDate);
            const newEndDate = new Date(newStartDate); newEndDate.setUTCDate(newEndDate.getUTCDate() + duration);
            const { startDateObj, endDateObj, ...originalTask } = task;
            await onUpdateTask({ ...originalTask, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) });
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
                                    {addingTaskTo === null && (<button onClick={() => setAddingTaskTo(day.date)} className="opacity-0 group-hover:opacity-100 transition-opacity text-accent-blue hover:text-blue-400" aria-label={`Add task for ${day.date.toISOString().slice(0,10)}`}><PlusIcon className="w-4 h-4"/></button>)}
                                </div>
                                <div className="flex-grow space-y-1 overflow-y-auto mt-1">{tasksForDay.map(task => (<div key={task.id} title={task.name} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); setDraggedTaskId(task.id)}} onClick={() => setFocusedTask(task)} className={`bg-accent-blue text-white text-xs rounded px-1.5 py-1 cursor-pointer flex items-center ${task.completed ? 'opacity-50' : ''} ${draggedTaskId === task.id ? 'opacity-30' : ''}`}><div className="flex items-center min-w-0"><span className={`truncate ${task.completed ? 'line-through' : ''}`}>{task.name}</span></div></div>))}
                                {addingTaskTo && areDatesEqual(addingTaskTo, day.date) && (
                                    <form onSubmit={handleFormSubmit} className="bg-app-background p-2 rounded-lg space-y-2 relative z-10">
                                        <input ref={newTaskInputRef} type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} onBlur={handleFormSubmit} placeholder="New task..." className="w-full bg-card-background border border-accent-blue rounded p-1 text-xs focus:outline-none" />
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


export default forwardRef(CalendarView);