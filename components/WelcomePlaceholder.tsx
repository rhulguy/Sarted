
import React from 'react';
import { PlusIcon } from './IconComponents';

interface WelcomePlaceholderProps {
    onNewProject: () => void;
}

export const WelcomePlaceholder: React.FC<WelcomePlaceholderProps> = ({ onNewProject }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
             <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome to Synergize</h2>
            <p className="max-w-md text-text-secondary mb-6">
                Select a project from the sidebar to view its tasks, or create a new project to get started.
            </p>
            <button
                onClick={onNewProject}
                className="flex items-center space-x-2 px-6 py-3 bg-accent text-white rounded-lg hover:bg-blue-500 transition-colors duration-200"
            >
                <PlusIcon className="w-5 h-5" />
                <span>Create Your First Project</span>
            </button>
        </div>
    );
};
