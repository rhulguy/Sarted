import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { useInbox } from '../contexts/InboxContext';
import { Task } from '../types';

const QuickAddTaskModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    projectId?: string | null;
}> = ({ isOpen, onClose, projectId }) => {
    const { addTask: addProjectTask } = useProject();
    const { addTask: addInboxTask } = useInbox();
    const [taskName, setTaskName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = taskName.trim();
        if (!trimmedName) return;

        if (projectId) {
            const newTask: Task = {
                id: `task-${Date.now()}`, name: trimmedName, completed: false,
                description: '', subtasks: [],
            };
            await addProjectTask(projectId, newTask);
        } else {
            await addInboxTask(trimmedName);
        }
        setTaskName('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-start pt-20 z-50" onClick={onClose}>
            <div className="bg-card-background rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={taskName}
                        onChange={e => setTaskName(e.target.value)}
                        placeholder={projectId ? 'Add new task to project...' : 'Add task to Inbox...'}
                        className="w-full bg-transparent border-b border-border-color text-lg p-4 focus:outline-none"
                    />
                </form>
            </div>
        </div>
    );
};

export default QuickAddTaskModal;