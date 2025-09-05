import React, { useState } from 'react';
import { Task } from '../types';
import TaskItem from './TaskItem';
import { PlusIcon, DownloadIcon } from './IconComponents';
import { useProject } from '../contexts/ProjectContext';
import { useDownloadImage } from '../hooks/useDownloadImage';

interface ListViewProps {
  onAddTask: (taskName: string, startDate?: string, endDate?: string) => Promise<void>;
  onUpdateTask: (updatedTask: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAddSubtask: (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => Promise<void>;
}


const ListView: React.FC<ListViewProps> = ({ onAddTask, onUpdateTask, onDeleteTask, onAddSubtask }) => {
  const [newTaskName, setNewTaskName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const { selectedProject } = useProject();

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskName.trim() === '') return;
    await onAddTask(newTaskName.trim(), newStartDate, newEndDate);
    setNewTaskName('');
    setNewStartDate('');
    setNewEndDate('');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-grow overflow-y-auto p-1">
        <div className="space-y-2">
          <TaskItemRenderer tasks={selectedProject!.tasks} level={0} onUpdate={onUpdateTask} onDelete={onDeleteTask} onAddSubtask={onAddSubtask} />
        </div>
        <form onSubmit={handleFormSubmit} className="mt-4 p-3 bg-card-background rounded-xl shadow-card flex flex-col sm:flex-row gap-2 items-center">
          <div className="w-6 h-6 rounded-lg border-2 border-border-color shrink-0 hidden sm:block"></div>
          <input
            type="text"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="Add a new top-level task..."
            className="w-full bg-app-background border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
          <input
              aria-label="Start Date"
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="w-full sm:w-auto bg-app-background border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent-blue text-text-secondary"
          />
          <input
              aria-label="End Date"
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="w-full sm:w-auto bg-app-background border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent-blue text-text-secondary"
          />
          <button type="submit" className="flex items-center justify-center p-2 bg-accent-blue text-white rounded-lg hover:opacity-90 transition-opacity h-full">
            <PlusIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

// Helper component to avoid passing project tasks directly, which might not be updated yet
const TaskItemRenderer: React.FC<{
  tasks: Task[],
  level: number,
  onUpdate: (task: Task) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onAddSubtask: (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => Promise<void>;
}> = ({ tasks, level, onUpdate, onDelete, onAddSubtask }) => {
    const { projects, selectedProjectId } = useProject();
    return (
        <>
            {tasks.map(task => (
                <TaskItem
                    key={task.id}
                    task={task}
                    level={level}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onAddSubtask={onAddSubtask}
                    projects={projects}
                    currentProjectId={selectedProjectId!}
                />
            ))}
        </>
    );
}


export default ListView;