import React, { useState, useEffect } from 'react';
import { ListIcon, GanttIcon, MindMapIcon, CalendarIcon, BookmarkSquareIcon, TrendingUpIcon, ImageIcon, TagIcon } from './IconComponents';
import { MainView } from '../App';

const ClickableAnimationStage: React.FC<{
    icon: React.ElementType;
    label: string;
    isHighlighted: boolean;
    onClick: () => void;
    className?: string;
}> = ({ icon: Icon, label, isHighlighted, onClick, className = '' }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center text-center group transition-transform duration-300 hover:scale-105 ${className}`}
    >
        <div className={`relative w-20 h-20 bg-card-background border-2 rounded-2xl flex items-center justify-center transition-all duration-300 ${isHighlighted ? 'border-accent-blue shadow-soft scale-110' : 'border-border-color'}`}>
            <Icon className={`w-10 h-10 transition-colors ${isHighlighted ? 'text-accent-blue' : 'text-text-secondary/50 group-hover:text-text-secondary'}`} />
        </div>
        <span className={`mt-2 text-sm font-semibold transition-colors ${isHighlighted ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>{label}</span>
    </button>
);


const HomePage: React.FC<{ onNavigate: (view: MainView) => void; onManageGroups: () => void; }> = ({ onNavigate, onManageGroups }) => {
    const [stage, setStage] = useState(0);

    const stages = [
        { core: true, views: false },
        { core: true, views: true },
        { core: false, views: false },
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setStage(prev => (prev + 1) % stages.length);
        }, 1500);

        return () => clearInterval(timer);
    }, [stages.length]);
    
    const currentStage = stages[stage];

    const views = [
        { id: 'list-inbox', label: 'List & Inbox', icon: ListIcon },
        { id: 'global-gantt', label: 'Gantt', icon: GanttIcon },
        { id: 'global-mindmap', label: 'Map', icon: MindMapIcon },
        { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
        { id: 'resources', label: 'Resources', icon: BookmarkSquareIcon },
        { id: 'habits', label: 'Habits', icon: TrendingUpIcon },
        { id: 'dreamboard', label: 'Dream Board', icon: ImageIcon },
    ];

    return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center overflow-hidden">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-bold text-text-primary tracking-tight">
                    One Brain, Many Views.
                    <span className="block text-accent-blue mt-2">Total Sync.</span>
                </h1>
                <p className="mt-4 max-w-2xl mx-auto text-base md:text-lg text-text-secondary">
                    Your central hub for total clarity. Click any view to get started. What you do in one place is instantly reflected everywhere else.
                </p>

                <div className="mt-6">
                    <button
                        onClick={onManageGroups}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-text-secondary bg-card-background border border-border-color rounded-lg hover:bg-app-background hover:text-text-primary transition-colors"
                    >
                        <TagIcon className="w-4 h-4" />
                        Manage Project Groups
                    </button>
                </div>

                <div className="mt-6 flex flex-col items-center gap-8">
                    {/* Core Hub */}
                    <div className="relative">
                        <div className={`relative w-28 h-28 bg-card-background border-2 rounded-full flex items-center justify-center transition-all duration-300 ${currentStage.core ? 'border-accent-blue shadow-soft scale-110' : 'border-border-color'}`}>
                            <span className={`font-bold text-lg transition-colors ${currentStage.core ? 'text-accent-blue' : 'text-text-secondary/50'}`}>Data Core</span>
                             {currentStage.views && <div className="absolute inset-0 bg-accent-blue/20 rounded-full animate-ping pointer-events-none"></div>}
                        </div>
                    </div>
                    
                    {/* Radiating Views */}
                    <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
                        {views.map(view => (
                            <ClickableAnimationStage
                                key={view.id}
                                icon={view.icon}
                                label={view.label}
                                isHighlighted={currentStage.views}
                                onClick={() => onNavigate(view.id as MainView)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;