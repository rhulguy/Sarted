import React, { useState, useEffect, useMemo, useRef } from 'react';
import Header from './components/Header';
import ProjectList from './components/ProjectList';
import TaskList from './components/TaskList';
import CreateProjectModal from './components/CreateProjectModal';
import { WelcomePlaceholder } from './components/WelcomePlaceholder';
import HabitTracker from './components/HabitTracker';
import CreateHabitModal from './components/CreateHabitModal';
import { Sidebar } from './components/Sidebar';
import { useProject, useResource } from './contexts/ProjectContext';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalLoader from './components/GlobalLoader';
import { useIsMobile } from './hooks/useIsMobile';
import InboxView from './components/InboxView';
import CommandBar from './components/CommandBar';
import WeeklyReviewModal from './components/WeeklyReviewModal';
import { useWeeklyReview } from './contexts/WeeklyReviewContext';
import GlobalCalendar from './components/GlobalCalendar';
import GlobalMindMapView from './components/GlobalMindMapView';
import { useAuth } from './contexts/AuthContext';
import GlobalGanttView from './components/GlobalGanttView';
import ProjectGroupEditorModal from './components/ProjectGroupEditorModal';
import { Resource, Project, ProjectGroup } from './types';
import { PlusIcon, RefreshIcon, TrashIcon, ViewGridIcon, ViewListIcon, LinkIcon, ChevronDownIcon, TagIcon, DocumentTextIcon, DownloadIcon } from './components/IconComponents';
import Spinner from './components/Spinner';
import { useLoading } from './contexts/LoadingContext';
import { useDownloadImage } from './hooks/useDownloadImage';


// --- NEW RESOURCE COMPONENTS (Inlined due to file system constraints) ---

// Helper: Custom hook for detecting clicks outside an element
const useClickOutside = (ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent) => void) => {
    useEffect(() => {
        const listener = (event: MouseEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
        };
    }, [ref, handler]);
};

// Helper: Project Multi-Select Popover
const ProjectMultiSelect: React.FC<{
    selectedProjectIds: string[];
    onSelectionChange: (ids: string[]) => void;
    projects: Project[];
    projectGroups: ProjectGroup[];
    children: React.ReactNode;
}> = ({ selectedProjectIds, onSelectionChange, projects, projectGroups, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    useClickOutside(wrapperRef, () => setIsOpen(false));

    const handleToggleProject = (projectId: string) => {
        const newSelection = selectedProjectIds.includes(projectId)
            ? selectedProjectIds.filter(id => id !== projectId)
            : [...selectedProjectIds, projectId];
        onSelectionChange(newSelection);
    };

    const groupedProjects = useMemo(() => {
        return projectGroups
            .map(group => ({
                ...group,
                projects: projects.filter(p => p.groupId === group.id),
            }))
            .filter(group => group.projects.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [projectGroups, projects]);

    return (
        <div className="relative" ref={wrapperRef}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full">
                {children}
            </button>
            {isOpen && (
                <div className="absolute top-full mt-1 w-64 bg-secondary border border-border-color rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                    {groupedProjects.length > 0 ? (
                        groupedProjects.map(group => (
                            <div key={group.id} className="p-2">
                                <h4 className="text-xs font-bold text-text-secondary uppercase px-2 mb-1 flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${group.color} shrink-0`}></div>
                                    {group.name}
                                </h4>
                                {group.projects.map(project => (
                                     <label key={project.id} className="flex items-center space-x-3 p-2 hover:bg-highlight cursor-pointer rounded-md">
                                        <input
                                            type="checkbox"
                                            checked={selectedProjectIds.includes(project.id)}
                                            onChange={() => handleToggleProject(project.id)}
                                            className="w-4 h-4 rounded bg-highlight border-border-color text-accent focus:ring-accent"
                                        />
                                        <span className="text-sm text-text-primary">{project.name}</span>
                                    </label>
                                ))}
                            </div>
                        ))
                    ) : (
                        <div className="p-2 text-sm text-text-secondary">No projects available.</div>
                    )}
                </div>
            )}
        </div>
    );
};


// AddResourceModal Component
const AddResourceModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { addResource } = useResource();
    const { projects, projectGroups } = useProject();
    const [url, setUrl] = useState('');
    const [metadata, setMetadata] = useState<{ title: string; thumbnailUrl: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [projectGroupId, setProjectGroupId] = useState(projectGroups[0]?.id || '');
    const [projectIds, setProjectIds] = useState<string[]>([]);
    const debounceTimeout = useRef<number | null>(null);

    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        const urlInput = url.trim();
        if (!urlInput) {
            setMetadata(null); setError(''); setIsLoading(false); return;
        }
        setIsLoading(true); setError(''); setMetadata(null);
        debounceTimeout.current = window.setTimeout(() => {
            try {
                let fullUrl = urlInput;
                if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'https://' + fullUrl;
                const urlObject = new URL(fullUrl);
                const hostname = urlObject.hostname;
                setMetadata({ title: hostname.replace(/^www\./, ''), thumbnailUrl: `https://www.google.com/s2/favicons?sz=128&domain=${hostname}` });
            } catch (err) { setError("Please enter a valid URL."); setMetadata(null); } 
            finally { setIsLoading(false); }
        }, 500);
    }, [url]);

    const handleAddResource = () => {
        if (!metadata || !url || !projectGroupId) return;
        addResource({
            url, title: metadata.title, thumbnailUrl: metadata.thumbnailUrl, notes: '',
            projectGroupId, projectIds, isPinned: false, createdAt: Date.now(),
        });
        handleClose();
    };

    const handleClose = () => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        setUrl(''); setMetadata(null); setError(''); setIsLoading(false); setProjectIds([]);
        if(projectGroups.length > 0) setProjectGroupId(projectGroups[0].id);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-primary md:bg-black md:bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-secondary md:rounded-lg shadow-xl p-6 md:p-8 w-full h-full md:h-auto md:max-w-xl flex flex-col">
                <div className="flex justify-between items-start mb-4"><h2 className="text-2xl font-bold">Add New Resource</h2><button onClick={handleClose} className="text-3xl">&times;</button></div>
                <div className="flex-grow space-y-4">
                    <div><label htmlFor="resourceUrl" className="block text-sm font-medium text-text-secondary">URL</label><div className="relative mt-1"><input id="resourceUrl" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="block w-full bg-highlight border-border-color rounded-md p-2 pr-10" />{isLoading && (<div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><Spinner /></div>)}</div></div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    {metadata && (
                        <div className="border border-border-color rounded-lg p-4 space-y-3 animate-fade-in">
                            <div className="flex items-start gap-4">
                                <img src={metadata.thumbnailUrl} alt="Favicon" className="w-12 h-12 rounded-md border border-border-color object-contain" onError={(e) => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZT0iI2M5ZDFkOSI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNMTMuMTkgOC42ODhhNC41IDQuNSAwIDAxMS4yNDIgNy4yNDRsLTQuNSA0LjVhNC41IDQuNSAwIDAxLTYuMzY0LTYuMzY0bDEuNzU3LTEuNzU3bTEzLjM1LS42MjJsMS43NTctMS43NTdhNC41IDQuNSAwIDAwLTYuMzY0LTYuMzY0bC00LjUgNC41YTQuNSA0LjUgMCAwMDEuMjQyIDcuMjQ0IiAvPjwvc3ZnPg==`; t.classList.add('p-2', 'bg-secondary'); }} />
                                <div className="flex-grow"><h3 className="text-lg font-semibold">{metadata.title}</h3><p className="text-sm text-text-secondary truncate">{url}</p></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border-color">
                                <div><label className="text-xs font-medium text-text-secondary">Project Group</label><select value={projectGroupId} onChange={e => setProjectGroupId(e.target.value)} className="w-full mt-1 bg-highlight border border-border-color rounded-md p-2 text-sm"><option value="" disabled>Select a group</option>{projectGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                                <div><label className="text-xs font-medium text-text-secondary">Link to Projects</label>
                                    <ProjectMultiSelect selectedProjectIds={projectIds} onSelectionChange={setProjectIds} projects={projects} projectGroups={projectGroups}>
                                        <div className="w-full mt-1 bg-highlight border border-border-color rounded-md p-2 text-sm text-left flex justify-between items-center">
                                            <span>{projectIds.length > 0 ? `${projectIds.length} project(s) selected` : 'None selected'}</span>
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </ProjectMultiSelect>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-6 flex justify-end gap-2"><button onClick={handleClose} className="px-4 py-2 bg-highlight rounded-md">Cancel</button><button onClick={handleAddResource} disabled={!metadata || isLoading || !projectGroupId} className="px-4 py-2 bg-accent text-white rounded-md disabled:opacity-50">Add Resource</button></div>
            </div>
        </div>
    );
};

const ResourceAssignments: React.FC<{ resource: Resource }> = ({ resource }) => {
    const { updateResource } = useResource();
    const { projects, projectGroups } = useProject();
    const group = projectGroups.find(g => g.id === resource.projectGroupId);

    const [isGroupChangerOpen, setGroupChangerOpen] = useState(false);
    const groupChangerRef = useRef<HTMLDivElement>(null);
    useClickOutside(groupChangerRef, () => setGroupChangerOpen(false));

    const linkedProjects = useMemo(() => {
        return resource.projectIds
            .map(id => projects.find(p => p.id === id))
            .filter((p): p is Project => p !== undefined);
    }, [resource.projectIds, projects]);

    return (
        <div className="mt-auto pt-2 text-xs border-t border-border-color flex flex-wrap items-center gap-x-4 gap-y-1">
            {/* Group Display and Changer */}
            <div ref={groupChangerRef} className="relative flex items-center">
                 <button 
                    type="button" 
                    onClick={() => setGroupChangerOpen(o => !o)} 
                    className="flex items-center gap-2 text-text-secondary hover:text-accent cursor-pointer text-xs focus:outline-none truncate"
                    title="Change project group"
                >
                    <div className={`w-2 h-2 rounded-full ${group?.color || 'bg-gray-500'} shrink-0`}></div>
                    <span className="truncate font-medium">{group?.name || 'Unassigned'}</span>
                    <ChevronDownIcon className="w-3 h-3 shrink-0" />
                </button>
                {isGroupChangerOpen && (
                    <div className="absolute bottom-full mb-1 w-40 bg-secondary border border-border-color rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
                        {projectGroups.map(g => (
                            <button 
                                key={g.id} 
                                onClick={() => {
                                    updateResource({ ...resource, projectGroupId: g.id });
                                    setGroupChangerOpen(false);
                                }}
                                className="w-full text-left flex items-center gap-2 p-2 hover:bg-highlight cursor-pointer"
                            >
                                <div className={`w-2 h-2 rounded-full ${g.color} shrink-0`}></div>
                                <span className="text-sm text-text-primary">{g.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Project Tags and Changer */}
            <div className="flex items-center gap-2 min-w-0">
                <ProjectMultiSelect
                    selectedProjectIds={resource.projectIds}
                    onSelectionChange={(ids) => updateResource({ ...resource, projectIds: ids })}
                    projects={projects}
                    projectGroups={projectGroups}
                >
                    <div className="text-text-secondary hover:text-accent cursor-pointer shrink-0" title="Link to projects">
                        <TagIcon className="w-3.5 h-3.5" />
                    </div>
                </ProjectMultiSelect>
                <div className="flex items-center gap-1 flex-wrap min-w-0">
                     {linkedProjects.length > 0 ? (
                        linkedProjects.map(p => (
                            <span key={p.id} className="bg-secondary px-1.5 py-0.5 rounded text-text-secondary truncate max-w-full">{p.name}</span>
                        ))
                    ) : (
                        <span className="text-text-secondary/70 italic">No projects linked</span>
                    )}
                </div>
            </div>
        </div>
    );
};


// ResourceCard Component
const ResourceCard: React.FC<{ resource: Resource; size: 'sm' | 'md' | 'lg' }> = ({ resource, size }) => {
    const { updateResource, deleteResource } = useResource();
    const [notes, setNotes] = useState(resource.notes);
    const handleNotesBlur = () => { if (notes !== resource.notes) updateResource({ ...resource, notes }); };
    const cardSizeClasses = { sm: 'w-64', md: 'w-80', lg: 'w-96' };
    const thumbHeightClasses = { sm: 'h-32', md: 'h-40', lg: 'h-48' };

    return (
        <div className={`flex flex-col bg-highlight rounded-lg border border-border-color ${cardSizeClasses[size]}`}>
            <a href={resource.url} target="_blank" rel="noopener noreferrer" className={`bg-secondary ${thumbHeightClasses[size]} flex items-center justify-center p-2 rounded-t-lg`}>
                <img src={resource.thumbnailUrl} alt={resource.title} className="max-w-full max-h-full object-contain" onError={(e) => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZT0iI2M5ZDFkOSI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNMTMuMTkgOC42ODhhNC41IDQuNSAwIDAxMS4yNDIgNy4yNDRsLTQuNSA0LjVhNC41IDQuNSAwIDAxLTYuMzY0LTYuMzY0bDEuNzU3LTEuNzU3bTEzLjM1LS42MjJsMS43NTctMS43NTdhNC41IDQuNSAwIDAwLTYuMzY0LTYuMzY0bC00LjUgNC41YTQuNSA0LjUgMCAwMDEuMjQyIDcuMjQ0IiAvPjwvc3ZnPg==`; t.classList.add('p-6', 'bg-highlight'); }} />
            </a>
            <div className="p-3 flex-grow flex flex-col">
                <a href={resource.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-accent truncate flex items-center gap-1.5"><LinkIcon className="w-4 h-4 shrink-0"/>{resource.title}</a>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={handleNotesBlur} placeholder="Add notes..." className="text-sm text-text-secondary bg-transparent w-full resize-none my-2 flex-grow focus:outline-none focus:ring-1 focus:ring-accent rounded -mx-1 px-1" />
                <div className="flex items-center justify-end text-xs gap-2"><button onClick={() => deleteResource(resource.id)} title="Delete" className="p-1 text-text-secondary hover:text-red-500"><TrashIcon className="w-4 h-4"/></button></div>
                <ResourceAssignments resource={resource} />
            </div>
        </div>
    );
};

// ResourceListItem Component
const ResourceListItem: React.FC<{ resource: Resource }> = ({ resource }) => {
    const { updateResource, deleteResource } = useResource();
    const [notes, setNotes] = useState(resource.notes);
    const handleNotesBlur = () => { if (notes !== resource.notes) updateResource({ ...resource, notes }); };

    return (
        <div className="flex items-center gap-4 bg-highlight p-2 rounded-lg border border-transparent hover:border-border-color">
            <img src={resource.thumbnailUrl} alt={resource.title} className="w-10 h-10 object-contain rounded border border-border-color shrink-0" onError={(e) => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZT0iI2M5ZDFkOSI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNMTMuMTkgOC42ODhhNC41IDQuNSAwIDAxMS4yNDIgNy4yNDRsLTQuNSA0LjVhNC41IDQuNSAwIDAxLTYuMzY0LTYuMzY0bDEuNzU3LTEuNzU3bTEzLjM1LS42MjJsMS43NTctMS43NTdhNC41IDQuNSAwIDAwLTYuMzY0LTYuMzY0bC00LjUgNC41YTQuNSA0LjUgMCAwMDEuMjQyIDcuMjQ0IiAvPjwvc3ZnPg==`; t.classList.add('p-1.5', 'bg-secondary'); }} />
            <div className="flex-grow min-w-0"><a href={resource.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-accent truncate block">{resource.title}</a></div>
            <div className="w-1/3"><textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={handleNotesBlur} placeholder="Notes..." className="text-sm w-full bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-accent rounded px-1"/></div>
            <div className="w-48 shrink-0"><ResourceAssignments resource={resource} /></div>
            <button onClick={() => deleteResource(resource.id)} title="Delete" className="p-1 text-text-secondary hover:text-red-500"><TrashIcon className="w-4 h-4"/></button>
        </div>
    );
};


// ResourceView Component
const ResourceView: React.FC<{ onAddResource: () => void }> = ({ onAddResource }) => {
    const { resources, loading } = useResource();
    const { projects, projectGroups } = useProject();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [thumbSize, setThumbSize] = useState<'sm' | 'md' | 'lg'>('sm');
    const [filterGroupId, setFilterGroupId] = useState('all');
    const [filterProjectId, setFilterProjectId] = useState('all');
    const [isExportOpen, setIsExportOpen] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    useClickOutside(exportRef, () => setIsExportOpen(false));
    const { downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();

    const filteredResources = useMemo(() => {
        return resources.filter(res => {
            const groupMatch = filterGroupId === 'all' || res.projectGroupId === filterGroupId;
            const projectMatch = filterProjectId === 'all' || res.projectIds.includes(filterProjectId);
            return groupMatch && projectMatch;
        });
    }, [resources, filterGroupId, filterProjectId]);

    const handleExportCSV = () => {
        const headers = ['Title', 'URL', 'Notes', 'Project Group', 'Projects'];
        const projectGroupMap = new Map(projectGroups.map(g => [g.id, g.name]));
        const projectMap = new Map(projects.map(p => [p.id, p.name]));
        const rows = filteredResources.map(res => [
            `"${res.title.replace(/"/g, '""')}"`, `"${res.url}"`, `"${res.notes.replace(/"/g, '""')}"`,
            `"${projectGroupMap.get(res.projectGroupId) || 'N/A'}"`, `"${res.projectIds.map(id => projectMap.get(id) || '').join(', ')}"`
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "resources.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExportOpen(false);
    };
    
    return (
        <div className="h-full flex flex-col">
            <header className="flex-wrap items-center justify-between p-2 mb-4 gap-2 flex">
                <div><h1 className="text-3xl font-bold">Resources</h1><p className="text-text-secondary">Your collection of saved links and notes.</p></div>
                <div className="flex items-center gap-2 flex-wrap">
                     <select value={filterGroupId} onChange={e => setFilterGroupId(e.target.value)} className="bg-highlight border border-border-color rounded-md p-2 text-sm"><option value="all">All Groups</option>{projectGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                     <select value={filterProjectId} onChange={e => setFilterProjectId(e.target.value)} className="bg-highlight border border-border-color rounded-md p-2 text-sm"><option value="all">All Projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                     <div className="bg-highlight p-1 rounded-lg flex"><button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-accent' : 'hover:bg-secondary'}`} title="Grid View"><ViewGridIcon className="w-5 h-5" /></button><button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-accent' : 'hover:bg-secondary'}`} title="List View"><ViewListIcon className="w-5 h-5" /></button></div>
                     {viewMode === 'grid' && <select value={thumbSize} onChange={e => setThumbSize(e.target.value as any)} className="bg-highlight border border-border-color rounded-md p-2 text-sm"><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select>}
                     <div className="relative" ref={exportRef}><button onClick={() => setIsExportOpen(!isExportOpen)} className="flex items-center gap-1.5 px-3 py-2 bg-highlight text-text-secondary rounded-lg hover:bg-gray-700">Export <ChevronDownIcon className="w-4 h-4" /></button>
                        {isExportOpen && <div className="absolute top-full right-0 mt-1 w-40 bg-secondary border border-border-color rounded-md shadow-lg z-10"><button onClick={handleExportCSV} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-highlight"><DocumentTextIcon className="w-4 h-4"/>Export CSV</button><button onClick={() => downloadImage('resources.png')} disabled={isDownloading} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-highlight"><DownloadIcon className="w-4 h-4"/>{isDownloading ? 'Exporting...' : 'Export PNG'}</button></div>}
                    </div>
                    <button onClick={onAddResource} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-500"><PlusIcon className="w-5 h-5" /><span>Add Resource</span></button>
                </div>
            </header>
            {loading ? <div className="flex-grow flex items-center justify-center"><Spinner/></div>
            : filteredResources.length === 0 ? <div className="flex-grow flex items-center justify-center text-text-secondary">No resources found. Try adjusting your filters.</div>
            : (<div ref={gridRef} className="flex-grow overflow-y-auto p-1">{viewMode === 'grid' ? (<div className="flex flex-wrap gap-4 p-2">{filteredResources.map(res => <ResourceCard key={res.id} resource={res} size={thumbSize} />)}</div>) : (<div className="space-y-2 p-2">{filteredResources.map(res => <ResourceListItem key={res.id} resource={res} />)}</div>)}</div>)}
        </div>
    );
};


// --- App Component ---
type MainView = 'projects' | 'habits' | 'inbox' | 'calendar' | 'global-mindmap' | 'global-gantt' | 'resources';

export default function App() {
  const { selectedProject, selectedProjectId, selectProject } = useProject();
  const { shouldShowReview, setReviewShown } = useWeeklyReview();
  const { loading: authLoading } = useAuth();
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState<boolean>(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [isGroupEditorOpen, setIsGroupEditorOpen] = useState<boolean>(false);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState<boolean>(false);

  const [mainView, setMainView] = useState<MainView>('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Show the weekly review modal when the context says so.
  useEffect(() => {
    if (shouldShowReview) {
      setIsReviewModalOpen(true);
    }
  }, [shouldShowReview]);

  // Command Bar keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setIsCommandBarOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Effect to close mobile sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  // Effect to switch to project view when a project is selected
  // and close the mobile sidebar
  useEffect(() => {
    if (selectedProjectId) {
      setMainView('projects');
      if (isMobile) {
        setIsSidebarOpen(false);
      }
    }
  }, [selectedProjectId, isMobile]);
  
  const handleSetMainView = (view: MainView) => {
    setMainView(view);
    if (view !== 'projects') {
        selectProject(null);
    }
    if (isMobile) setIsSidebarOpen(false);
  }

  const renderMainContent = () => {
    switch (mainView) {
      case 'inbox':
        return <InboxView />;
      case 'calendar':
        return <GlobalCalendar />;
      case 'global-mindmap':
        return <GlobalMindMapView onNewProject={() => setIsProjectModalOpen(true)} />;
      case 'global-gantt':
        return <GlobalGanttView />;
      case 'habits':
        return <HabitTracker onNewHabit={() => setIsHabitModalOpen(true)} />;
      case 'resources':
        return <ResourceView onAddResource={() => setIsAddResourceModalOpen(true)} />;
      case 'projects':
      default:
        if (selectedProject) {
          return <TaskList key={selectedProject.id} />;
        }
        return <WelcomePlaceholder onNewProject={() => setIsProjectModalOpen(true)} />;
    }
  };

  if (authLoading) {
    return <GlobalLoader />;
  }

  return (
    <div className="flex flex-col h-screen font-sans bg-primary">
      <GlobalLoader />
      <Header 
        onNewProject={() => setIsProjectModalOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isMobile={isMobile}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          mainView={mainView}
          onSetMainView={handleSetMainView}
          isMobile={isMobile}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        >
          <ProjectList 
            onNewProject={() => setIsProjectModalOpen(true)}
            onEditGroups={() => setIsGroupEditorOpen(true)}
          />
        </Sidebar>
        <main className="flex-1 p-2 md:p-6 overflow-y-auto">
          <ErrorBoundary>
            {renderMainContent()}
          </ErrorBoundary>
        </main>
      </div>
      {isProjectModalOpen && (
        <CreateProjectModal 
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
        />
      )}
      {isHabitModalOpen && (
        <CreateHabitModal
          isOpen={isHabitModalOpen}
          onClose={() => setIsHabitModalOpen(false)}
        />
      )}
       {isAddResourceModalOpen && (
        <AddResourceModal
          isOpen={isAddResourceModalOpen}
          onClose={() => setIsAddResourceModalOpen(false)}
        />
      )}
      {isGroupEditorOpen && (
        <ProjectGroupEditorModal
          isOpen={isGroupEditorOpen}
          onClose={() => setIsGroupEditorOpen(false)}
        />
      )}
      {isCommandBarOpen && (
        <CommandBar 
            isOpen={isCommandBarOpen}
            onClose={() => setIsCommandBarOpen(false)}
        />
      )}
      {isReviewModalOpen && (
        <WeeklyReviewModal
            isOpen={isReviewModalOpen}
            onClose={() => {
                setIsReviewModalOpen(false);
                setReviewShown();
            }}
        />
      )}
    </div>
  );
}