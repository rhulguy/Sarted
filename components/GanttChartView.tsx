import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Task } from '../types';
import { PlusIcon, MinusIcon, ImageIcon, DownloadIcon, ArrowLongRightIcon, ArrowLongLeftIcon } from './IconComponents';
import { useProject } from '../contexts/ProjectContext';
import { generateImageForTask } from '../services/geminiService';
import Spinner from './Spinner';
import { useDownloadImage } from '../hooks/useDownloadImage';

interface GanttChartViewProps {
  onAddTask: (taskName: string, startDate?: string, endDate?: string) => Promise<void>;
  onUpdateTask: (updatedTask: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAddSubtask: (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => Promise<void>;
}

interface InteractionState {
    type: 'drag' | 'resize-start' | 'resize-end';
    taskId: string;
    startX: number;
    originalTask: Task;
    originalLeft: number;
    originalWidth: number;
}

interface CreatingState {
    task: GanttTask;
    startX: number;
}

interface GanttTask extends Task {
  level: number;
}

// --- Date Helper Functions ---
const parseDate = (dateStr: string | undefined): Date => {
  if (!dateStr) return new Date(NaN);
  return new Date(dateStr + 'T00:00:00Z');
};

const formatDate = (date: Date): string => {
    return date.toISOString().slice(0, 10);
};

const getDaysInMonthUTC = (year: number, month: number): number => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const dayDiff = (startDate: Date, endDate: Date): number => {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const startUTC = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
    const endUTC = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
    return Math.floor((endUTC - startUTC) / MS_PER_DAY);
}

const getMondayOfWeek = (d: Date): Date => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(date.setUTCDate(diff));
};


// --- Component ---
const GanttChartView: React.FC<GanttChartViewProps> = ({ onAddTask, onUpdateTask: onUpdateTaskProp, onDeleteTask, onAddSubtask }) => {
  const { selectedProject, updateTask, updateMultipleTasks, reparentTask } = useProject();
  const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
  const project = selectedProject!; // Assert non-null
  
  const [dayWidth, setDayWidth] = useState(30);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [creatingState, setCreatingState] = useState<CreatingState | null>(null);
  const [tempCreatingBar, setTempCreatingBar] = useState<{ left: number; width: number } | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [tempTaskBar, setTempTaskBar] = useState<{ id: string, left: number, width: number } | null>(null);


  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const taskBarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  const { allTasks, minDate, maxDate, taskMap, parentMap } = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    const flattenedTasks: GanttTask[] = [];
    const localTaskMap = new Map<string, Task>();
    const localParentMap = new Map<string, string | null>();

    const findDateRangeAndFlatten = (tasks: Task[], level: number, parentId: string | null) => {
        tasks.forEach(task => {
            flattenedTasks.push({ ...task, level });
            localTaskMap.set(task.id, task);
            localParentMap.set(task.id, parentId);
            const start = parseDate(task.startDate);
            const end = parseDate(task.endDate);
            if (!isNaN(start.getTime())) { if (!min || start < min) min = start; }
            if (!isNaN(end.getTime())) { if (!max || end > max) max = end; }
            if (task.subtasks) findDateRangeAndFlatten(task.subtasks, level + 1, task.id);
        });
    };
    findDateRangeAndFlatten(project.tasks, 0, null);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight

    let effectiveMin = today; // Default start date is today

    // If the earliest task starts in the future, use that date as the start
    // so the user doesn't have a huge empty space at the beginning.
    if (min && min > today) {
        effectiveMin = min;
    }

    let effectiveMax = max;
    const futureDate = new Date(today);
    futureDate.setUTCDate(futureDate.getUTCDate() + 30);
    if (!effectiveMax || effectiveMax < futureDate) {
        effectiveMax = futureDate;
    }

    return { allTasks: flattenedTasks, minDate: effectiveMin, maxDate: effectiveMax, taskMap: localTaskMap, parentMap: localParentMap };
  }, [project.tasks]);

  const { chartStartDate, totalDays, months, totalWidth } = useMemo(() => {
    if (!minDate || !maxDate) return { chartStartDate: new Date(), totalDays: 0, months: [], totalWidth: 0 };
    const startDate = new Date(minDate);
    const endDate = new Date(maxDate);
    endDate.setUTCDate(endDate.getUTCDate() + 7);
    const days = dayDiff(startDate, endDate) + 1;
    const width = days * dayWidth;
  
    const monthHeaders: { name: string; year: number; days: number; }[] = [];
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const year = currentDate.getUTCFullYear();
      const month = currentDate.getUTCMonth();
      const daysInMonth = getDaysInMonthUTC(year, month);
      const remainingDaysInMonth = daysInMonth - currentDate.getUTCDate() + 1;
      const daysToShow = Math.min(dayDiff(currentDate, endDate) + 1, remainingDaysInMonth);
  
      monthHeaders.push({ name: currentDate.toLocaleString('default', { month: 'long', timeZone: 'UTC' }), year, days: daysToShow });
      currentDate.setUTCDate(currentDate.getUTCDate() + daysToShow);
    }
  
    return { chartStartDate: startDate, totalDays: days, months: monthHeaders, totalWidth: width };
  }, [minDate, maxDate, dayWidth]);

  const taskPositions = useMemo(() => {
    const localTaskPositions = new Map<string, { startX: number, endX: number }>();
    allTasks.forEach((task) => {
        const taskStart = parseDate(task.startDate);
        if (isNaN(taskStart.getTime())) return;
        const startOffset = dayDiff(chartStartDate, taskStart);
        const duration = dayDiff(taskStart, parseDate(task.endDate)) + 1;
        localTaskPositions.set(task.id, { startX: startOffset * dayWidth, endX: (startOffset * dayWidth) + (duration * dayWidth) });
    });
    return localTaskPositions;
  }, [allTasks, chartStartDate, dayWidth]);
  
  const handleCreateMouseUp = useCallback(async (e: MouseEvent) => {
      if (!creatingState || !scrollContainerRef.current) return;
      const { task, startX } = creatingState;
      const timelineRect = scrollContainerRef.current.querySelector('.timeline-body')?.getBoundingClientRect();
      if (!timelineRect) return;

      const endX = e.clientX - timelineRect.left;
      
      const startDayIndex = Math.round(Math.min(startX, endX) / dayWidth);
      const endDayIndex = Math.round(Math.max(startX, endX) / dayWidth) - 1; // Snap to end of day

      const newStartDate = new Date(chartStartDate);
      newStartDate.setUTCDate(newStartDate.getUTCDate() + startDayIndex);
      const newEndDate = new Date(chartStartDate);
      newEndDate.setUTCDate(newEndDate.getUTCDate() + endDayIndex);

      if (newStartDate > newEndDate) return;

      const taskToUpdate = task;
      if (taskToUpdate) {
          await updateTask(project.id, { ...taskToUpdate, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) });
      }
      
      setCreatingState(null);
      setTempCreatingBar(null);
  }, [creatingState, dayWidth, chartStartDate, updateTask, project.id]);

  useEffect(() => {
    if (!creatingState) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!scrollContainerRef.current) return;
      const timelineRect = scrollContainerRef.current.querySelector('.timeline-body')?.getBoundingClientRect();
      if (!timelineRect) return;

      const currentX = e.clientX - timelineRect.left;
      const width = Math.abs(currentX - creatingState.startX);
      const left = Math.min(currentX, creatingState.startX);
      setTempCreatingBar({ left, width });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleCreateMouseUp, { once: true });
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleCreateMouseUp);
    };
  }, [creatingState, dayWidth, handleCreateMouseUp]);
  
  const handleMouseUp = useCallback(async (e: MouseEvent) => {
    const currentInteraction = interaction;
    setInteraction(null);
    setTempTaskBar(null);

    if (!currentInteraction) return;

    const finalOffsetPx = e.clientX - currentInteraction.startX;
    const dayDelta = Math.round(finalOffsetPx / dayWidth);
    
    // Only update if there was a meaningful change
    if (dayDelta === 0 && currentInteraction.type === 'drag') {
        return;
    }
        
    const { originalTask } = currentInteraction;
    const originalStart = parseDate(originalTask.startDate);
    const originalEnd = parseDate(originalTask.endDate);

    if (!isNaN(originalStart.getTime()) && !isNaN(originalEnd.getTime())) {
        let newStart = new Date(originalStart);
        let newEnd = new Date(originalEnd);

        if (currentInteraction.type === 'drag') {
            newStart.setUTCDate(newStart.getUTCDate() + dayDelta);
            const duration = dayDiff(originalStart, originalEnd);
            newEnd = new Date(newStart);
            newEnd.setUTCDate(newEnd.getUTCDate() + duration);
        } else if (currentInteraction.type === 'resize-start') {
            newStart.setUTCDate(newStart.getUTCDate() + dayDelta);
        } else if (currentInteraction.type === 'resize-end') {
            newEnd.setUTCDate(newEnd.getUTCDate() + dayDelta);
        }
        
        if (newStart <= newEnd) {
            const draggedTaskUpdate = { ...originalTask, startDate: formatDate(newStart), endDate: formatDate(newEnd) };
            const tasksToUpdate: Task[] = [draggedTaskUpdate];

            if (currentInteraction.type === 'drag') {
                const dragDelta = dayDiff(originalStart, newStart);
                
                const collectSubtasks = (tasks: Task[], delta: number) => {
                    tasks.forEach(subtask => {
                        const originalSubStart = parseDate(subtask.startDate);
                        const originalSubEnd = parseDate(subtask.endDate);
                        if (!isNaN(originalSubStart.getTime()) && !isNaN(originalSubEnd.getTime())) {
                            const newSubStart = new Date(originalSubStart);
                            newSubStart.setUTCDate(newSubStart.getUTCDate() + delta);
                            const duration = dayDiff(originalSubStart, originalSubEnd);
                            const newSubEnd = new Date(newSubStart);
                            newSubEnd.setUTCDate(newSubEnd.getUTCDate() + duration);
                            tasksToUpdate.push({ ...subtask, startDate: formatDate(newSubStart), endDate: formatDate(newSubEnd) });
                        }
                        if (subtask.subtasks) collectSubtasks(subtask.subtasks, delta);
                    });
                };
                if (originalTask.subtasks) collectSubtasks(originalTask.subtasks, dragDelta);
            }
            
            await updateMultipleTasks(project.id, tasksToUpdate);
        }
    }
  }, [dayWidth, updateMultipleTasks, project.id, chartStartDate, interaction]);

  useEffect(() => {
    const currentInteraction = interaction;
    if (!currentInteraction) return;

    const handleMouseMove = (e: MouseEvent) => {
        const currentOffsetPx = e.clientX - currentInteraction.startX;
        const { originalLeft, originalWidth } = currentInteraction;
        let newLeft = originalLeft;
        let newWidth = originalWidth;

        if (currentInteraction.type === 'drag') {
            newLeft = originalLeft + currentOffsetPx;
        } else if (currentInteraction.type === 'resize-start') {
            newLeft = originalLeft + currentOffsetPx;
            newWidth = originalWidth - currentOffsetPx;
        } else if (currentInteraction.type === 'resize-end') {
            newWidth = originalWidth + currentOffsetPx;
        }

        if (newWidth >= dayWidth) {
          setTempTaskBar({ id: currentInteraction.taskId, left: newLeft, width: newWidth });
        }
    };
    
    const onMouseUp = (e: MouseEvent) => handleMouseUp(e);

    document.body.style.cursor = currentInteraction.type === 'drag' ? 'grabbing' : 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', onMouseUp, { once: true });
    
    return () => {
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    };
  }, [interaction, handleMouseUp, dayWidth]);

  const handleZoom = (direction: 'in' | 'out') => setDayWidth(prev => Math.max(10, Math.min(100, direction === 'in' ? prev * 1.5 : prev / 1.5)));

  const handleIndent = async (task: GanttTask, index: number) => {
    if (index === 0) return;
    const potentialParent = allTasks[index - 1];
    if (potentialParent && potentialParent.level === task.level) {
        await reparentTask(project.id, task.id, potentialParent.id);
    }
  };

  const handleOutdent = async (task: GanttTask) => {
    const parentId = parentMap.get(task.id);
    if (parentId === undefined || parentId === null) return;
    const grandparentId = parentMap.get(parentId) ?? null;
    await reparentTask(project.id, task.id, grandparentId);
  };

  const handleNewTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskName.trim()) {
        await onAddTask(newTaskName.trim());
        setNewTaskName('');
        setIsAddingTask(false);
    }
  };


  const today = new Date();
  today.setUTCHours(0,0,0,0);
  const rowHeight = 40;
  
  return (
    <div ref={downloadRef} className="flex flex-col h-full bg-card-background rounded-xl border border-border-color">
        <div className="p-2 border-b border-border-color flex items-center justify-between">
            <div className="flex items-center space-x-1">
                <button onClick={() => handleZoom('out')} className="p-1 rounded text-text-secondary hover:bg-app-background"><MinusIcon className="w-5 h-5" /></button>
                <button onClick={() => handleZoom('in')} className="p-1 rounded text-text-secondary hover:bg-app-background"><PlusIcon className="w-5 h-5" /></button>
            </div>
             <button 
                onClick={() => downloadImage(`${project?.name}-gantt-chart.png`)} 
                disabled={isDownloading} 
                className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-app-background text-text-secondary rounded-lg hover:bg-border-color transition-colors disabled:opacity-50"
             >
                <DownloadIcon className="w-4 h-4" />
                <span>{isDownloading ? 'Exporting...' : 'Export'}</span>
            </button>
        </div>
        <div ref={scrollContainerRef} className="flex-grow overflow-auto flex">
            {/* Task List Column */}
            <div className="w-64 shrink-0 sticky left-0 z-20 bg-card-background border-r border-border-color">
                <div className="h-16 flex items-center justify-between p-2 border-b border-border-color">
                    <h3 className="font-semibold">Task Name</h3>
                    <button onClick={() => setIsAddingTask(true)} title="Add New Task" className="p-1 text-text-secondary hover:text-accent-blue"><PlusIcon className="w-5 h-5"/></button>
                </div>
                <div className="relative">
                    {allTasks.map((task, index) => (
                        <div key={task.id} className="flex h-10 items-center p-2 border-b border-border-color group" style={{ paddingLeft: `${10 + task.level * 20}px` }}>
                            <span className="flex-grow truncate text-sm">{task.name}</span>
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                <button onClick={() => handleIndent(task, index)} title="Indent Task" className="p-1 text-text-secondary hover:text-text-primary"><ArrowLongRightIcon className="w-5 h-5" /></button>
                                <button onClick={() => handleOutdent(task)} title="Outdent Task" className="p-1 text-text-secondary hover:text-text-primary"><ArrowLongLeftIcon className="w-5 h-5" /></button>
                            </div>
                        </div>
                    ))}
                    {isAddingTask && (
                        <div className="flex h-10 items-center p-1 border-b border-border-color" style={{ paddingLeft: `${10}px` }}>
                            <form onSubmit={handleNewTaskSubmit} className="w-full h-full">
                                <input
                                    type="text" value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
                                    onBlur={() => { if (!newTaskName.trim()) setIsAddingTask(false); }}
                                    onKeyDown={e => { if (e.key === 'Escape') setIsAddingTask(false); }}
                                    placeholder="New task name..."
                                    className="w-full h-full bg-app-background border border-accent-blue rounded px-2 text-sm" autoFocus
                                />
                            </form>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Timeline Column */}
            <div className="flex-grow relative">
                <div className="sticky top-0 z-10 bg-card-background">
                    <div className="h-8 flex">{months.map((month, index) => (<div key={index} className="flex items-center justify-center border-r border-b border-border-color text-sm font-semibold" style={{ width: month.days * dayWidth, minWidth: month.days * dayWidth }}>{month.name} {month.year}</div>))}</div>
                    <div className="h-8 flex">{Array.from({ length: totalDays }).map((_, i) => { const d = new Date(chartStartDate); d.setUTCDate(d.getUTCDate() + i); const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6; return (<div key={i} className={`flex items-center justify-center border-r border-b border-border-color text-xs text-text-secondary ${isWeekend ? 'bg-yellow-400/20' : ''}`} style={{ width: dayWidth, minWidth: dayWidth }}>{dayWidth > 20 ? d.getUTCDate() : ''}</div>); })}</div>
                </div>
                <div className="relative timeline-body" style={{ width: totalWidth, minWidth: totalWidth, height: Math.max(400, (allTasks.length + (isAddingTask ? 1 : 0)) * rowHeight) }}>
                    {/* Vertical Grid Lines & Weekends */}
                    {Array.from({ length: totalDays }).map((_, i) => { const d = new Date(chartStartDate); d.setUTCDate(d.getUTCDate() + i); const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6; return <div key={i} className={`absolute top-0 bottom-0 border-r border-border-color ${isWeekend ? 'bg-yellow-400/20' : ''}`} style={{ left: i * dayWidth, width: dayWidth }}></div> })}
                    {/* Today Marker */}
                    {(() => { const todayOffset = dayDiff(chartStartDate, new Date()); if (todayOffset >= 0 && todayOffset < totalDays) { return <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-20" title="Today" style={{ left: todayOffset * dayWidth }}></div>; } return null; })()}

                    {/* Horizontal Grid Lines */}
                    {allTasks.map((_, index) => <div key={`row-${index}`} className="absolute w-full border-b border-border-color" style={{ top: (index + 1) * rowHeight, height: '1px' }}></div>)}
                    {isAddingTask && <div className="absolute w-full border-b border-border-color" style={{ top: (allTasks.length + 1) * rowHeight, height: '1px' }}></div>}
                    
                    {/* Task Bars */}
                    {allTasks.map((task, index) => {
                        const taskPos = taskPositions.get(task.id);
                        if (!taskPos) {
                            return (
                                <div key={`creator-${task.id}`} className="absolute w-full h-10 group/creator" style={{ top: index * rowHeight }} 
                                    onMouseDown={(e) => { e.preventDefault(); const timelineRect = e.currentTarget.getBoundingClientRect(); setCreatingState({ task: task, startX: e.clientX - timelineRect.left }); }}>
                                    <div className="absolute inset-0 bg-transparent group-hover/creator:bg-accent-blue/10 transition-colors flex items-center justify-center">
                                        <span className="text-xs text-text-secondary opacity-0 group-hover/creator:opacity-100 pointer-events-none">Click and drag to schedule</span>
                                    </div>
                                </div>
                            );
                        }
                        const isInteracting = interaction?.taskId === task.id;
                        const currentPos = tempTaskBar?.id === task.id ? tempTaskBar : { left: taskPos.startX, width: taskPos.endX - taskPos.startX };
                        const endDate = parseDate(task.endDate);
                        const isOverdue = endDate && endDate < today && !task.completed;

                        return (
                            <div key={task.id} data-task-id={task.id} className="absolute group" 
                            style={{ top: `${index * rowHeight + 6}px`, left: `${currentPos.left}px`, width: `${currentPos.width}px`, zIndex: isInteracting ? 10 : 1 }}>
                                <div title={`${task.name}\nStart: ${task.startDate}\nEnd: ${task.endDate}`} className={`h-7 rounded-md flex items-center justify-between px-2 text-white text-xs select-none cursor-grab relative ${isOverdue ? 'bg-accent-red' : 'bg-accent-blue'}`}
                                    onMouseDown={(e) => { e.preventDefault(); setInteraction({ type: 'drag', taskId: task.id, startX: e.clientX, originalTask: task, originalLeft: taskPos.startX, originalWidth: taskPos.endX - taskPos.startX }); }}>
                                    <span className="truncate pointer-events-none">{task.name}</span>
                                </div>
                                <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setInteraction({ type: 'resize-start', taskId: task.id, startX: e.clientX, originalTask: task, originalLeft: taskPos.startX, originalWidth: taskPos.endX - taskPos.startX }); }} className="absolute -left-2 top-0 w-4 h-7 cursor-ew-resize opacity-0 group-hover:opacity-100" />
                                <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setInteraction({ type: 'resize-end', taskId: task.id, startX: e.clientX, originalTask: task, originalLeft: taskPos.startX, originalWidth: taskPos.endX - taskPos.startX }); }} className="absolute -right-2 top-0 w-4 h-7 cursor-ew-resize opacity-0 group-hover:opacity-100" />
                            </div>
                        )
                    })}
                     {creatingState && tempCreatingBar && (
                        <div className="absolute h-7 pointer-events-none bg-accent-blue/50 rounded-md" 
                        style={{ ...tempCreatingBar, top: `${allTasks.findIndex(t => t.id === creatingState.task.id) * rowHeight + 6}px` }}></div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default GanttChartView;