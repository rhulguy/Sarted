import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Header from './components/Header';
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
import CommandBar from './components/CommandBar';
import WeeklyReviewModal from './components/WeeklyReviewModal';
import { useWeeklyReview } from './contexts/WeeklyReviewContext';
import GlobalCalendar from './components/GlobalCalendar';
import GlobalMindMapView from './components/GlobalMindMapView';
import { useAuth } from './contexts/AuthContext';
import GlobalGanttView from './components/GlobalGanttView';
import ProjectGroupEditorModal from './components/ProjectGroupEditorModal';
import { Project, ProjectGroup, ProjectView, Task, Resource } from './types';
import { PlusIcon, ChevronDownIcon, SartedLogoIcon, DownloadIcon, ImageIcon, DocumentTextIcon, ViewGridIcon, UploadIcon, SparklesIcon, TrashIcon, LinkIcon, ViewListIcon, TagIcon } from './components/IconComponents';
import Spinner from './components/Spinner';
import SettingsView from './components/SettingsView';
import { useLoading } from './contexts/LoadingContext';
import { generateImage } from './services/geminiService';
import { useDownloadImage } from './hooks/useDownloadImage';
import ExportDropdown from './components/ExportDropdown';
import { exportResourcesToCsv, exportResourcesToDoc } from './utils/exportUtils';
import HomePage from './components/HomePage';
import GlobalListView from './components/GlobalListView';


// --- HELPER HOOK & FUNCTION (Moved to top-level for stability) ---
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

// --- STABLE TOP-LEVEL COMPONENT DEFINITIONS ---

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
                <div className="absolute top-full right-0 mt-2 w-64 bg-card-background border border-border-color rounded-xl shadow-soft z-20 max-h-60 overflow-y-auto p-2">
                    {groupedProjects.length > 0 ? (
                        groupedProjects.map(group => (
                            <div key={group.id} className="p-1">
                                <h4 className="text-xs font-semibold text-text-secondary uppercase px-2 mb-1 flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${group.color} shrink-0`}></div>
                                    {group.name}
                                </h4>
                                {group.projects.map(project => (
                                     <label key={project.id} className="flex items-center space-x-3 p-2 hover:bg-app-background cursor-pointer rounded-lg">
                                        <input
                                            type="checkbox"
                                            checked={selectedProjectIds.includes(project.id)}
                                            onChange={() => handleToggleProject(project.id)}
                                            className="w-4 h-4 rounded text-accent-blue focus:ring-accent-blue"
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

const AddResourceModal: React.FC<{ isOpen: boolean; onClose: () => void; initialContext?: { projectId?: string; groupId?: string } }> = ({ isOpen, onClose, initialContext }) => {
    const { addResource } = useResource();
    const { projects, projectGroups } = useProject();
    const [url, setUrl] = useState('');
    const [metadata, setMetadata] = useState<{ title: string; thumbnailUrl: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [projectGroupId, setProjectGroupId] = useState('');
    const [projectIds, setProjectIds] = useState<string[]>([]);
    const debounceTimeout = useRef<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            setProjectGroupId(initialContext?.groupId || (projectGroups.length > 0 ? projectGroups[0].id : ''));
            setProjectIds(initialContext?.projectId ? [initialContext.projectId] : []);
        }
    }, [isOpen, initialContext, projectGroups]);


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
        if (!metadata || !url) return;
        if (projectGroups.length > 0 && !projectGroupId) return; // Prevent adding if group not selected
        addResource({
            url, title: metadata.title, thumbnailUrl: metadata.thumbnailUrl, notes: '',
            projectGroupId, projectIds, isPinned: false, createdAt: Date.now(),
        });
        handleClose();
    };

    const handleClose = () => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        setUrl(''); setMetadata(null); setError(''); setIsLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-card-background rounded-2xl shadow-soft p-6 md:p-8 w-full max-w-xl flex flex-col">
                <div className="flex justify-between items-start mb-4"><h2 className="text-2xl font-bold">Add New Resource</h2><button onClick={handleClose} className="text-3xl text-text-secondary hover:text-text-primary">&times;</button></div>
                <div className="flex-grow space-y-4">
                    <div><label htmlFor="resourceUrl" className="block text-sm font-medium text-text-secondary">URL</label><div className="relative mt-1"><input id="resourceUrl" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="block w-full bg-app-background border-border-color rounded-lg p-2 pr-10" />{isLoading && (<div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><Spinner /></div>)}</div></div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    {metadata && (
                        <div className="space-y-3 animate-fade-in">
                            <div className="flex items-center gap-4">
                                <img src={metadata.thumbnailUrl} alt="Favicon" className="w-12 h-12 rounded-full border-2 border-border-color p-1 object-contain" onError={(e) => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZT0iIzY4NzI4MCI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNMTMuMTkgOC42ODhhNC41IDQuNSAwIDAxMS4yNDIgNy4yNDRsLTQuNSA0LjVhNC41IDQuNSAwIDAxLTYuMzY0LTYuMzY0bDEuNzU3LTEuNzU3bTEzLjM1LS42MjJsMS43NTctMS43NTdhNC41IDQuNSAwIDAwLTYuMzY0LTYuMzY0bC00LjUgNC41YTQuNSA0LjUgMCAwMDEuMjQyIDcuMjQ0IiAvPjwvc3ZnPg==`; t.classList.add('p-2', 'bg-app-background'); }} />
                                <div className="flex-grow"><h3 className="text-lg font-semibold">{metadata.title}</h3><p className="text-sm text-text-secondary truncate">{url}</p></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-border-color">
                                <div><label className="text-xs font-medium text-text-secondary">Project Group</label><select value={projectGroupId} onChange={e => setProjectGroupId(e.target.value)} className="w-full mt-1 bg-app-background border border-border-color rounded-lg p-2 text-sm"><option value="" disabled>Select a group</option>{projectGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                                <div><label className="text-xs font-medium text-text-secondary">Link to Projects</label>
                                    <ProjectMultiSelect selectedProjectIds={projectIds} onSelectionChange={setProjectIds} projects={projects} projectGroups={projectGroups}>
                                        <div className="w-full mt-1 bg-app-background border border-border-color rounded-lg p-2 text-sm text-left flex justify-between items-center">
                                            <span>{projectIds.length > 0 ? `${projectIds.length} project(s) selected` : 'None selected'}</span>
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </ProjectMultiSelect>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-6 flex justify-end gap-2"><button onClick={handleClose} className="px-4 py-2 bg-app-background rounded-lg hover:bg-border-color">Cancel</button><button onClick={handleAddResource} disabled={!metadata || isLoading || (projectGroups.length > 0 && !projectGroupId)} className="px-4 py-2 bg-accent-blue text-white rounded-lg disabled:opacity-50">Add Resource</button></div>
            </div>
        </div>
    );
};

const SlideshowModal: React.FC<{
    images: string[];
    isOpen: boolean;
    onClose: () => void;
}> = ({ images, isOpen, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [speed, setSpeed] = useState(500); // ms

    useEffect(() => {
        if (!isOpen || images.length === 0) return;
        const timer = setTimeout(() => {
            setCurrentIndex(prev => (prev + 1) % images.length);
        }, speed);
        return () => clearTimeout(timer);
    }, [isOpen, currentIndex, speed, images.length]);

    if (!isOpen || images.length === 0) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 p-4" onClick={onClose}>
            <img src={images[currentIndex]} alt="Slideshow" className="max-w-full max-h-[80vh] object-contain rounded-lg"/>
            <div className="absolute bottom-5 w-full max-w-md p-2 bg-black/50 rounded-lg">
                <label className="flex items-center justify-center gap-3 text-white">
                    <span>Slow</span>
                    <input
                        type="range"
                        min="100" // 0.1s
                        max="1000" // 1s
                        step="100"
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        className="w-full"
                    />
                    <span>Fast</span>
                </label>
            </div>
            <button onClick={onClose} className="absolute top-4 right-4 text-white text-4xl">&times;</button>
        </div>
    );
};

const DreamBoardView: React.FC = () => {
    const { visibleProjects, updateProject } = useProject();
    const { dispatch: loadingDispatch } = useLoading();
    const [prompt, setPrompt] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [slideshowOpen, setSlideshowOpen] = useState(false);
    const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();

    const allImages = useMemo(() => {
        return visibleProjects.flatMap(p => p.dreamBoardImages || []);
    }, [visibleProjects]);

    useEffect(() => {
        if (!selectedProjectId && visibleProjects.length > 0) {
            setSelectedProjectId(visibleProjects[0].id);
        }
    }, [visibleProjects, selectedProjectId]);

    const handleGenerateImage = async () => {
        if (!prompt.trim() || !selectedProjectId) return;
        
        const project = visibleProjects.find(p => p.id === selectedProjectId);
        if (!project) return;

        loadingDispatch({ type: 'SET_LOADING', payload: true });
        try {
            const imageUrl = await generateImage(prompt);
            const updatedImages = [...(project.dreamBoardImages || []), imageUrl];
            await updateProject(project.id, { dreamBoardImages: updatedImages });
            setPrompt('');
        } catch (error) {
            console.error("Failed to generate dream board image:", error);
            alert("Could not generate image. Please check console for details.");
        } finally {
            loadingDispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    
    return (
        <div className="h-full flex flex-col p-4 md:p-6">
            <header className="mb-6 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-text-primary">Dream Board</h1>
                <p className="text-text-secondary">Visualize your goals and dreams. Generate images to inspire you.</p>
              </div>
              <button 
                  onClick={() => downloadImage('dream-board.png')} 
                  disabled={isDownloading} 
                  className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-app-background text-text-secondary rounded-lg hover:bg-border-color transition-colors disabled:opacity-50"
              >
                  <DownloadIcon className="w-4 h-4" />
                  <span>{isDownloading ? 'Exporting...' : 'Export as Image'}</span>
              </button>
            </header>
            <div className="mb-4 p-4 bg-card-background rounded-xl border border-border-color">
                <div className="flex flex-col md:flex-row gap-2">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A cozy cabin in a snowy forest..."
                        className="flex-grow bg-app-background border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    />
                    <select
                        value={selectedProjectId || ''}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="bg-app-background border border-border-color rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    >
                        {visibleProjects.map(p => <option key={p.id} value={p.id}>Add to: {p.name}</option>)}
                    </select>
                    <button onClick={handleGenerateImage} className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:opacity-90 flex items-center justify-center gap-2">
                        <SparklesIcon className="w-5 h-5"/>
                        <span>Generate</span>
                    </button>
                </div>
            </div>
            <div ref={downloadRef} className="flex-grow overflow-y-auto bg-app-background p-4 rounded-lg">
                {allImages.length === 0 ? (
                    <div className="text-center py-10 text-text-secondary">
                        <ImageIcon className="w-12 h-12 mx-auto mb-4" />
                        <p>Your dream board is empty. Generate an image to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {allImages.map((img, index) => (
                            <div key={index} className="aspect-video bg-card-background rounded-lg overflow-hidden cursor-pointer group relative" onClick={() => setSlideshowOpen(true)}>
                                <img src={img} alt="Dream board" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white font-bold">View</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <SlideshowModal images={allImages} isOpen={slideshowOpen} onClose={() => setSlideshowOpen(false)} />
        </div>
    );
};

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
            res.notes.toLowerCase().includes(lowercasedFilter)
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
                {loading ? <p>Loading...</p> : 
                groupedResources.length === 0 ? (
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

// --- App Component ---
export type MainView = 'projects' | 'habits' | 'list-inbox' | 'calendar' | 'global-mindmap' | 'global-gantt' | 'resources' | 'dreamboard' | 'settings';

export default function App() {
  const { projects, selectedProject, selectProject } = useProject();
  const { shouldShowReview, setReviewShown } = useWeeklyReview();
  const { user, loading: authLoading } = useAuth();
  const prevUser = useRef(user);
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState<boolean>(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [isGroupEditorOpen, setIsGroupEditorOpen] = useState<boolean>(false);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState<boolean>(false);
  const [resourceModalContext, setResourceModalContext] = useState<{ projectId?: string; groupId?: string } | null>(null);
  const [initialProjectView, setInitialProjectView] = useState<ProjectView>('list');

  const [mainView, setMainView] = useState<MainView>('projects');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  
  useEffect(() => {
    if (authLoading) return;
    if (!prevUser.current && user) {
        setMainView('projects');
    } else if (!user) {
        setMainView('projects'); // Default to dashboard/home
    }
    prevUser.current = user;
  }, [user, authLoading]);

  useEffect(() => {
    if (shouldShowReview) {
      setIsReviewModalOpen(true);
    }
  }, [shouldShowReview]);

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

  useEffect(() => {
    if (!isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);
  
  const handleSetMainView = (view: MainView) => {
    setMainView(view);
    if (selectedProject) {
        selectProject(null);
    }
    setInitialProjectView('list');
    if (isMobile) setIsSidebarOpen(false);
  }
  
  const handleNavigateToProject = (projectId: string, view: ProjectView) => {
    setInitialProjectView(view);
    setMainView('projects'); 
    selectProject(projectId);
  };

  const handleOpenAddResourceModal = (context?: { projectId?: string; groupId?: string }) => {
    setResourceModalContext(context || null);
    setIsAddResourceModalOpen(true);
  };

  const renderMainContent = () => {
    if (selectedProject) {
      return <TaskList key={selectedProject.id} onAddResource={handleOpenAddResourceModal} initialView={initialProjectView} />;
    }

    switch (mainView) {
      case 'list-inbox':
        return <GlobalListView />;
      case 'calendar':
        return <GlobalCalendar />;
      case 'dreamboard':
        return <DreamBoardView />;
      case 'global-mindmap':
        return <GlobalMindMapView onNewProject={() => setIsProjectModalOpen(true)} onNavigateToProject={handleNavigateToProject} />;
      case 'global-gantt':
        return <GlobalGanttView onNavigateToProject={handleNavigateToProject} />;
      case 'habits':
        return <HabitTracker onNewHabit={() => setIsHabitModalOpen(true)} />;
      case 'resources':
        return <ResourceView onAddResource={() => handleOpenAddResourceModal()} />;
      case 'settings':
        return <SettingsView />;
      case 'projects':
      default:
        if (projects.length === 0 && user) { 
            return <WelcomePlaceholder onNewProject={() => setIsProjectModalOpen(true)} />;
        }
        return <HomePage onNavigate={handleSetMainView} />;
    }
  };

  if (authLoading) {
    return (
        <div className="fixed inset-0 bg-app-background flex items-center justify-center">
            <SartedLogoIcon className="w-16 h-16 animate-pulse-subtle" />
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen font-sans bg-app-background">
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
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 bg-card-background md:p-0 overflow-y-auto min-h-0">
            <ErrorBoundary>
              {renderMainContent()}
            </ErrorBoundary>
          </main>
        </div>
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
          initialContext={resourceModalContext || undefined}
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