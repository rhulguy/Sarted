import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Task, ProjectGroup, BaseMindMapNode, LaidoutMindMapNode } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { PlusIcon, ImageIcon, EditIcon } from './IconComponents';
import { generateImageForTask } from '../services/geminiService';
import Spinner from './Spinner';
import { layoutGlobalTree } from '../utils/mindMapLayouts';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;

interface GlobalMindMapViewProps {
    onNewProject: () => void;
}

interface EditableBaseMindMapNode extends BaseMindMapNode {
    projectId?: string; // Add projectId to track which project a task belongs to
}
interface EditableLaidoutMindMapNode extends LaidoutMindMapNode {
    projectId?: string;
}

const GlobalMindMapView: React.FC<GlobalMindMapViewProps> = ({ onNewProject }) => {
    const { visibleProjects, projectGroups, addTask, addSubtask, updateTask } = useProject();
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

        const projectNodes = visibleProjects.map(p => ({
            id: p.id, name: p.name, isProject: true, isCompleted: false,
            color: groupColorMap.get(p.groupId) || 'bg-text-secondary', projectId: p.id,
            children: buildTaskHierarchy(p.tasks || [], p.id),
        }));

        const rootNode: EditableBaseMindMapNode = {
            id: 'global-root', name: 'All Projects', isProject: true, isCompleted: false,
            color: 'bg-accent-blue', children: projectNodes,
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
    }, [visibleProjects, groupColorMap]);
    
    const projectIdsKey = useMemo(() => visibleProjects.map(p => p.id).sort().join(','), [visibleProjects]);

    useEffect(() => {
        // This effect only resets the view when projects are added/removed.
        if (svgRef.current && nodes.length > 0) {
            const { width, height } = svgRef.current.getBoundingClientRect();
            if (width > 0 && height > 0) {
                setViewBox({ w: width * 2, h: height * 2, x: -width, y: -height });
            }
        }
        setAddingToNode(null);
        setEditingNode(null);
    }, [projectIdsKey]);

    const handleNewNodeCommit = async () => {
        if (isSubmittingRef.current || !addingToNode) return;
        const taskName = newNodeName.trim();
        if (taskName) {
            isSubmittingRef.current = true;
            const newTask: Omit<Task, 'id'> = { name: taskName, description: '', completed: false, subtasks: [], startDate: newNodeStartDate || undefined, endDate: newNodeEndDate || undefined };
            if (addingToNode.isProject && addingToNode.id !== 'global-root') {
                await addTask(addingToNode.id, { ...newTask, id: `task-${Date.now()}` });
            } else if (addingToNode.projectId) {
                await addSubtask(addingToNode.projectId, addingToNode.id, { ...newTask, id: `task-${Date.now()}` });
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
            const imageUrl = await generateImageForTask(node.name);
            await updateTask(node.projectId, { ...node.task, imageUrl });
        } catch (e) { console.error(e); } finally { setGeneratingImageFor(null); }
    };
    
    const handleAddClick = (e: React.MouseEvent, node: EditableLaidoutMindMapNode) => {
        e.stopPropagation();
        setEditingNode(null);
        if (node.id === 'global-root') {
            onNewProject();
        } else {
            setAddingToNode(node);
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
        'bg-yellow-500': '#FBBF24', 'bg-red-500': '#EF4444', 'bg-indigo-500': '#6366F1',
        'bg-text-secondary': '#6B7280'
      };
      return colorMap[tailwindClass] || '#6B7280'; // Default to secondary text color
    };

    return (
        <div className="w-full h-full relative bg-app-background rounded-xl border border-border-color">
             <header className="absolute top-0 left-0 p-4 z-10">
                <h1 className="text-2xl font-bold text-text-primary">Global Mind Map</h1>
                <p className="text-sm text-text-secondary">A unified view of all your projects.</p>
                <button onClick={onNewProject} className="mt-2 flex items-center space-x-2 px-3 py-1.5 bg-accent-blue text-white rounded-lg hover:opacity-90"><PlusIcon className="w-4 h-4" /><span>Add Project</span></button>
            </header>
            <svg ref={svgRef} className="w-full h-full cursor-grab" viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}>
                <g>{links.map((link, i) => <path key={`link-${i}`} d={`M ${link.source.x} ${link.source.y} L ${link.target.x} ${link.target.y}`} stroke="#E5E7EB" strokeWidth="2" fill="none" />)}</g>
                <g>{nodes.map(node => (
                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`} className="cursor-pointer group" onDoubleClick={(e) => handleAddClick(e, node)} onMouseDown={(e) => e.stopPropagation()}>
                        <rect x={-NODE_WIDTH / 2} y={-NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT} rx={20} fill={node.isProject ? getHexColor(node.color!) : "#FFFFFF"} stroke={"#E5E7EB"} strokeWidth="1" />
                        <text x={0} y={node.task?.startDate ? -8 : 0} textAnchor="middle" dominantBaseline="middle" fill={node.isProject ? "#FFFFFF" : "#1F2937"} fontSize="14" fontWeight={node.isProject ? "bold" : "normal"} style={{ pointerEvents: 'none', userSelect: 'none', textDecoration: node.isCompleted ? 'line-through' : 'none', opacity: node.isCompleted ? 0.6 : 1, }}>{node.name.length > 25 ? `${node.name.slice(0, 24)}…` : node.name}</text>
                        {node.task?.startDate && <text x={0} y={15} textAnchor="middle" dominantBaseline="middle" fill={node.isProject ? "#FFFFFF" : "#6B7280"} fontSize="11">{node.task.startDate} → {node.task.endDate}</text>}
                        <g className="opacity-0 group-hover:opacity-100 transition-opacity" transform={`translate(95, -12)`}>
                            <g onClick={(e) => handleAddClick(e, node)} className="cursor-pointer"><rect x="0" y="0" width="24" height="24" rx="4" fill="#FFFFFF" /><PlusIcon x="4" y="4" className="w-4 h-4 text-text-secondary" /></g>
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
                            <div className="flex gap-1 mt-1"><input type="date" aria-label="Start Date" value={newNodeStartDate} onChange={(e) => setNewNodeStartDate(e.target.value)} max={newNodeEndDate} className="w-full bg-card-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue" /><input type="date" aria-label="End Date" value={newNodeEndDate} onChange={(e) => setNewNodeEndDate(e.target.value)} min={newNodeStartDate} className="w-full bg-card-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue" /></div>
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