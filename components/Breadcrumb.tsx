import React from 'react';
import { MainView } from '../App';
import { Project, ProjectGroup } from '../types';
import { getIconForView } from '../utils/viewUtils';

const Breadcrumb: React.FC<{
    previousView: MainView;
    project: Project;
    projectGroups: ProjectGroup[];
    onGoBack: () => void;
}> = ({ previousView, project, projectGroups, onGoBack }) => {
    const group = projectGroups.find(g => g.id === project.groupId);
    const PreviousViewIcon = getIconForView(previousView);

    return (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
            <button onClick={onGoBack} className="flex items-center gap-1.5 hover:text-text-primary transition-colors p-1 -ml-1 rounded-md hover:bg-app-background">
                {PreviousViewIcon && <PreviousViewIcon className="w-4 h-4" />}
                <span>Back</span>
            </button>
            <span className="opacity-50">/</span>
            {group && (
                <>
                    <span>{group.name}</span>
                    <span className="opacity-50">/</span>
                </>
            )}
            <span className="font-semibold text-text-primary">{project.name}</span>
        </div>
    );
};

export default Breadcrumb;