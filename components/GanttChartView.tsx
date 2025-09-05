import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Task } from '../types';
import { PlusIcon, MinusIcon, ImageIcon, DownloadIcon, ArrowLongRightIcon, ArrowLongLeftIcon } from './IconComponents';
import { useProject } from '../contexts/ProjectContext';
import { generateImageForTask } from '../services/geminiService';
import Spinner from './Spinner';
import { useDownloadImage } from '../hooks/useDownloadImage';

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
const GanttChartView: React.FC = () => {
  const { selectedProject, updateTask, updateMultipleTasks, reparentTask } = useProject();
  const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
  const project = selectedProject!; // Assert non-null
  
  const [dayWidth, setDayWidth] = useState(30);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [creatingState, setCreatingState] = useState<CreatingState | null>(null);
  const [tempCreatingBar, setTempCreatingBar] = useState<{ left: number; width: number } | null>(null);
  const [tempTaskPositions, setTempTaskPositions] = useState<Map<string, { left: number; width: number }>>(new Map());
  const [generatingImageFor, setGeneratingImageFor] = useState<string|null>(null);

  const ganttContainerRef = useRef<HTMLDivElement>(null);
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

    const mondayThisWeek = getMondayOfWeek(new Date());

    let effectiveMin = mondayThisWeek;
    if (min && min < mondayThisWeek) {
        effectiveMin = min;
    }

    let effectiveMax = max;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
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
    const localTaskPositions = new Map<string, { y: number, startX: number, endX: number }>();
    allTasks.forEach((task, index) => {
        const taskStart = parseDate(task.startDate);
        if (isNaN(taskStart.getTime())) return;
        const startOffset = dayDiff(chartStartDate, taskStart);
        const duration = dayDiff(taskStart, parseDate(task.endDate)) + 1;
        localTaskPositions.set(task.id, { y: index * 40 + 20, startX: startOffset * dayWidth, endX: (startOffset * dayWidth) + (duration * dayWidth) });
    });
    return localTaskPositions;
  }, [allTasks, chartStartDate, dayWidth]);
  
  useEffect(() => {
    if (tempTaskPositions.size > 0) {
      const newTempPositions = new Map(tempTaskPositions);
      let changed = false;
      for (const [taskId, tempPos] of tempTaskPositions.entries()) {
        const currentPos = taskPositions.get(taskId);
        if (currentPos && Math.round(currentPos.startX) === Math.round(tempPos.left) && Math.round(currentPos.endX - currentPos.startX) === Math.round(tempPos.width)) {
          newTempPositions.delete(taskId);
          changed = true;
        }
      }
      if (changed) setTempTaskPositions(newTempPositions);
    }
  }, [project.tasks, taskPositions, tempTaskPositions]);

  const handleCreateMouseUp = useCallback(async (e: MouseEvent) => {
      if (!creatingState || !ganttContainerRef.current) return;
      const { task, startX } = creatingState;
      const timelineRect = ganttContainerRef.current.querySelector('.timeline-body')?.getBoundingClientRect();
      if (!timelineRect) return;

      const endX = e.clientX - timelineRect.left;
      
      const startDayIndex = Math.floor(Math.min(startX, endX) / dayWidth);
      const endDayIndex = Math.floor(Math.max(startX, endX) / dayWidth);

      const newStartDate = new Date(chartStartDate);
      newStartDate.setUTCDate(newStartDate.getUTCDate() + startDayIndex);
      const newEndDate = new Date(chartStartDate);
      newEndDate.setUTCDate(newEndDate.getUTCDate() + endDayIndex);

      const taskToUpdate = task;
      if (taskToUpdate) {
          // FIX: The `updateTask` function requires the project ID as the first argument.
          await updateTask(project.id, { ...taskToUpdate, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) });
      }
      
      setCreatingState(null);
      setTempCreatingBar(null);
  }, [creatingState, dayWidth, chartStartDate, updateTask, project.id]);

  useEffect(() => {
    if (!creatingState) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!ganttContainerRef.current) return;
      const timelineRect = ganttContainerRef.current.querySelector('.timeline-body')?.getBoundingClientRect();
      if (!timelineRect) return;

      const currentX = e.clientX - timelineRect.left;
      const width = Math.max(dayWidth / 2, Math.abs(currentX - creatingState.startX));
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
  
  const handleMouseUp = useCallback(async (e: MouseEvent, interaction: InteractionState) => {
    const finalOffsetPx = e.clientX - interaction.startX;
    const dayDelta = Math.round(finalOffsetPx / dayWidth);
    
    if (dayDelta !== 0) {
        const { originalTask } = interaction;
        const originalStart = parseDate(originalTask.startDate);
        const originalEnd = parseDate(originalTask.endDate);

        if (!isNaN(originalStart.getTime()) && !isNaN(originalEnd.getTime())) {
            let newStart = new Date(originalStart);
            let newEnd = new Date(originalEnd);

            if (interaction.type === 'drag') {
                newStart.setUTCDate(newStart.getUTCDate() + dayDelta);
                const duration = dayDiff(originalStart, originalEnd);
                newEnd = new Date(newStart);
                newEnd.setUTCDate(newEnd.getUTCDate() + duration);
            } else if (interaction.type === 'resize-start') {
                newStart.setUTCDate(newStart.getUTCDate() + dayDelta);
            } else if (interaction.type === 'resize-end') {
                newEnd.setUTCDate(newEnd.getUTCDate() + dayDelta);
            }
            
            if (newStart <= newEnd) {
                const draggedTaskUpdate = { ...originalTask, startDate: formatDate(newStart), endDate: formatDate(newEnd) };
                const tasksToUpdate: Task[] = [draggedTaskUpdate];

                if (interaction.type === 'drag') {
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
                
                const newTempPositions = new Map<string, { left: number; width: number }>();
                tasksToUpdate.forEach(updatedTask => {
                    const start = parseDate(updatedTask.startDate);
                    const end = parseDate(updatedTask.endDate);
                    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                        const startOffset = dayDiff(chartStartDate, start);
                        const duration = dayDiff(start, end) + 1;
                        newTempPositions.set(updatedTask.id, { left: startOffset * dayWidth, width: Math.max(dayWidth, duration * dayWidth) });
                    }
                });
                setTempTaskPositions(newTempPositions);
                await updateMultipleTasks(project.id, tasksToUpdate);
            }
        }
    }
    setInteraction(null);
  }, [dayWidth, updateMultipleTasks, project.id, chartStartDate]);

  useEffect(() => {
    const currentInteraction = interaction;
    if (!currentInteraction) return;

    const taskBarEl = taskBarRefs.current.get(currentInteraction.taskId);

    const handleMouseMove = (e: MouseEvent) => {
        if (!taskBarEl) return;
        const currentOffsetPx = e.clientX - currentInteraction.startX;
        const dayDelta = Math.round(currentOffsetPx / dayWidth);
        const snappedOffset = dayDelta * dayWidth;
        const { originalLeft, originalWidth } = currentInteraction;

        if (currentInteraction.type === 'drag') {
            taskBarEl.style.left = `${originalLeft + snappedOffset}px`;
        } else if (currentInteraction.type === 'resize-start') {
            const newLeft = originalLeft + snappedOffset;
            const newWidth = originalWidth - snappedOffset;
            if (newWidth >= dayWidth) {
                taskBarEl.style.left = `${newLeft}px`;
                taskBarEl.style.width = `${newWidth}px`;
            }
        } else if (currentInteraction.type === 'resize-end') {
            const newWidth = originalWidth + snappedOffset;
            if (newWidth >= dayWidth) {
                taskBarEl.style.width = `${newWidth}px`;
            }
        }
    };
    
    const onMouseUp = (e: MouseEvent) => {
        handleMouseUp(e, currentInteraction);
    };

    document.body.style.cursor = currentInteraction.type === 'drag' ? 'grabbing' : 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', onMouseUp, { once: true });
    
    return () => {
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (taskBarEl) {
            taskBarEl.style.left = `${currentInteraction.originalLeft}px`;
            taskBarEl.style.width = `${currentInteraction.originalWidth}px`;
        }
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

  const today = new Date();
  today.setUTCHours(0,0,0,0);

  if (!minDate || !maxDate) return <div className="text-center text-text-secondary p-8">No tasks with valid dates.</div>;
  
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
        <div className="flex-grow flex overflow-hidden">
            <div className="w-64 shrink-0 border-r border-border-color bg-card-background z-10 overflow-y-hidden flex flex-col">
                <div className="h-16 flex items-center p-2 border-b border-border-color shrink-0"><h3 className="font-semibold">Task Name</h3></div>
                <div className="overflow-y-auto">
                    {allTasks.map((task, index) => (
                        <div key={task.id} className="h-10 flex items-center border-b border-border-color text-sm truncate group" style={{ paddingLeft: `${10 + task.level * 20}px` }}>
                            <span className="flex-grow truncate">{task.name}</span>
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                <button onClick={() => handleIndent(task, index)} title="Indent Task" className="p-1 text-text-secondary hover:text-text-primary"><ArrowLongRightIcon className="w-5 h-5" /></button>
                                <button onClick={() => handleOutdent(task)} title="Outdent Task" className="p-1 text-text-secondary hover:text-text-primary"><ArrowLongLeftIcon className="w-5 h-5" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex-grow overflow-auto">
                <div ref={ganttContainerRef} style={{ width: totalWidth, height: allTasks.length * 40 + 64 }}>
                    <div className="sticky top-0 z-10 bg-card-background"><div className="h-16 relative"><div className="flex absolute top-0 left-0 w-full h-8 border-b border-border-color">{months.map((month, index) => (<div key={index} className="flex items-center justify-center border-r border-border-color text-sm font-semibold" style={{ width: month.days * dayWidth }}>{month.name} {month.year}</div>))}</div><div className="flex absolute bottom-0 left-0 w-full h-8 border-b border-border-color">{Array.from({ length: totalDays }).map((_, i) => { const d = new Date(chartStartDate); d.setUTCDate(d.getUTCDate() + i); const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6; return (<div key={i} className={`flex items-center justify-center border-r border-border-color text-xs text-text-secondary ${isWeekend ? 'bg-yellow-400/20' : ''}`} style={{ width: dayWidth }}>{dayWidth > 20 ? d.getUTCDate() : ''}</div>); })}</div></div></div>
                    <div className="relative timeline-body" style={{ height: allTasks.length * 40 }}>
                        {Array.from({ length: totalDays }).map((_, i) => { const d = new Date(chartStartDate); d.setUTCDate(d.getUTCDate() + i); const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6; return <div key={i} className={`absolute top-0 bottom-0 border-r border-border-color ${isWeekend ? 'bg-yellow-400/20' : ''}`} style={{ left: i * dayWidth, width: dayWidth }}></div> })}
                        {allTasks.map((_, index) => (<div key={index} className="absolute w-full h-10 border-b border-border-color" style={{ top: index * 40 }}></div>))}
                        
                        {(() => {
                            const todayOffset = dayDiff(chartStartDate, new Date()) * dayWidth;
                            if (todayOffset >= 0 && todayOffset <= totalWidth) {
                                return <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-20" title="Today" style={{ left: todayOffset }}></div>;
                            }
                            return null;
                        })()}

                        {allTasks.map((task, index) => {
                            const taskPos = taskPositions.get(task.id);
                            if (!taskPos) {
                                // Render row for unscheduled tasks
                                return (
                                    <div key={`unscheduled-${task.id}`} className="absolute w-full h-10 group/creator" style={{ top: index * 40 }} onMouseDown={(e) => { e.preventDefault(); const timelineRect = e.currentTarget.getBoundingClientRect(); setCreatingState({ task: task, startX: e.clientX - timelineRect.left }); }}>
                                        <div className="absolute inset-0 bg-transparent group-hover/creator:bg-accent-blue/10 transition-colors flex items-center justify-center">
                                            <span className="text-xs text-text-secondary opacity-0 group-hover/creator:opacity-100 pointer-events-none">Click and drag to schedule</span>
                                        </div>
                                    </div>
                                );
                            }
                            const isInteracting = interaction?.taskId === task.id;
                            const tempPos = tempTaskPositions.get(task.id);
                            const left = tempPos ? tempPos.left : taskPos.startX;
                            const width = tempPos ? tempPos.width : (taskPos.endX - taskPos.startX);
                            const barStyles: React.CSSProperties = { top: `${index * 40 + 6}px`, left: `${left}px`, width: `${width}px`, transition: isInteracting ? 'none' : 'left 0.2s, width 0.2s', zIndex: isInteracting ? 10 : 1 };
                            const endDate = parseDate(task.endDate);
                            const isOverdue = endDate && endDate < today && !task.completed;

                            return (
                                <div key={task.id} ref={el => { if (el) taskBarRefs.current.set(task.id, el); else taskBarRefs.current.delete(task.id); }} data-task-id={task.id} className="absolute group" style={barStyles}>
                                    <div title={`${task.name}\nStart: ${task.startDate}\nEnd: ${task.endDate}`} className={`h-7 rounded-md flex items-center justify-between px-2 text-white text-xs select-none cursor-grab relative ${isOverdue ? 'bg-accent-red' : 'bg-accent-blue'}`}
                                        onMouseDown={(e) => { e.preventDefault(); const pos = taskPositions.get(task.id); if (!pos) return; setInteraction({ type: 'drag', taskId: task.id, startX: e.clientX, originalTask: task, originalLeft: pos.startX, originalWidth: pos.endX - pos.startX }); }}>
                                        <span className="truncate pointer-events-none">{task.name}</span>
                                    </div>
                                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); const pos = taskPositions.get(task.id); if (!pos) return; setInteraction({ type: 'resize-start', taskId: task.id, startX: e.clientX, originalTask: task, originalLeft: pos.startX, originalWidth: pos.endX - pos.startX }); }} className="absolute -left-2 top-0 w-4 h-7 cursor-ew-resize opacity-0 group-hover:opacity-100" />
                                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); const pos = taskPositions.get(task.id); if (!pos) return; setInteraction({ type: 'resize-end', taskId: task.id, startX: e.clientX, originalTask: task, originalLeft: pos.startX, originalWidth: pos.endX - pos.startX }); }} className="absolute -right-2 top-0 w-4 h-7 cursor-ew-resize opacity-0 group-hover:opacity-100" />
                                </div>
                            )
                        })}
                         {creatingState && tempCreatingBar && (
                            <div className="absolute h-7 top-1/2 -translate-y-1/2 pointer-events-none bg-accent-blue/50 rounded-md" style={{ ...tempCreatingBar, top: `${allTasks.findIndex(t => t.id === creatingState.task.id) * 40 + 6}px` }}></div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default GanttChartView;