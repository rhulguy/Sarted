import React, { useState, useEffect, memo } from 'react';
import { Task, Project } from '../types';
import { TrashIcon, ChevronRightIcon, CornerDownRightIcon, EditIcon, ImageIcon } from './IconComponents';
import { generateImageForTask } from '../services/geminiService';
import Spinner from './Spinner';

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

const TaskItem: React.FC<TaskItemProps> = ({ task, level, onUpdate, onDelete, onAddSubtask, projects, currentProjectId, onMoveProject }) => {
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
    const [description, setDescription] = useState(task.description);
    const [startDate, setStartDate] = useState(task.startDate || '');
    const [endDate, setEndDate] = useState(task.endDate || '');
    const [isExpanded, setIsExpanded] = useState(true);
    const [isAddingSubtask, setIsAddingSubtask] = useState(false);
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [newSubtaskStartDate, setNewSubtaskStartDate] = useState('');
    const [newSubtaskEndDate, setNewSubtaskEndDate] = useState('');
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    useEffect(() => {
        setDescription(task.description);
        setStartDate(task.startDate || '');
        setEndDate(task.endDate || '');
    }, [task]);

    const handleToggleComplete = () => {
        const toggleChildren = (tasks: Task[], completed: boolean): Task[] => {
            return tasks.map(t => ({
                ...t,
                completed,
                subtasks: t.subtasks ? toggleChildren(t.subtasks, completed) : []
            }));
        };
        const newCompletedStatus = !task.completed;
        onUpdate({ 
            ...task, 
            completed: newCompletedStatus,
            subtasks: toggleChildren(task.subtasks, newCompletedStatus)
        });
    };

    const handleDescriptionBlur = () => {
        if (description !== task.description) {
            onUpdate({ ...task, description });
        }
    };

    const handleStartDateBlur = () => {
        if (startDate !== (task.startDate || '')) {
            onUpdate({ ...task, startDate: startDate || undefined });
        }
    };
    
    const handleEndDateBlur = () => {
        if (endDate !== (task.endDate || '')) {
            onUpdate({ ...task, endDate: endDate || undefined });
        }
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

    const handleGenerateImage = async () => {
        setIsGeneratingImage(true);
        try {
            const imageUrl = await generateImageForTask(task.name);
            onUpdate({ ...task, imageUrl });
        } catch (error) {
            console.error("Failed to generate image for task:", error);
            alert("Could not generate image. Please check the console for details.");
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const hasSubtasks = task.subtasks && task.subtasks.length > 0;

    return (
        <div>
            <div 
                className={`flex items-center p-2 rounded-lg transition-colors ${task.completed ? 'bg-secondary' : 'bg-highlight'} md:group`}
                // Reduced indentation for better mobile view
                style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
            >
                <div className="flex items-center space-x-2 flex-grow min-w-0">
                    <button onClick={() => setIsExpanded(!isExpanded)} className={`p-1 text-text-secondary hover:text-text-primary ${!hasSubtasks && 'invisible'}`}>
                        <ChevronRightIcon className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={handleToggleComplete}
                        className="w-5 h-5 rounded bg-secondary border-border-color text-accent focus:ring-accent shrink-0"
                    />
                     {isGeneratingImage ? (
                        <div className="w-8 h-8 flex items-center justify-center shrink-0"><Spinner /></div>
                    ) : task.imageUrl && (
                        <img src={task.imageUrl} alt={task.name} className="w-8 h-8 rounded object-cover shrink-0" />
                    )}
                    <span 
                        onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                        className={`text-base cursor-pointer truncate ${task.completed ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                        {task.name}
                    </span>
                </div>
                {/* Action buttons are now always visible on mobile and appear on hover on desktop */}
                <div className="flex items-center space-x-2 md:space-x-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button onClick={handleGenerateImage} disabled={isGeneratingImage} className="p-2 text-text-secondary hover:text-accent disabled:opacity-50" title="Generate image with AI">
                        <ImageIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsAddingSubtask(true)} className="p-2 text-text-secondary hover:text-accent" title="Add sub-task">
                        <CornerDownRightIcon className="w-5 h-5" />
                    </button>
                    {/* Edit button is hidden on mobile. Tap the task name to edit. */}
                    <button onClick={() => setIsDetailsExpanded(!isDetailsExpanded)} className="hidden md:block p-2 text-text-secondary hover:text-accent" title="Edit details">
                        <EditIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onDelete(task.id)} className="p-2 text-text-secondary hover:text-red-500" title="Delete task">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {isDetailsExpanded && (
                <div className="py-2 space-y-3" style={{ paddingLeft: `${level * 1.5 + 2.5}rem` }}>
                    <div>
                        <label htmlFor={`description-${task.id}`} className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                        <textarea
                            id={`description-${task.id}`}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            onBlur={handleDescriptionBlur}
                            placeholder="Add a description..."
                            className="w-full bg-secondary border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                            rows={3}
                        />
                    </div>
                    <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
                        <div className="flex-1">
                            <label htmlFor={`start-date-${task.id}`} className="block text-xs font-medium text-text-secondary mb-1">Start Date</label>
                            <input
                                id={`start-date-${task.id}`}
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                onBlur={handleStartDateBlur}
                                max={endDate || undefined}
                                className="w-full bg-secondary border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                        </div>
                        <div className="flex-1">
                            <label htmlFor={`end-date-${task.id}`} className="block text-xs font-medium text-text-secondary mb-1">End Date</label>
                            <input
                                id={`end-date-${task.id}`}
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                onBlur={handleEndDateBlur}
                                min={startDate || undefined}
                                className="w-full bg-secondary border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                        </div>
                    </div>
                     {onMoveProject && projects && currentProjectId && (
                        <div>
                            <label htmlFor={`project-select-${task.id}`} className="block text-xs font-medium text-text-secondary mb-1">Project</label>
                            <select
                                id={`project-select-${task.id}`}
                                value={currentProjectId}
                                onChange={(e) => onMoveProject(e.target.value)}
                                className="w-full bg-secondary border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
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
                <form onSubmit={handleSubtaskFormSubmit} className="my-2 space-y-2" style={{ paddingLeft: `${(level + 1) * 1.5 + 0.5}rem` }}>
                    <input
                        type="text"
                        value={newSubtaskName}
                        onChange={(e) => setNewSubtaskName(e.target.value)}
                        placeholder="New sub-task name..."
                        className="w-full bg-secondary border border-border-color rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        autoFocus
                    />
                    <div className="flex flex-col md:flex-row gap-2">
                        <input
                            type="date"
                            aria-label="Start Date"
                            value={newSubtaskStartDate}
                            onChange={(e) => setNewSubtaskStartDate(e.target.value)}
                            max={newSubtaskEndDate || undefined}
                            className="w-full bg-secondary border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <input
                            type="date"
                            aria-label="End Date"
                            value={newSubtaskEndDate}
                            onChange={(e) => setNewSubtaskEndDate(e.target.value)}
                            min={newSubtaskStartDate || undefined}
                            className="w-full bg-secondary border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setIsAddingSubtask(false)} className="px-3 py-1 text-sm rounded-md bg-highlight hover:bg-gray-700">Cancel</button>
                        <button type="submit" className="px-3 py-1 text-sm rounded-md text-white bg-accent hover:bg-blue-500">Add Sub-task</button>
                    </div>
                </form>
            )}
            {isExpanded && hasSubtasks && (
                <div className="space-y-1">
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