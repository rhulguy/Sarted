import React from 'react';
import { MainView } from '../App';
import { MindMapIcon, GanttIcon, CalendarIcon, BookmarkSquareIcon, ImageIcon, FolderIcon } from './IconComponents';

interface FocusViewProps {
    onNavigate: (view: MainView) => void;
}

const FocusCard: React.FC<{
    icon: React.ElementType;
    title: string;
    description: string;
    onClick: () => void;
    gradient: string;
}> = ({ icon: Icon, title, description, onClick, gradient }) => (
    <button
        onClick={onClick}
        className="group relative bg-card-background border border-border-color rounded-2xl p-6 text-left hover:shadow-soft hover:-translate-y-1 transition-all duration-300 flex flex-col items-start w-full overflow-hidden"
    >
        <div className={`absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${gradient}`}></div>
        <div className="relative z-10">
            <div className="bg-white/70 backdrop-blur-sm p-3 rounded-xl mb-4 inline-block">
                <Icon className="w-10 h-10 text-accent-blue" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">{title}</h3>
            <p className="text-text-secondary text-sm mt-1 flex-grow">{description}</p>
            <span className="mt-4 text-sm font-semibold text-accent-blue">Open View →</span>
        </div>
    </button>
);

const FocusView: React.FC<FocusViewProps> = ({ onNavigate }) => {

    const focusAreas = [
        {
            id: 'projects',
            icon: FolderIcon,
            title: 'Dashboard',
            description: 'Return to the main dashboard to see a high-level overview of your workspace.',
            gradient: 'bg-gradient-to-tr from-blue-200 to-indigo-200'
        },
        {
            id: 'global-mindmap',
            icon: MindMapIcon,
            title: 'Global Mind Map',
            description: 'Get a bird\'s-eye view of all your projects and their connections in one unified map.',
            gradient: 'bg-gradient-to-tr from-purple-200 to-pink-200'
        },
        {
            id: 'global-gantt',
            icon: GanttIcon,
            title: 'Global Gantt Chart',
            description: 'Visualize timelines and dependencies across every project on a single, powerful chart.',
            gradient: 'bg-gradient-to-tr from-teal-200 to-green-200'
        },
        {
            id: 'calendar',
            icon: CalendarIcon,
            title: 'Global Calendar',
            description: 'See all your scheduled tasks and habits from every project in a unified calendar view.',
            gradient: 'bg-gradient-to-tr from-orange-200 to-yellow-200'
        },
        {
            id: 'resources',
            icon: BookmarkSquareIcon,
            title: 'Resource Library',
            description: 'Access a central library of all your saved links, documents, and references.',
            gradient: 'bg-gradient-to-tr from-sky-200 to-cyan-200'
        },
        {
            id: 'dreamboard',
            icon: ImageIcon,
            title: 'Dream Board',
            description: 'Visualize your goals and dreams by generating inspirational AI images.',
            gradient: 'bg-gradient-to-tr from-rose-200 to-fuchsia-200'
        }
    ];

    return (
        <div className="h-full flex flex-col p-4 md:p-8">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-text-primary">Focus</h1>
                <p className="text-text-secondary mt-1 max-w-2xl">
                    Choose a high-level view to organize, plan, and visualize your work across all projects.
                </p>
            </header>
            <div className="flex-grow overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {focusAreas.map(area => (
                        <FocusCard
                            key={area.id}
                            icon={area.icon}
                            title={area.title}
                            description={area.description}
                            onClick={() => onNavigate(area.id as MainView)}
                            gradient={area.gradient}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FocusView;