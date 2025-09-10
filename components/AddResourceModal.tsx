import React, { useState, useEffect, useCallback } from 'react';
import { useResource, useProject } from '../contexts/ProjectContext';
import { useNotification } from '../contexts/NotificationContext';
import { fetchResourceMetadata } from '../services/geminiService';
import { Resource, ApiError } from '../types';
import Spinner from './Spinner';

const AddResourceModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    initialContext?: { projectId?: string; groupId?: string };
}> = ({ isOpen, onClose, initialContext }) => {
    const { addResource } = useResource();
    const { projects, projectGroups } = useProject();
    const { showNotification } = useNotification();
    
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [isFetching, setIsFetching] = useState(false);
    const [step, setStep] = useState(1);

    const resetState = useCallback(() => {
        setUrl('');
        setTitle('');
        setNotes('');
        setThumbnailUrl('');
        setSelectedProjectIds(initialContext?.projectId ? [initialContext.projectId] : []);
        setSelectedGroupId(initialContext?.groupId || (projectGroups.length > 0 ? projectGroups[0].id : ''));
        setStep(1);
    }, [initialContext, projectGroups]);

    useEffect(() => {
        if (isOpen) {
            resetState();
        }
    }, [isOpen, resetState]);

    const handleFetchMetadata = async () => {
        if (!url.trim()) return;
        setIsFetching(true);
        try {
            const metadata = await fetchResourceMetadata(url);
            setTitle(metadata.title);
            setThumbnailUrl(metadata.thumbnailUrl);
            setStep(2);
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Could not fetch metadata. Please check the URL.';
            showNotification({ message, type: 'error' });
        } finally {
            setIsFetching(false);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim() || !selectedGroupId) {
            showNotification({ message: 'Title and a project group are required.', type: 'error' });
            return;
        }
        const newResource: Omit<Resource, 'id'> = {
            url, title, notes, thumbnailUrl,
            projectGroupId: selectedGroupId,
            projectIds: selectedProjectIds,
            isPinned: false,
            createdAt: Date.now(),
        };
        await addResource(newResource);
        onClose();
    };
    
    useEffect(() => {
        if (selectedProjectIds.length > 0) {
            const firstProjectId = selectedProjectIds[0];
            const project = projects.find(p => p.id === firstProjectId);
            if (project && project.groupId !== selectedGroupId) {
                setSelectedGroupId(project.groupId);
            }
        }
    }, [selectedProjectIds, projects, selectedGroupId]);

    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-card-background rounded-2xl shadow-soft p-6 md:p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold text-text-primary">Add New Resource</h2>
                    <button onClick={onClose} className="text-text-secondary text-3xl hover:text-text-primary">&times;</button>
                </div>

                {step === 1 && (
                    <div className="space-y-4">
                        <label htmlFor="resourceUrl" className="block text-sm font-medium text-text-secondary">Resource URL</label>
                        <input
                            id="resourceUrl"
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="block w-full h-10 bg-app-background border border-border-color rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                        <button onClick={handleFetchMetadata} disabled={isFetching || !url.trim()} className="w-full px-4 py-3 bg-accent-blue text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center">
                            {isFetching ? <Spinner /> : 'Fetch Metadata'}
                        </button>
                    </div>
                )}
                
                {step === 2 && (
                    <div className="space-y-4">
                         <div className="flex items-start gap-3 bg-app-background p-3 rounded-lg">
                            <img src={thumbnailUrl} alt={title} className="w-16 h-16 rounded-lg border border-border-color object-contain" />
                            <div className="min-w-0">
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="font-semibold text-text-primary bg-transparent w-full border-b border-border-color focus:outline-none focus:border-accent-blue" />
                                <p className="text-sm text-text-secondary truncate mt-1">{url}</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Notes (optional)</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1 block w-full bg-app-background border border-border-color rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Project Group</label>
                                <select value={selectedGroupId} onChange={e => {setSelectedGroupId(e.target.value); setSelectedProjectIds([]);}} className="mt-1 block w-full bg-app-background border border-border-color rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent-blue">
                                <option value="" disabled>Select a group</option>
                                {projectGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Link to Projects (optional)</label>
                                <select multiple value={selectedProjectIds} onChange={e => setSelectedProjectIds(Array.from(e.target.selectedOptions, option => option.value))} className="mt-1 block w-full bg-app-background border border-border-color rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent-blue" disabled={!selectedGroupId}>
                                {projects.filter(p => p.groupId === selectedGroupId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setStep(1)} className="px-4 py-2 bg-app-background rounded-lg hover:bg-border-color">Back</button>
                            <button onClick={handleSubmit} className="px-4 py-2 bg-accent-blue text-white rounded-lg">Add Resource</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddResourceModal;