import React, { useState, useEffect, memo, useRef } from 'react';
import { Task, Project } from '../types';
import { TrashIcon, ChevronRightIcon, CornerDownRightIcon, EditIcon, ImageIcon, UploadIcon } from './IconComponents';
// FIX: Removed unused import for generateImageForTask
import Spinner from './Spinner';
import { useProject } from '../contexts/ProjectContext';

interface TaskItemProps {
  task: Task;
  level: number;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAddSubtask: (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => void;
  // Optional props for global views
  projects?: Project[];
  currentProjectId?: string;
  onMoveProject?: (targetProjectId: string) => void;
}

const CustomCheckbox: React.FC<{ checked: boolean; onChange: () => void; colorClass: string }> = ({ checked, onChange, colorClass }) => {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
        checked ? `${colorClass} border-transparent` : 'bg-card-background border-border-color'
      }`}
    >
      {checked && (
        <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="currentColor">
          <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
        </svg>
      )}
    </button>
  );
};

// Use a consistent, timezone-safe date formatter
const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const TaskItem: React.FC<TaskItemProps> = ({ task, level, onUpdate, onDelete, onAddSubtask, projects, currentProjectId, onMoveProject }) => {
    const { projectGroups } = useProject();
    const project = projects?.find(p => p.id === currentProjectId);
    const group = project ? projectGroups.find(g => g.id === project.groupId) : null;
    const colorClass = group ? group.color.replace('bg-', 'bg-brand-') : 'bg-accent-blue';

    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [isAddingSubtask, setIsAddingSubtask] = useState(false);
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [newSubtaskStartDate, setNewSubtaskStartDate] = useState('');
    const [newSubtaskEndDate, setNewSubtaskEndDate] = useState('');
    
    const [showSaved, setShowSaved] = useState(false);
    const saveTimeoutRef = useRef<number | null>(null);

    const triggerSaveAnimation = () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        setShowSaved(true);
        saveTimeoutRef.current = window.setTimeout(() => {
            setShowSaved(false);
        }, 2000);
    };
    
    const handleUpdate = (updates: Partial<Task>) => {
        onUpdate({ ...task, ...updates });
        triggerSaveAnimation();
    };
    
    const handleToggleComplete = () => {
        const newCompletedStatus = !task.completed;
        const completionDate = newCompletedStatus ? formatDate(new Date()) : undefined;

        const toggleChildren = (tasks: Task[], completed: boolean, date?: string): Task[] => {
            return tasks.map(t => ({
                ...t,
                completed,
                completionDate: date,
                subtasks: t.subtasks ? toggleChildren(t.subtasks, completed, date) : []
            }));
        };
        
        onUpdate({ 
            ...task, 
            completed: newCompletedStatus,
            completionDate,
            subtasks: toggleChildren(task.subtasks, newCompletedStatus, completionDate)
        });
    };

    const handleSubtaskFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newSubtaskName.trim()) {
            onAddSubtask(task.id, newSubtaskName.trim(), newSubtaskStartDate, newSubtaskEndDate);
            setNewSubtaskName('');
            setNewSubtaskStartDate('');
            setNewSubtaskEndDate('');
            setIsAddingSubtask(false);
            setIsExpanded(true);
        }
    };
    
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;

    return (
        <div style={{ paddingLeft: `${level * 1.5}rem` }}>
            <div 
                className={`flex items-center p-3 rounded-xl transition-colors ${task.completed ? 'bg-app-background' : 'bg-card-background shadow-card'}`}
            >
                <div className="flex items-center space-x-3 flex-grow min-w-0">
                     <button onClick={() => setIsExpanded(!isExpanded)} className={`p-1 text-text-secondary hover:text-text-primary ${!hasSubtasks && 'invisible'}`}>
                        <ChevronRightIcon className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    <CustomCheckbox checked={task.completed} onChange={handleToggleComplete} colorClass={colorClass} />
                    <span className={`text-base truncate ${task.completed ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                        {task.name}
                    </span>
                </div>
                <div className="flex items-center space-x-2 md:space-x-1">
                    <button onClick={() => setIsDetailsExpanded(prev => !prev)} className="p-2 text-text-secondary hover:text-accent-blue" title="Edit details">
                        <EditIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsAddingSubtask(true)} className="p-2 text-text-secondary hover:text-accent-blue" title="Add sub-task">
                        <CornerDownRightIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onDelete(task.id)} className="p-2 text-text-secondary hover:text-accent-red" title="Delete task">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {isDetailsExpanded && (
                <div className="py-2 px-4 space-y-3 bg-card-background rounded-b-xl mb-2 relative" style={{ marginLeft: `3.5rem` }}>
                     {showSaved && (
                        <div className="absolute top-3 right-3 text-xs text-accent-green bg-green-100/50 px-2 py-0.5 rounded-full animate-fade-in-out z-10">
                            Saved
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                        <textarea
                            key={`${task.id}-desc`}
                            defaultValue={task.description}
                            onBlur={(e) => {
                                if (e.target.value !== task.description) {
                                    handleUpdate({ description: e.target.value });
                                }
                            }}
                            placeholder="Add a description..."
                            className="w-full bg-app-background border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                            rows={3}
                        />
                    </div>
                    <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-text-secondary mb-1">Start Date</label>
                            <input
                                key={`${task.id}-start`}
                                type="date"
                                defaultValue={task.startDate || ''}
                                onBlur={(e) => {
                                    if(e.target.value !== (task.startDate || '')) {
                                        handleUpdate({ startDate: e.target.value || undefined });
                                    }
                                }}
                                className="w-full bg-app-background border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-text-secondary mb-1">End Date</label>
                            <input
                                key={`${task.id}-end`}
                                type="date"
                                defaultValue={task.endDate || ''}
                                onBlur={(e) => {
                                    if(e.target.value !== (task.endDate || '')) {
                                        handleUpdate({ endDate: e.target.value || undefined });
                                    }
                                }}
                                min={task.startDate || undefined}
                                className="w-full bg-app-background border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                            />
                        </div>
                    </div>
                     {onMoveProject && projects && currentProjectId && (
                        <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Move to Project</label>
                            <select
                                defaultValue={currentProjectId}
                                onChange={(e) => onMoveProject(e.target.value)}
                                className="w-full bg-app-background border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                            >
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

             {isAddingSubtask && (
                <div className="my-2" style={{ paddingLeft: `3rem` }}>
                  <form onSubmit={handleSubtaskFormSubmit} className="space-y-2 p-3 bg-card-background rounded-xl">
                      <input
                          type="text"
                          value={newSubtaskName}
                          onChange={(e) => setNewSubtaskName(e.target.value)}
                          placeholder="New sub-task name..."
                          className="w-full bg-app-background border border-border-color rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
                          autoFocus
                      />
                      <div className="flex flex-col md:flex-row gap-2">
                          <input type="date" aria-label="Start Date" value={newSubtaskStartDate} onChange={(e) => setNewSubtaskStartDate(e.target.value)} max={newSubtaskEndDate || undefined} className="w-full bg-app-background border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                          <input type="date" aria-label="End Date" value={newSubtaskEndDate} onChange={(e) => setNewSubtaskEndDate(e.target.value)} min={newSubtaskStartDate || undefined} className="w-full bg-app-background border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                      </div>
                      <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setIsAddingSubtask(false)} className="px-3 py-1 text-sm rounded-md bg-app-background hover:bg-border-color">Cancel</button>
                          <button type="submit" className="px-3 py-1 text-sm rounded-md text-white bg-accent-blue hover:opacity-90">Add Sub-task</button>
                      </div>
                  </form>
                </div>
            )}
            {isExpanded && hasSubtasks && (
                <div className="space-y-2 mt-2">
                    {task.subtasks.map(subtask => (
                        <TaskItem 
                            key={subtask.id}
                            task={subtask}
                            level={level + 1}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            onAddSubtask={onAddSubtask}
                            projects={projects}
                            currentProjectId={currentProjectId}
                            onMoveProject={onMoveProject}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default memo(TaskItem);