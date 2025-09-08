import React, { useState, useMemo } from 'react';
import { Habit } from '../types';
import { COLOR_PALETTE } from '../constants';
import { useHabit } from '../contexts/HabitContext';
import { useProject } from '../contexts/ProjectContext';

interface CreateHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CreateHabitModal: React.FC<CreateHabitModalProps> = ({ isOpen, onClose }) => {
  const { addHabit } = useHabit();
  const { projects, projectGroups } = useProject();
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [color, setColor] = useState(COLOR_PALETTE[5]);
  const [projectGroupId, setProjectGroupId] = useState('');
  const [projectId, setProjectId] = useState('');

  const handleDayToggle = (dayIndex: number) => {
    setDaysOfWeek(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newHabit: Omit<Habit, 'id'> = {
      name: name.trim(),
      frequency,
      daysOfWeek: frequency === 'weekly' ? daysOfWeek.sort() : undefined,
      color,
      completions: {},
      createdAt: new Date().toISOString().split('T')[0],
      projectGroupId: projectGroupId || undefined,
      projectId: projectId || undefined,
    };
    addHabit(newHabit);
    // Reset form
    setName('');
    setFrequency('daily');
    setDaysOfWeek([]);
    setColor(COLOR_PALETTE[5]);
    setProjectGroupId('');
    setProjectId('');
    onClose();
  };
  
  const projectsByGroup = useMemo(() => {
    return projectGroups.map(group => ({
      ...group,
      projects: projects.filter(p => p.groupId === group.id)
    })).filter(group => group.projects.length > 0);
  }, [projects, projectGroups]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card-background rounded-2xl shadow-soft p-6 md:p-8 w-full h-auto md:max-w-lg transform transition-all flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-text-primary">Create a New Habit</h2>
          <button onClick={onClose} className="text-text-secondary text-3xl hover:text-text-primary">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 flex-grow flex flex-col">
          <div className="flex-grow space-y-4 overflow-y-auto pr-2">
            <div>
              <label htmlFor="habitName" className="block text-sm font-medium text-text-secondary">Habit Name</label>
              <input
                id="habitName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Drink 8 glasses of water"
                className="mt-1 block w-full bg-app-background border border-border-color rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent-blue focus:border-accent-blue"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">Link to Group (Optional)</label>
                <select value={projectGroupId} onChange={e => {setProjectGroupId(e.target.value); setProjectId('');}} className="mt-1 block w-full bg-app-background border border-border-color rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent-blue">
                  <option value="">None</option>
                  {projectGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
               <div>
                <label className="block text-sm font-medium text-text-secondary">Link to Project (Optional)</label>
                <select value={projectId} onChange={e => {setProjectId(e.target.value); if(e.target.value) { const p = projects.find(pr=>pr.id === e.target.value); if(p) setProjectGroupId(p.groupId)}}} className="mt-1 block w-full bg-app-background border border-border-color rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent-blue">
                  <option value="">None</option>
                  {projectsByGroup.map(group => (
                    <optgroup key={group.id} label={group.name}>
                      {group.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">Frequency</label>
              <div className="mt-2 flex space-x-2 bg-app-background p-1 rounded-lg">
                <button type="button" onClick={() => setFrequency('daily')} className={`flex-1 py-1 rounded-md text-sm ${frequency === 'daily' ? 'bg-accent-blue text-white' : 'hover:bg-border-color'}`}>Daily</button>
                <button type="button" onClick={() => setFrequency('weekly')} className={`flex-1 py-1 rounded-md text-sm ${frequency === 'weekly' ? 'bg-accent-blue text-white' : 'hover:bg-border-color'}`}>Weekly</button>
              </div>
            </div>

            {frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-text-secondary">On these days</label>
                <div className="mt-2 grid grid-cols-7 gap-2">
                  {WEEKDAYS.map((day, index) => (
                    <button 
                      key={day}
                      type="button"
                      onClick={() => handleDayToggle(index)}
                      className={`p-2 rounded-md text-sm text-center border transition-colors ${daysOfWeek.includes(index) ? 'bg-accent-blue text-white border-accent-blue' : 'bg-app-background border-border-color hover:border-gray-400'}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-secondary">Color</label>
              <div className="mt-2 grid grid-cols-7 sm:grid-cols-9 gap-2">
                  {COLOR_PALETTE.map(c => (
                      <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`w-full pt-[100%] relative rounded-full ${c} ${color === c ? 'ring-2 ring-offset-2 ring-offset-card-background ring-accent-blue' : ''}`}
                          aria-label={`Set color to ${c}`}
                      />
                  ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-app-background rounded-lg hover:bg-border-color">Cancel</button>
            <button type="submit" disabled={!name.trim()} className="px-4 py-2 bg-accent-blue text-white rounded-lg disabled:opacity-50">Create Habit</button>
          </div>
        </form>
      </div>
    </div>
  );
};
// FIX: Add default export to resolve import error in App.tsx.
export default CreateHabitModal;