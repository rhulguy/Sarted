import React, { useState, useMemo } from 'react';
import { useProject, useResource } from '../contexts/ProjectContext';
import { PlusIcon, TrashIcon, LinkIcon, ViewGridIcon, ViewListIcon } from './IconComponents';
import ExportDropdown from './ExportDropdown';
import { exportResourcesToCsv, exportResourcesToDoc } from '../utils/exportUtils';
import { Resource, ProjectGroup } from '../types';
import { Skeleton } from './Skeleton';

const ResourceViewSkeleton: React.FC = () => (
    <div className="h-full flex flex-col p-4 md:p-6 animate-pulse">
        <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <Skeleton className="h-9 w-48 mb-2" />
                <Skeleton className="h-5 w-80" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-24 rounded-lg" />
                <Skeleton className="h-10 w-36 rounded-lg" />
            </div>
        </header>
        <div className="mb-4 flex gap-4">
            <Skeleton className="h-10 flex-grow rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
        <div className="flex-grow overflow-y-auto pr-2 space-y-6">
            <div>
                <Skeleton className="h-7 w-32 mb-2" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                </div>
            </div>
            <div>
                <Skeleton className="h-7 w-40 mb-2" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-28 rounded-xl" />
                </div>
            </div>
        </div>
    </div>
);

const ResourceView: React.FC<{ onAddResource: () => void }> = ({ onAddResource }) => {
    const { resources, loading, deleteResource } = useResource();
    const { projectGroups } = useProject();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const filteredResources = useMemo(() => {
        if (!searchTerm.trim()) return resources;
        const lowercasedFilter = searchTerm.toLowerCase();
        return resources.filter(res => 
            res.title.toLowerCase().includes(lowercasedFilter) ||
            res.url.toLowerCase().includes(lowercasedFilter) ||
            (res.notes && res.notes.toLowerCase().includes(lowercasedFilter))
        );
    }, [resources, searchTerm]);
    
    const groupedResources = useMemo(() => {
        const groups = new Map<string, { group: ProjectGroup, resources: Resource[] }>();
        projectGroups.forEach(pg => groups.set(pg.id, { group: pg, resources: [] }));

        filteredResources.forEach(res => {
            if (groups.has(res.projectGroupId)) {
                groups.get(res.projectGroupId)!.resources.push(res);
            }
        });
        
        return Array.from(groups.values()).filter(g => g.resources.length > 0);
    }, [filteredResources, projectGroups]);
    
    const handleExport = (type: 'csv' | 'doc') => {
        if (type === 'csv') {
            exportResourcesToCsv(filteredResources);
        } else {
            exportResourcesToDoc(filteredResources);
        }
    };
    
    const ResourceCard: React.FC<{ resource: Resource }> = ({ resource }) => (
        <div className="bg-app-background rounded-xl p-4 flex flex-col justify-between group h-full">
            <div className="flex items-start gap-3">
                <img src={resource.thumbnailUrl} alt={resource.title} className="w-10 h-10 rounded-lg border border-border-color object-contain" />
                <div className="min-w-0">
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-text-primary hover:underline break-words">{resource.title}</a>
                    <p className="text-sm text-text-secondary truncate">{resource.notes || resource.url}</p>
                </div>
            </div>
            <div className="flex justify-end mt-2">
                <button onClick={() => { if(window.confirm('Delete this resource?')) deleteResource(resource.id); }} title="Delete" className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-card-background text-text-secondary">
                    <TrashIcon className="w-5 h-5"/>
                </button>
                <a href={resource.url} target="_blank" rel="noopener noreferrer" title={resource.url} className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-card-background text-text-secondary">
                    <LinkIcon className="w-5 h-5"/>
                </a>
            </div>
        </div>
    );

    const ResourceListItem: React.FC<{ resource: Resource }> = ({ resource }) => (
        <div className="flex items-center justify-between p-2 hover:bg-app-background rounded-lg group">
             <div className="flex items-center gap-4 flex-grow min-w-0">
                <img src={resource.thumbnailUrl} alt={resource.title} className="w-8 h-8 rounded-md border border-border-color object-contain" />
                <div className="min-w-0">
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-text-primary hover:underline truncate block">{resource.title}</a>
                    <p className="text-sm text-text-secondary truncate">{resource.url}</p>
                </div>
            </div>
             <div className="flex items-center shrink-0">
                <button onClick={() => { if(window.confirm('Delete this resource?')) deleteResource(resource.id); }} title="Delete" className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-card-background text-text-secondary">
                    <TrashIcon className="w-5 h-5"/>
                </button>
                <a href={resource.url} target="_blank" rel="noopener noreferrer" title={resource.url} className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-card-background text-text-secondary">
                    <LinkIcon className="w-5 h-5"/>
                </a>
            </div>
        </div>
    );

    if (loading) {
        return <ResourceViewSkeleton />;
    }

    return (
        <div className="h-full flex flex-col p-4 md:p-6">
            <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary">Resources</h1>
                    <p className="text-text-secondary">A central library for all your links and references.</p>
                </div>
                <div className="flex items-center gap-2">
                     <ExportDropdown 
                        onExportCsv={() => handleExport('csv')}
                        onExportDoc={() => handleExport('doc')}
                        onExportImage={() => { /* Not available */ }}
                     />
                     <button onClick={onAddResource} className="flex items-center space-x-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:opacity-90">
                        <PlusIcon className="w-5 h-5" />
                        <span>Add Resource</span>
                    </button>
                </div>
            </header>
            <div className="mb-4 flex gap-4">
                <input
                    type="search"
                    placeholder="Search resources..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-grow bg-card-background border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                />
                 <div className="bg-card-background p-1 rounded-lg flex space-x-1 border border-border-color">
                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-accent-blue text-white' : 'hover:bg-app-background'}`} title="Grid View">
                        <ViewGridIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-accent-blue text-white' : 'hover:bg-app-background'}`} title="List View">
                        <ViewListIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>
             <div className="flex-grow overflow-y-auto pr-2">
                {groupedResources.length === 0 ? (
                    <div className="text-center py-10 text-text-secondary">No resources found.</div>
                ) : (
                    <div className="space-y-6">
                        {groupedResources.map(({ group, resources }) => (
                            <div key={group.id}>
                                <h2 className="text-lg font-semibold flex items-center gap-2 mb-2">
                                    <div className={`w-3 h-3 rounded-full ${group.color} shrink-0`}></div>
                                    {group.name}
                                </h2>
                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {resources.map(res => <ResourceCard key={res.id} resource={res} />)}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {resources.map(res => <ResourceListItem key={res.id} resource={res} />)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResourceView;