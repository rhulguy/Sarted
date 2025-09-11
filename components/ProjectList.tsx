import React, { useState } from 'react';
import { Task } from '../types';
import { PlusIcon, TagIcon, ArchiveBoxIcon, ArrowUturnLeftIcon, ChevronRightIcon } from './IconComponents';
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
    visibleProjects, archivedProjects, projectGroups, selectedProjectId, selectProject, 
    addTask, unarchiveProject
  } = useProject();
  const { deleteTask: deleteInboxTask } = useInbox();
  
  const [isDragOver, setIsDragOver] = useState<string | null>(null);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);

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

  return (
    <nav className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
            <div className="flex justify-between items-center mb-2 px-2">
                <h2 className="text-lg font-semibold text-text-primary">Projects</h2>
                <div className="flex items-center space-x-2">
                    <button onClick={onEditGroups} title="Manage Project Groups" className="text-text-secondary hover:text-text-primary p-1"><TagIcon className="w-5 h-5"/></button>
                </div>
            </div>

            {projectGroups.map(group => {
                const groupProjects = visibleProjects.filter(p => p.groupId === group.id);
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
                                className={`flex items-center justify-between text-sm py-2 pr-2 pl-2 rounded-lg group relative transition-colors ${
                                selectedProjectId === project.id ? 'bg-accent-blue text-white' : 'text-text-primary hover:bg-card-background'
                                } ${isDragOver === project.id ? 'bg-accent-blue/10 ring-2 ring-accent-blue' : ''}`}
                            >
                                <div className="flex items-center gap-2 truncate pl-2">
                                    <span className="text-lg">{project.icon || '📁'}</span>
                                    <span className="truncate">{project.name}</span>
                                </div>
                            </a>
                        </li>
                    ))}
                    </ul>
                </div>
                );
            })}
             {archivedProjects.length > 0 && (
                <div className="mt-6 border-t border-border-color pt-4">
                    <button onClick={() => setIsArchivedOpen(!isArchivedOpen)} className="flex justify-between items-center w-full px-2 text-sm font-semibold text-text-secondary">
                        <span>Archived</span>
                        <ChevronRightIcon className={`w-4 h-4 transition-transform ${isArchivedOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isArchivedOpen && (
                        <ul className="mt-2">
                            {archivedProjects.map(project => (
                                <li key={project.id} className="my-1">
                                    <div className="flex items-center justify-between text-sm py-2 px-4 rounded-lg group text-text-secondary">
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="text-lg">{project.icon || '📁'}</span>
                                            <span className="truncate italic">{project.name}</span>
                                        </div>
                                        <button onClick={() => unarchiveProject(project.id)} title="Restore Project" className="p-1 opacity-0 group-hover:opacity-100 hover:text-accent-blue">
                                            <ArrowUturnLeftIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
        <button 
            onClick={onNewProject}
            className="w-full flex items-center justify-center space-x-2 mt-4 px-4 py-2 bg-card-background border border-border-color text-text-primary rounded-lg hover:bg-border-color transition-colors"
        >
            <PlusIcon className="w-5 h-5" />
            <span>New Project</span>
        </button>
    </nav>
  );
};

export default ProjectList;