import React, { useState, useCallback } from 'react';
import { useInbox } from '../contexts/InboxContext';
import { TrashIcon, MicrophoneIcon, PlusIcon, DragHandleIcon } from './IconComponents';
import { InboxTask } from '../types';
import { useSpeechToText } from '../hooks/useSpeechToText';
import Spinner from './Spinner';
import { Skeleton } from './Skeleton';
import { useNotification } from '../contexts/NotificationContext';

const InboxItem: React.FC<{ task: InboxTask }> = ({ task }) => {
    const { deleteTask } = useInbox();

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (task.isPending) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('inboxTask', JSON.stringify(task));
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div
            draggable={!task.isPending}
            onDragStart={handleDragStart}
            className={`flex items-center justify-between p-3 bg-app-background rounded-lg group transition-opacity ${task.isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-grab'}`}
        >
            <div className="flex items-center gap-2">
                <DragHandleIcon className="w-5 h-5 text-text-secondary opacity-50 group-hover:opacity-100" />
                <span className="text-text-primary">{task.name}</span>
            </div>
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

const GlobalListView: React.FC = () => {
    // FIX: Renamed 'addInboxTask' to 'addTask' to match the function provided by the InboxContext.
    const { tasks: inboxTasks, addTask, addMultipleTasks, loading: inboxLoading } = useInbox();
    const { showNotification } = useNotification();
    
    const [textInput, setTextInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleVoiceError = useCallback((error: string) => {
        showNotification({ message: error, type: 'error' });
    }, [showNotification]);

    const handleAddTaskFromVoice = (taskName: string) => { if (taskName) addTask(taskName); };
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
            // The context function shows its own notification on failure
            console.error("Failed to add multiple tasks:", error);
        } finally {
            setIsProcessing(false);
        }
    };
    
    return (
        <div className="max-w-4xl mx-auto h-full flex flex-col p-4 md:p-6">
            <header className="mb-6 shrink-0">
                <h1 className="text-3xl font-bold text-text-primary mb-2">Inbox</h1>
                <p className="text-text-secondary">
                    Your capture space. Add tasks below (one per line), or drag them from here to a project in the sidebar.
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
                    inboxTasks.map(task => <InboxItem key={task.id} task={task} />)
                )}
            </div>
        </div>
    );
};

export default GlobalListView;