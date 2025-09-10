import React, { useMemo, forwardRef } from 'react';
import { useResource } from '../contexts/ProjectContext';
import { Project, Resource } from '../types';
import { PlusIcon, TrashIcon, LinkIcon } from './IconComponents';

const ProjectResourcesView = forwardRef<HTMLDivElement, {
    project: Project;
    onAddResource: () => void;
}>(({ project, onAddResource }, ref) => {
    const { resources, loading, deleteResource } = useResource();

    const projectResources = useMemo(() => {
        return resources.filter(res => res.projectIds.includes(project.id));
    }, [resources, project.id]);

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

    return (
        <div ref={ref} className="h-full flex flex-col">
            <div className="flex-grow overflow-y-auto pr-2">
                {loading ? <p className="text-text-secondary p-4">Loading resources...</p> : 
                    projectResources.length === 0 ? (
                        <div className="text-center py-10 text-text-secondary">
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <button onClick={onAddResource} className="border-2 border-dashed border-border-color rounded-xl flex flex-col items-center justify-center text-text-secondary hover:bg-app-background hover:border-accent-blue transition-colors min-h-[120px]">
                                    <PlusIcon className="w-6 h-6 mb-1" />
                                    <span>Add Resource</span>
                                </button>
                             </div>
                            <p className="mt-4">No resources linked to this project yet. Click '+' to add one.</p>
                        </div>
                    ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {projectResources.map(res => (
                                <ResourceCard key={res.id} resource={res} />
                            ))}
                             <button onClick={onAddResource} className="border-2 border-dashed border-border-color rounded-xl flex flex-col items-center justify-center text-text-secondary hover:bg-app-background hover:border-accent-blue transition-colors min-h-[120px]">
                                <PlusIcon className="w-6 h-6 mb-1" />
                                <span>Add Resource</span>
                            </button>
                        </div>
                    )
                }
            </div>
        </div>
    );
});

export default ProjectResourcesView;