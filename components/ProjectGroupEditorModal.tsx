import React, { useState } from 'react';
import { ProjectGroup } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { PlusIcon, TrashIcon, PencilIcon } from './IconComponents';

interface ProjectGroupEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_PALETTE = [
  'bg-red-500', 'bg-orange-500', 'bg-yellow-500',
  'bg-green-500', 'bg-teal-500', 'bg-blue-500',
  'bg-indigo-500', 'bg-purple-500', 'bg-pink-500',
];

const ProjectGroupEditorModal: React.FC<ProjectGroupEditorModalProps> = ({ isOpen, onClose }) => {
  const { projectGroups, addProjectGroup, updateProjectGroup, deleteProjectGroup } = useProject();
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(COLOR_PALETTE[0]);

  const handleStartEditing = (group: ProjectGroup) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const handleSaveEdit = (group: ProjectGroup) => {
    if (editingName.trim() && editingName !== group.name) {
      updateProjectGroup({ ...group, name: editingName.trim() });
    }
    setEditingGroupId(null);
  };

  const handleDelete = (groupId: string) => {
    if (window.confirm('Are you sure? This will not delete the projects in this group.')) {
      deleteProjectGroup(groupId);
    }
  };
  
  const handleAddNewGroup = (e: React.FormEvent) => {
      e.preventDefault();
      if(newGroupName.trim()) {
          addProjectGroup({ name: newGroupName.trim(), color: newGroupColor });
          setNewGroupName('');
      }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-primary md:bg-black md:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-secondary md:rounded-lg shadow-xl p-6 md:p-8 w-full h-full md:h-auto md:max-w-lg transform transition-all flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-text-primary">Edit Project Groups</h2>
          <button onClick={onClose} className="text-text-secondary text-3xl hover:text-text-primary">&times;</button>
        </div>

        <div className="space-y-3 flex-grow overflow-y-auto pr-2">
          {projectGroups.map(group => (
            <div key={group.id} className="flex items-center space-x-3 bg-highlight p-2 rounded-lg">
              <div className={`w-5 h-5 rounded-full ${group.color} shrink-0`}></div>
              {editingGroupId === group.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleSaveEdit(group)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(group); if (e.key === 'Escape') setEditingGroupId(null); }}
                  className="flex-grow bg-secondary border border-accent rounded px-2 py-1 text-sm"
                  autoFocus
                />
              ) : (
                <span className="flex-grow text-text-primary">{group.name}</span>
              )}
              <button onClick={() => handleStartEditing(group)} className="text-text-secondary hover:text-accent"><PencilIcon className="w-4 h-4"/></button>
              <button onClick={() => handleDelete(group.id)} className="text-text-secondary hover:text-red-500"><TrashIcon className="w-4 h-4"/></button>
            </div>
          ))}
        </div>
        
        <form onSubmit={handleAddNewGroup} className="mt-6 border-t border-border-color pt-4">
            <h3 className="text-lg font-semibold mb-2">Add New Group</h3>
            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="New group name..."
                    className="flex-grow bg-highlight border border-border-color rounded-md px-3 py-2 text-sm"
                />
                <div className="flex items-center justify-center gap-2 p-2 bg-highlight rounded-md">
                    {COLOR_PALETTE.map(c => (
                        <button key={c} type="button" onClick={() => setNewGroupColor(c)} className={`w-5 h-5 rounded-full ${c} ${newGroupColor === c ? 'ring-2 ring-offset-2 ring-offset-highlight ring-white' : ''}`}></button>
                    ))}
                </div>
                <button type="submit" className="px-4 py-2 bg-accent text-white rounded-md hover:bg-blue-500"><PlusIcon className="w-5 h-5"/></button>
            </div>
        </form>

        <div className="mt-8 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-md text-text-primary bg-highlight hover:bg-gray-700">Done</button>
        </div>
      </div>
    </div>
  );
};

export default ProjectGroupEditorModal;