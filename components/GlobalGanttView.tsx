import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Task, Project, ProjectGroup } from '../types';
import { PlusIcon, MinusIcon, DownloadIcon, ChevronRightIcon, ImageIcon, FolderIcon, ArrowLongLeftIcon, ArrowLongRightIcon, TrashIcon } from './IconComponents';
import { useProject } from '../contexts/ProjectContext';
import { useDownloadImage } from '../hooks/useDownloadImage';
import { int, dateToIndexUTC, indexToDateUTC, pixelToIndex, inclusiveWidth } from '../utils/taskUtils';

interface InteractionState {
    type: 'drag' | 'resize-start' | 'resize-end';
    taskId: string;
    pointerId: number;
    startPointerX: number;
    originalTask: Task;
    originalStartIndex: number;
    originalEndIndex: number;
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
  const [addingTaskToProject, setAddingTaskToProject] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskEndDate, setNewTaskEndDate] = useState('');
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
        startDate: newTaskStartDate || undefined, endDate: newTaskEndDate || undefined,
      };
      await addTask(addingTaskToProject, newTask);
      setNewTaskName('');
      setNewTaskStartDate('');
      setNewTaskEndDate('');
    }
  }, [newTaskName, addingTaskToProject, addTask, newTaskStartDate, newTaskEndDate]);
  
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
    if (!interaction) return;

    const taskBarEl = taskBarRefs.current.get(interaction.taskId);
    if (!taskBarEl) {
      setInteraction(null);
      return;
    }
    
    taskBarEl.setPointerCapture(interaction.pointerId);
    document.body.style.cursor = interaction.type === 'drag' ? 'grabbing' : 'ew-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== interaction.pointerId) return;
      e.preventDefault();

      const deltaX = e.clientX - interaction.startPointerX;
      let newLeftPx: number, newWidthPx: number;
      
      const originalStartPx = interaction.originalStartIndex * dayWidth;

      if (interaction.type === 'drag') {
        const dayDelta = Math.round(deltaX / dayWidth);
        const newStartIndex = interaction.originalStartIndex + dayDelta;
        
        newLeftPx = newStartIndex * dayWidth;
        newWidthPx = inclusiveWidth(interaction.originalStartIndex, interaction.originalEndIndex, dayWidth);

      } else if (interaction.type === 'resize-start') {
        const dayDelta = Math.round(deltaX / dayWidth);
        let newStartIndex = interaction.originalStartIndex + dayDelta;
        
        if (newStartIndex > interaction.originalEndIndex) {
            newStartIndex = interaction.originalEndIndex;
        }
        newLeftPx = newStartIndex * dayWidth;
        newWidthPx = inclusiveWidth(newStartIndex, interaction.originalEndIndex, dayWidth);

      } else { // resize-end
        const timelineRect = scrollContainerRef.current?.querySelector('.timeline-body')?.getBoundingClientRect();
        if (!timelineRect) return;

        const pointerXInTimeline = e.clientX - timelineRect.left;
        const newEndIndex = pixelToIndex(pointerXInTimeline, dayWidth);
        const finalEndIndex = Math.max(interaction.originalStartIndex, newEndIndex);

        newLeftPx = originalStartPx;
        newWidthPx = inclusiveWidth(interaction.originalStartIndex, finalEndIndex, dayWidth);
      }
      
      taskBarEl.style.left = `${int(newLeftPx)}px`;
      taskBarEl.style.width = `${int(newWidthPx)}px`;
    };

    const handlePointerUp = async (e: PointerEvent) => {
      if (e.pointerId !== interaction.pointerId) return;
      
      const taskInfo = allTasksWithMeta.find(t => t.id === interaction.taskId);
      if (!taskInfo) { setInteraction(null); return; }

      const { originalTask, startPointerX, type, originalStartIndex, originalEndIndex } = interaction;
      let finalStartIndex = originalStartIndex;
      let finalEndIndex = originalEndIndex;
      const deltaX = e.clientX - startPointerX;
      
      if (type === 'drag') {
        const dayDelta = Math.round(deltaX / dayWidth);
        finalStartIndex += dayDelta;
        finalEndIndex += dayDelta;
      } else if (type === 'resize-start') {
        const dayDelta = Math.round(deltaX / dayWidth);
        finalStartIndex += dayDelta;
        if (finalStartIndex > finalEndIndex) finalStartIndex = finalEndIndex;
      } else { // resize-end
        const timelineRect = scrollContainerRef.current?.querySelector('.timeline-body')?.getBoundingClientRect();
        if (!timelineRect) { setInteraction(null); return; }
        const pointerXInTimeline = e.clientX - timelineRect.left;
        const newEndIndex = pixelToIndex(pointerXInTimeline, dayWidth);
        finalEndIndex = Math.max(originalStartIndex, newEndIndex);
      }

      if (finalStartIndex !== originalStartIndex || finalEndIndex !== originalEndIndex) {
          const newStartDate = indexToDateUTC(chartStartDate, finalStartIndex);
          const newEndDate = indexToDateUTC(chartStartDate, finalEndIndex);
          
          const draggedTaskUpdate: Task = { ...originalTask, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) };
          const tasksToUpdate: Task[] = [draggedTaskUpdate];
  
          if (type === 'drag' && originalTask.subtasks?.length) {
              const dragDayDelta = finalStartIndex - originalStartIndex;
              const collectSubtasks = (tasks: Task[], delta: number) => {
                  tasks.forEach(subtask => {
                      const oStart = parseDate(subtask.startDate), oEnd = parseDate(subtask.endDate);
                      if (!isNaN(oStart.getTime()) && !isNaN(oEnd.getTime())) {
                          const nStart = new Date(oStart); nStart.setUTCDate(nStart.getUTCDate() + delta);
                          const duration = dayDiff(oStart, oEnd);
                          const nEnd = new Date(nStart); nEnd.setUTCDate(nEnd.getUTCDate() + duration);
                          tasksToUpdate.push({ ...subtask, startDate: formatDate(nStart), endDate: formatDate(nEnd) });
                      }
                      if (subtask.subtasks) collectSubtasks(subtask.subtasks, delta);
                  });
              };
              collectSubtasks(originalTask.subtasks, dragDayDelta);
          }
          await updateMultipleTasks(taskInfo.projectId, tasksToUpdate);
      }
      
      if (taskBarEl.hasPointerCapture(interaction.pointerId)) taskBarEl.releasePointerCapture(interaction.pointerId);
      setInteraction(null);
    };

    const handlePointerCancel = (e: PointerEvent) => {
        if (e.pointerId !== interaction.pointerId) return;
        const originalStartPx = interaction.originalStartIndex * dayWidth;
        const originalWidthPx = inclusiveWidth(interaction.originalStartIndex, interaction.originalEndIndex, dayWidth);
        taskBarEl.style.left = `${int(originalStartPx)}px`;
        taskBarEl.style.width = `${int(originalWidthPx)}px`;
        setInteraction(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    
    return () => {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [interaction, dayWidth, chartStartDate, allTasksWithMeta, updateMultipleTasks]);

  const handleZoom = (direction: 'in' | 'out') => setDayWidth(prev => Math.max(10, Math.min(100, direction === 'in' ? prev * 1.5 : prev / 1.5)));

  const today = new Date();
  today.setUTCHours(0,0,0,0);
  const rowHeight = 40;
  
  return (
    <div ref={downloadRef} className="flex flex-col h-full bg-card-background rounded-xl border border-border-color">
        <div className="p-2 border-b border-border-color flex items-center justify-between">
             <h1 className="text-xl font-bold ml-2">Global Gantt</h1>
            <div className="flex items-center space-x-1">
                <button onClick={() => handleZoom('out')} className="p-1 rounded text-text-secondary hover:bg-app-background"><MinusIcon className="w-5 h-5" /></button>
                <button onClick={() => handleZoom('in')} className="p-1 rounded text-text-secondary hover:bg-app-background"><PlusIcon className="w-5 h-5" /></button>
                <button 
                    onClick={() => downloadImage('global-gantt-chart.png')} 
                    disabled={isDownloading} 
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-app-background text-text-secondary rounded-lg hover:bg-border-color transition-colors disabled:opacity-50"
                >
                    <DownloadIcon className="w-4 h-4" />
                    <span>{isDownloading ? 'Exporting...' : 'Export'}</span>
                </button>
            </div>
        </div>
        <div ref={scrollContainerRef} className="flex-grow overflow-auto">
            <div className="relative" style={{ width: totalWidth + 320, minWidth: '100%' }}>
                <div className="sticky top-0 z-20 h-16 flex">
                    <div className="w-80 shrink-0 sticky left-0 z-10 bg-card-background border-r border-b border-border-color flex items-center p-2"><h3 className="font-semibold">Projects & Tasks</h3></div>
                    <div className="flex-grow relative border-b border-border-color bg-card-background">
                        <div className="absolute top-0 left-0 w-full h-8 flex">{months.map((month, index) => (<div key={index} className="flex items-center justify-center border-r border-border-color text-sm font-semibold" style={{ width: month.days * dayWidth }}>{month.name} {month.year}</div>))}</div>
                        <div className="absolute bottom-0 left-0 w-full h-8 flex">{Array.from({ length: totalDays }).map((_, i) => { const d = new Date(chartStartDate); d.setUTCDate(d.getUTCDate() + i); const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6; return (<div key={i} className={`flex items-center justify-center border-r border-border-color text-xs text-text-secondary ${isWeekend ? 'bg-yellow-400/20' : ''}`} style={{ width: dayWidth }}>{dayWidth > 20 ? d.getUTCDate() : ''}</div>); })}</div>
                    </div>
                </div>
                <div className="relative" style={{ height: Math.max(500, itemsToRender.length * rowHeight) }}>
                    <div className="absolute top-0 h-full" style={{ left: 320, width: totalWidth }}>
                      {Array.from({ length: totalDays }).map((_, i) => { const d = new Date(chartStartDate); d.setUTCDate(d.getUTCDate() + i); const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6; return <div key={i} className={`absolute top-0 bottom-0 border-r border-border-color ${isWeekend ? 'bg-yellow-400/20' : ''}`} style={{ left: i * dayWidth, width: dayWidth }}></div> })}
                    </div>
                    {(() => { const todayOffset = dayDiff(chartStartDate, new Date()) * dayWidth; if (todayOffset >= 0 && todayOffset <= totalWidth) { return <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-20" title="Today" style={{ left: 320 + todayOffset }}></div>; } return null; })()}
                    <div className="relative">
                        {itemsToRender.map((item, index) => {
                            let content;
                            switch (item.type) {
                                case 'group':
                                    content = <div className="flex items-center gap-2"><button onClick={() => toggleGroupCollapse(item.data.id)}><ChevronRightIcon className={`w-4 h-4 transition-transform ${collapsedGroups.has(item.data.id) ? '' : 'rotate-90'}`} /></button><div className={`w-3 h-3 rounded-full ${item.data.color}`}></div><span className="font-bold">{item.data.name}</span></div>;
                                    break;
                                case 'project':
                                    content = <div className="flex items-center gap-2" style={{ paddingLeft: '1.5rem' }}><button onClick={() => toggleProjectCollapse(item.data.id)}><ChevronRightIcon className={`w-4 h-4 transition-transform ${collapsedProjects.has(item.data.id) ? '' : 'rotate-90'}`} /></button><FolderIcon className="w-4 h-4" /><span>{item.data.name}</span></div>;
                                    break;
                                case 'task':
                                    if (item.data.id.startsWith('new-task-form')) {
                                        content = <div style={{ paddingLeft: `${2.5 + item.level * 1.5}rem` }}><form onSubmit={handleNewTaskSubmit} className="w-full flex gap-1"><input type="text" value={newTaskName} onChange={e => setNewTaskName(e.target.value)} onBlur={() => { if (!newTaskName.trim()) setAddingTaskToProject(null); }} onKeyDown={e => { if (e.key === 'Escape') setAddingTaskToProject(null); }} placeholder="New task..." className="w-full bg-app-background border border-accent-blue rounded px-2 text-sm" autoFocus /><input type="date" value={newTaskStartDate} onChange={e => setNewTaskStartDate(e.target.value)} className="bg-app-background border rounded text-sm px-1" /><input type="date" value={newTaskEndDate} onChange={e => setNewTaskEndDate(e.target.value)} min={newTaskStartDate} className="bg-app-background border rounded text-sm px-1" /><button type="submit" className="px-2 bg-accent-blue text-white rounded">+</button></form></div>;
                                    } else {
                                        content = <div className="flex-grow truncate text-sm" style={{ paddingLeft: `${2.5 + item.level * 1.5}rem` }}>{item.data.name}</div>;
                                    }
                                    break;
                            }
                           return <div key={`${item.type}-${item.data.id}-${index}`} className="flex h-10 items-center w-full" style={{ height: `${rowHeight}px` }}><div className="w-80 shrink-0 sticky left-0 z-10 flex items-center p-2 border-r border-b border-border-color bg-card-background group">{content}</div></div>
                        })}
                    </div>
                    <div className="absolute top-0 left-80 w-full h-full timeline-body">
                         {itemsToRender.map((item, index) => {
                             if (item.type !== 'task' || item.data.id.startsWith('new-task-form')) return null;
                            const task = item.data;
                            const taskPos = taskPositions.get(task.id);
                            if (!taskPos) return null;
                            const isInteracting = interaction?.taskId === task.id;
                            const left = taskPos.startX;
                            const width = taskPos.endX - taskPos.startX;
                            const isOverdue = parseDate(task.endDate) < today && !task.completed;
                            return (
                                <div key={task.id} ref={el => { if (el) taskBarRefs.current.set(task.id, el); else taskBarRefs.current.delete(task.id); }} data-task-id={task.id} className="absolute group touch-none" 
                                style={{ top: `${index * rowHeight + 6}px`, left: `${int(left)}px`, width: `${int(width)}px`, transition: isInteracting ? 'none' : 'left 0.2s, width 0.2s', zIndex: isInteracting ? 10 : 1 }}>
                                    <div title={`${task.name}\nProject: ${task.projectName}`} className={`h-7 rounded-md flex items-center justify-between px-2 text-white text-xs select-none cursor-grab relative ${isOverdue ? 'bg-accent-red' : task.projectColor.replace('bg-', 'bg-brand-')}`}
                                        onPointerDown={(e) => { e.preventDefault(); const s = parseDate(task.startDate), en = parseDate(task.endDate); if (isNaN(s.getTime()) || isNaN(en.getTime())) return; setInteraction({ type: 'drag', taskId: task.id, pointerId: e.pointerId, startPointerX: e.clientX, originalTask: task, originalStartIndex: dateToIndexUTC(chartStartDate, s), originalEndIndex: dateToIndexUTC(chartStartDate, en) }); }}>
                                        <span className="truncate pointer-events-none">{task.name}</span>
                                    </div>
                                    <div onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); const s = parseDate(task.startDate), en = parseDate(task.endDate); if (isNaN(s.getTime()) || isNaN(en.getTime())) return; setInteraction({ type: 'resize-start', taskId: task.id, pointerId: e.pointerId, startPointerX: e.clientX, originalTask: task, originalStartIndex: dateToIndexUTC(chartStartDate, s), originalEndIndex: dateToIndexUTC(chartStartDate, en) }); }} className="absolute -left-2 top-0 w-4 h-7 cursor-ew-resize opacity-0 group-hover:opacity-100" />
                                    <div onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); const s = parseDate(task.startDate), en = parseDate(task.endDate); if (isNaN(s.getTime()) || isNaN(en.getTime())) return; setInteraction({ type: 'resize-end', taskId: task.id, pointerId: e.pointerId, startPointerX: e.clientX, originalTask: task, originalStartIndex: dateToIndexUTC(chartStartDate, s), originalEndIndex: dateToIndexUTC(chartStartDate, en) }); }} className="absolute -right-2 top-0 w-4 h-7 cursor-ew-resize opacity-0 group-hover:opacity-100" />
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default GlobalGanttView;