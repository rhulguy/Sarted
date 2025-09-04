import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { useHabit } from '../contexts/HabitContext';
import { generateFocusPlan, AIFocusPlan } from '../services/geminiService';
import { Task } from '../types';
import TaskItem from './TaskItem';
import Spinner from './Spinner';
import { SparklesIcon, CheckCircleIcon } from './IconComponents';

interface PrioritizedTask {
    task: Task;
    reason: string;
    projectId: string;
}

const FocusView: React.FC<{ onNewProject: () => void }> = ({ onNewProject }) => {
    const { visibleProjects, updateTask, deleteTask, addSubtask } = useProject();
    const { habits } = useHabit();
    const [priorities, setPriorities] = useState<PrioritizedTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const allTasksMap = useMemo(() => {
        const map = new Map<string, { task: Task, projectId: string }>();
        const traverse = (tasks: Task[], projectId: string) => {
            tasks.forEach(task => {
                map.set(task.id, { task, projectId });
                if (task.subtasks) {
                    traverse(task.subtasks, projectId);
                }
            });
        };
        visibleProjects.forEach(p => traverse(p.tasks, p.id));
        return map;
    }, [visibleProjects]);

    useEffect(() => {
        const getFocusPlan = async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (visibleProjects.length === 0 && habits.length === 0) {
                     setPriorities([]);
                     return;
                }
                const plan = await generateFocusPlan(visibleProjects, habits);
                const resolvedPriorities: PrioritizedTask[] = plan.priorities
                    .map(p => {
                        const taskInfo = allTasksMap.get(p.taskId);
                        if (!taskInfo) return null;
                        return { task: taskInfo.task, reason: p.reason, projectId: taskInfo.projectId };
                    })
                    .filter((p): p is PrioritizedTask => p !== null);
                setPriorities(resolvedPriorities);
            } catch (err: any) {
                setError(err.message || 'Could not load focus plan.');
            } finally {
                setIsLoading(false);
            }
        };
        getFocusPlan();
    }, [visibleProjects, habits, allTasksMap]);

    const handleUpdateTask = (projectId: string) => (updatedTask: Task) => {
        updateTask(projectId, updatedTask);
    };

    const handleDeleteTask = (projectId: string) => (taskId: string) => {
        deleteTask(projectId, taskId);
    };
    
    const handleAddSubtask = (projectId: string) => (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => {
        const newSubtask: Task = {
          id: `task-${Date.now()}`, name: subtaskName, description: '', completed: false, subtasks: [], startDate, endDate
        };
        addSubtask(projectId, parentId, newSubtask);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <Spinner />
                <p className="mt-4 text-text-secondary">Analyzing your tasks to find today's priorities...</p>
            </div>
        );
    }
    
    if (error) {
        return <div className="text-center text-red-400 p-8">{error}</div>;
    }

    if (priorities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <CheckCircleIcon className="w-16 h-16 text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-text-primary mb-2">All Clear!</h2>
                <p className="max-w-md text-text-secondary mb-6">
                    You have no pressing tasks or deadlines. A great time to plan a new project!
                </p>
                <button
                    onClick={onNewProject}
                    className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-blue-500 transition-colors duration-200"
                >
                    Create New Project
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto h-full overflow-y-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-text-primary mb-2">Today's Focus</h1>
                <p className="text-text-secondary">Here are your AI-powered priorities for today. Let's make some progress!</p>
            </div>
            <div className="space-y-4">
                {priorities.map(({ task, reason, projectId }) => (
                    <div key={task.id} className="bg-secondary p-4 rounded-lg">
                        <div className="flex items-start space-x-3 mb-2">
                            <SparklesIcon className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                            <p className="text-sm text-text-secondary italic">"{reason}"</p>
                        </div>
                        <TaskItem
                            task={task}
                            level={0}
                            onUpdate={handleUpdateTask(projectId)}
                            onDelete={handleDeleteTask(projectId)}
                            onAddSubtask={handleAddSubtask(projectId)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FocusView;