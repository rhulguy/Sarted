import React, { useState, useRef, useEffect } from 'react';
import { ProjectGroup } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { PlusIcon, TrashIcon, PencilIcon, DragHandleIcon } from './IconComponents';
import { GROUP_ICON_OPTIONS } from '../constants';

interface ProjectGroupEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GroupIconPicker: React.FC<{ selectedIcon: string; onSelect: (icon: string) => void }> = ({ selectedIcon, onSelect }) => {
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
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="h-10 w-10 text-2xl bg-app-background border border-border-color rounded-lg flex items-center justify-center shrink-0">
                {selectedIcon}
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 w-64 bg-card-background border border-border-color rounded-lg p-2 grid grid-cols-6 gap-2 z-20 shadow-soft">
                    {GROUP_ICON_OPTIONS.map(emoji => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => { onSelect(emoji); setIsOpen(false); }}
                            className={`text-2xl rounded-md p-1 hover:bg-app-background ${selectedIcon === emoji ? 'bg-accent-blue' : ''}`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


const ProjectGroupEditorModal: React.FC<ProjectGroupEditorModalProps> = ({ isOpen, onClose }) => {
  const { projectGroups, addProjectGroup, updateProjectGroup, deleteProjectGroup, reorderProjectGroups } = useProject();
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingIcon, setEditingIcon] = useState('💼');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState(GROUP_ICON_OPTIONS[0]);
  
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

  const handleStartEditing = (group: ProjectGroup) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
    setEditingIcon(group.icon || '💼');
  };

  const handleSaveEdit = (group: ProjectGroup) => {
    const nameChanged = editingName.trim() && editingName.trim() !== group.name;
    const iconChanged = editingIcon !== group.icon;
    if (nameChanged || iconChanged) {
      updateProjectGroup({ ...group, name: editingName.trim(), icon: editingIcon });
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
          addProjectGroup({ name: newGroupName.trim(), icon: newGroupIcon });
          setNewGroupName('');
          setNewGroupIcon(GROUP_ICON_OPTIONS[0]);
      }
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, groupId: string) => {
    dragItem.current = groupId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, groupId: string) => {
    dragOverItem.current = groupId;
  };
  
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    
    const reorderedGroups = [...projectGroups];
    const dragItemIndex = reorderedGroups.findIndex(g => g.id === dragItem.current);
    const dragOverItemIndex = reorderedGroups.findIndex(g => g.id === dragOverItem.current);

    const [draggedItem] = reorderedGroups.splice(dragItemIndex, 1);
    reorderedGroups.splice(dragOverItemIndex, 0, draggedItem);
    
    reorderProjectGroups(reorderedGroups);

    dragItem.current = null;
    dragOverItem.current = null;
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-card-background rounded-2xl shadow-soft p-6 md:p-8 w-full h-auto md:max-w-lg transform transition-all flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-text-primary">Edit Project Groups</h2>
          <button onClick={onClose} className="text-text-secondary text-3xl hover:text-text-primary">&times;</button>
        </div>

        <div className="space-y-3 flex-grow overflow-y-auto pr-2">
          {projectGroups.map(group => (
            <div 
                key={group.id} 
                className="flex items-center space-x-3 bg-app-background p-2 rounded-lg"
                draggable
                onDragStart={(e) => handleDragStart(e, group.id)}
                onDragEnter={(e) => handleDragEnter(e, group.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
            >
              <div className="cursor-move text-text-secondary">
                  <DragHandleIcon className="w-5 h-5" />
              </div>
              {editingGroupId === group.id ? (
                <>
                  <GroupIconPicker selectedIcon={editingIcon} onSelect={setEditingIcon} />
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleSaveEdit(group)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(group); if (e.key === 'Escape') setEditingGroupId(null); }}
                    className="flex-grow bg-card-background border border-accent-blue rounded px-2 py-1 text-sm text-text-primary"
                    autoFocus
                  />
                </>
              ) : (
                <>
                  <span className="text-2xl w-10 h-10 flex items-center justify-center shrink-0">{group.icon || '📁'}</span>
                  <span className="flex-grow text-text-primary">{group.name}</span>
                  <button onClick={() => handleStartEditing(group)} className="text-text-secondary hover:text-accent-blue"><PencilIcon className="w-4 h-4"/></button>
                  <button onClick={() => handleDelete(group.id)} className="text-text-secondary hover:text-accent-red"><TrashIcon className="w-4 h-4"/></button>
                </>
              )}
            </div>
          ))}
        </div>
        
        <form onSubmit={handleAddNewGroup} className="mt-6 border-t border-border-color pt-4">
            <h3 className="text-lg font-semibold mb-2 text-text-primary">Add New Group</h3>
            <div className="flex flex-col sm:flex-row gap-2">
                <GroupIconPicker selectedIcon={newGroupIcon} onSelect={setNewGroupIcon} />
                <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="New group name..."
                    className="flex-grow bg-app-background border border-border-color rounded-lg px-3 py-2 text-sm"
                />
                <button type="submit" className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:opacity-90 font-semibold">Create</button>
            </div>
        </form>

        <div className="mt-8 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-lg text-text-primary bg-app-background hover:bg-border-color">Done</button>
        </div>
      </div>
    </div>
  );
};

export default ProjectGroupEditorModal;