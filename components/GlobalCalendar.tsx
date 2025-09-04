import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task, Project } from '../types';
import { ChevronRightIcon, ChevronLeftIcon, PlusIcon, DownloadIcon, ImageIcon } from './IconComponents';
import TaskItem from './TaskItem';
import { useProject } from '../contexts/ProjectContext';
import { generateImageForTask } from '../services/geminiService';
import { useDownloadImage } from '../hooks/useDownloadImage';

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

const GlobalCalendar: React.FC = () => {
    const { visibleProjects, projects, projectGroups, addTask, updateTask, deleteTask, addSubtask, moveTask } = useProject();
    const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
    
    const [currentDate, setCurrentDate] = useState(() => normalizeDate(new Date()));
    const [addingTaskTo, setAddingTaskTo] = useState<Date | null>(null);
    const [newTaskName, setNewTaskName] = useState("");
    const [newProjectForTask, setNewProjectForTask] = useState(projects[0]?.id || '');
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
    const [focusedTask, setFocusedTask] = useState<GlobalCalendarTask | null>(null);
    const newTaskInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (addingTaskTo && newTaskInputRef.current) {
            newTaskInputRef.current.focus();
        }
    }, [addingTaskTo]);
    
    useEffect(() => {
        if (!newProjectForTask && projects.length > 0) {
            setNewProjectForTask(projects[0].id);
        }
    }, [projects, newProjectForTask]);

    const allTasks = useMemo(() => {
        const flattened: GlobalCalendarTask[] = [];
        visibleProjects.forEach(project => {
            const flatten = (tasks: Task[], projectId: string) => {
                tasks.forEach(task => {
                    const startDateObj = parseDate(task.startDate);
                    const endDateObj = parseDate(task.endDate);
                    if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
                        flattened.push({ ...task, projectId, startDateObj, endDateObj });
                    }
                    if (task.subtasks) flatten(task.subtasks, projectId);
                });
            };
            flatten(project.tasks, project.id);
        });
        return flattened.sort((a,b) => dayDiff(a.startDateObj, b.startDateObj));
    }, [visibleProjects]);

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

    const changePeriod = (amount: number) => {
        setAddingTaskTo(null);
        const newDate = new Date(currentDate);
        newDate.setUTCMonth(newDate.getUTCMonth() + amount);
        setCurrentDate(newDate);
    };
    
    const handleStartAddTask = (date: Date) => {
        setAddingTaskTo(date);
        setNewTaskName("");
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const taskName = newTaskName.trim();
        const taskDate = addingTaskTo;
        
        if (taskDate && taskName && newProjectForTask) {
            const dateStr = formatDate(taskDate);
            const newTask: Task = { id: `task-${Date.now()}`, name: taskName, description: '', completed: false, subtasks: [], startDate: dateStr, endDate: dateStr };
            await addTask(newProjectForTask, newTask);
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

    const handleGenerateImage = async (task: GlobalCalendarTask) => {
        if (generatingImageFor) return;
        setGeneratingImageFor(task.id);
        try {
            const imageUrl = await generateImageForTask(task.name);
            const { projectId, startDateObj, endDateObj, ...originalTask } = task;
            await updateTask(projectId, { ...originalTask, imageUrl });
        } catch (error) {
            console.error("Failed to generate image for task:", error);
            alert("Could not generate image. Please check the console for details.");
        } finally {
            setGeneratingImageFor(null);
        }
    };

    const headerTitle = useMemo(() => {
        return currentDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    }, [currentDate]);
    
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
    
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const numWeeks = calendarGrid.length / 7;

    return (
        <div ref={downloadRef} className="h-full flex flex-col bg-secondary rounded-lg">
            <header className="flex items-center justify-between p-4 border-b border-border-color shrink-0 flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                    <button onClick={() => changePeriod(-1)} aria-label="Previous period" className="p-1 rounded text-text-secondary hover:bg-highlight"><ChevronLeftIcon className="w-5 h-5"/></button>
                    <button onClick={() => setCurrentDate(normalizeDate(new Date()))} className="px-3 py-1 text-sm rounded bg-highlight hover:bg-gray-700">Today</button>
                    <button onClick={() => changePeriod(1)} aria-label="Next period" className="p-1 rounded text-text-secondary hover:bg-highlight"><ChevronRightIcon className="w-5 h-5"/></button>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-center order-first w-full md:w-auto md:order-none">{headerTitle}</h2>
                <button 
                    onClick={() => downloadImage(`global-calendar.png`)} 
                    disabled={isDownloading} 
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-highlight text-text-secondary rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    <span>{isDownloading ? 'Exporting...' : 'Export'}</span>
                </button>
            </header>
            <div className="flex-grow overflow-auto flex flex-col">
                <div className="grid grid-cols-7 shrink-0">{weekdays.map(day => <div key={day} className="text-center font-semibold text-sm text-text-secondary p-2 border-b border-r border-border-color">{day}</div>)}</div>
                <div className={`grid grid-cols-7 flex-grow`} style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(0, 1fr))` }}>
                    {calendarGrid.map((day, index) => {
                        const tasksForDay = allTasks.filter(task => day.date >= task.startDateObj && day.date <= task.endDateObj);
                        return (
                            <div key={index} className={`relative border-b border-r border-border-color p-1 flex flex-col group ${!day.isCurrentMonth ? 'bg-primary' : 'hover:bg-highlight/50'}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, day.date)}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-sm ${day.isToday ? 'bg-accent text-white rounded-full flex items-center justify-center w-6 h-6' : 'text-text-primary'}`}>{day.date.getUTCDate()}</span>
                                    {addingTaskTo === null && <button onClick={() => handleStartAddTask(day.date)} className="opacity-0 group-hover:opacity-100 transition-opacity text-accent hover:text-blue-400" aria-label={`Add task for ${day.date.toISOString().slice(0,10)}`}><PlusIcon className="w-4 h-4"/></button>}
                                </div>
                                <div className="flex-grow space-y-1 overflow-y-auto">
                                    {tasksForDay.map(task => {
                                        const project = projects.find(p => p.id === task.projectId);
                                        const group = project ? projectGroups.find(g => g.id === project.groupId) : undefined;
                                        const projectColor = group ? group.color : 'bg-gray-500';
                                        return (
                                            <div key={task.id} title={task.name} draggable onDragStart={(e) => handleDragStart(e, task.id)}
                                                onClick={() => setFocusedTask(task)}
                                                className={`text-white text-xs rounded px-1.5 py-1 cursor-pointer flex items-center justify-between group/task ${task.completed ? 'opacity-50 bg-gray-600' : 'opacity-90 bg-accent'} ${draggedTaskId === task.id ? 'opacity-30' : ''}`}
                                            >
                                               <div className="flex items-center min-w-0">
                                                   {task.imageUrl ? (
                                                        <img src={task.imageUrl} alt={task.name} className="w-4 h-4 rounded-sm mr-1.5 object-cover shrink-0"/>
                                                    ) : (
                                                        <div className={`w-1.5 h-1.5 rounded-full ${projectColor} mr-1.5 shrink-0`}></div>
                                                    )}
                                                   <span className={`truncate ${task.completed ? 'line-through' : ''}`}>{task.name}</span>
                                               </div>
                                               {!task.imageUrl && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleGenerateImage(task); }} 
                                                        disabled={!!generatingImageFor}
                                                        className="p-0.5 opacity-0 group-hover/task:opacity-100 shrink-0"
                                                    >
                                                        {generatingImageFor === task.id ? (
                                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                        ) : (
                                                            <ImageIcon className="w-3 h-3"/>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {addingTaskTo && areDatesEqual(addingTaskTo, day.date) && (
                                        <form onSubmit={handleFormSubmit}>
                                            <input ref={newTaskInputRef} type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} onBlur={(e) => e.currentTarget.form?.requestSubmit()} onKeyDown={(e) => { if (e.key === 'Escape') { setAddingTaskTo(null); setNewTaskName(""); }}} placeholder="New task..." className="w-full bg-highlight border border-accent rounded p-1 text-xs focus:outline-none relative z-10" />
                                            <select value={newProjectForTask} onChange={e => setNewProjectForTask(e.target.value)} className="mt-1 w-full bg-highlight border border-accent rounded p-1 text-xs focus:outline-none relative z-10">
                                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </form>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
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
                                    if (refreshedTask) setFocusedTask(refreshedTask);
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

export default GlobalCalendar;