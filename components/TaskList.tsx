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

  // The new architecture with the ProjectsDashboard and safe archiving logic
  // ensures that this component will never be rendered with a null project.
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
    <div className="h-full flex flex-col p-4 md:p-6">
      <header className="mb-4 shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
             <span className="text-3xl">{project.icon || '📁'}</span>
             <div>
                <h1 className="text-2xl md:text-3xl font-bold text-text-primary">{project.name}</h1>
                <p className="text-text-secondary text-sm">Doing something amazing.</p>
             </div>
          </div>
          <div className="bg-card-background border border-border-color p-1 rounded-full flex space-x-1">
            {viewButtons.map(button => (
                <button
                    key={button.id}
                    onClick={() => setCurrentView(button.id as View)}
                    className={`flex items-center space-x-2 py-1.5 px-3 text-sm font-medium rounded-full transition-colors shrink-0 ${
                        currentView === button.id
                        ? 'bg-accent-blue text-white'
                        : 'text-text-secondary hover:text-text-primary hover:bg-app-background'
                    }`}
                >
                    <button.icon className="w-5 h-5" />
                    <span className="hidden md:inline">{button.name}</span>
                </button>
            ))}
        </div>
        </div>
        <div className="mt-4 flex items-center space-x-4">
            <div className="w-full bg-border-color rounded-full h-2"><div className="bg-accent-blue h-2 rounded-full" style={{ width: `${progress}%` }}></div></div>
            <span className="text-sm font-medium text-text-secondary">{Math.round(progress)}%</span>
        </div>
      </header>
      
      <div className="flex-grow overflow-hidden mt-4">
        {currentView === 'list' && <ListView {...viewProps} />}
        {currentView === 'gantt' && <GanttChartView />}
        {currentView === 'mindmap' && <MindMapView {...viewProps} />}
        {currentView === 'calendar' && <CalendarView {...viewProps} />}
      </div>
    </div>
  );
};

export default TaskList;