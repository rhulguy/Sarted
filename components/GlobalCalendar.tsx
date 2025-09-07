import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Task, Project, Habit, ProjectGroup } from '../types';
import { ChevronRightIcon, ChevronLeftIcon, PlusIcon, DownloadIcon, ImageIcon, ViewDayIcon, CalendarDaysIcon, SparklesIcon, CheckCircleIcon, ViewWeekIcon, FolderIcon } from './IconComponents';
import TaskItem from './TaskItem';
import Spinner from './Spinner';
import { useProject } from '../contexts/ProjectContext';
import { useHabit } from '../contexts/HabitContext';
import { useDownloadImage } from '../hooks/useDownloadImage';

// --- Type Definitions ---
type CalendarDisplayMode = 'month' | 'week' | 'day';

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

// --- Helper Components ---

const useClickOutside = (ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent) => void) => {
    useEffect(() => {
        const listener = (event: MouseEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
        };
    }, [ref, handler]);
};

const ProjectFilterDropdown: React.FC<{
    selectedProjectIds: string[];
    onSelectionChange: (ids: string[]) => void;
    projects: Project[];
    projectGroups: ProjectGroup[];
}> = ({ selectedProjectIds, onSelectionChange, projects, projectGroups }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    useClickOutside(wrapperRef, () => setIsOpen(false));

    const handleToggleProject = (projectId: string) => {
        const newSelection = selectedProjectIds.includes(projectId)
            ? selectedProjectIds.filter(id => id !== projectId)
            : [...selectedProjectIds, projectId];
        onSelectionChange(newSelection);
    };

    const groupedProjects = useMemo(() => {
        return projectGroups
            .map(group => ({
                ...group,
                projects: projects.filter(p => p.groupId === group.id),
            }))
            .filter(group => group.projects.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [projectGroups, projects]);

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-app-background text-text-secondary rounded-lg hover:bg-border-color transition-colors"
            >
                <FolderIcon className="w-4 h-4" />
                <span>{selectedProjectIds.length > 0 ? `${selectedProjectIds.length} Project(s)` : 'All Projects'}</span>
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-card-background border border-border-color rounded-xl shadow-soft z-20 max-h-80 overflow-y-auto p-2">
                    <div className="p-1">
                        <label className="flex items-center space-x-3 p-2 hover:bg-app-background cursor-pointer rounded-lg">
                            <input
                                type="checkbox"
                                checked={selectedProjectIds.length === 0}
                                onChange={() => onSelectionChange([])}
                                className="w-4 h-4 rounded text-accent-blue focus:ring-accent-blue"
                            />
                            <span className="text-sm font-semibold text-text-primary">All Projects</span>
                        </label>
                    </div>
                    {groupedProjects.map(group => (
                        <div key={group.id} className="p-1">
                            <h4 className="text-xs font-semibold text-text-secondary uppercase px-2 mb-1 flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${group.color} shrink-0`}></div>
                                {group.name}
                            </h4>
                            {group.projects.map(project => (
                                 <label key={project.id} className="flex items-center space-x-3 p-2 hover:bg-app-background cursor-pointer rounded-lg">
                                    <input
                                        type="checkbox"
                                        checked={selectedProjectIds.includes(project.id)}
                                        onChange={() => handleToggleProject(project.id)}
                                        className="w-4 h-4 rounded text-accent-blue focus:ring-accent-blue"
                                    />
                                    <span className="text-sm text-text-primary">{project.name}</span>
                                </label>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- Add Task Modal Component ---
interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduleTask: (projectId: string, taskId: string, date: string) => void;
}

const AddTaskFromProjectModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onScheduleTask }) => {
    const { visibleProjects } = useProject();
    const [selectedTaskInfo, setSelectedTaskInfo] = useState<{ task: Task; projectId: string } | null>(null);
    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

    const unscheduledTasksByProject = useMemo(() => {
        const getUnscheduled = (tasks: Task[]): Task[] => {
            const results: Task[] = [];
            tasks.forEach(task => {
                if (!task.startDate) {
                    results.push(task);
                }
                // Recursively find in subtasks as well
                if (task.subtasks) {
                    results.push(...getUnscheduled(task.subtasks));
                }
            });
            return results;
        };

        return visibleProjects
            .map(p => ({
                ...p,
                unscheduledTasks: getUnscheduled(p.tasks),
            }))
            .filter(p => p.unscheduledTasks.length > 0);
    }, [visibleProjects]);

    const handleSchedule = () => {
        if (selectedTaskInfo && selectedDate) {
            onScheduleTask(selectedTaskInfo.projectId, selectedTaskInfo.task.id, selectedDate);
            onClose();
        }
    };

    useEffect(() => {
        if (!isOpen) {
            setSelectedTaskInfo(null);
            setSelectedDate(formatDate(new Date()));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-card-background rounded-2xl shadow-xl w-full max-w-lg flex flex-col h-[70vh]" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-border-color shrink-0">
                    <h2 className="text-xl font-bold">{selectedTaskInfo ? 'Schedule Task' : 'Add Task to Calendar'}</h2>
                </header>
                <div className="flex-grow p-4 overflow-y-auto">
                    {selectedTaskInfo ? (
                        <div className="space-y-4">
                            <p>Schedule <span className="font-semibold">{selectedTaskInfo.task.name}</span> for:</p>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="w-full bg-app-background border border-border-color rounded-md p-2 text-sm"
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {unscheduledTasksByProject.map(project => (
                                <details key={project.id} open>
                                    <summary className="font-semibold cursor-pointer">{project.name}</summary>
                                    <ul className="pl-4 mt-2 space-y-1">
                                        {project.unscheduledTasks.map(task => (
                                            <li key={task.id} className="flex items-center justify-between p-1 hover:bg-app-background rounded">
                                                <span>{task.name}</span>
                                                <button onClick={() => setSelectedTaskInfo({ task, projectId: project.id })} className="p-1 text-accent-blue">
                                                    <PlusIcon className="w-5 h-5"/>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            ))}
                        </div>
                    )}
                </div>
                <footer className="p-4 border-t border-border-color shrink-0 flex justify-end gap-2">
                    {selectedTaskInfo && (
                        <button onClick={() => setSelectedTaskInfo(null)} className="px-4 py-2 bg-app-background rounded-lg hover:bg-border-color">Back</button>
                    )}
                    <button onClick={selectedTaskInfo ? handleSchedule : onClose} className="px-4 py-2 bg-accent-blue text-white rounded-lg">
                        {selectedTaskInfo ? 'Schedule' : 'Close'}
                    </button>
                </footer>
            </div>
        </div>
    );
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
    const [filteredProjectIds, setFilteredProjectIds] = useState<string[]>([]);
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);

    const allTasks = useMemo(() => {
        const flattened: GlobalCalendarTask[] = [];
        visibleProjects.forEach(project => {
            const flatten = (tasks: Task[], projectId: string) => {
                tasks.forEach(task => {
                    const startDateObj = parseDate(task.startDate);
                    // Even if a task has a start date, we still want to be able to interact with it.
                    // Let's adjust logic to consider tasks that can be scheduled.
                    let endDateObj = parseDate(task.endDate);
                    if (!isNaN(startDateObj.getTime()) && isNaN(endDateObj.getTime())) {
                        endDateObj = startDateObj;
                    }
                    flattened.push({ ...task, projectId, startDateObj, endDateObj });
                    
                    if (task.subtasks) flatten(task.subtasks, projectId);
                });
            };
            flatten(project.tasks, project.id);
        });
        return flattened;
    }, [visibleProjects]);
    
    const filteredTasks = useMemo(() => {
        if (filteredProjectIds.length === 0) return allTasks.filter(t => t.startDate);
        return allTasks.filter(task => task.startDate && filteredProjectIds.includes(task.projectId));
    }, [allTasks, filteredProjectIds]);
    
    // --- Event Handlers ---
    const onUpdateTask = (projectId: string) => async (updatedTask: Task) => { await updateTask(projectId, updatedTask); };
    const onDeleteTask = (projectId: string) => async (taskId: string) => { await deleteTask(projectId, taskId); };
    const onAddSubtask = (projectId: string) => async (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => {
        const newSubtask: Task = { id: `task-${Date.now()}`, name: subtaskName, completed: false, description: '', subtasks: [], startDate, endDate };
        await addSubtask(projectId, parentId, newSubtask);
    };
    const onMoveProject = async (sourceProjectId: string, targetProjectId: string, task: Task) => {
        await moveTask(sourceProjectId, targetProjectId, task);
        setFocusedTask(null);
    };

    const handleScheduleTask = async (projectId: string, taskId: string, date: string) => {
        const project = visibleProjects.find(p => p.id === projectId);
        if (!project) return;
        
        let taskToUpdate: Task | null = null;
        const findTaskRecursive = (tasks: Task[]): Task | null => {
            for (const task of tasks) {
                if (task.id === taskId) return task;
                if (task.subtasks) {
                    const found = findTaskRecursive(task.subtasks);
                    if (found) return found;
                }
            }
            return null;
        };
        
        taskToUpdate = findTaskRecursive(project.tasks);

        if (taskToUpdate) {
            await updateTask(projectId, { ...taskToUpdate, startDate: date, endDate: date });
        }
    };
    
    // --- Date Navigation ---
    const changeDate = (amount: number) => {
        const newDate = new Date(currentDate);
        if (displayMode === 'month') newDate.setUTCMonth(newDate.getUTCMonth() + amount);
        else if (displayMode === 'week') newDate.setUTCDate(newDate.getUTCDate() + (amount * 7));
        else newDate.setUTCDate(newDate.getUTCDate() + amount);
        setCurrentDate(newDate);
    };

    const { calendarGrid, weekStartDate, weekEndDate, weekDates } = useMemo(() => {
        const year = currentDate.getUTCFullYear();
        const month = currentDate.getUTCMonth();
        const firstDayOfMonth = new Date(Date.UTC(year, month, 1)); const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
        const gridStartDate = new Date(firstDayOfMonth); gridStartDate.setUTCDate(gridStartDate.getUTCDate() - gridStartDate.getUTCDay());
        const gridEndDate = new Date(lastDayOfMonth); gridEndDate.setUTCDate(gridEndDate.getUTCDate() + (6 - gridEndDate.getUTCDay()));
        const grid: CalendarDay[] = []; const today = normalizeDate(new Date()); let d = new Date(gridStartDate);
        while (d <= gridEndDate) { grid.push({ date: new Date(d), isCurrentMonth: d.getUTCMonth() === month, isToday: areDatesEqual(d, today) }); d.setUTCDate(d.getUTCDate() + 1); }
        
        const weekD = new Date(currentDate); const day = weekD.getUTCDay();
        const diff = weekD.getUTCDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(weekD.setUTCDate(diff));
        const end = new Date(start); end.setUTCDate(start.getUTCDate() + 6);
        const dates = Array.from({length: 7}).map((_, i) => { const nextDay = new Date(start); nextDay.setUTCDate(start.getUTCDate() + i); return nextDay; });
        return { calendarGrid: grid, weekStartDate: start, weekEndDate: end, weekDates: dates };
    }, [currentDate]);

    const headerTitle = useMemo(() => {
        if (displayMode === 'month') return currentDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        if (displayMode === 'week') return `${weekStartDate.toLocaleDateString('default', { month: 'long', day: 'numeric', timeZone: 'UTC' })} - ${weekEndDate.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
        return currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }, [currentDate, displayMode, weekStartDate, weekEndDate]);
    
    const handleExport = () => {
        let range;
        if (displayMode === 'month') range = { start: calendarGrid[0].date, end: calendarGrid[calendarGrid.length - 1].date };
        else if (displayMode === 'week') range = { start: weekStartDate, end: weekEndDate };
        else range = { start: currentDate, end: currentDate };
        setExportDateRange(range);
        setIsExportModalOpen(true);
    };

    return (
        <div className="h-full flex flex-col bg-card-background">
            <header className="flex items-center justify-between p-4 border-b border-border-color shrink-0 flex-wrap gap-2">
                <div className="flex items-center space-x-2"><button onClick={() => changeDate(-1)} aria-label="Previous period" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronLeftIcon className="w-5 h-5"/></button><button onClick={() => setCurrentDate(normalizeDate(new Date()))} className="px-3 py-1 text-sm rounded bg-app-background hover:bg-border-color">Today</button><button onClick={() => changeDate(1)} aria-label="Next period" className="p-1 rounded text-text-secondary hover:bg-app-background"><ChevronRightIcon className="w-5 h-5"/></button></div>
                <h2 className="text-lg md:text-xl font-bold text-center order-first w-full md:w-auto md:order-none">{headerTitle}</h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsAddTaskModalOpen(true)} className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-app-background text-text-secondary rounded-lg hover:bg-border-color transition-colors">
                        <PlusIcon className="w-4 h-4" />
                        <span>Add Task</span>
                    </button>
                    <ProjectFilterDropdown selectedProjectIds={filteredProjectIds} onSelectionChange={setFilteredProjectIds} projects={visibleProjects} projectGroups={projectGroups} />
                    <div className="bg-app-background p-1 rounded-lg flex space-x-1"><button onClick={() => setDisplayMode('month')} className={`p-1.5 rounded-md ${displayMode === 'month' ? 'bg-accent-blue text-white' : 'hover:bg-card-background'}`} title="Month View"><CalendarDaysIcon className="w-5 h-5" /></button><button onClick={() => setDisplayMode('week')} className={`p-1.5 rounded-md ${displayMode === 'week' ? 'bg-accent-blue text-white' : 'hover:bg-card-background'}`} title="Week View"><ViewWeekIcon className="w-5 h-5" /></button><button onClick={() => setDisplayMode('day')} className={`p-1.5 rounded-md ${displayMode === 'day' ? 'bg-accent-blue text-white' : 'hover:bg-card-background'}`} title="Day View"><ViewDayIcon className="w-5 h-5" /></button></div>
                    <button onClick={handleExport} className="hidden md:flex items-center space-x-2 px-3 py-1.5 text-sm bg-app-background text-text-secondary rounded-lg hover:bg-border-color"><DownloadIcon className="w-4 h-4" /><span>Export</span></button>
                </div>
            </header>
            
            <div className="flex-grow overflow-auto">
                {displayMode === 'month' && <MonthGrid tasks={filteredTasks} setFocusedTask={setFocusedTask} calendarGrid={calendarGrid} />}
                {displayMode === 'week' && <WeekGrid tasks={filteredTasks} setFocusedTask={setFocusedTask} weekDates={weekDates} />}
                {displayMode === 'day' && <DayPlanner tasks={filteredTasks} setFocusedTask={setFocusedTask} selectedDate={currentDate} />}
            </div>

            <AddTaskFromProjectModal isOpen={isAddTaskModalOpen} onClose={() => setIsAddTaskModalOpen(false)} onScheduleTask={handleScheduleTask} />
            {isExportModalOpen && <AchievementsExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} startDate={exportDateRange.start} endDate={exportDateRange.end} />}
            {focusedTask && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setFocusedTask(null)}>
                    <div className="bg-card-background rounded-lg shadow-xl p-4 md:p-6 w-full max-w-2xl mx-2" onClick={e => e.stopPropagation()}>
                        <div className="max-h-[80vh] overflow-y-auto">
                           <TaskItem 
                                task={focusedTask} level={0}
                                onUpdate={async (updatedTask) => {
                                    await onUpdateTask(focusedTask.projectId)(updatedTask);
                                    const refreshedTask = allTasks.find(t => t.id === updatedTask.id);
                                    if (refreshedTask) setFocusedTask(t => ({...t!, ...refreshedTask}));
                                }}
                                onDelete={async (taskId) => { await onDeleteTask(focusedTask.projectId)(taskId); setFocusedTask(null); }}
                                onAddSubtask={onAddSubtask(focusedTask.projectId)}
                                projects={projects} currentProjectId={focusedTask.projectId}
                                onMoveProject={(targetProjectId) => onMoveProject(focusedTask.projectId, targetProjectId, focusedTask)}
                           />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- View Content Components ---
const MonthGrid: React.FC<{tasks: GlobalCalendarTask[], setFocusedTask: (t: GlobalCalendarTask) => void, calendarGrid: CalendarDay[]}> = ({tasks, setFocusedTask, calendarGrid}) => {
    const { visibleProjects, projects, projectGroups, updateTask, addTask } = useProject();
    const [draggedTaskId, setDraggedTaskId] = useState<string|null>(null);
    const [addingTaskTo, setAddingTaskTo] = useState<Date | null>(null);
    const [newTaskName, setNewTaskName] = useState("");
    const [newProjectId, setNewProjectId] = useState<string>("");
    const newTaskInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!newProjectId && visibleProjects.length > 0) {
            setNewProjectId(visibleProjects[0].id);
        }
    }, [visibleProjects, newProjectId]);

    useEffect(() => { if(addingTaskTo && newTaskInputRef.current) newTaskInputRef.current.focus(); }, [addingTaskTo]);

    const handleAddTask = async () => {
        const taskName = newTaskName.trim();
        if (addingTaskTo && taskName && newProjectId) {
            const dateStr = formatDate(addingTaskTo);
            const newTaskData: Omit<Task, 'id'> = {
                name: taskName, description: '', completed: false, subtasks: [],
                startDate: dateStr, endDate: dateStr,
            };
            await addTask(newProjectId, { ...newTaskData, id: `task-${Date.now()}` });
        }
        setAddingTaskTo(null);
        setNewTaskName("");
    };

    const handleDrop = async (e: React.DragEvent, dropDate: Date) => {
        e.preventDefault(); const taskId = e.dataTransfer.getData('text/plain'); const task = tasks.find(t => t.id === taskId);
        if (task) {
            const duration = dayDiff(task.startDateObj, task.endDateObj); const newStartDate = new Date(dropDate);
            const newEndDate = new Date(newStartDate); newEndDate.setUTCDate(newEndDate.getUTCDate() + duration);
            const { projectId, startDateObj, endDateObj, ...originalTask } = task;
            await updateTask(projectId, { ...originalTask, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) });
        }
        setDraggedTaskId(null);
    };

    const numWeeks = calendarGrid.length / 7;
    return(
        <div className="flex-grow flex flex-col bg-app-background">
            <div className="grid grid-cols-7 shrink-0">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="text-center font-semibold text-sm text-text-secondary p-2 border-b border-r border-border-color bg-card-background">{day}</div>)}</div>
            <div className={`grid grid-cols-7 flex-grow`} style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(0, 1fr))` }}>
                {calendarGrid.map((day, index) => {
                    const tasksForDay = tasks.filter(task => day.date >= task.startDateObj && day.date <= task.endDateObj);
                    const isAddingHere = addingTaskTo && areDatesEqual(addingTaskTo, day.date);
                    return (
                        <div key={index} className={`relative border-b border-r border-border-color p-1 flex flex-col group ${!day.isCurrentMonth ? 'bg-app-background/50' : 'bg-card-background hover:bg-app-background'}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, day.date)}>
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm ${day.isToday ? 'bg-accent-blue text-white rounded-full flex items-center justify-center w-6 h-6' : 'text-text-primary'}`}>{day.date.getUTCDate()}</span>
                                {!isAddingHere && (
                                    <button onClick={() => setAddingTaskTo(day.date)} className="opacity-0 group-hover:opacity-100 transition-opacity text-accent-blue hover:text-blue-400" aria-label={`Add task for ${day.date.toISOString().slice(0,10)}`}>
                                        <PlusIcon className="w-4 h-4"/>
                                    </button>
                                )}
                            </div>
                            <div className="flex-grow space-y-1 overflow-y-auto mt-1">
                                {tasksForDay.map(task => {
                                    const project = projects.find(p => p.id === task.projectId); const group = project ? projectGroups.find(g => g.id === project.groupId) : undefined;
                                    return (<div key={task.id} title={`${task.name}\nProject: ${project?.name || 'N/A'}`} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); setDraggedTaskId(task.id)}} onClick={() => setFocusedTask(task)} className={`text-white text-xs rounded px-1.5 py-1 cursor-pointer flex items-center ${task.completed ? 'opacity-50 bg-gray-600' : ''} ${draggedTaskId === task.id ? 'opacity-30' : ''} ${group?.color || 'bg-gray-500'}`}><div className="flex items-center min-w-0"><span className={`truncate ${task.completed ? 'line-through' : ''}`}>{task.name}</span></div></div>);
                                })}
                                {isAddingHere && (
                                    <form onSubmit={(e) => { e.preventDefault(); handleAddTask(); }} className="bg-card-background p-1.5 rounded-lg space-y-2 relative z-10 border border-accent-blue shadow-lg">
                                        <input ref={newTaskInputRef} type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} onBlur={handleAddTask} placeholder="New task..." className="w-full bg-app-background border border-border-color rounded p-1 text-xs focus:outline-none" />
                                        <select value={newProjectId} onChange={e => setNewProjectId(e.target.value)} className="w-full bg-app-background border border-border-color rounded p-1 text-xs focus:outline-none">
                                            {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </form>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    )
};

const WeekGrid: React.FC<{tasks: GlobalCalendarTask[], setFocusedTask: (t: GlobalCalendarTask) => void, weekDates: Date[]}> = ({tasks, setFocusedTask, weekDates}) => {
    const { projects, projectGroups, updateTask } = useProject();
    const [draggedTaskId, setDraggedTaskId] = useState<string|null>(null);

    const handleDrop = async (e: React.DragEvent, dropDate: Date) => {
        e.preventDefault(); const taskId = e.dataTransfer.getData('text/plain'); const task = tasks.find(t => t.id === taskId);
        if (task) {
            const duration = dayDiff(task.startDateObj, task.endDateObj); const newStartDate = new Date(dropDate);
            const newEndDate = new Date(newStartDate); newEndDate.setUTCDate(newEndDate.getUTCDate() + duration);
            const { projectId, startDateObj, endDateObj, ...originalTask } = task;
            await updateTask(projectId, { ...originalTask, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) });
        }
        setDraggedTaskId(null);
    };

    return (
        <div className="grid grid-cols-7 flex-grow">
            {weekDates.map((day, index) => {
                const tasksForDay = tasks.filter(task => day >= task.startDateObj && day <= task.endDateObj);
                const isToday = areDatesEqual(day, normalizeDate(new Date()));
                return (
                    <div key={index} className={`relative border-r border-border-color p-2 flex flex-col group`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, day)}>
                        <div className="flex justify-between items-center mb-2"><span className={`text-sm font-semibold ${isToday ? 'bg-accent-blue text-white rounded-full flex items-center justify-center w-6 h-6' : 'text-text-primary'}`}>{day.getUTCDate()}</span><span className="text-sm font-semibold text-text-secondary">{day.toLocaleDateString('default', { weekday: 'short', timeZone: 'UTC' })}</span></div>
                        <div className="flex-grow space-y-1.5 overflow-y-auto mt-1">{tasksForDay.map(task => {
                            const project = projects.find(p => p.id === task.projectId); const group = project ? projectGroups.find(g => g.id === project.groupId) : undefined;
                            return (<div key={task.id} title={task.name} draggable onDragStart={(e) => {e.dataTransfer.setData('text/plain', task.id); setDraggedTaskId(task.id)}} onClick={() => setFocusedTask(task)} className={`text-white text-xs rounded px-1.5 py-1 cursor-pointer flex items-center ${task.completed ? 'opacity-50 bg-gray-600' : ''} ${draggedTaskId === task.id ? 'opacity-30' : ''} ${group?.color || 'bg-gray-500'}`}><div className="flex items-center min-w-0"><span className={`truncate ${task.completed ? 'line-through' : ''}`}>{task.name}</span></div></div>);
                        })}</div>
                    </div>
                );
            })}
        </div>
    );
};

const DayPlanner: React.FC<{tasks: GlobalCalendarTask[], setFocusedTask: (t: GlobalCalendarTask) => void, selectedDate: Date}> = ({tasks, setFocusedTask, selectedDate}) => {
    const { updateTask } = useProject();
    const timelineRef = useRef<HTMLDivElement>(null);

    const tasksForDay = useMemo(() => tasks.filter(task => areDatesEqual(task.startDateObj, selectedDate)), [tasks, selectedDate]);
    const scheduledTasks = useMemo(() => tasksForDay.filter(t => t.startTime), [tasksForDay]);
    const unscheduledTasks = useMemo(() => tasksForDay.filter(t => !t.startTime), [tasksForDay]);
    
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); const taskId = e.dataTransfer.getData('taskId'); const task = tasks.find(t => t.id === taskId); if (!task || !timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect(); const dropY = e.clientY - rect.top; const totalMinutes = (dropY / rect.height) * (23 - 6) * 60;
        const hour = Math.floor(totalMinutes / 60) + 6; const minute = Math.round((totalMinutes % 60) / 30) * 30;
        const newStartTime = `${String(hour).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
        updateTask(task.projectId, { ...task, startTime: newStartTime, duration: task.duration || 60 });
    };

    const handleTaskUpdateOnTimeline = (taskId: string, updates: { startTime?: string, duration?: number }) => {
        const task = tasks.find(t => t.id === taskId); if (task) updateTask(task.projectId, { ...task, ...updates });
    };

    return(
        <div className="grid grid-cols-1 md:grid-cols-4 bg-app-background h-full">
            <div className="md:col-span-3 flex h-full">
                <div className="w-16 shrink-0 text-right pr-2 text-xs text-text-secondary py-2">{Array.from({length: 18}).map((_, i) => <div key={i} className="h-16 flex items-start justify-end">{i+6}:00</div>)}</div>
                <div ref={timelineRef} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="flex-grow relative bg-card-background border-l border-border-color">{Array.from({length: 34}).map((_, i) => <div key={i} className="h-8 border-b border-border-color"></div>)}
                {scheduledTasks.map(task => <ScheduledTaskItem key={task.id} task={task} onUpdate={handleTaskUpdateOnTimeline} onClick={() => setFocusedTask(task)} />)}
                </div>
            </div>
            <div className="md:col-span-1 p-4 space-y-4 border-l border-border-color overflow-y-auto">
                <div><h3 className="font-semibold mb-2">Unscheduled</h3>
                    <div className="space-y-2">{unscheduledTasks.map(task => <UnscheduledTaskItem key={task.id} task={task} onClick={() => setFocusedTask(task)} />)}
                        {unscheduledTasks.length === 0 && <p className="text-xs text-text-secondary">No unscheduled tasks for today.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Achievements Export Modal ---
const AchievementsExportModal: React.FC<{isOpen: boolean; onClose: () => void; startDate: Date; endDate: Date;}> = ({ isOpen, onClose, startDate, endDate }) => {
    const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
    const { visibleProjects } = useProject();
    const { habits } = useHabit();

    const { completedTasks, completedHabits } = useMemo(() => {
        const tasks: Task[] = [];
        const taskCompletionsInRange = (task: Task) => {
            const completionDate = task.completionDate ? parseDate(task.completionDate) : null;
            if (completionDate && completionDate >= startDate && completionDate <= endDate) tasks.push(task);
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

export default GlobalCalendar;