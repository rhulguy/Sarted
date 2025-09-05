import React from 'react';
import { PlusIcon, SartedLogoIcon } from './IconComponents';

interface WelcomePlaceholderProps {
    onNewProject: () => void;
}

export const WelcomePlaceholder: React.FC<WelcomePlaceholderProps> = ({ onNewProject }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
             <SartedLogoIcon className="w-16 h-16 mb-6" />
            <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome to sarted</h2>
            <p className="max-w-md text-text-secondary mb-6">
                Select a project from the sidebar to view its tasks, or create a new project to get started.
            </p>
            <button
                onClick={onNewProject}
                className="flex items-center space-x-2 px-6 py-3 bg-accent-blue text-white rounded-lg hover:opacity-90 transition-opacity"
            >
                <PlusIcon className="w-5 h-5" />
                <span>Create Your First Project</span>
            </button>
        </div>
    );
};