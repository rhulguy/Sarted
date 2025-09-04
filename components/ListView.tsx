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
  const { ref, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
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
       <div className="flex justify-end p-2 shrink-0">
         <button 
            onClick={() => downloadImage(`${selectedProject?.name}-list-view.png`)} 
            disabled={isDownloading} 
            className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-highlight text-text-secondary rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>{isDownloading ? 'Exporting...' : 'Export'}</span>
          </button>
      </div>
      <div ref={ref} className="max-w-4xl mx-auto w-full flex-grow overflow-y-auto bg-primary p-1">
        <form onSubmit={handleFormSubmit} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 mb-6 items-center p-1">
          <input
            type="text"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="Add a new top-level task..."
            className="w-full bg-secondary border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
              aria-label="Start Date"
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="w-full bg-secondary border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent text-text-secondary"
          />
          <input
              aria-label="End Date"
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="w-full bg-secondary border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent text-text-secondary"
          />
          <button type="submit" className="flex items-center justify-center p-2 bg-accent text-white rounded-lg hover:bg-blue-500 transition-colors h-full">
            <PlusIcon className="w-5 h-5" />
          </button>
        </form>

        <div className="space-y-1">
          {/* We can safely assume project is not null because TaskList handles it */}
          <TaskItemRenderer tasks={selectedProject!.tasks} level={0} onUpdate={onUpdateTask} onDelete={onDeleteTask} onAddSubtask={onAddSubtask} />
        </div>
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
                />
            ))}
        </>
    );
}


export default ListView;