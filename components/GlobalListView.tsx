import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useInbox } from '../contexts/InboxContext';
import { TrashIcon, MicrophoneIcon, PlusIcon, ArrowLongRightIcon } from './IconComponents';
import { InboxTask, Task, ProjectGroup } from '../types';
import { useSpeechToText } from '../hooks/useSpeechToText';
import Spinner from './Spinner';
import { Skeleton } from './Skeleton';
import { useNotification } from '../contexts/NotificationContext';
import { useProject } from '../contexts/ProjectContext';

const CustomCheckbox: React.FC<{
    checked: boolean;
    onChange: () => void;
    indeterminate?: boolean;
    disabled?: boolean;
}> = ({ checked, onChange, indeterminate, disabled }) => {
    const ref = useRef<HTMLInputElement>(null!);
    useEffect(() => {
        ref.current.indeterminate = indeterminate ?? false;
    }, [indeterminate]);

    return (
        <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="h-5 w-5 rounded text-accent-blue border-border-color focus:ring-accent-blue disabled:opacity-50"
        />
    );
};

const MoveToProjectPopover: React.FC<{
    anchorEl: HTMLElement | null;
    onClose: () => void;
    onMove: (projectId: string) => void;
}> = ({ anchorEl, onClose, onMove }) => {
    const { visibleProjects, projectGroups } = useProject();
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && anchorEl && !anchorEl.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose, anchorEl]);

    if (!anchorEl) return null;

    const rect = anchorEl.getBoundingClientRect();
    const popoverWidth = 256;
    const bottom = window.innerHeight - rect.top + 4; // 4px above the anchor
    const left = rect.left + window.scrollX - (popoverWidth / 2) + (rect.width / 2);

    return (
        <div
            ref={popoverRef}
            style={{ bottom: `${bottom}px`, left: `${left}px`, width: `${popoverWidth}px` }}
            className="fixed bg-card-background border border-border-color rounded-lg shadow-soft z-50 max-h-80 overflow-y-auto p-2 animate-fade-in"
        >
            <h4 className="text-xs font-semibold text-text-secondary px-2 mb-1">Move to Project</h4>
            {projectGroups.map(group => {
                const groupProjects = visibleProjects.filter(p => p.groupId === group.id);
                if (groupProjects.length === 0) return null;

                return (
                    <div key={group.id}>
                        <h5 className="text-xs text-text-secondary px-2 my-1 flex items-center gap-2">
                             <span className={`w-2 h-2 rounded-full ${group.color} mr-1`}></span>
                             {group.name}
                        </h5>
                        {groupProjects.map(project => (
                             <button
                                key={project.id}
                                onClick={() => onMove(project.id)}
                                className="w-full text-left text-sm text-text-primary hover:bg-app-background rounded-md px-2 py-1.5 flex items-center gap-2"
                             >
                                 <span className="text-lg">{project.icon || '📁'}</span>
                                 <span className="truncate">{project.name}</span>
                             </button>
                        ))}
                    </div>
                );
            })}
        </div>
    );
};


const GlobalListView: React.FC = () => {
    const { tasks: inboxTasks, addMultipleTasks, deleteMultipleTasks, loading: inboxLoading } = useInbox();
    const { addMultipleTasks: addTasksToProject, projects } = useProject();
    const { showNotification } = useNotification();
    
    const [textInput, setTextInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const [movePopoverAnchor, setMovePopoverAnchor] = useState<HTMLElement | null>(null);

    const handleVoiceError = useCallback((error: string) => {
        showNotification({ message: error, type: 'error' });
    }, [showNotification]);

    const handleAddTaskFromVoice = (taskName: string) => { 
        if (taskName) addMultipleTasks([taskName]); 
    };
    const { isListening, transcript, startListening, stopListening } = useSpeechToText({ 
        onTranscriptFinalized: handleAddTaskFromVoice,
        onError: handleVoiceError,
    });

    const handleAddTasks = async () => {
        const taskNames = textInput.split('\n').filter(name => name.trim() !== '');
        if (taskNames.length === 0 || isProcessing) return;

        setIsProcessing(true);
        try {
            await addMultipleTasks(taskNames);
            setTextInput('');
        } catch (error) {
            console.error("Failed to add multiple tasks:", error);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleSelectionChange = (taskId: string) => {
        setSelectedTaskIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) {
                newSet.delete(taskId);
            } else {
                newSet.add(taskId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedTaskIds.size === inboxTasks.length) {
            setSelectedTaskIds(new Set());
        } else {
            setSelectedTaskIds(new Set(inboxTasks.filter(t => !t.isPending).map(t => t.id)));
        }
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Are you sure you want to delete ${selectedTaskIds.size} task(s)? This action cannot be undone.`)) {
            deleteMultipleTasks(Array.from(selectedTaskIds));
            setSelectedTaskIds(new Set());
        }
    };

    const handleBulkMove = (projectId: string) => {
        const tasksToMove = inboxTasks.filter(t => selectedTaskIds.has(t.id));
        if (tasksToMove.length === 0) return;

        const newProjectTasks: Task[] = tasksToMove.map(t => ({
            id: `task-${Date.now()}-${t.id.slice(-6)}`,
            name: t.name,
            description: '',
            completed: false,
            subtasks: [],
        }));

        addTasksToProject(projectId, newProjectTasks);
        deleteMultipleTasks(tasksToMove.map(t => t.id));

        const project = projects.find(p => p.id === projectId);
        showNotification({ message: `${tasksToMove.length} task(s) moved to "${project?.name || 'project'}"`, type: 'success' });
        
        setSelectedTaskIds(new Set());
        setMovePopoverAnchor(null);
    };

    const nonPendingTasks = inboxTasks.filter(t => !t.isPending);

    return (
        <>
            <div className="max-w-4xl mx-auto h-full flex flex-col p-4 md:p-6">
                <header className="mb-6 shrink-0">
                    <h1 className="text-3xl font-bold text-text-primary mb-2">Inbox</h1>
                    <p className="text-text-secondary">
                        Your capture space. Add tasks below, then select them to move or delete.
                    </p>
                </header>
                
                <div className="mb-4">
                    <div className="flex flex-col gap-2">
                        <textarea
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder="Add a new task...&#10;Add another task..."
                            className="flex-grow p-3 bg-app-background border border-border-color rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue"
                            rows={4}
                            disabled={isProcessing}
                        />
                        <div className="flex justify-between items-center">
                            <button
                                type="button"
                                onClick={isListening ? stopListening : startListening}
                                className={`p-3 rounded-lg transition-colors shrink-0 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-accent-blue hover:opacity-90'}`}
                                title={isListening ? "Stop Listening" : "Add with Voice"}
                            >
                                <MicrophoneIcon className="w-5 h-5 text-white" />
                            </button>
                            <button
                                type="button"
                                onClick={handleAddTasks}
                                disabled={!textInput.trim() || isProcessing}
                                className="flex items-center justify-center shrink-0 px-4 py-2 bg-accent-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                                aria-label="Add tasks"
                            >
                                {isProcessing ? <Spinner /> : <PlusIcon className="w-5 h-5" />}
                                <span className="ml-2">Add Task(s)</span>
                            </button>
                        </div>
                    </div>
                </div>

                {isListening && <div className="mb-4 p-2 bg-app-background rounded-lg border border-border-color"><p className="text-text-secondary text-sm">Listening: {transcript || "..."}</p></div>}
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                    {inboxLoading && inboxTasks.length === 0 ? (
                        <>
                            <Skeleton className="h-12 w-full rounded-lg" />
                            <Skeleton className="h-12 w-full rounded-lg" />
                            <Skeleton className="h-12 w-full rounded-lg" />
                        </>
                    ) : inboxTasks.length === 0 ? (
                        <div className="flex items-center justify-center text-center text-text-secondary h-full">
                            <p>Your inbox is empty.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 p-2 border-b border-border-color mb-2">
                                <CustomCheckbox
                                    checked={nonPendingTasks.length > 0 && selectedTaskIds.size === nonPendingTasks.length}
                                    indeterminate={selectedTaskIds.size > 0 && selectedTaskIds.size < nonPendingTasks.length}
                                    onChange={handleSelectAll}
                                    disabled={nonPendingTasks.length === 0}
                                />
                                <span className="text-sm font-semibold text-text-secondary">Select All</span>
                            </div>
                            {inboxTasks.map(task => (
                                <div key={task.id} className={`flex items-center gap-3 p-3 bg-app-background rounded-lg transition-opacity ${task.isPending ? 'opacity-50' : ''}`}>
                                    <CustomCheckbox checked={selectedTaskIds.has(task.id)} onChange={() => handleSelectionChange(task.id)} disabled={task.isPending} />
                                    <span className="text-text-primary truncate flex-grow">{task.name}</span>
                                    {task.isPending && <Spinner />}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
             {selectedTaskIds.size > 0 && (
                <div className="fixed bottom-0 left-1/2 -translate-x-1/2 mb-6 z-20">
                    <div className="bg-card-background border border-border-color rounded-lg shadow-soft p-2 flex items-center gap-4 animate-fade-in">
                        <span className="text-sm font-semibold px-2">{selectedTaskIds.size} selected</span>
                        <button
                            onClick={(e) => setMovePopoverAnchor(e.currentTarget)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-app-background rounded-md hover:bg-border-color"
                        >
                            <ArrowLongRightIcon className="w-5 h-5" />
                            Move
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-app-background rounded-md hover:bg-border-color text-accent-red"
                        >
                            <TrashIcon className="w-5 h-5" />
                            Delete
                        </button>
                    </div>
                </div>
            )}
            <MoveToProjectPopover 
                anchorEl={movePopoverAnchor}
                onClose={() => setMovePopoverAnchor(null)}
                onMove={handleBulkMove}
            />
        </>
    );
};

export default GlobalListView;