import React, { useState } from 'react';
import { useInbox } from '../contexts/InboxContext';
import { TrashIcon, MicrophoneIcon, SparklesIcon } from './IconComponents';
import { InboxTask } from '../types';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { parseTextToTasks } from '../services/geminiService';
import Spinner from './Spinner';

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
    const [textInput, setTextInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAddTaskFromVoice = (taskName: string) => {
        if (taskName) {
            addTask(taskName);
        }
    };

    const { isListening, transcript, startListening, stopListening } = useSpeechToText({
        onTranscriptFinalized: handleAddTaskFromVoice,
    });

    const handleProcessText = async () => {
        if (!textInput.trim()) return;
        setIsProcessing(true);
        try {
            const taskNames = await parseTextToTasks(textInput);
            for (const name of taskNames) {
                await addTask(name);
            }
            setTextInput('');
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "An unknown error occurred.");
        } finally {
            setIsProcessing(false);
        }
    };


    return (
        <div className="max-w-4xl mx-auto h-full flex flex-col p-4">
            <header className="mb-6 shrink-0">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary mb-2">Inbox</h1>
                        <p className="text-text-secondary">
                            Your capture space. Add tasks, paste notes to convert, or drag items to a project.
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
            
            <div className="mb-4">
                <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste a list, meeting notes, or any text to convert into tasks..."
                    className="w-full h-24 p-3 bg-app-background border border-border-color rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    disabled={isProcessing}
                />
                <button
                    onClick={handleProcessText}
                    disabled={!textInput.trim() || isProcessing}
                    className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                    {isProcessing ? <Spinner/> : <SparklesIcon className="w-5 h-5" />}
                    {isProcessing ? 'Processing...' : 'Process Text into Tasks'}
                </button>
            </div>

            {tasks.length === 0 && !isListening ? (
                <div className="flex-grow flex items-center justify-center text-center text-text-secondary">
                    <p>Your inbox is empty. Add tasks via text, voice, or <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Ctrl+K</kbd>.</p>
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