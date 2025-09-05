import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task, Project } from '../types';
import { ChevronRightIcon, ChevronLeftIcon, PlusIcon, DownloadIcon, ImageIcon, ViewDayIcon, CalendarDaysIcon, SparklesIcon } from './IconComponents';
import TaskItem from './TaskItem';
import Spinner from './Spinner';
import { useProject } from '../contexts/ProjectContext';
import { useHabit } from '../contexts/HabitContext';
import { generateImageForTask, generateFocusPlan, AIFocusPlan } from '../services/geminiService';
import { useDownloadImage } from '../hooks/useDownloadImage';

// --- Type Definitions ---
type CalendarDisplayMode = 'month' | 'day';

interface PrioritizedTask {
    task: GlobalCalendarTask;
    reason: string;
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

// --- Main Component ---
const GlobalCalendar: React.FC = () => {
    const { visibleProjects, projects, projectGroups, addTask, updateTask, deleteTask, addSubtask, moveTask } = useProject();
    const { habits } = useHabit();
    const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>('month');
    const [currentDate, setCurrentDate] = useState(() => normalizeDate(new Date()));
    const [focusedTask, setFocusedTask] = useState<GlobalCalendarTask | null>(null);

    const allTasks = useMemo(() => {
        const flattened: GlobalCalendarTask[] = [];
        visibleProjects.forEach(project => {
            const flatten = (tasks: Task[], projectId: string) => {
                tasks.forEach(task => {
                    const startDateObj = parseDate(task.startDate);
                    const endDateObj = parseDate(task.endDate);
                    flattened.push({ ...task, projectId, startDateObj, endDateObj });
                    if (task.subtasks) flatten(task.subtasks, projectId);
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
        const newSubtask: Task = { id: `task-${Date.now()}`, name: subtaskName, description: '', completed: false, subtasks: [], startDate, endDate };
        await addSubtask(projectId, parentId, newSubtask);
    };
    const onMoveProject = async (sourceProjectId: string, targetProjectId: string, task: Task) => {
        await moveTask(sourceProjectId, targetProjectId, task);
        setFocusedTask(null);
    };
    
    const handleSetDisplayMode = (mode: CalendarDisplayMode) => {
        setDisplayMode(mode);
        // Go to today's date when switching to day view for relevance
        if (mode === 'day') {
            setCurrentDate(normalizeDate(new Date()));
        }
    };

    return (
        <div className="h-full flex flex-col bg-secondary rounded-lg">
            {displayMode === 'month' ? (
                <MonthView 
                    allTasks={allTasks}
                    currentDate={currentDate}
                    setCurrentDate={setCurrentDate}
                    setFocusedTask={setFocusedTask}
                    onSetDisplayMode={handleSetDisplayMode}
                />
            ) : (
                <DayView 
                    selectedDate={currentDate}
                    setSelectedDate={setCurrentDate}
                    allTasks={allTasks}
                    setFocusedTask={setFocusedTask}
                    onSetDisplayMode={handleSetDisplayMode}
                />
            )}
             {focusedTask && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setFocusedTask(null)}>
                    <div className="bg-secondary rounded-lg shadow-xl p-4 md:p-6 w-full max-w-2xl mx-2" onClick={e => e.stopPropagation()}>
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

// --- Day View Sub-Component ---
interface DayViewProps {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    allTasks: GlobalCalendarTask[];
    setFocusedTask: (task: GlobalCalendarTask | null) => void;
    onSetDisplayMode: (mode: CalendarDisplayMode) => void;
}

const DayView: React.FC<DayViewProps> = ({ selectedDate, setSelectedDate, allTasks, onSetDisplayMode }) => {
    const { visibleProjects, updateTask } = useProject();
    const { habits } = useHabit();
    const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
    const [priorities, setPriorities] = useState<PrioritizedTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const allTasksMap = useMemo(() => new Map(allTasks.map(t => [t.id, t])), [allTasks]);

    useEffect(() => {
        const getFocusPlan = async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (visibleProjects.length === 0 && habits.length === 0) {
                     setPriorities([]);
                     return;
                }
                const plan = await generateFocusPlan(visibleProjects, habits);
                const resolvedPriorities: PrioritizedTask[] = plan.priorities
                    .map(p => {
                        const taskInfo = allTasksMap.get(p.taskId);
                        if (!taskInfo) return null;
                        return { task: taskInfo, reason: p.reason };
                    })
                    .filter((p): p is PrioritizedTask => p !== null && !p.task.completed);
                setPriorities(resolvedPriorities);
            } catch (err: any) {
                setError(err.message || 'Could not load focus plan.');
            } finally {
                setIsLoading(false);
            }
        };
        getFocusPlan();
    }, [visibleProjects, habits, allTasksMap]);

    const changeDay = (amount: number) => {
        const newDate = new Date(selectedDate);
        newDate.setUTCDate(newDate.getUTCDate() + amount);
        setSelectedDate(newDate);
    };

    const headerTitle = useMemo(() => {
        return selectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }, [selectedDate]);

    const otherTasksForDay = useMemo(() => {
        const priorityIds = new Set(priorities.map(p => p.task.id));
        return allTasks.filter(task => {
            const isScheduled = !isNaN(task.startDateObj.getTime()) && selectedDate >= task.startDateObj && selectedDate <= task.endDateObj;
            return isScheduled && !priorityIds.has(task.id);
        });
    }, [allTasks, selectedDate, priorities]);
    
    const handleUpdateTask = (projectId: string) => (updatedTask: Task) => {
        updateTask(projectId, updatedTask);
    };

    return (
        <div className="h-full flex flex-col">
             <header className="flex items-center justify-between p-4 border-b border-border-color shrink-0 flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                    <button onClick={() => changeDay(-1)} aria-label="Previous day" className="p-1 rounded text-text-secondary hover:bg-highlight"><ChevronLeftIcon className="w-5 h-5"/></button>
                    <button onClick={() => setSelectedDate(normalizeDate(new Date()))} className="px-3 py-1 text-sm rounded bg-highlight hover:bg-gray-700">Today</button>
                    <button onClick={() => changeDay(1)} aria-label="Next day" className="p-1 rounded text-text-secondary hover:bg-highlight"><ChevronRightIcon className="w-5 h-5"/></button>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-center order-first w-full md:w-auto md:order-none">{headerTitle}</h2>
                <div className="flex items-center gap-2">
                    <div className="bg-highlight p-1 rounded-lg flex space-x-1">
                        <button onClick={() => onSetDisplayMode('month')} className="p-1.5 rounded-md hover:bg-secondary" title="Month View"><CalendarDaysIcon className="w-5 h-5 text-text-primary" /></button>
                        <button onClick={() => onSetDisplayMode('day')} className="p-1.5 rounded-md bg-accent" title="Day View"><ViewDayIcon className="w-5 h-5 text-text-primary" /></button>
                    </div>
                    <button onClick={() => downloadImage(`daily-plan-${formatDate(selectedDate)}.png`)} disabled={isDownloading} className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-highlight text-text-secondary rounded-lg hover:bg-gray-700 disabled:opacity-50"><DownloadIcon className="w-4 h-4" /><span>{isDownloading ? 'Exporting...' : 'Export'}</span></button>
                </div>
            </header>
            <div ref={downloadRef} className="flex-grow overflow-auto p-4 md:p-6 bg-primary">
                <div className="max-w-4xl mx-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-8"><Spinner /></div>
                    ) : error ? (
                        <div className="text-center text-red-400 p-8">{error}</div>
                    ) : (
                        <div className="space-y-6">
                            {priorities.length > 0 && (
                                <div>
                                    <h3 className="text-xl font-semibold mb-3 text-accent">AI Priorities</h3>
                                    <div className="space-y-3">
                                        {priorities.map(({ task, reason }) => (
                                            <div key={task.id} className="bg-secondary p-3 rounded-lg">
                                                <div className="flex items-start space-x-2.5 mb-2">
                                                    <SparklesIcon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                                    <p className="text-sm text-text-secondary italic">"{reason}"</p>
                                                </div>
                                                <TaskItem task={task} level={0} onUpdate={handleUpdateTask(task.projectId)} onDelete={() => {}} onAddSubtask={() => {}} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {otherTasksForDay.length > 0 && (
                                <div>
                                    <h3 className="text-xl font-semibold mb-3 text-text-primary">Other Tasks for Today</h3>
                                    <div className="space-y-2">
                                        {otherTasksForDay.map(task => (
                                            <TaskItem key={task.id} task={task} level={0} onUpdate={handleUpdateTask(task.projectId)} onDelete={() => {}} onAddSubtask={() => {}} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {priorities.length === 0 && otherTasksForDay.length === 0 && (
                                 <div className="text-center text-text-secondary py-16">No tasks scheduled for today.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


// --- Month View Sub-Component ---
interface MonthViewProps {
    allTasks: GlobalCalendarTask[];
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    setFocusedTask: (task: GlobalCalendarTask | null) => void;
    onSetDisplayMode: (mode: CalendarDisplayMode) => void;
}
const MonthView: React.FC<MonthViewProps> = ({ allTasks, currentDate, setCurrentDate, setFocusedTask, onSetDisplayMode }) => {
    const { projects, projectGroups, updateTask, addTask } = useProject();
    const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [addingTaskTo, setAddingTaskTo] = useState<Date | null>(null);
    const [newTaskName, setNewTaskName] = useState("");
    const [newTaskProjectId, setNewTaskProjectId] = useState(projects[0]?.id || "");
    const newTaskInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if(addingTaskTo && newTaskInputRef.current) {
            newTaskInputRef.current.focus();
        }
    }, [addingTaskTo]);

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
            grid.push({ date: new Date(d), isCurrentMonth: d.getUTCMonth() === month, isToday: areDatesEqual(d, today) });
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
    
    const handleStartAddTask = (date: Date) => {
        setAddingTaskTo(date);
        setNewTaskName("");
        if(projects.length > 0) setNewTaskProjectId(projects[0].id);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const taskName = newTaskName.trim();
        const taskDate = addingTaskTo;
        
        if (taskDate && taskName && newTaskProjectId) {
            const dateStr = formatDate(taskDate);
            const newTask: Task = { id: `task-${Date.now()}`, name: taskName, completed: false, description: '', subtasks: [], startDate: dateStr, endDate: dateStr };
            await addTask(newTaskProjectId, newTask);
        }
        setAddingTaskTo(null);
        setNewTaskName("");
    };

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData('text/plain', taskId);
        setDraggedTaskId(taskId);
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

    const headerTitle = currentDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const numWeeks = calendarGrid.length / 7;

    return (
        <div className="h-full flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-border-color shrink-0 flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                    <button onClick={() => changeMonth(-1)} aria-label="Previous month" className="p-1 rounded text-text-secondary hover:bg-highlight"><ChevronLeftIcon className="w-5 h-5"/></button>
                    <button onClick={() => setCurrentDate(normalizeDate(new Date()))} className="px-3 py-1 text-sm rounded bg-highlight hover:bg-gray-700">Today</button>
                    <button onClick={() => changeMonth(1)} aria-label="Next month" className="p-1 rounded text-text-secondary hover:bg-highlight"><ChevronRightIcon className="w-5 h-5"/></button>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-center order-first w-full md:w-auto md:order-none">{headerTitle}</h2>
                <div className="flex items-center gap-2">
                    <div className="bg-highlight p-1 rounded-lg flex space-x-1">
                        <button onClick={() => onSetDisplayMode('month')} className="p-1.5 rounded-md bg-accent" title="Month View"><CalendarDaysIcon className="w-5 h-5 text-text-primary" /></button>
                        <button onClick={() => onSetDisplayMode('day')} className="p-1.5 rounded-md hover:bg-secondary" title="Day View"><ViewDayIcon className="w-5 h-5 text-text-primary" /></button>
                    </div>
                     <button onClick={() => downloadImage(`global-calendar-${formatDate(currentDate).slice(0, 7)}.png`)} disabled={isDownloading} className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-highlight text-text-secondary rounded-lg hover:bg-gray-700 disabled:opacity-50"><DownloadIcon className="w-4 h-4" /><span>{isDownloading ? 'Exporting...' : 'Export'}</span></button>
                </div>
            </header>
            <div ref={downloadRef} className="flex-grow overflow-auto flex flex-col bg-primary">
                <div className="grid grid-cols-7 shrink-0">{weekdays.map(day => <div key={day} className="text-center font-semibold text-sm text-text-secondary p-2 border-b border-r border-border-color bg-secondary">{day}</div>)}</div>
                <div className={`grid grid-cols-7 flex-grow`} style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(0, 1fr))` }}>
                    {calendarGrid.map((day, index) => {
                        const tasksForDay = allTasks.filter(task => !isNaN(task.startDateObj.getTime()) && day.date >= task.startDateObj && day.date <= task.endDateObj);
                        return (
                            <div key={index} className={`relative border-b border-r border-border-color p-1 flex flex-col group ${!day.isCurrentMonth ? 'bg-primary/50' : 'hover:bg-highlight/30'}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, day.date)}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-sm ${day.isToday ? 'bg-accent text-white rounded-full flex items-center justify-center w-6 h-6' : 'text-text-primary'}`}>{day.date.getUTCDate()}</span>
                                    {addingTaskTo === null && (
                                        <button onClick={() => handleStartAddTask(day.date)} className="opacity-0 group-hover:opacity-100 transition-opacity text-accent hover:text-blue-400" aria-label={`Add task for ${day.date.toISOString().slice(0,10)}`}>
                                            <PlusIcon className="w-4 h-4"/>
                                        </button>
                                    )}
                                </div>
                                <div className="flex-grow space-y-1 overflow-y-auto mt-1">
                                    {tasksForDay.map(task => {
                                        const project = projects.find(p => p.id === task.projectId);
                                        const group = project ? projectGroups.find(g => g.id === project.groupId) : undefined;
                                        const taskColor = group?.color?.replace('bg-', '')?.split('-')[0] || 'gray';
                                        
                                        return (
                                            <div key={task.id} title={`${task.name}\nProject: ${project?.name || 'N/A'}\nGroup: ${group?.name || 'N/A'}`} draggable onDragStart={(e) => handleDragStart(e, task.id)} onClick={() => setFocusedTask(task)} 
                                                 className={`text-white text-xs rounded px-1.5 py-1 cursor-pointer flex items-center ${task.completed ? 'opacity-50 bg-gray-600' : ''} ${draggedTaskId === task.id ? 'opacity-30' : ''}`} 
                                                 style={{ backgroundColor: task.completed ? undefined : `var(--tw-color-${taskColor}-500)` }}
                                            >
                                               <div className="flex items-center min-w-0"><span className={`truncate ${task.completed ? 'line-through' : ''}`}>{task.name}</span></div>
                                            </div>
                                        );
                                    })}
                                    {addingTaskTo && areDatesEqual(addingTaskTo, day.date) && (
                                        <form onSubmit={handleFormSubmit} className="bg-highlight p-2 rounded-lg space-y-2 relative z-10">
                                            <input ref={newTaskInputRef} type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="New task..."
                                                className="w-full bg-secondary border border-accent rounded p-1 text-xs focus:outline-none" />
                                            <select value={newTaskProjectId} onChange={e => setNewTaskProjectId(e.target.value)} className="w-full bg-secondary border border-border-color rounded p-1 text-xs">
                                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                            <div className="flex justify-end gap-1">
                                                <button type="button" onClick={() => setAddingTaskTo(null)} className="px-2 py-0.5 text-xs bg-gray-600 rounded">Cancel</button>
                                                <button type="submit" className="px-2 py-0.5 text-xs bg-accent text-white rounded">Add</button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default GlobalCalendar;