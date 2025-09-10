import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Task, ProjectGroup, BaseMindMapNode, LaidoutMindMapNode, ProjectView } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { PlusIcon, ImageIcon, EditIcon, DownloadIcon } from './IconComponents';
import { generateImage } from '../services/geminiService';
import Spinner from './Spinner';
import { layoutGlobalTree } from '../utils/mindMapLayouts';
import { useDownloadImage } from '../hooks/useDownloadImage';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;

interface GlobalMindMapViewProps {
    onNewProject: () => void;
    onNavigateToProject: (projectId: string, view: 'mindmap') => void;
}

interface EditableBaseMindMapNode extends BaseMindMapNode {
    projectId?: string; 
}
interface EditableLaidoutMindMapNode extends LaidoutMindMapNode {
    projectId?: string;
}

const GlobalMindMapView: React.FC<GlobalMindMapViewProps> = ({ onNewProject, onNavigateToProject }) => {
    const { visibleProjects, projectGroups, addTask, addSubtask, updateTask } = useProject();
    const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
    const svgRef = useRef<SVGSVGElement>(null);
    const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 800 });
    const [isPanning, setIsPanning] = useState(false);
    const [addingToNode, setAddingToNode] = useState<EditableLaidoutMindMapNode | null>(null);
    const [editingNode, setEditingNode] = useState<EditableLaidoutMindMapNode | null>(null);
    const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
    const [newNodeName, setNewNodeName] = useState('');
    const [newNodeStartDate, setNewNodeStartDate] = useState('');
    const [newNodeEndDate, setNewNodeEndDate] = useState('');
    const newNodeInputRef = useRef<HTMLInputElement>(null);
    const isSubmittingRef = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const viewStateRef = useRef(viewBox);

    useEffect(() => {
        viewStateRef.current = viewBox;
    }, [viewBox]);

    useEffect(() => {
        if (addingToNode) {
            isSubmittingRef.current = false;
            newNodeInputRef.current?.focus();
        }
    }, [addingToNode]);

    useEffect(() => {
        if (editingNode) setAddingToNode(null);
    }, [editingNode]);

    const groupColorMap = useMemo(() => new Map(projectGroups.map(g => [g.id, g.color])), [projectGroups]);

    const { nodes, links } = useMemo(() => {
        const buildTaskHierarchy = (tasks: Task[], projectId: string): EditableBaseMindMapNode[] => {
            return tasks.map(task => ({
                id: task.id, name: task.name, task, projectId, isProject: false,
                isCompleted: task.completed, imageUrl: task.imageUrl,
                children: buildTaskHierarchy(task.subtasks || [], projectId),
            }));
        };

        const groupNodes = projectGroups
            .map((group): EditableBaseMindMapNode | null => {
                const projectsInGroup = visibleProjects
                    .filter(p => p.groupId === group.id)
                    .map((p): EditableBaseMindMapNode => ({
                        id: p.id,
                        name: p.name,
                        isProject: true,
                        isCompleted: false,
                        color: groupColorMap.get(p.groupId) || 'bg-text-secondary',
                        projectId: p.id,
                        children: buildTaskHierarchy(p.tasks || [], p.id),
                    }));
                
                if (projectsInGroup.length === 0) {
                    return null;
                }

                return {
                    id: group.id,
                    name: group.name,
                    isProject: true, 
                    isCompleted: false,
                    color: group.color,
                    children: projectsInGroup,
                };
            })
            .filter((g): g is EditableBaseMindMapNode => g !== null);

        const rootNode: EditableBaseMindMapNode = {
            id: 'global-root', name: 'All Projects', isProject: true, isCompleted: false,
            color: 'bg-accent-blue', children: groupNodes,
        };
        
        const laidOutRoot = layoutGlobalTree(rootNode);
        
        const flattenedNodes: EditableLaidoutMindMapNode[] = [];
        const flattenedLinks: { source: EditableLaidoutMindMapNode; target: EditableLaidoutMindMapNode }[] = [];
        
        const traverse = (node: LaidoutMindMapNode) => {
            flattenedNodes.push(node as EditableLaidoutMindMapNode);
            node.children.forEach(child => {
                flattenedLinks.push({ source: node, target: child });
                traverse(child);
            });
        };

        if (laidOutRoot) {
          traverse(laidOutRoot);
        }

        return { nodes: flattenedNodes, links: flattenedLinks };
    }, [visibleProjects, projectGroups, groupColorMap]);
    
    const projectIdsKey = useMemo(() => visibleProjects.map(p => p.id).sort().join(','), [visibleProjects]);

    useEffect(() => {
        if (svgRef.current && nodes.length > 0) {
            const { width: containerWidth, height: containerHeight } = svgRef.current.getBoundingClientRect();
            if (containerWidth === 0 || containerHeight === 0) return;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            nodes.forEach(node => {
                minX = Math.min(minX, node.x - NODE_WIDTH / 2);
                maxX = Math.max(maxX, node.x + NODE_WIDTH / 2);
                minY = Math.min(minY, node.y - NODE_HEIGHT / 2);
                maxY = Math.max(maxY, node.y + NODE_HEIGHT / 2);
            });
            
            if (nodes.length === 1) {
                const node = nodes[0];
                minX = node.x - NODE_WIDTH / 2; maxX = node.x + NODE_WIDTH / 2;
                minY = node.y - NODE_HEIGHT / 2; maxY = node.y + NODE_HEIGHT / 2;
            }

            const treeWidth = maxX - minX;
            const treeHeight = maxY - minY;
            const PADDING = 150;

            const contentWidthWithPadding = treeWidth + PADDING * 2;
            const contentHeightWithPadding = treeHeight + PADDING * 2;
            
            const scaleX = containerWidth / contentWidthWithPadding;
            const scaleY = containerHeight / contentHeightWithPadding;
            const scale = Math.min(scaleX, scaleY, 1);

            const newViewBoxWidth = containerWidth / scale;
            const newViewBoxHeight = containerHeight / scale;

            const treeCenterX = minX + treeWidth / 2;
            const treeCenterY = minY + treeHeight / 2;

            setViewBox({
                w: newViewBoxWidth,
                h: newViewBoxHeight,
                x: treeCenterX - newViewBoxWidth / 2,
                y: treeCenterY - newViewBoxHeight / 2,
            });
        }
        setAddingToNode(null);
        setEditingNode(null);
    }, [nodes, projectIdsKey]);

    const handleNewNodeCommit = async () => {
        if (isSubmittingRef.current || !addingToNode) return;
        const taskName = newNodeName.trim();
        if (taskName) {
            isSubmittingRef.current = true;
            const newTask: Omit<Task, 'id'> = { name: taskName, description: '', completed: false, subtasks: [], startDate: newNodeStartDate || undefined, endDate: newNodeEndDate || undefined };
            
            const { isProject, projectId, id } = addingToNode;

            if (isProject && projectId) {
                await addTask(projectId, { ...newTask, id: `task-${Date.now()}` });
            } else if (!isProject && projectId) {
                await addSubtask(projectId, id, { ...newTask, id: `task-${Date.now()}` });
            }
        }
        setAddingToNode(null);
        setNewNodeName(''); setNewNodeStartDate(''); setNewNodeEndDate('');
    };

    const handleDateUpdate = async (node: EditableLaidoutMindMapNode, dates: { startDate?: string, endDate?: string }) => {
        if (!node.task || !node.projectId) return;
        await updateTask(node.projectId, { ...node.task, ...dates });
    };

    const handleGenerateImage = async (node: EditableLaidoutMindMapNode) => {
        if (!node.task || !node.projectId) return;
        setGeneratingImageFor(node.id);
        try {
            const imageUrl = await generateImage(`A simple, clean icon representing: ${node.name}`);
            await updateTask(node.projectId, { ...node.task, imageUrl });
        } catch (e) { console.error(e); } finally { setGeneratingImageFor(null); }
    };
    
    const handleAddClick = (e: React.MouseEvent, node: EditableLaidoutMindMapNode) => {
        e.stopPropagation();
        setEditingNode(null);
        // A project node is one that is a project but not a group
        const isProjectNode = node.isProject && node.projectId && node.id === node.projectId;
        if (node.id === 'global-root') {
            onNewProject();
        } else if(isProjectNode || !node.isProject) {
            setAddingToNode(node);
        }
    };
    
    const handleDoubleClick = (e: React.MouseEvent, node: EditableLaidoutMindMapNode) => {
        const isProjectNode = node.isProject && node.projectId && node.id === node.projectId;
        if(isProjectNode) {
            onNavigateToProject(node.projectId!, 'mindmap');
        } else if (!node.isProject && node.projectId) {
            onNavigateToProject(node.projectId, 'mindmap');
        }
    };

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setAddingToNode(null); setEditingNode(null); setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            svgRef.current?.classList.add('cursor-grabbing');
        }
    }, []);

    const handleMouseUp = useCallback(() => { setIsPanning(false); svgRef.current?.classList.remove('cursor-grabbing'); }, []);
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        const scale = viewStateRef.current.w / (svgRef.current?.clientWidth || 1);
        setViewBox(vb => ({ ...vb, x: vb.x - dx * scale, y: vb.y - dy * scale }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    }, [isPanning]);
    
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const svg = svgRef.current; if (!svg) return;
        const zoomFactor = 1.1;
        const { clientX, clientY, deltaY } = e;
        const rect = svg.getBoundingClientRect();
        const mouseX = clientX - rect.left; const mouseY = clientY - rect.top;
        const currentVB = viewStateRef.current;
        const [svgX, svgY] = [(mouseX / rect.width) * currentVB.w + currentVB.x, (mouseY / rect.height) * currentVB.h + currentVB.y];
        const zoom = deltaY < 0 ? 1 / zoomFactor : zoomFactor;
        const newW = currentVB.w * zoom; const newH = currentVB.h * zoom;
        setViewBox({ w: newW, h: newH, x: svgX - (mouseX / rect.width) * newW, y: svgY - (mouseY / rect.height) * newH });
    }, []);
    
    const getHexColor = (tailwindClass: string) => {
      const colorMap: { [key: string]: string } = {
        'bg-brand-teal': '#14B8A6', 'bg-brand-orange': '#F97316', 'bg-brand-purple': '#8B5CF6',
        'bg-brand-pink': '#EC4899', 'bg-accent-blue': '#3B82F6', 'bg-accent-green': '#10B981',
        'bg-accent-yellow': '#FBBF24', 'bg-accent-red': '#EF4444', 'bg-indigo-500': '#6366F1',
        'bg-text-secondary': '#6B7280'
      };
      return colorMap[tailwindClass] || '#6B7280';
    };

    const getPath = (source: LaidoutMindMapNode, target: LaidoutMindMapNode) => {
        const midX = (source.x + target.x) / 2;
        if (target.x > source.x) { // Right side
            return `M ${source.x + (source.isProject ? 0 : NODE_WIDTH / 2)} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x - NODE_WIDTH / 2} ${target.y}`;
        }
        if (target.x < source.x) { // Left side
            return `M ${source.x - (source.isProject ? 0 : NODE_WIDTH / 2)} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x + NODE_WIDTH / 2} ${target.y}`;
        }
        // Fallback for vertical connections (e.g. root to first level)
        const midY = (source.y + target.y) / 2;
        return `M ${source.x} ${source.y} C ${source.x} ${midY}, ${target.x} ${midY}, ${target.x} ${target.y}`;
    };

    const canAddNode = (node: EditableLaidoutMindMapNode) => {
        const isProjectNode = node.isProject && node.projectId && node.id === node.projectId;
        return node.id === 'global-root' || isProjectNode || !node.isProject;
    }

    return (
        <div ref={downloadRef} className="w-full h-full relative bg-app-background rounded-xl border border-border-color">
             <header className="absolute top-0 left-0 p-4 z-10">
                <h1 className="text-2xl font-bold text-text-primary">Global Mind Map</h1>
                <p className="text-sm text-text-secondary">A unified view of all your projects. Double-click a project to focus.</p>
                <div className="flex items-center gap-2 mt-2">
                    <button onClick={onNewProject} className="flex items-center space-x-2 px-3 py-1.5 bg-accent-blue text-white rounded-lg hover:opacity-90"><PlusIcon className="w-4 h-4" /><span>Add Project</span></button>
                    <button 
                        onClick={() => downloadImage('global-mind-map.png')} 
                        disabled={isDownloading} 
                        className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-card-background text-text-secondary rounded-lg border border-border-color hover:bg-app-background transition-colors disabled:opacity-50"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>{isDownloading ? 'Exporting...' : 'Export Image'}</span>
                    </button>
                </div>
            </header>
            <svg ref={svgRef} className="w-full h-full cursor-grab" viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}>
                <g>{links.map((link, i) => <path key={`link-${i}`} d={getPath(link.source, link.target)} stroke="#E5E7EB" strokeWidth="2" fill="none" />)}</g>
                <g>{nodes.map(node => (
                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`} className="cursor-pointer group" onDoubleClick={(e) => handleDoubleClick(e, node)} onMouseDown={(e) => e.stopPropagation()}>
                        <rect x={-NODE_WIDTH / 2} y={-NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT} rx={20} fill={node.isProject ? getHexColor(node.color!) : "#FFFFFF"} stroke={"#E5E7EB"} strokeWidth="1" />
                        <text x={0} y={node.task?.startDate ? -8 : 0} textAnchor="middle" dominantBaseline="middle" fill={node.isProject ? "#FFFFFF" : "#1F2937"} fontSize="14" fontWeight={node.isProject ? "bold" : "normal"} style={{ pointerEvents: 'none', userSelect: 'none', textDecoration: node.isCompleted ? 'line-through' : 'none', opacity: node.isCompleted ? 0.6 : 1, }}>{node.name.length > 25 ? `${node.name.slice(0, 24)}…` : node.name}</text>
                        {node.task?.startDate && <text x={0} y={15} textAnchor="middle" dominantBaseline="middle" fill={node.isProject ? "#FFFFFF" : "#6B7280"} fontSize="11">{node.task.startDate} → {node.task.endDate}</text>}
                        <g className="opacity-0 group-hover:opacity-100 transition-opacity" transform={`translate(95, -12)`}>
                            {canAddNode(node) && (
                                <g onClick={(e) => handleAddClick(e, node)} className="cursor-pointer">
                                    <rect x="0" y="0" width="24" height="24" rx="4" fill="#FFFFFF" />
                                    <PlusIcon x="4" y="4" className="w-4 h-4 text-text-secondary" />
                                </g>
                            )}
                            {!node.isProject && (<>
                                <g onClick={(e) => { e.stopPropagation(); setEditingNode(node); }} transform={`translate(28, 0)`}><rect x="0" y="0" width="24" height="24" rx="4" fill="#FFFFFF" /><EditIcon x="4" y="4" className="w-4 h-4 text-text-secondary"/></g>
                                <g onClick={(e) => { e.stopPropagation(); handleGenerateImage(node); }} transform={`translate(56, 0)`}>{generatingImageFor === node.id ? (<foreignObject x="0" y="0" width="24" height="24"><Spinner /></foreignObject>) : (<><rect x="0" y="0" width="24" height="24" rx="4" fill="#FFFFFF" /><ImageIcon x="4" y="4" className="w-4 h-4 text-text-secondary"/></>)}</g>
                            </>)}
                        </g>
                    </g>
                ))}</g>
                {addingToNode && (
                    <foreignObject x={addingToNode.x + NODE_WIDTH/2 + 5} y={addingToNode.y - 25} width={NODE_WIDTH + 20} height={100}>
                        <form onSubmit={async (e) => { e.preventDefault(); await handleNewNodeCommit(); }}>
                            <input ref={newNodeInputRef} type="text" value={newNodeName} onChange={e => setNewNodeName(e.target.value)} placeholder={addingToNode.isProject ? "New task..." : "New sub-task..."} className="w-full bg-card-background border border-accent-blue rounded-md p-2 text-sm focus:outline-none" onClick={e => e.stopPropagation()} onBlur={handleNewNodeCommit} onKeyDown={(e) => { if (e.key === 'Escape') setAddingToNode(null); }} />
                            <div className="flex gap-1 mt-1"><input type="date" aria-label="Start Date" value={newNodeStartDate} onChange={(e) => setNewNodeStartDate(e.target.value)} max={newNodeEndDate || undefined} className="w-full bg-card-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue" /><input type="date" aria-label="End Date" value={newNodeEndDate} onChange={(e) => setNewNodeEndDate(e.target.value)} min={newNodeStartDate || undefined} className="w-full bg-card-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue" /></div>
                        </form>
                    </foreignObject>
                )}
                {editingNode && editingNode.task && (
                    <foreignObject x={editingNode.x - NODE_WIDTH/2} y={editingNode.y - NODE_HEIGHT/2} width={NODE_WIDTH} height={NODE_HEIGHT}>
                        <div className="w-full h-full bg-card-background/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-2 gap-1" onClick={(e) => e.stopPropagation()}>
                            <input type="date" aria-label="Start Date" defaultValue={editingNode.task.startDate} onBlur={(e) => handleDateUpdate(editingNode, { startDate: e.target.value })} onKeyDown={(e) => {if(e.key === 'Enter' || e.key === 'Escape') setEditingNode(null)}} className="w-full bg-app-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue" />
                            <input type="date" aria-label="End Date" defaultValue={editingNode.task.endDate} onBlur={(e) => handleDateUpdate(editingNode, { endDate: e.target.value })} onKeyDown={(e) => {if(e.key === 'Enter' || e.key === 'Escape') setEditingNode(null)}} min={editingNode.task.startDate} className="w-full bg-app-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue" />
                        </div>
                    </foreignObject>
                )}
            </svg>
        </div>
    );
};

export default GlobalMindMapView;