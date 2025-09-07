import React, { useState, useEffect, memo, useRef } from 'react';
import { Task, Project } from '../types';
import { TrashIcon, ChevronRightIcon, CornerDownRightIcon, EditIcon, ImageIcon, UploadIcon } from './IconComponents';
import { generateImageForTask } from '../services/geminiService';
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

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });


const TaskItem: React.FC<TaskItemProps> = ({ task, level, onUpdate, onDelete, onAddSubtask, projects, currentProjectId, onMoveProject }) => {
    const { projectGroups } = useProject();
    const project = projects?.find(p => p.id === currentProjectId);
    const group = project ? projectGroups.find(g => g.id === project.groupId) : null;
    const colorClass = group ? group.color.replace('bg-', 'bg-brand-') : 'bg-accent-blue';

    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
    const [description, setDescription] = useState(task.description);
    const [startDate, setStartDate] = useState(task.startDate || '');
    const [endDate, setEndDate] = useState(task.endDate || '');
    const [isExpanded, setIsExpanded] = useState(true);
    const [isAddingSubtask, setIsAddingSubtask] = useState(false);
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [newSubtaskStartDate, setNewSubtaskStartDate] = useState('');
    const [newSubtaskEndDate, setNewSubtaskEndDate] = useState('');
    const [generatingImage, setGeneratingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        setDescription(task.description);
        setStartDate(task.startDate || '');
        setEndDate(task.endDate || '');
    }, [task]);

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

    const handleDescriptionBlur = () => {
        if (description !== task.description) {
            onUpdate({ ...task, description });
        }
    };

    const handleDateChange = (type: 'start' | 'end', value: string) => {
        if (type === 'start') {
            setStartDate(value);
            onUpdate({ ...task, startDate: value || undefined });
        } else {
            setEndDate(value);
            onUpdate({ ...task, endDate: value || undefined });
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
        setGeneratingImage(true);
        try {
            const imageUrl = await generateImageForTask(task.name);
            onUpdate({ ...task, imageUrl });
        } catch (error) {
            console.error("Failed to generate image for task:", error);
            alert("Could not generate image. Please check the console for details.");
        } finally {
            setGeneratingImage(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          const base64 = await fileToBase64(file);
          onUpdate({ ...task, imageUrl: base64 });
        } catch (error) {
          console.error("Error converting file to base64", error);
          alert("Could not upload image. Please try another file.");
        }
      }
    };

    const handleRemoveImage = () => {
      onUpdate({ ...task, imageUrl: undefined });
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
                    <button onClick={() => setIsDetailsExpanded(o => !o)} className="p-2 text-text-secondary hover:text-accent-blue" title="Edit details">
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
                <div className="py-2 px-4 space-y-3 bg-card-background rounded-b-xl mb-2" style={{ marginLeft: `3.5rem` }}>
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            onBlur={handleDescriptionBlur}
                            placeholder="Add a description..."
                            className="w-full bg-app-background border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                            rows={3}
                        />
                    </div>
                     <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Image</label>
                        <div className="mt-1 flex items-center gap-4">
                            {task.imageUrl ? (
                                <div className="relative group">
                                    <img src={task.imageUrl} alt="Task visual" className="h-24 w-24 rounded-lg object-cover" />
                                    <button 
                                    onClick={handleRemoveImage}
                                    title="Remove Image"
                                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                    <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                            <div className="flex gap-2">
                                <button onClick={handleGenerateImage} disabled={generatingImage} className="flex items-center gap-2 px-3 py-2 text-sm bg-app-background rounded-lg hover:bg-border-color disabled:opacity-50">
                                    {generatingImage ? <Spinner /> : <ImageIcon className="w-5 h-5" />}
                                    <span>{generatingImage ? 'Generating...' : 'Generate AI'}</span>
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-sm bg-app-background rounded-lg hover:bg-border-color">
                                    <UploadIcon className="w-5 h-5" />
                                    <span>Upload</span>
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                            </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-text-secondary mb-1">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleDateChange('start', e.target.value)}
                                max={endDate || undefined}
                                className="w-full bg-app-background border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-text-secondary mb-1">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => handleDateChange('end', e.target.value)}
                                min={startDate || undefined}
                                className="w-full bg-app-background border border-border-color rounded-md p-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                            />
                        </div>
                    </div>
                     {onMoveProject && projects && currentProjectId && (
                        <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Move to Project</label>
                            <select
                                value={currentProjectId}
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