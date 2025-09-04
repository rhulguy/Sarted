import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ListIcon, GanttIcon, MindMapIcon, CalendarIcon } from './IconComponents';
import ListView from './ListView';
import GanttChartView from './GanttChartView';
import MindMapView from './MindMapView';
import CalendarView from './CalendarView';
import { useProject } from '../contexts/ProjectContext';
import { calculateProgress } from '../utils/taskUtils';
import { useIsMobile } from '../hooks/useIsMobile';
import { Task } from '../types';

type View = 'list' | 'gantt' | 'mindmap' | 'calendar';

const TaskList: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('list');
  const { selectedProject, addTask, updateTask, deleteTask, addSubtask } = useProject();
  const isMobile = useIsMobile();

  // This component will not render if selectedProject is null, so we can assert it.
  const project = selectedProject!;

  const { completed, total } = useMemo(() => calculateProgress(project.tasks), [project.tasks]);
  const progress = total > 0 ? (completed / total) * 100 : 0;

  // --- Task Management Handlers ---
  const handleAddTask = useCallback(async (taskName: string, startDate?: string, endDate?: string) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      name: taskName,
      description: '',
      completed: false,
      subtasks: [],
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    await addTask(project.id, newTask);
  }, [project.id, addTask]);
  
  const handleUpdateTask = useCallback(async (updatedTask: Task) => {
    await updateTask(project.id, updatedTask);
  }, [project.id, updateTask]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    await deleteTask(project.id, taskId);
  }, [project.id, deleteTask]);

  const handleAddSubtask = useCallback(async (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => {
      const newSubtask: Task = {
        id: `task-${Date.now()}`,
        name: subtaskName,
        description: '',
        completed: false,
        subtasks: [],
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      await addSubtask(project.id, parentId, newSubtask);
  }, [project.id, addSubtask]);

  const viewProps = { 
      onAddTask: handleAddTask, 
      onUpdateTask: handleUpdateTask, 
      onDeleteTask: handleDeleteTask, 
      onAddSubtask: handleAddSubtask 
  };
  
  const allViewButtons = useMemo(() => [
    { id: 'list', name: 'List', icon: ListIcon },
    { id: 'gantt', name: 'Gantt', icon: GanttIcon },
    { id: 'mindmap', name: 'Mind Map', icon: MindMapIcon },
    { id: 'calendar', name: 'Calendar', icon: CalendarIcon },
  ], []);

  const viewButtons = useMemo(() => {
    const mobileViews = ['list', 'calendar'];
    if (isMobile) {
        return allViewButtons.filter(b => mobileViews.includes(b.id));
    }
    return allViewButtons;
  }, [isMobile, allViewButtons]);
    
  // Effect to switch to a mobile-friendly view if the current one is not supported
  useEffect(() => {
    if (isMobile) {
      const isCurrentViewMobileFriendly = viewButtons.some(b => b.id === currentView);
      if (!isCurrentViewMobileFriendly) {
        setCurrentView('list');
      }
    }
  }, [isMobile, currentView, viewButtons]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 shrink-0">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{project.name}</h1>
        <div className="flex items-center space-x-4">
            <div className="w-full bg-highlight rounded-full h-2.5">
                <div className="bg-accent h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="text-sm font-medium text-text-secondary">{Math.round(progress)}%</span>
        </div>
      </div>

      <div className="border-b border-border-color mb-4 shrink-0 overflow-x-auto">
        <nav className="flex space-x-1 md:space-x-4">
            {viewButtons.map(button => (
                <button
                    key={button.id}
                    onClick={() => setCurrentView(button.id as View)}
                    className={`flex items-center space-x-2 py-2 px-3 text-sm font-medium rounded-t-lg transition-colors shrink-0 ${
                        currentView === button.id
                        ? 'border-b-2 border-accent text-accent'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                    <button.icon className="w-5 h-5" />
                    <span>{button.name}</span>
                </button>
            ))}
        </nav>
      </div>
      
      <div className="flex-grow overflow-hidden">
        {currentView === 'list' && <ListView {...viewProps} />}
        {currentView === 'gantt' && <GanttChartView />}
        {currentView === 'mindmap' && <MindMapView {...viewProps} />}
        {currentView === 'calendar' && <CalendarView {...viewProps} />}
      </div>
    </div>
  );
};

export default TaskList;