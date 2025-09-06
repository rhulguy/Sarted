import React from 'react';
import { useInbox } from '../contexts/InboxContext';
import { TrashIcon, MicrophoneIcon } from './IconComponents';
import { InboxTask } from '../types';
import { useSpeechToText } from '../hooks/useSpeechToText';

const InboxItem: React.FC<{ task: InboxTask }> = ({ task }) => {
    const { deleteTask } = useInbox();

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('inboxTask', JSON.stringify(task));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDelete = () => {
        deleteTask(task.id);
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            className="flex items-center justify-between p-3 bg-app-background rounded-lg cursor-grab group"
        >
            <span className="text-text-primary">{task.name}</span>
            <button
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400"
                title="Delete task from inbox"
            >
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

const InboxView: React.FC = () => {
    const { tasks, addTask } = useInbox();

    const handleAddTaskFromVoice = (taskName: string) => {
        if (taskName) {
            addTask(taskName);
        }
    };

    const { isListening, transcript, startListening, stopListening } = useSpeechToText({
        onTranscriptFinalized: handleAddTaskFromVoice,
    });

    return (
        <div className="max-w-4xl mx-auto h-full flex flex-col">
            <header className="mb-6 shrink-0">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary mb-2">Inbox</h1>
                        <p className="text-text-secondary">
                            This is your capture space. Drag tasks to a project or use voice to add new ones.
                        </p>
                    </div>
                    <button
                        onClick={isListening ? stopListening : startListening}
                        className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-500 animate-pulse' : 'bg-accent-blue hover:opacity-90'}`}
                        title={isListening ? "Stop Listening" : "Add Tasks with Voice"}
                    >
                        <MicrophoneIcon className="w-6 h-6 text-white" />
                    </button>
                </div>
                 {isListening && (
                    <div className="mt-4 p-4 bg-app-background rounded-lg border border-border-color">
                        <p className="text-text-secondary text-sm mb-1">Listening... Say "next" after each task to add another.</p>
                        <p className="text-text-primary min-h-[1.5em]">{transcript || "..."}</p>
                    </div>
                )}
            </header>

            {tasks.length === 0 && !isListening ? (
                <div className="flex-grow flex items-center justify-center text-center text-text-secondary">
                    <p>Your inbox is empty. Use <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Ctrl+K</kbd> or the microphone to add tasks!</p>
                </div>
            ) : (
                <div className="space-y-2 overflow-y-auto">
                    {tasks.map(task => (
                        <InboxItem key={task.id} task={task} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default InboxView;