import React, { useState, useEffect, useMemo } from 'react';
import { generateWeeklySummary } from '../services/geminiService';
import Spinner from './Spinner';
import { useProject } from '../contexts/ProjectContext';
import { useHabit } from '../contexts/HabitContext';
import { Task } from '../types';
import { SparklesIcon } from './IconComponents';

interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({ isOpen, onClose }) => {
  const { projects } = useProject();
  const { habits } = useHabit();
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const weeklyData = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const completedTasks: Task[] = [];
    const traverse = (tasks: Task[]) => {
        tasks.forEach(task => {
            if (task.completed) { // Simple check: was it completed? A more robust check might use a completion date.
                completedTasks.push(task);
            }
            if (task.subtasks) traverse(task.subtasks);
        });
    };
    projects.forEach(p => traverse(p.tasks));

    const completedHabits = habits.map(habit => {
        const count = Object.keys(habit.completions).filter(dateStr => {
            const completionDate = new Date(dateStr);
            return completionDate >= oneWeekAgo && habit.completions[dateStr];
        }).length;
        return { name: habit.name, count };
    }).filter(h => h.count > 0);

    return { completedTasks, completedHabits };
  }, [projects, habits]);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      generateWeeklySummary(weeklyData.completedTasks, weeklyData.completedHabits)
        .then(setSummary)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, weeklyData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-primary md:bg-black md:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-secondary md:rounded-lg shadow-xl p-6 md:p-8 w-full h-full md:h-auto md:max-w-2xl transform transition-all flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-accent"/>
            Your Weekly Review
          </h2>
          <button onClick={onClose} className="text-text-secondary text-3xl hover:text-text-primary">&times;</button>
        </div>

        <div className="space-y-4 flex-grow overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48">
                <Spinner/>
                <p className="mt-4 text-text-secondary">Generating your weekly summary...</p>
            </div>
          ) : (
            <p className="text-text-primary text-lg leading-relaxed">{summary}</p>
          )}
          <div className="text-sm text-text-secondary border-t border-border-color pt-4">
            <h3 className="font-semibold text-base mb-2">Last 7 Days at a Glance:</h3>
            <ul className="list-disc list-inside">
                <li><span className="font-bold">{weeklyData.completedTasks.length}</span> tasks completed.</li>
                {weeklyData.completedHabits.map(h => (
                    <li key={h.name}>Completed <span className="font-bold">{h.name}</span> <span className="font-bold">{h.count}</span> times.</li>
                ))}
            </ul>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button 
            onClick={onClose} 
            className="px-6 py-2 rounded-md text-white bg-accent hover:bg-blue-500"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyReviewModal;