import React, { useState, useEffect } from 'react';
import { ListIcon, GanttIcon, MindMapIcon, CalendarIcon, InboxIcon, ArrowLongRightIcon } from './IconComponents';
import Auth from './Auth';
import { useAuth } from '../contexts/AuthContext';

const AnimationStage: React.FC<{
    icon: React.ElementType;
    label: string;
    isHighlighted: boolean;
}> = ({ icon: Icon, label, isHighlighted }) => (
    <div className="flex flex-col items-center text-center">
        <div className={`relative w-20 h-20 bg-card-background border-2 rounded-2xl flex items-center justify-center transition-all duration-300 ${isHighlighted ? 'border-accent-blue shadow-soft scale-110' : 'border-border-color'}`}>
            <Icon className={`w-10 h-10 transition-colors ${isHighlighted ? 'text-accent-blue' : 'text-text-secondary/50'}`} />
        </div>
        <span className="mt-2 text-sm font-semibold">{label}</span>
    </div>
);


const HomePage: React.FC = () => {
    const { user } = useAuth();
    const [stage, setStage] = useState(0);

    const stages = [
        { inbox: true, core: false, views: false },
        { inbox: true, core: true, views: false },
        { inbox: false, core: true, views: true },
        { inbox: false, core: false, views: false }, // Reset state
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setStage(prev => (prev + 1) % stages.length);
        }, 1500); // Cycle through stages every 1.5 seconds

        return () => clearInterval(timer);
    }, [stages.length]);
    
    const currentStage = stages[stage];

    return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center overflow-hidden">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl md:text-6xl font-bold text-text-primary tracking-tight">
                    One Brain, Many Views.
                    <span className="block text-accent-blue mt-2">Total Sync.</span>
                </h1>
                <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-text-secondary">
                    Plan, visualize, and track your work without duplication. An item added to your inbox, calendar, or any view instantly populates everywhere else.
                </p>

                <div className="mt-12 flex flex-col items-center">
                    <div className="relative w-full flex items-center justify-center gap-4 md:gap-8">
                        {/* Animation Visual */}
                        <AnimationStage icon={InboxIcon} label="Inbox" isHighlighted={currentStage.inbox} />
                        <ArrowLongRightIcon className={`w-12 h-12 text-border-color transition-all duration-300 ${currentStage.core ? 'text-accent-blue scale-110' : ''}`} />
                        <div className="flex flex-col items-center">
                             <div className={`relative w-24 h-24 bg-card-background border-2 rounded-2xl flex items-center justify-center transition-all duration-300 ${currentStage.core ? 'border-accent-blue shadow-soft scale-110' : 'border-border-color'}`}>
                                <span className={`font-bold text-lg transition-colors ${currentStage.core ? 'text-accent-blue' : 'text-text-secondary/50'}`}>Data Core</span>
                                {currentStage.views && (
                                    <div className="absolute inset-0 bg-accent-blue/20 rounded-2xl animate-ping-slow pointer-events-none"></div>
                                )}
                            </div>
                             <span className="mt-2 text-sm font-semibold">Your Brain</span>
                        </div>
                        <ArrowLongRightIcon className={`w-12 h-12 text-border-color transition-all duration-300 ${currentStage.views ? 'text-accent-blue scale-110' : ''}`} />
                        <div className="grid grid-cols-2 gap-4">
                            <AnimationStage icon={ListIcon} label="List" isHighlighted={currentStage.views} />
                            <AnimationStage icon={GanttIcon} label="Gantt" isHighlighted={currentStage.views} />
                            <AnimationStage icon={MindMapIcon} label="Map" isHighlighted={currentStage.views} />
                            <AnimationStage icon={CalendarIcon} label="Calendar" isHighlighted={currentStage.views} />
                        </div>
                    </div>
                </div>

                {!user && (
                    <div className="mt-16">
                        <p className="text-lg font-semibold mb-4">Get started for free.</p>
                        <Auth />
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomePage;