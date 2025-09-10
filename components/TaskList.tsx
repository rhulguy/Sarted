import React, { useState, useMemo, useEffect } from 'react';
import { ListIcon, GanttIcon, MindMapIcon, CalendarIcon, BookmarkSquareIcon } from './IconComponents';
import ListView from './ListView';
import GanttChartView from './GanttChartView';
import MindMapView from './MindMapView';
import CalendarView from './CalendarView';
import { useProject } from '../contexts/ProjectContext';
import { calculateProgress } from '../utils/taskUtils';
import { useIsMobile } from '../hooks/useIsMobile';
import { Task, ProjectView } from '../types';
import ExportDropdown from './ExportDropdown';
import { useDownloadImage } from '../hooks/useDownloadImage';
import { exportTasksToCsv, exportTasksToDoc } from '../utils/exportUtils';
import { MainView } from '../App';
import Breadcrumb from './Breadcrumb';
import ProjectResourcesView from './ProjectResourcesView';

// --- Main TaskList Component ---
interface TaskListProps {
  onAddResource: () => void;
  initialView: ProjectView;
  previousView: MainView;
  onGoBack: () => void;
}

const TaskList: React.FC<TaskListProps> = ({ onAddResource, initialView, previousView, onGoBack }) => {
  const { selectedProject, projectGroups, addTask, updateTask, deleteTask, addSubtask } = useProject();
  const [projectView, setProjectView] = useState<ProjectView>(initialView);
  const isMobile = useIsMobile();
  const { ref: viewRef, downloadImage } = useDownloadImage<HTMLDivElement>();

  const project = selectedProject!;

  const { completed, total } = useMemo(() => calculateProgress(project.tasks), [project.tasks]);
  const progress = total > 0 ? (completed / total) * 100 : 0;

  const viewButtons = useMemo(() => {
    const all = [
      { id: 'list', name: 'List', icon: ListIcon },
      { id: 'gantt', name: 'Gantt', icon: GanttIcon },
      { id: 'mindmap', name: 'Mind Map', icon: MindMapIcon },
      { id: 'calendar', name: 'Calendar', icon: CalendarIcon },
      { id: 'resources', name: 'Resources', icon: BookmarkSquareIcon },
    ];
    if (isMobile) {
        return all.filter(b => ['list', 'calendar', 'resources'].includes(b.id));
    }
    return all;
  }, [isMobile]);

  useEffect(() => {
    setProjectView(initialView);
  }, [initialView, project.id]);

  // --- Handlers ---
  const handleAddTask = async (taskName: string, startDate?: string, endDate?: string) => {
    const newTask: Task = { id: `task-${Date.now()}`, name: taskName, description: '', completed: false, subtasks: [], startDate, endDate };
    await addTask(project.id, newTask);
  };
  
  const handleUpdateTask = async (updatedTask: Task) => { await updateTask(project.id, updatedTask); };
  const handleDeleteTask = async (taskId: string) => { await deleteTask(project.id, taskId); };
  const handleAddSubtask = async (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => {
      const newSubtask: Task = { id: `task-${Date.now()}`, name: subtaskName, description: '', completed: false, subtasks: [], startDate, endDate };
      await addSubtask(project.id, parentId, newSubtask);
  };

  const handleExport = (type: 'image' | 'csv' | 'doc') => {
      if (type === 'image') {
          downloadImage(`${project.name}-${projectView}.png`);
      } else if (type === 'csv') {
          exportTasksToCsv(project.tasks, project.name);
      } else {
          exportTasksToDoc(project.tasks, project.name);
      }
  };

  const viewProps = { onAddTask: handleAddTask, onUpdateTask: handleUpdateTask, onDeleteTask: handleDeleteTask, onAddSubtask: handleAddSubtask };
    
  useEffect(() => {
    if (isMobile) {
      if (!['list', 'calendar', 'resources'].includes(projectView)) {
        setProjectView('list');
      }
    }
  }, [isMobile, projectView]);

  const renderView = () => {
    switch (projectView) {
        case 'list': return <ListView ref={viewRef} {...viewProps} />;
        case 'gantt': return <GanttChartView ref={viewRef} {...viewProps} />;
        case 'mindmap': return <MindMapView ref={viewRef} {...viewProps} />;
        case 'calendar': return <CalendarView ref={viewRef} {...viewProps} />;
        case 'resources': return <ProjectResourcesView ref={viewRef} project={project} onAddResource={onAddResource} />;
        default: return <ListView ref={viewRef} {...viewProps} />;
    }
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      <header className="mb-4 shrink-0">
        <Breadcrumb 
            previousView={previousView}
            project={project}
            projectGroups={projectGroups}
            onGoBack={onGoBack}
        />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-2">
           <h1 className="text-2xl md:text-3xl font-bold text-text-primary flex items-center gap-3">
             <span className="text-3xl">{project.icon || '📁'}</span>
             {project.name}
           </h1>
           <div className="flex items-center space-x-2">
                <ExportDropdown 
                    onExportImage={() => handleExport('image')}
                    onExportCsv={() => handleExport('csv')}
                    onExportDoc={() => handleExport('doc')}
                />
                <div className="bg-app-background border border-border-color p-1 rounded-full flex space-x-1">
                    {viewButtons.map(button => (
                        <button
                            key={button.id}
                            onClick={() => setProjectView(button.id as ProjectView)}
                            className={`flex items-center space-x-2 py-1.5 px-3 text-sm font-medium rounded-full transition-colors shrink-0 ${
                                projectView === button.id
                                ? 'bg-accent-blue text-white'
                                : 'text-text-secondary hover:text-text-primary hover:bg-card-background'
                            }`}
                        >
                            <button.icon className="w-5 h-5" />
                            <span className="hidden md:inline">{button.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
        <div className="mt-4 flex items-center space-x-4">
            <div className="w-full bg-border-color rounded-full h-2"><div className="bg-accent-blue h-2 rounded-full" style={{ width: `${progress}%` }}></div></div>
            <span className="text-sm font-medium text-text-secondary">{Math.round(progress)}%</span>
        </div>
      </header>
      
      <div className="flex-grow overflow-hidden mt-4">
        {renderView()}
      </div>
    </div>
  );
};

export default TaskList;