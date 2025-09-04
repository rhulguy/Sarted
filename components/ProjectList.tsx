import React, { useState, useRef, useEffect } from 'react';
import { ProjectGroup, Task } from '../types';
import { PlusIcon, TrashIcon, CogIcon, EyeIcon, EyeSlashIcon } from './IconComponents';
import { useProject } from '../contexts/ProjectContext';
import { useInbox } from '../contexts/InboxContext';

interface ProjectListProps {
  onNewProject: () => void;
  onEditGroups: () => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ 
    onNewProject,
    onEditGroups,
}) => {
  const { 
    projects, projectGroups, selectedProjectId, selectProject, deleteProject, 
    addTask, showHiddenProjects, setShowHiddenProjects, toggleProjectVisibility 
  } = useProject();
  const { deleteTask: deleteInboxTask } = useInbox();
  
  const [isDragOver, setIsDragOver] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if(window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
        deleteProject(projectId);
    }
  }

  const handleToggleVisibility = (e: React.MouseEvent, projectId: string, isHidden: boolean) => {
      e.stopPropagation();
      toggleProjectVisibility(projectId, !isHidden);
  }

  const handleDrop = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    setIsDragOver(null);
    const inboxTaskData = e.dataTransfer.getData("inboxTask");
    if (inboxTaskData) {
        const inboxTask = JSON.parse(inboxTaskData);
        deleteInboxTask(inboxTask.id);
        const newTask: Task = {
            id: `task-${Date.now()}`, name: inboxTask.name, description: '', completed: false, subtasks: [],
        };
        addTask(projectId, newTask);
        selectProject(projectId);
    }
  };
  
  const displayedProjects = showHiddenProjects ? projects : projects.filter(p => !p.isHidden);

  return (
    <nav className="flex flex-col h-full">
        <div className="flex-1">
            <div className="flex justify-between items-center mb-2 px-2">
                <h2 className="text-lg font-semibold text-text-primary">Projects</h2>
                <div className="flex items-center space-x-2">
                    <button onClick={onEditGroups} title="Edit Project Groups" className="text-text-secondary hover:text-text-primary p-1"><CogIcon className="w-5 h-5"/></button>
                    <div className="flex items-center space-x-1.5 text-sm text-text-secondary">
                        <label htmlFor="show-hidden" className="cursor-pointer">Show Hidden</label>
                        <button
                            id="show-hidden"
                            role="switch"
                            aria-checked={showHiddenProjects}
                            onClick={() => setShowHiddenProjects(!showHiddenProjects)}
                            className={`${showHiddenProjects ? 'bg-accent' : 'bg-gray-600'} relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-secondary`}
                        >
                            <span className={`${showHiddenProjects ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}/>
                        </button>
                    </div>
                </div>
            </div>

            {projectGroups.map(group => {
                const groupProjects = displayedProjects.filter(p => p.groupId === group.id);
                if (groupProjects.length === 0) return null;

                return (
                <div key={group.id} className="mb-4">
                    <h3 className="flex items-center text-sm font-semibold text-text-secondary mb-2 px-2">
                        <span className={`w-3 h-3 rounded-full ${group.color} mr-2`}></span>
                        {group.name}
                    </h3>
                    <ul>
                    {groupProjects.map(project => (
                        <li key={project.id} 
                            className="my-1"
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(project.id); }}
                            onDragLeave={() => setIsDragOver(null)}
                            onDrop={(e) => handleDrop(e, project.id)}
                        >
                            <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); selectProject(project.id); }}
                                className={`flex items-center justify-between text-sm py-2 pr-2 pl-5 rounded-lg group relative transition-colors ${
                                selectedProjectId === project.id ? 'bg-accent text-white' : 'text-text-primary hover:bg-highlight'
                                } ${isDragOver === project.id ? 'ring-2 ring-accent' : ''} ${project.isHidden ? 'opacity-50' : ''}`}
                            >
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${group.color}`}></div>
                                <span className="truncate">{project.name}</span>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => handleToggleVisibility(e, project.id, project.isHidden)} title={project.isHidden ? "Show Project" : "Hide Project"} className="p-1 text-text-secondary hover:text-accent">
                                        {project.isHidden ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
                                    </button>
                                    <button onClick={(e) => handleDelete(e, project.id)} className="p-1 text-red-400 hover:text-red-300">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </a>
                        </li>
                    ))}
                    </ul>
                </div>
                );
            })}
        </div>
        <button 
            onClick={onNewProject}
            className="w-full flex items-center justify-center space-x-2 mt-4 px-4 py-2 bg-highlight border border-border-color text-text-primary rounded-lg hover:bg-gray-700 transition-colors duration-200"
        >
            <PlusIcon className="w-5 h-5" />
            <span>New Project</span>
        </button>
    </nav>
  );
};

export default ProjectList;