import React, { useState, useCallback, useMemo } from 'react';
import { useInbox } from '../contexts/InboxContext';
import { useProject } from '../contexts/ProjectContext';
import { TrashIcon, MicrophoneIcon, SparklesIcon, ChevronRightIcon } from './IconComponents';
import { InboxTask, Task, Project } from '../types';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { parseTextToTasks } from '../services/geminiService';
import Spinner from './Spinner';
import TaskItem from './TaskItem';
import { Skeleton } from './Skeleton';
import { useNotification } from '../contexts/NotificationContext';
import { ApiError } from '../types';

const InboxItem: React.FC<{ task: InboxTask }> = ({ task }) => {
    const { deleteTask } = useInbox();

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('inboxTask', JSON.stringify(task));
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            className="flex items-center justify-between p-3 bg-app-background rounded-lg cursor-grab group"
        >
            <span className="text-text-primary">{task.name}</span>
            <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400"
                title="Delete task from inbox"
            >
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

const GlobalListViewSkeleton: React.FC = () => (
    <div className="max-w-4xl mx-auto h-full flex flex-col p-4 md:p-6 animate-pulse">
        <header className="mb-6 shrink-0">
            <Skeleton className="h-9 w-3/4 mb-2" />
            <Skeleton className="h-5 w-full" />
        </header>
        <div className="flex-grow overflow-y-auto pr-2 space-y-8">
            <section>
                <Skeleton className="h-7 w-1/4 mb-3" />
                <Skeleton className="h-24 w-full mb-2" />
                <Skeleton className="h-10 w-full" />
                <div className="space-y-2 mt-4">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                </div>
            </section>
            <section>
                <Skeleton className="h-7 w-1/3 mb-3" />
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </section>
        </div>
    </div>
);

const GlobalListView: React.FC = () => {
    const { tasks: inboxTasks, addTask: addInboxTask, addMultipleTasks, deleteTask: deleteInboxTask, loading: inboxLoading } = useInbox();
    const { visibleProjects, projectGroups, updateTask, deleteTask, addSubtask, moveTask, projects, loading: projectLoading, addTask: addProjectTask } = useProject();
    const { showNotification } = useNotification();
    
    const [textInput, setTextInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
    const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);

    const handleVoiceError = useCallback((error: string) => {
        showNotification({ message: error, type: 'error' });
    }, [showNotification]);

    const handleAddTaskFromVoice = (taskName: string) => { if (taskName) addInboxTask(taskName); };
    const { isListening, transcript, startListening, stopListening } = useSpeechToText({ 
        onTranscriptFinalized: handleAddTaskFromVoice,
        onError: handleVoiceError,
    });

    const handleProcessText = async () => {
        if (!textInput.trim()) return;
        setIsProcessing(true);
        try {
            const taskNames = await parseTextToTasks(textInput);
            if (taskNames.length === 0) {
                showNotification({ message: "No actionable tasks found in the text.", type: 'info' });
            } else {
                await addMultipleTasks(taskNames);
                showNotification({ message: `${taskNames.length} task(s) added to inbox.`, type: 'success' });
            }
            setTextInput('');
        } catch (error) {
            const message = error instanceof ApiError ? error.message : "Could not process text.";
            showNotification({ message, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDrop = (e: React.DragEvent, project: Project) => {
        e.preventDefault();
        setDragOverProjectId(null);
        const inboxTaskData = e.dataTransfer.getData("inboxTask");
        if (inboxTaskData) {
            try {
                const inboxTask: InboxTask = JSON.parse(inboxTaskData);
                
                deleteInboxTask(inboxTask.id);
                
                const newTask: Task = {
                    id: `task-${Date.now()}`,
                    name: inboxTask.name,
                    description: '',
                    completed: false,
                    subtasks: [],
                };
                addProjectTask(project.id, newTask);

                showNotification({ message: `"${inboxTask.name}" moved to "${project.name}".`, type: 'success' });

            } catch (error) {
                showNotification({ message: "Could not move task.", type: 'error' });
            }
        }
    };


    const toggleGroup = (groupId: string) => setCollapsedGroups(prev => {
        const newSet = new Set(prev);
        newSet.has(groupId) ? newSet.delete(groupId) : newSet.add(groupId);
        return newSet;
    });

    const toggleProject = (projectId: string) => setCollapsedProjects(prev => {
        const newSet = new Set(prev);
        newSet.has(projectId) ? newSet.delete(projectId) : newSet.add(projectId);
        return newSet;
    });

    const onUpdateTask = (projectId: string) => async (updatedTask: Task) => await updateTask(projectId, updatedTask);
    const onDeleteTask = (projectId: string) => async (taskId: string) => await deleteTask(projectId, taskId);
    const onAddSubtask = (projectId: string) => async (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => {
        const newSubtask: Task = { id: `task-${Date.now()}`, name: subtaskName, completed: false, description: '', subtasks: [], startDate, endDate };
        await addSubtask(projectId, parentId, newSubtask);
    };
    const onMoveProject = (sourceProjectId: string) => async (targetProjectId: string, task: Task) => {
        await moveTask(sourceProjectId, targetProjectId, task);
    };

    const projectsByGroup = useMemo(() => {
        return projectGroups
            .map(group => ({ ...group, projects: visibleProjects.filter(p => p.groupId === group.id) })) // Keep projects even if they have no tasks
            .filter(g => g.projects.length > 0)
            .sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
    }, [visibleProjects, projectGroups]);

    if (inboxLoading || projectLoading) {
        return <GlobalListViewSkeleton />;
    }

    return (
        <div className="max-w-4xl mx-auto h-full flex flex-col p-4 md:p-6">
            <header className="mb-6 shrink-0">
                <h1 className="text-3xl font-bold text-text-primary mb-2">List & Inbox</h1>
                <p className="text-text-secondary">Capture ideas in your inbox, or get a complete overview of every task across all your projects.</p>
            </header>

            <div className="flex-grow overflow-y-auto pr-2 space-y-8">
                <section>
                    <h2 className="text-xl font-semibold mb-3">Inbox</h2>
                    <div className="mb-4">
                        <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Paste notes to convert into tasks..." className="w-full h-24 p-3 bg-app-background border border-border-color rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue" disabled={isProcessing}/>
                        <div className="flex gap-2 mt-2">
                            <button onClick={handleProcessText} disabled={!textInput.trim() || isProcessing} className="flex-grow flex items-center justify-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50"><SparklesIcon className="w-5 h-5" />{isProcessing ? 'Processing...' : 'Process Text'}</button>
                            <button onClick={isListening ? stopListening : startListening} className={`p-3 rounded-lg transition-colors ${isListening ? 'bg-red-500 animate-pulse' : 'bg-accent-blue hover:opacity-90'}`} title={isListening ? "Stop Listening" : "Add with Voice"}><MicrophoneIcon className="w-5 h-5 text-white" /></button>
                        </div>
                        {isListening && <div className="mt-2 p-2 bg-app-background rounded-lg border border-border-color"><p className="text-text-secondary text-sm">Listening: {transcript || "..."}</p></div>}
                    </div>
                    <div className="space-y-2">
                        {inboxTasks.map(task => <InboxItem key={task.id} task={task} />)}
                    </div>
                    {inboxTasks.length === 0 && <p className="text-sm text-center text-text-secondary py-4">Your inbox is empty.</p>}
                </section>
                
                <section>
                    <h2 className="text-xl font-semibold mb-3">List</h2>
                    <div className="space-y-4">
                        {projectsByGroup.map(group => (
                            <div key={group.id}>
                                <button onClick={() => toggleGroup(group.id)} className="w-full flex items-center gap-2 p-2 text-left hover:bg-app-background rounded-lg">
                                    <ChevronRightIcon className={`w-4 h-4 transition-transform ${!collapsedGroups.has(group.id) && 'rotate-90'}`} />
                                    <div className={`w-3 h-3 rounded-full ${group.color} shrink-0`}></div>
                                    <span className="font-semibold text-text-primary">{group.name}</span>
                                </button>
                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsedGroups.has(group.id) ? 'max-h-0 opacity-0' : 'max-h-[10000px] opacity-100'}`}>
                                    <div className="pl-4 mt-2 space-y-3">
                                        {group.projects.map(project => (
                                            <div 
                                                key={project.id}
                                                onDragOver={(e) => { e.preventDefault(); setDragOverProjectId(project.id); }}
                                                onDragEnter={() => setDragOverProjectId(project.id)}
                                                onDragLeave={() => setDragOverProjectId(null)}
                                                onDrop={(e) => handleDrop(e, project)}
                                                className={`rounded-lg transition-colors ${dragOverProjectId === project.id ? 'bg-accent-blue/10' : ''}`}
                                            >
                                                <button onClick={() => toggleProject(project.id)} className="w-full flex items-center gap-2 p-1 text-left hover:bg-app-background rounded-lg">
                                                    <ChevronRightIcon className={`w-3 h-3 transition-transform ${!collapsedProjects.has(project.id) && 'rotate-90'}`} />
                                                    <span className="text-lg">{project.icon || '📁'}</span>
                                                    <span className="text-sm font-medium text-text-secondary">{project.name}</span>
                                                </button>
                                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsedProjects.has(project.id) ? 'max-h-0 opacity-0' : 'max-h-[10000px] opacity-100'}`}>
                                                    <div className="pl-6 mt-1 space-y-2">
                                                        {project.tasks.length > 0 ? project.tasks.map(task => (
                                                            <TaskItem 
                                                                key={task.id} task={task} level={0}
                                                                onUpdate={onUpdateTask(project.id)}
                                                                onDelete={onDeleteTask(project.id)}
                                                                onAddSubtask={onAddSubtask(project.id)}
                                                                projects={projects} currentProjectId={project.id}
                                                                onMoveProject={(targetProjectId) => onMoveProject(project.id)(targetProjectId, task)}
                                                            />
                                                        )) : (
                                                            <p className="text-xs text-text-secondary pl-2 pb-2">No tasks yet. Drag an inbox item here to add one.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default GlobalListView;