import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PlusIcon, TrashIcon, LinkIcon } from './IconComponents';
import ListView from './ListView';
import GanttChartView from './GanttChartView';
import MindMapView from './MindMapView';
import CalendarView from './CalendarView';
import { useProject, useResource } from '../contexts/ProjectContext';
import { calculateProgress } from '../utils/taskUtils';
import { useIsMobile } from '../hooks/useIsMobile';
import { Task, ProjectView, Project, Resource } from '../types';

// --- Inlined Project Resources View ---
const ProjectResourcesView: React.FC<{
    project: Project;
    onAddResource: (context: { projectId: string; groupId: string }) => void;
}> = ({ project, onAddResource }) => {
    const { resources, loading, deleteResource } = useResource();

    const projectResources = useMemo(() => {
        return resources.filter(res => res.projectIds.includes(project.id));
    }, [resources, project.id]);

    const ResourceCard: React.FC<{ resource: Resource; onDelete: (id: string) => void }> = ({ resource, onDelete }) => (
        <div className="bg-app-background rounded-xl p-4 flex flex-col justify-between group h-full">
            <div className="flex items-start gap-3">
                <img src={resource.thumbnailUrl} alt={resource.title} className="w-10 h-10 rounded-lg border border-border-color object-contain" />
                <div className="min-w-0">
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-text-primary hover:underline break-words">{resource.title}</a>
                    <p className="text-sm text-text-secondary truncate">{resource.notes || resource.url}</p>
                </div>
            </div>
            <div className="flex justify-end mt-2">
                <button onClick={() => { if(window.confirm('Delete this resource?')) onDelete(resource.id); }} title="Delete" className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-card-background text-text-secondary">
                    <TrashIcon className="w-5 h-5"/>
                </button>
                <a href={resource.url} target="_blank" rel="noopener noreferrer" title={resource.url} className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-card-background text-text-secondary">
                    <LinkIcon className="w-5 h-5"/>
                </a>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            <div className="flex-grow overflow-y-auto pr-2">
                {loading ? <p className="text-text-secondary p-4">Loading resources...</p> : 
                    projectResources.length === 0 ? (
                        <div className="text-center py-10 text-text-secondary">
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <button onClick={() => onAddResource({ projectId: project.id, groupId: project.groupId })} className="border-2 border-dashed border-border-color rounded-xl flex flex-col items-center justify-center text-text-secondary hover:bg-app-background hover:border-accent-blue transition-colors min-h-[120px]">
                                    <PlusIcon className="w-6 h-6 mb-1" />
                                    <span>Add Resource</span>
                                </button>
                             </div>
                            <p className="mt-4">No resources linked to this project yet. Click '+' to add one.</p>
                        </div>
                    ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {projectResources.map(res => (
                                <ResourceCard key={res.id} resource={res} onDelete={deleteResource} />
                            ))}
                             <button onClick={() => onAddResource({ projectId: project.id, groupId: project.groupId })} className="border-2 border-dashed border-border-color rounded-xl flex flex-col items-center justify-center text-text-secondary hover:bg-app-background hover:border-accent-blue transition-colors min-h-[120px]">
                                <PlusIcon className="w-6 h-6 mb-1" />
                                <span>Add Resource</span>
                            </button>
                        </div>
                    )
                }
            </div>
        </div>
    );
};


// --- Main TaskList Component ---
interface TaskListProps {
  projectView: ProjectView;
  setProjectView: (view: ProjectView) => void;
  onAddResource: (context: { projectId: string; groupId: string }) => void;
}

const TaskList: React.FC<TaskListProps> = ({ projectView, setProjectView, onAddResource }) => {
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
    
  // Effect to switch to a mobile-friendly view if the current one is not supported
  useEffect(() => {
    if (isMobile) {
      const mobileFriendlyViews: ProjectView[] = ['list', 'calendar', 'resources'];
      if (!mobileFriendlyViews.includes(projectView)) {
        setProjectView('list');
      }
    }
  }, [isMobile, projectView, setProjectView]);

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
        </div>
        <div className="mt-4 flex items-center space-x-4">
            <div className="w-full bg-border-color rounded-full h-2"><div className="bg-accent-blue h-2 rounded-full" style={{ width: `${progress}%` }}></div></div>
            <span className="text-sm font-medium text-text-secondary">{Math.round(progress)}%</span>
        </div>
      </header>
      
      <div className="flex-grow overflow-hidden mt-4">
        {projectView === 'list' && <ListView {...viewProps} />}
        {projectView === 'gantt' && <GanttChartView {...viewProps} />}
        {projectView === 'mindmap' && <MindMapView {...viewProps} />}
        {projectView === 'calendar' && <CalendarView {...viewProps} />}
        {projectView === 'resources' && <ProjectResourcesView project={project} onAddResource={onAddResource} />}
      </div>
    </div>
  );
};

export default TaskList;