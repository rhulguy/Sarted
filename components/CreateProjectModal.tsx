import React, { useState, useRef, useEffect } from 'react';
import { Project, Task } from '../types';
import { generateProjectPlan, AIGeneratedTask } from '../services/geminiService';
import { SparklesIcon } from './IconComponents';
import Spinner from './Spinner';
import { useProject } from '../contexts/ProjectContext';
import { useLoading } from '../contexts/LoadingContext';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMOJI_OPTIONS = ['🎨', '🚀', '💡', '💰', '📈', '💼', '🏠', '❤️', '✈️', '💻', '🌐', '📚', '⚙️', '⚡️', '🔒', '🎯'];

const IconPicker: React.FC<{ selectedIcon: string; onSelect: (icon: string) => void }> = ({ selectedIcon, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={pickerRef}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="h-10 w-10 text-2xl bg-highlight rounded-md flex items-center justify-center shrink-0">
                {selectedIcon}
            </button>
            {isOpen && (
                <div className="absolute bottom-full mb-2 w-64 bg-secondary border border-border-color rounded-lg p-2 grid grid-cols-6 gap-2 z-10">
                    {EMOJI_OPTIONS.map(emoji => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => { onSelect(emoji); setIsOpen(false); }}
                            className={`text-2xl rounded-md p-1 hover:bg-highlight ${selectedIcon === emoji ? 'bg-accent' : ''}`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// Helper to recursively add IDs and default properties to tasks from AI
const processTasks = (tasks: AIGeneratedTask[]): Task[] => {
  return tasks.map((task, index) => ({
    id: `task-${Date.now()}-${index}`,
    name: task.name || 'Untitled Task',
    description: task.description || '',
    startDate: task.startDate,
    endDate: task.endDate,
    completed: false,
    subtasks: task.subtasks ? processTasks(task.subtasks) : [],
  }));
};

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
  const { projectGroups, addProject } = useProject();
  const { isLoading, dispatch: loadingDispatch } = useLoading();
  const [projectName, setProjectName] = useState('');
  const [groupId, setGroupId] = useState(projectGroups[0]?.id || '');
  const [icon, setIcon] = useState('🎯');
  const [aiGoal, setAiGoal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreateProject = (projectData: Omit<Project, 'id' | 'isHidden'>) => {
    addProject(projectData);
    onClose();
  };

  const handleGenerateWithAI = async () => {
    if (!aiGoal.trim()) return;
    loadingDispatch({ type: 'SET_LOADING', payload: true });
    setError(null);
    try {
      const generatedTasks = await generateProjectPlan(aiGoal);
      const newProjectData = {
        name: projectName || aiGoal,
        groupId,
        tasks: processTasks(generatedTasks),
        icon,
      };
      handleCreateProject(newProjectData);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      loadingDispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleCreateManually = () => {
    if (!projectName.trim() || !groupId) return;
    const newProjectData = {
      name: projectName,
      groupId,
      tasks: [],
      icon,
    };
    handleCreateProject(newProjectData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-primary md:bg-black md:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-secondary md:rounded-lg shadow-xl p-6 md:p-8 w-full h-full md:h-auto md:max-w-2xl transform transition-all flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-text-primary">Create a New Project</h2>
          <button onClick={onClose} className="text-text-secondary text-3xl hover:text-text-primary">&times;</button>
        </div>

        <div className="space-y-4 flex-grow overflow-y-auto">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-text-secondary">Project Name & Icon</label>
            <div className="mt-1 flex items-center gap-2">
                <IconPicker selectedIcon={icon} onSelect={setIcon} />
                <input
                  id="projectName"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Q3 Marketing Campaign"
                  className="block w-full h-10 bg-highlight border border-border-color rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent"
                />
            </div>
          </div>
          <div>
            <label htmlFor="projectGroup" className="block text-sm font-medium text-text-secondary">Project Group</label>
            <select
              id="projectGroup"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="mt-1 block w-full bg-highlight border border-border-color rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent"
            >
              {projectGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>

          <div className="text-center my-4">
            <span className="text-text-secondary text-sm">OR</span>
          </div>

          <div>
            <label htmlFor="aiGoal" className="block text-sm font-medium text-text-secondary">Describe your project goal</label>
            <textarea
              id="aiGoal"
              value={aiGoal}
              onChange={(e) => setAiGoal(e.target.value)}
              placeholder="e.g., Launch a new podcast by the end of the quarter"
              className="mt-1 block w-full bg-highlight border border-border-color rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent"
              rows={3}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
        
        <div className="mt-6 flex flex-col-reverse md:flex-row justify-end md:space-x-4 gap-2">
          <button 
            onClick={handleGenerateWithAI} 
            disabled={!aiGoal.trim() || isLoading}
            className="flex items-center justify-center space-x-2 px-4 py-3 md:py-2 rounded-md text-white bg-accent hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
          >
            {isLoading ? <Spinner /> : <SparklesIcon className="w-5 h-5" />}
            <span>{isLoading ? 'Generating...' : 'Generate with AI'}</span>
          </button>
          <button 
            onClick={handleCreateManually} 
            disabled={!projectName.trim() || isLoading}
            className="px-4 py-3 md:py-2 rounded-md text-white bg-gray-600 hover:bg-gray-500 disabled:opacity-50 w-full md:w-auto"
          >
            Create Manually
          </button>
           <button onClick={onClose} className="px-4 py-3 md:py-2 rounded-md text-text-primary bg-highlight hover:bg-gray-700 w-full md:w-auto">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectModal;