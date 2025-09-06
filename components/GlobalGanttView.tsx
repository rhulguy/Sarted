import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Task, Project, ProjectGroup } from '../types';
import { PlusIcon, MinusIcon, DownloadIcon, ChevronRightIcon, ImageIcon, FolderIcon, ArrowLongLeftIcon, ArrowLongRightIcon, TrashIcon } from './IconComponents';
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
    task: RenderItem;
    startX: number;
}

type RenderItem = 
    | { type: 'group'; data: ProjectGroup }
    | { type: 'project'; data: Project }
    | { type: 'task'; data: GlobalGanttTask; level: number };

interface GlobalGanttTask extends Task {
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
  const { visibleProjects, projectGroups, addTask, updateTask, updateMultipleTasks, deleteTask, reparentTask } = useProject();
  const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
  
  const [dayWidth, setDayWidth] = useState(30);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [creatingState, setCreatingState] = useState<CreatingState | null>(null);
  const [tempCreatingBar, setTempCreatingBar] = useState<{ left: number; width: number } | null>(null);
  const [tempTaskPositions, setTempTaskPositions] = useState<Map<string, { left: number; width: number }>>(new Map());
  const [addingTaskToProject, setAddingTaskToProject] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [collapsedProjects, setCollapsedProjects] = useState(new Set<string>());
  const [collapsedGroups, setCollapsedGroups] = useState(new Set<string>());
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const taskBarRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { allTasksWithMeta, minDate, maxDate } = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    const flattenedTasks: GlobalGanttTask[] = [];
    const groupColorMap = new Map(projectGroups.map(g => [g.id, g.color]));

    visibleProjects.forEach(project => {
      const projectColor = groupColorMap.get(project.groupId) || 'bg-gray-500';
      const findDateRangeAndFlatten = (tasks: Task[]) => {
          tasks.forEach(task => {
              flattenedTasks.push({ ...task, projectId: project.id, projectName: project.name, projectColor });
              const start = parseDate(task.startDate);
              const end = parseDate(task.endDate);
              if (!isNaN(start.getTime())) { if (!min || start < min) min = start; }
              if (!isNaN(end.getTime())) { if (!max || end > max) max = end; }
              if (task.subtasks) findDateRangeAndFlatten(task.subtasks);
          });
      };
      findDateRangeAndFlatten(project.tasks);
    });

    const mondayThisWeek = getMondayOfWeek(new Date());
    let effectiveMin = min && min < mondayThisWeek ? min : mondayThisWeek;
    
    let effectiveMax = max;
    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 30);
    if (!effectiveMax || effectiveMax < futureDate) {
        effectiveMax = futureDate;
    }

    return { allTasksWithMeta: flattenedTasks, minDate: effectiveMin, maxDate: effectiveMax };
  }, [visibleProjects, projectGroups]);
  
  const parentMap = useMemo(() => {
    const map = new Map<string, string | null>();
    visibleProjects.forEach(project => {
        const buildMap = (tasks: Task[], parentId: string | null) => {
            tasks.forEach(task => {
                map.set(task.id, parentId);
                if (task.subtasks) {
                    buildMap(task.subtasks, task.id);
                }
            });
        };
        buildMap(project.tasks, null);
    });
    return map;
}, [visibleProjects]);

  const itemsToRender = useMemo((): RenderItem[] => {
    const items: RenderItem[] = [];
    const sortedGroups = [...projectGroups].sort((a, b) => a.name.localeCompare(b.name));

    sortedGroups.forEach(group => {
        const projectsInGroup = visibleProjects.filter(p => p.groupId === group.id).sort((a,b) => a.name.localeCompare(b.name));
        if (projectsInGroup.length > 0) {
            items.push({ type: 'group', data: group });

            if (!collapsedGroups.has(group.id)) {
                projectsInGroup.forEach(project => {
                    items.push({ type: 'project', data: project });

                    if (project.id === addingTaskToProject) {
                        const placeholderTask: GlobalGanttTask = {
                            id: `new-task-form-${project.id}`, name: '', completed: false, description: '', subtasks: [],
                            projectId: project.id, projectName: project.name, projectColor: ''
                        };
                        items.push({ type: 'task', data: placeholderTask, level: 0 });
                    }

                    if (!collapsedProjects.has(project.id)) {
                        const taskMap = new Map(allTasksWithMeta.filter(t => t.projectId === project.id).map(t => [t.id, t]));
                        
                        const addTasksRecursively = (tasks: Task[], level: number) => {
                            tasks.forEach(task => {
                                const taskWithMeta = taskMap.get(task.id);
                                if (taskWithMeta) {
                                    items.push({ type: 'task', data: taskWithMeta, level });
                                    if (task.subtasks) addTasksRecursively(task.subtasks, level + 1);
                                }
                            });
                        };
                        addTasksRecursively(project.tasks, 0);
                    }
                });
            }
        }
    });

    return items;
  }, [visibleProjects, projectGroups, collapsedGroups, collapsedProjects, allTasksWithMeta, addingTaskToProject]);

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
    itemsToRender.forEach((item, index) => {
        if (item.type === 'task' && item.data.startDate && item.data.endDate) {
            const task = item.data;
            const taskStart = parseDate(task.startDate);
            if (isNaN(taskStart.getTime())) return;
            const startOffset = dayDiff(chartStartDate, taskStart);
            const duration = dayDiff(taskStart, parseDate(task.endDate)) + 1;
            localTaskPositions.set(task.id, {
                y: index * 40, // rowHeight is 40
                startX: startOffset * dayWidth,
                endX: (startOffset * dayWidth) + (duration * dayWidth),
            });
        }
    });
    return localTaskPositions;
  }, [itemsToRender, chartStartDate, dayWidth]);

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
  }, [visibleProjects, taskPositions, tempTaskPositions]);

  const toggleProjectCollapse = useCallback((projectId: string) => {
    setCollapsedProjects(prev => {
        const newSet = new Set(prev);
        if (newSet.has(projectId)) newSet.delete(projectId);
        else newSet.add(projectId);
        return newSet;
    });
  }, []);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
        const newSet = new Set(prev);
        if (newSet.has(groupId)) newSet.delete(groupId);
        else newSet.add(groupId);
        return newSet;
    });
  }, []);

  const handleNewTaskSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskName.trim() && addingTaskToProject) {
      const newTask: Task = {
        id: `task-${Date.now()}`, name: newTaskName.trim(), description: '', completed: false, subtasks: [],
      };
      await addTask(addingTaskToProject, newTask);
      setNewTaskName('');
    }
  }, [newTaskName, addingTaskToProject, addTask]);

  const handleMouseUp = useCallback(async (e: MouseEvent, currentInteraction: InteractionState) => {
    const { originalTask, startX, type, taskId } = currentInteraction;
    const taskInfo = allTasksWithMeta.find(t => t.id === taskId);
    if (!taskInfo) {
      setInteraction(null);
      return;
    }

    const finalOffsetPx = e.clientX - startX;
    const dayDelta = Math.round(finalOffsetPx / dayWidth);
    
    setInteraction(null);
    if (dayDelta === 0) return;

    const originalStart = parseDate(originalTask.startDate);
    const originalEnd = parseDate(originalTask.endDate);

    if (isNaN(originalStart.getTime()) || isNaN(originalEnd.getTime())) return;

    let newStart = new Date(originalStart);
    let newEnd = new Date(originalEnd);

    if (type === 'drag') {
        newStart.setUTCDate(newStart.getUTCDate() + dayDelta);
        const duration = dayDiff(originalStart, originalEnd);
        newEnd = new Date(newStart);
        newEnd.setUTCDate(newEnd.getUTCDate() + duration);
    } else if (type === 'resize-start') {
        newStart.setUTCDate(newStart.getUTCDate() + dayDelta);
    } else if (type === 'resize-end') {
        newEnd.setUTCDate(newEnd.getUTCDate() + dayDelta);
    }
    
    if (newStart <= newEnd) {
        const draggedTaskUpdate = { ...originalTask, startDate: formatDate(newStart), endDate: formatDate(newEnd) };
        const tasksToUpdate: Task[] = [draggedTaskUpdate];

        // If dragging a parent, move all children too.
        if (type === 'drag' && originalTask.subtasks && originalTask.subtasks.length > 0) {
            const dragDayDelta = dayDiff(originalStart, newStart);
            
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
            collectSubtasks(originalTask.subtasks, dragDayDelta);
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
        setTempTaskPositions(prev => new Map([...Array.from(prev.entries()), ...Array.from(newTempPositions.entries())]));
        
        await updateMultipleTasks(taskInfo.projectId, tasksToUpdate);
    }
  }, [dayWidth, updateMultipleTasks, allTasksWithMeta, chartStartDate]);
  
  const handleCreateMouseUp = useCallback(async (e: MouseEvent) => {
      if (!creatingState || !scrollContainerRef.current) return;
      const { task, startX } = creatingState;
      const timelineRect = scrollContainerRef.current.querySelector('.timeline-body')?.getBoundingClientRect();
      if (!timelineRect) return;

      if (task.type !== 'task') {
        setCreatingState(null);
        setTempCreatingBar(null);
        return;
      }

      const endX = e.clientX - timelineRect.left;
      
      const startDayIndex = Math.floor(Math.min(startX, endX) / dayWidth);
      const endDayIndex = Math.floor(Math.max(startX, endX) / dayWidth);

      const newStartDate = new Date(chartStartDate);
      newStartDate.setUTCDate(newStartDate.getUTCDate() + startDayIndex);
      const newEndDate = new Date(chartStartDate);
      newEndDate.setUTCDate(newEndDate.getUTCDate() + endDayIndex);

      const taskToUpdate = task.data;
      if (taskToUpdate) {
          await updateTask(taskToUpdate.projectId, { ...taskToUpdate, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) });
      }
      
      setCreatingState(null);
      setTempCreatingBar(null);
  }, [creatingState, dayWidth, chartStartDate, updateTask]);

  useEffect(() => {
    if (!creatingState) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!scrollContainerRef.current) return;
      const timelineRect = scrollContainerRef.current.querySelector('.timeline-body')?.getBoundingClientRect();
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

  const handleDelete = useCallback(async (projectId: string, taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task and all its subtasks?')) {
        await deleteTask(projectId, taskId);
    }
  }, [deleteTask]);

  const handleIndent = useCallback(async (taskData: GlobalGanttTask, itemIndex: number) => {
      if (itemIndex === 0) return;
      const potentialParentItem = itemsToRender[itemIndex - 1];
      const currentItem = itemsToRender[itemIndex];
      
      if (potentialParentItem.type === 'task' && currentItem.type === 'task' &&
          potentialParentItem.data.projectId === taskData.projectId && 
          potentialParentItem.level === currentItem.level) {
          await reparentTask(taskData.projectId, taskData.id, potentialParentItem.data.id);
      }
  }, [itemsToRender, reparentTask]);

  const handleOutdent = useCallback(async (taskData: GlobalGanttTask) => {
      const parentId = parentMap.get(taskData.id);
      if (parentId === null || parentId === undefined) return;
      
      const grandparentId = parentMap.get(parentId) ?? null;
      await reparentTask(taskData.projectId, taskData.id, grandparentId);
  }, [parentMap, reparentTask]);

  const today = new Date();
  today.setUTCHours(0,0,0,0);

  if (visibleProjects.length === 0) return <div className="text-center text-text-secondary p-8">No projects to display.</div>;
  
  return (
    <div ref={downloadRef} className="h-full flex flex-col bg-secondary rounded-lg">
        <div className="p-2 border-b border-border-color flex items-center justify-between">
            <div className="flex items-center space-x-1">
                <button onClick={() => handleZoom('out')} className="p-1 rounded text-text-secondary hover:bg-highlight"><MinusIcon className="w-5 h-5" /></button>
                <button onClick={() => handleZoom('in')} className="p-1 rounded text-text-secondary hover:bg-highlight"><PlusIcon className="w-5 h-5" /></button>
            </div>
             <button onClick={() => downloadImage(`global-gantt-chart.png`)} disabled={isDownloading} className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-highlight text-text-secondary rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"><DownloadIcon className="w-4 h-4" /><span>{isDownloading ? 'Exporting...' : 'Export'}</span></button>
        </div>

        <div ref={scrollContainerRef} className="flex-grow overflow-auto">
            <div className="relative" style={{ width: totalWidth, minWidth: '100%' }}>
                {/* Sticky Header */}
                <div className="sticky top-0 z-20 h-16 bg-secondary flex">
                    <div className="w-72 shrink-0 sticky left-0 z-10 bg-primary border-r border-b border-border-color flex items-center p-2">
                        <h3 className="font-semibold">Task Name</h3>
                    </div>
                    <div className="flex-grow relative border-b border-border-color">
                        <div className="absolute top-0 left-0 w-full h-8 flex">{months.map((month, index) => (<div key={index} className="flex items-center justify-center border-r border-border-color text-sm font-semibold" style={{ width: month.days * dayWidth }}>{month.name} {month.year}</div>))}</div>
                        <div className="absolute bottom-0 left-0 w-full h-8 flex">{Array.from({ length: totalDays }).map((_, i) => { const d = new Date(chartStartDate); d.setUTCDate(d.getUTCDate() + i); return (<div key={i} className={`flex items-center justify-center border-r border-border-color text-xs text-text-secondary`} style={{ width: dayWidth }}>{dayWidth > 20 ? d.getUTCDate() : ''}</div>); })}</div>
                    </div>
                </div>

                {/* Body */}
                <div className="relative timeline-body">
                     {/* Vertical Grid Lines & Weekend Highlights */}
                    {Array.from({ length: totalDays }).map((_, i) => { const d = new Date(chartStartDate); d.setUTCDate(d.getUTCDate() + i); const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6; return <div key={i} className={`absolute top-0 bottom-0 border-r border-border-color ${isWeekend ? 'bg-yellow-400/10' : ''}`} style={{ left: i * dayWidth, width: dayWidth }}></div> })}
                    {/* Today Marker */}
                    {(() => { const todayOffset = dayDiff(chartStartDate, new Date()); if (todayOffset >= 0 && todayOffset < totalDays) { return <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" title="Today" style={{ left: todayOffset * dayWidth }}></div>; } return null; })()}
                    
                    {itemsToRender.map((item, index) => {
                        const rowHeight = 40;
                        
                        if (item.type === 'task') {
                            let canIndent = false;
                            if (index > 0) {
                                const potentialParentItem = itemsToRender[index - 1];
                                if (potentialParentItem.type === 'task' && potentialParentItem.data.projectId === item.data.projectId && potentialParentItem.level === item.level) {
                                    canIndent = true;
                                }
                            }
                            const canOutdent = parentMap.get(item.data.id) !== null;

                            return (
                                <div key={item.type + '-' + item.data.id} className="flex h-10 items-center w-full" style={{ height: `${rowHeight}px` }}>
                                    <div className="w-72 shrink-0 sticky left-0 z-10 flex items-center p-2 border-b border-border-color bg-primary">
                                        {item.data.id.startsWith('new-task-form') ? (
                                            <form onSubmit={handleNewTaskSubmit} className="w-full" style={{ paddingLeft: '1.5rem' }}>
                                                <input
                                                    type="text" value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
                                                    onBlur={() => { if (newTaskName.trim() === '') setAddingTaskToProject(null); }}
                                                    onKeyDown={e => { if (e.key === 'Escape') { setNewTaskName(''); setAddingTaskToProject(null); } }}
                                                    placeholder="New task..." autoFocus
                                                    className="w-full bg-secondary border border-accent rounded p-1 text-sm"
                                                />
                                            </form>
                                        ) : (
                                            <div className="flex items-center group w-full" style={{ paddingLeft: '1.5rem' }}>
                                                <div className="flex-grow truncate text-sm" style={{ paddingLeft: `${item.level * 20}px` }}>
                                                  {item.data.name}
                                                </div>
                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleIndent(item.data, index)} disabled={!canIndent} title="Indent Task" className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"><ArrowLongRightIcon className="w-5 h-5" /></button>
                                                    <button onClick={() => handleOutdent(item.data)} disabled={!canOutdent} title="Outdent Task" className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"><ArrowLongLeftIcon className="w-5 h-5" /></button>
                                                    <button onClick={() => handleDelete(item.data.projectId, item.data.id)} title="Delete Task" className="p-1 text-red-500 hover:text-red-400"><TrashIcon className="w-5 h-5" /></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-grow h-full relative border-b border-border-color">
                                        {!item.data.id.startsWith('new-task-form') && (() => {
                                            const task = item.data;
                                            const taskPos = taskPositions.get(task.id);

                                            if (!taskPos) {
                                                return (
                                                    <div className="absolute inset-0 group/creator cursor-cell" onMouseDown={(e) => { e.preventDefault(); const timelineRect = e.currentTarget.getBoundingClientRect(); setCreatingState({ task: item, startX: e.clientX - timelineRect.left }); }}>
                                                        <div className="absolute inset-0 bg-transparent group-hover/creator:bg-accent/10 transition-colors flex items-center justify-center">
                                                            <span className="text-xs text-text-secondary opacity-0 group-hover/creator:opacity-100 pointer-events-none">Click and drag to schedule</span>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            const isInteracting = interaction?.taskId === task.id;
                                            const tempPos = tempTaskPositions.get(task.id);
                                            const left = tempPos ? tempPos.left : taskPos.startX;
                                            const width = tempPos ? tempPos.width : (taskPos.endX - taskPos.startX);
                                            const endDate = parseDate(task.endDate);
                                            const isOverdue = endDate && endDate < today && !task.completed;
                                            
                                            return (
                                                <div 
                                                    ref={el => { if (el) taskBarRefs.current.set(task.id, el); else taskBarRefs.current.delete(task.id); }}
                                                    data-task-id={task.id} 
                                                    className="absolute h-7 top-1/2 -translate-y-1/2 group" 
                                                    style={{ left: `${left}px`, width: `${width}px`, zIndex: isInteracting ? 20 : 1, transition: isInteracting ? 'none' : 'left 0.2s, width 0.2s' }}
                                                    onMouseDown={(e) => { e.preventDefault(); setInteraction({ type: 'drag', taskId: task.id, startX: e.clientX, originalTask: task, originalLeft: taskPos.startX, originalWidth: taskPos.endX - taskPos.startX }); }}>
                                                    <div title={`${task.name}\n${task.startDate} to ${task.endDate}`} className={`h-full w-full rounded-md flex items-center px-2 text-white text-xs select-none cursor-grab relative ${isOverdue ? 'bg-accent-red' : task.completed ? 'bg-gray-600' : task.projectColor} ${task.completed ? 'opacity-50' : ''}`}>
                                                        {task.imageUrl && (<img src={task.imageUrl} alt={task.name} className="w-5 h-5 rounded-full object-cover mr-2 shrink-0"/>)}
                                                        <span className="truncate pointer-events-none">{task.name}</span>
                                                    </div>
                                                    <div onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setInteraction({ type: 'resize-start', taskId: task.id, startX: e.clientX, originalTask: task, originalLeft: taskPos.startX, originalWidth: taskPos.endX - taskPos.startX }); }} className="absolute -left-2 top-0 w-4 h-full cursor-ew-resize opacity-0 group-hover:opacity-100" />
                                                    <div onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setInteraction({ type: 'resize-end', taskId: task.id, startX: e.clientX, originalTask: task, originalLeft: taskPos.startX, originalWidth: taskPos.endX - taskPos.startX }); }} className="absolute -right-2 top-0 w-4 h-full cursor-ew-resize opacity-0 group-hover:opacity-100" />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        } else {
                            const isGroup = item.type === 'group';
                            const isProject = item.type === 'project';
                            const data = item.data;

                             return (
                                <div key={item.type + '-' + data.id} className="flex h-10 items-center w-full" style={{ height: `${rowHeight}px` }}>
                                    <div className={`w-72 shrink-0 sticky left-0 z-10 flex items-center p-2 border-b border-border-color 
                                        ${isGroup ? 'bg-secondary font-bold text-text-secondary' : ''}
                                        ${isProject ? 'bg-highlight font-bold' : ''}
                                    `}>
                                        {isGroup && (
                                            <div className="flex items-center w-full">
                                                <button onClick={() => toggleGroupCollapse(data.id)} className="p-1 mr-1 text-text-secondary hover:text-text-primary">
                                                    <ChevronRightIcon className={`w-4 h-4 transition-transform ${!collapsedGroups.has(data.id) ? 'rotate-90' : ''}`} />
                                                </button>
                                                <FolderIcon className="w-5 h-5 mr-2" />
                                                <span className="truncate">{data.name}</span>
                                            </div>
                                        )}
                                        {isProject && (
                                            <div className="flex items-center justify-between w-full group" style={{ paddingLeft: '1rem' }}>
                                                <div className="flex items-center truncate">
                                                    <button onClick={() => toggleProjectCollapse(data.id)} className="p-1 mr-1 text-text-secondary hover:text-text-primary">
                                                        <ChevronRightIcon className={`w-4 h-4 transition-transform ${!collapsedProjects.has(data.id) ? 'rotate-90' : ''}`} />
                                                    </button>
                                                    <span className="truncate">{data.name}</span>
                                                </div>
                                                <button onClick={() => { setNewTaskName(''); setAddingTaskToProject(data.id); }} className="opacity-0 group-hover:opacity-100 text-accent hover:text-blue-400 p-1"><PlusIcon className="w-5 h-5"/></button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-grow h-full relative border-b border-border-color">
                                        <div className="w-full h-px bg-border-color absolute top-1/2"></div>
                                    </div>
                                </div>
                            );
                        }
                    })}
                    {creatingState && tempCreatingBar && (
                        <div className="absolute h-7 top-1/2 -translate-y-1/2 pointer-events-none bg-accent/50 rounded-md" style={{ ...tempCreatingBar, top: `${itemsToRender.findIndex(i => i.data.id === creatingState.task.data.id) * 40 + 6}px` }}></div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default GlobalGanttView;
