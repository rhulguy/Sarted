import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Task, Project } from '../types';
import { PlusIcon, MinusIcon, DownloadIcon, ArrowLongRightIcon, ArrowLongLeftIcon } from './IconComponents';
import { useProject } from '../contexts/ProjectContext';
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
    taskId: string;
    projectId: string;
    startX: number;
    taskTop: number;
}

interface GlobalGanttTask extends Task {
  level: number;
  projectId: string;
  projectName: string;
  projectColor: string;
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

const GlobalGanttView: React.FC = () => {
  const { visibleProjects, projectGroups, addTask, updateTask, updateMultipleTasks, reparentTask } = useProject();
  const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
  
  const [dayWidth, setDayWidth] = useState(30);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [creatingState, setCreatingState] = useState<CreatingState | null>(null);
  const [tempCreatingBar, setTempCreatingBar] = useState<{ left: number; width: number; top: number } | null>(null);
  const [addingTaskToProject, setAddingTaskToProject] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [isNewTaskFormFocused, setIsNewTaskFormFocused] = useState(false);
  
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sortedProjects = useMemo(() => {
    return [...visibleProjects].sort((a, b) => a.name.localeCompare(b.name));
  }, [visibleProjects]);

  const { allTasks, minDate, maxDate, taskMap, parentMap, projectHeaders } = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    const flattenedTasks: GlobalGanttTask[] = [];
    const localTaskMap = new Map<string, Task>();
    const localParentMap = new Map<string, string | null>();
    const groupColorMap = new Map(projectGroups.map(g => [g.id, g.color]));
    const localProjectHeaders: { id: string, name: string, yPos: number }[] = [];

    let currentY = 0;

    sortedProjects.forEach(project => {
      localProjectHeaders.push({ id: project.id, name: project.name, yPos: currentY });
      currentY += 40; // Height of the header

      const projectColor = groupColorMap.get(project.groupId) || 'bg-gray-500';
      const findDateRangeAndFlatten = (tasks: Task[], level: number, parentId: string | null) => {
          tasks.forEach(task => {
              flattenedTasks.push({ ...task, level, projectId: project.id, projectName: project.name, projectColor });
              localTaskMap.set(task.id, task);
              localParentMap.set(task.id, parentId);
              const start = parseDate(task.startDate);
              const end = parseDate(task.endDate);
              if (!isNaN(start.getTime())) { if (!min || start < min) min = start; }
              if (!isNaN(end.getTime())) { if (!max || end > max) max = end; }
              currentY += 40; // Height of a task row
              if (task.subtasks) findDateRangeAndFlatten(task.subtasks, level + 1, task.id);
          });
      };
      findDateRangeAndFlatten(project.tasks, 0, null);
    });

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

    return { allTasks: flattenedTasks, minDate: effectiveMin, maxDate: effectiveMax, taskMap: localTaskMap, parentMap: localParentMap, projectHeaders: localProjectHeaders };
  }, [sortedProjects, projectGroups]);
  
  const handleNewTaskSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskName.trim() && addingTaskToProject) {
      const newTask: Task = {
        id: `task-${Date.now()}`,
        name: newTaskName.trim(),
        description: '',
        completed: false,
        subtasks: [],
      };
      await addTask(addingTaskToProject, newTask);
      setNewTaskName('');
      // Keep the form open for the next task
      // setAddingTaskToProject(null) is now handled by onBlur
    }
  }, [newTaskName, addingTaskToProject, addTask]);

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

  const handleMouseUp = useCallback(async (e: MouseEvent) => {
    if (!interaction) return;

    const finalOffsetPx = e.clientX - interaction.startX;
    const dayDelta = Math.round(finalOffsetPx / dayWidth);
    
    if (dayDelta !== 0) {
        const { originalTask } = interaction;
        const taskInfo = allTasks.find(t => t.id === originalTask.id);
        if (!taskInfo) return;

        const originalStart = parseDate(originalTask.startDate);
        const originalEnd = parseDate(originalTask.endDate);

        if (!isNaN(originalStart.getTime()) && !isNaN(originalEnd.getTime())) {
            let newStart = new Date(originalStart);
            let newEnd = new Date(originalEnd);

            if (interaction.type === 'drag') {
                newStart.setUTCDate(newStart.getUTCDate() + dayDelta);
                newEnd.setUTCDate(newEnd.getUTCDate() + dayDelta);
            } else if (interaction.type === 'resize-start') {
                newStart.setUTCDate(newStart.getUTCDate() + dayDelta);
            } else if (interaction.type === 'resize-end') {
                newEnd.setUTCDate(newEnd.getUTCDate() + dayDelta);
            }
            
            if (newStart <= newEnd) {
                const updatedMainTask = { ...originalTask, startDate: formatDate(newStart), endDate: formatDate(newEnd) };
                const tasksToUpdate: Task[] = [updatedMainTask];

                if (interaction.type === 'drag' && originalTask.subtasks?.length > 0) {
                    const collectSubtasks = (tasks: Task[]) => {
                        tasks.forEach(subtask => {
                            const subStart = parseDate(subtask.startDate);
                            if (!isNaN(subStart.getTime())) {
                                const newSubStart = new Date(subStart);
                                newSubStart.setUTCDate(newSubStart.getUTCDate() + dayDelta);
                                const duration = dayDiff(parseDate(subtask.startDate), parseDate(subtask.endDate));
                                const newSubEnd = new Date(newSubStart);
                                newSubEnd.setUTCDate(newSubEnd.getUTCDate() + duration);
                                tasksToUpdate.push({ ...subtask, startDate: formatDate(newSubStart), endDate: formatDate(newSubEnd) });
                            }
                            if (subtask.subtasks) collectSubtasks(subtask.subtasks);
                        });
                    };
                    collectSubtasks(originalTask.subtasks);
                }
                
                await updateMultipleTasks(taskInfo.projectId, tasksToUpdate);
            }
        }
    }
    setInteraction(null);
  }, [dayWidth, updateMultipleTasks, allTasks, interaction]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!interaction) return;
      const currentOffsetPx = e.clientX - interaction.startX;
      const { originalLeft, originalWidth } = interaction;
      if (ganttContainerRef.current) {
        const bar = ganttContainerRef.current.querySelector(`[data-task-id="${interaction.taskId}"]`) as HTMLElement;
        if (bar) {
          const snappedOffset = Math.round(currentOffsetPx / dayWidth) * dayWidth;
          if (interaction.type === 'drag') {
            bar.style.transform = `translateX(${snappedOffset}px)`;
          } else if (interaction.type === 'resize-start') {
             if (originalWidth - snappedOffset >= dayWidth) {
                bar.style.width = `${originalWidth - snappedOffset}px`;
                bar.style.transform = `translateX(${snappedOffset}px)`;
             }
          } else if (interaction.type === 'resize-end') {
            if (originalWidth + snappedOffset >= dayWidth) bar.style.width = `${originalWidth + snappedOffset}px`;
          }
        }
      }
    };

    if (interaction) {
      document.body.style.cursor = interaction.type === 'drag' ? 'grabbing' : 'ew-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp, { once: true });
    }
    
    return () => {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interaction, handleMouseUp, dayWidth]);
  
  const handleMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize-start' | 'resize-end', task: Task) => {
    e.preventDefault(); e.stopPropagation();
    const taskStart = parseDate(task.startDate); const taskEnd = parseDate(task.endDate);
    if (isNaN(taskStart.getTime()) || isNaN(taskEnd.getTime())) return;
    const startOffset = dayDiff(chartStartDate, taskStart); const duration = dayDiff(taskStart, taskEnd) + 1;
    setInteraction({ type, taskId: task.id, startX: e.clientX, originalTask: task, originalLeft: startOffset * dayWidth, originalWidth: duration * dayWidth });
  };
  
  const handleCreateMouseDown = (e: React.MouseEvent, task: GlobalGanttTask, taskTop: number) => {
    e.preventDefault();
    if (!scrollContainerRef.current) return;
    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    const startX = e.clientX - containerRect.left + scrollContainerRef.current.scrollLeft;
    
    setCreatingState({ taskId: task.id, projectId: task.projectId, startX, taskTop });
  };

  useEffect(() => {
    if (!creatingState) return;
    const handleMouseMove = (e: MouseEvent) => {
        if (!scrollContainerRef.current) return;
        const containerRect = scrollContainerRef.current.getBoundingClientRect();
        const currentX = e.clientX - containerRect.left + scrollContainerRef.current.scrollLeft;
        const width = Math.max(dayWidth / 2, Math.abs(currentX - creatingState.startX));
        const left = Math.min(currentX, creatingState.startX);
        setTempCreatingBar({ left, width, top: creatingState.taskTop });
    };

    const handleMouseUp = async (e: MouseEvent) => {
        if (!scrollContainerRef.current) return;
        const containerRect = scrollContainerRef.current.getBoundingClientRect();
        const endX = e.clientX - containerRect.left + scrollContainerRef.current.scrollLeft;
        
        const startDayIndex = Math.floor(Math.min(creatingState.startX, endX) / dayWidth);
        const endDayIndex = Math.floor(Math.max(creatingState.startX, endX) / dayWidth);

        const newStartDate = new Date(chartStartDate);
        newStartDate.setUTCDate(newStartDate.getUTCDate() + startDayIndex);
        const newEndDate = new Date(chartStartDate);
        newEndDate.setUTCDate(newEndDate.getUTCDate() + endDayIndex);

        const taskToUpdate = taskMap.get(creatingState.taskId);
        if (taskToUpdate) {
            await updateTask(creatingState.projectId, { ...taskToUpdate, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) });
        }
        
        setCreatingState(null);
        setTempCreatingBar(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [creatingState, dayWidth, chartStartDate, taskMap, updateTask]);

  const handleZoom = (direction: 'in' | 'out') => setDayWidth(prev => Math.max(10, Math.min(100, direction === 'in' ? prev * 1.5 : prev / 1.5)));

  const handleIndent = async (task: GlobalGanttTask) => {
    const taskIndex = allTasks.findIndex(t => t.id === task.id);
    if (taskIndex <= 0) return;
    const potentialParent = allTasks[taskIndex - 1];
    if (potentialParent && potentialParent.projectId === task.projectId && potentialParent.level === task.level) {
        await reparentTask(task.projectId, task.id, potentialParent.id);
    }
  };

  const handleOutdent = async (task: GlobalGanttTask) => {
    const parentId = parentMap.get(task.id);
    if (parentId === undefined || parentId === null) return;
    const grandparentId = parentMap.get(parentId) ?? null;
    await reparentTask(task.projectId, task.id, grandparentId);
  };
  
  if (visibleProjects.length === 0) return <div className="text-center text-text-secondary p-8">No projects to display.</div>;
  
  return (
    <div ref={downloadRef} className="flex flex-col bg-secondary rounded-lg">
        <div className="p-2 border-b border-border-color flex items-center justify-between">
            <div className="flex items-center space-x-1">
                <button onClick={() => handleZoom('out')} className="p-1 rounded text-text-secondary hover:bg-highlight"><MinusIcon className="w-5 h-5" /></button>
                <button onClick={() => handleZoom('in')} className="p-1 rounded text-text-secondary hover:bg-highlight"><PlusIcon className="w-5 h-5" /></button>
            </div>
             <button onClick={() => downloadImage(`global-gantt-chart.png`)} disabled={isDownloading} className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-highlight text-text-secondary rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"><DownloadIcon className="w-4 h-4" /><span>{isDownloading ? 'Exporting...' : 'Export'}</span></button>
        </div>
        <div className="flex-grow flex">
            <div className="w-72 shrink-0 border-r border-border-color bg-primary z-10 flex flex-col">
                <div className="h-16 flex items-center p-2 border-b border-border-color shrink-0 sticky top-0 bg-primary z-10"><h3 className="font-semibold">Task Name</h3></div>
                <div>
                    {projectHeaders && projectHeaders.map(header => (
                        <div key={header.id}>
                            <div className="h-10 flex items-center justify-between p-2 bg-highlight font-bold border-b border-t border-border-color text-text-primary group">
                                {header.name}
                                <button onClick={() => { setNewTaskName(''); setAddingTaskToProject(header.id); }} className="opacity-0 group-hover:opacity-100 text-accent hover:text-blue-400"><PlusIcon className="w-5 h-5"/></button>
                            </div>
                            {addingTaskToProject === header.id && (
                                <form onSubmit={handleNewTaskSubmit} onBlur={() => { if(!isNewTaskFormFocused) { setAddingTaskToProject(null); }}}>
                                    <input 
                                        autoFocus 
                                        type="text" 
                                        value={newTaskName} 
                                        onChange={e => setNewTaskName(e.target.value)} 
                                        onFocus={() => setIsNewTaskFormFocused(true)}
                                        onBlur={() => {
                                            setIsNewTaskFormFocused(false);
                                            // A tiny delay to allow the submit to process before the input disappears
                                            setTimeout(() => setAddingTaskToProject(null), 100);
                                        }}
                                        onKeyDown={e => {if (e.key === 'Escape') setAddingTaskToProject(null)}} 
                                        placeholder="New task name..." 
                                        className="w-full bg-secondary border border-accent rounded p-1 text-sm m-2 max-w-[calc(100%-1rem)]"
                                    />
                                </form>
                            )}
                            {allTasks.filter(t => t.projectId === header.id).map((task) => {
                                const canIndent = allTasks.findIndex(t => t.id === task.id) > 0 && allTasks[allTasks.findIndex(t => t.id === task.id) - 1].projectId === task.projectId && allTasks[allTasks.findIndex(t => t.id === task.id) - 1].level === task.level;
                                const canOutdent = parentMap.get(task.id) !== null;
                                return (
                                    <div key={task.id} className="h-10 flex items-center border-b border-border-color text-sm truncate group" style={{ paddingLeft: `${10 + task.level * 20}px` }}>
                                        <div className={`w-2 h-2 rounded-full ${task.projectColor} mr-2 shrink-0`}></div>
                                        <span className="flex-grow truncate">{task.name}</span>
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                            <button onClick={() => handleIndent(task)} disabled={!canIndent} title="Indent Task" className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"><ArrowLongRightIcon className="w-5 h-5" /></button>
                                            <button onClick={() => handleOutdent(task)} disabled={!canOutdent} title="Outdent Task" className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"><ArrowLongLeftIcon className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            <div ref={scrollContainerRef} className="flex-grow overflow-x-auto">
                <div style={{ width: totalWidth, position: 'relative' }}>
                    <div className="sticky top-0 z-10 bg-secondary"><div className="h-16 relative"><div className="flex absolute top-0 left-0 w-full h-8 border-b border-border-color">{months.map((month, index) => (<div key={index} className="flex items-center justify-center border-r border-border-color text-sm font-semibold" style={{ width: month.days * dayWidth }}>{month.name} {month.year}</div>))}</div><div className="flex absolute bottom-0 left-0 w-full h-8 border-b border-border-color">{Array.from({ length: totalDays }).map((_, i) => { const d = new Date(chartStartDate); d.setUTCDate(d.getUTCDate() + i); const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6; return (<div key={i} className={`flex items-center justify-center border-r border-border-color text-xs text-text-secondary ${isWeekend ? 'bg-yellow-400/10' : ''}`} style={{ width: dayWidth }}>{dayWidth > 20 ? d.getUTCDate() : ''}</div>); })}</div></div></div>
                    <div ref={ganttContainerRef} className="relative" style={{ height: (allTasks.length * 40) + (projectHeaders.length * 40) }}>
                        {Array.from({ length: totalDays }).map((_, i) => { const d = new Date(chartStartDate); d.setUTCDate(d.getUTCDate() + i); const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6; return <div key={i} className={`absolute top-0 bottom-0 border-r border-border-color ${isWeekend ? 'bg-yellow-400/10' : ''}`} style={{ left: i * dayWidth, width: dayWidth }}></div> })}
                        {projectHeaders.map(h => <div key={`header-row-${h.id}`} className="absolute w-full h-10 border-b border-border-color bg-highlight/30" style={{ top: h.yPos }}></div>)}
                        {(() => { const todayOffset = dayDiff(chartStartDate, new Date()) * dayWidth; if (todayOffset >= 0 && todayOffset <= totalWidth) { return <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" title="Today" style={{ left: todayOffset }}></div>; } return null; })()}
                        
                        {allTasks.map((task) => {
                            const projectHeader = projectHeaders.find(h => h.id === task.projectId);
                            const projectTaskIndex = allTasks.filter(t => t.projectId === task.projectId).findIndex(t => t.id === task.id);
                            if(!projectHeader) return null;
                            const taskTop = projectHeader.yPos + 40 + (projectTaskIndex * 40);
                            const taskStart = parseDate(task.startDate);

                            if (isNaN(taskStart.getTime())) {
                                return (
                                    <div key={`creator-${task.id}`} className="absolute w-full h-10 group/creator" style={{ top: taskTop, left: 0 }} onMouseDown={(e) => handleCreateMouseDown(e, task, taskTop)}>
                                        <div className="absolute inset-0 bg-transparent group-hover/creator:bg-accent/10 transition-colors flex items-center justify-center cursor-cell">
                                            <span className="text-xs text-text-secondary opacity-0 group-hover/creator:opacity-100 pointer-events-none">Click and drag to schedule</span>
                                        </div>
                                    </div>
                                );
                            }

                            const startOffset = dayDiff(chartStartDate, taskStart);
                            const duration = dayDiff(taskStart, parseDate(task.endDate)) + 1;
                            const left = startOffset * dayWidth;
                            const width = duration * dayWidth;
                            const isInteracting = interaction?.taskId === task.id;
                            const containerStyles: React.CSSProperties = { top: `${taskTop}px`, left: `${left}px`, width: `${width}px`, zIndex: isInteracting ? 10 : 1, transition: isInteracting ? 'none' : 'all 0.2s ease' };
                            
                            return (
                                <div key={task.id} data-task-id={task.id} className="absolute h-10 flex items-center group" style={containerStyles}>
                                    <div title={`${task.name}\nStart: ${task.startDate}\nEnd: ${task.endDate}`} className={`h-7 w-full rounded-md flex items-center px-2 text-white text-xs select-none cursor-grab relative ${task.projectColor} ${task.completed ? 'opacity-50' : ''}`} onMouseDown={(e) => handleMouseDown(e, 'drag', task)}>
                                        <span className="truncate pointer-events-none">{task.name}</span>
                                    </div>
                                    <div onMouseDown={(e) => handleMouseDown(e, 'resize-start', task)} className="absolute -left-2 top-0 w-4 h-10 cursor-ew-resize opacity-0 group-hover:opacity-100" />
                                    <div onMouseDown={(e) => handleMouseDown(e, 'resize-end', task)} className="absolute -right-2 top-0 w-4 h-10 cursor-ew-resize opacity-0 group-hover:opacity-100" />
                                </div>
                            );
                        })}
                        {tempCreatingBar && (
                            <div className="absolute h-10 flex items-center pointer-events-none" style={{...tempCreatingBar}}>
                                <div className="h-7 w-full rounded-md bg-accent/50"/>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default GlobalGanttView;