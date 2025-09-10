import React, { useState, useEffect, useMemo, useRef, useCallback, forwardRef } from 'react';
import { Task, BaseMindMapNode, LaidoutMindMapNode } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { PlusIcon, ImageIcon, MindMapIcon, RadialMindMapIcon, EditIcon } from './IconComponents';
import Spinner from './Spinner';
import { generateImage } from '../services/geminiService';
import { layoutTree, layoutRadial } from '../utils/mindMapLayouts';

type LayoutType = 'tree' | 'radial';

interface MindMapViewProps {
    onAddTask: (taskName: string, startDate?: string, endDate?: string) => Promise<void>;
    onAddSubtask: (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => Promise<void>;
    onUpdateTask: (task: Task) => Promise<void>;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;

const MindMapView: React.ForwardRefRenderFunction<HTMLDivElement, MindMapViewProps> = ({ onAddTask, onAddSubtask, onUpdateTask }, ref) => {
    const { selectedProject } = useProject();
    const project = selectedProject!; // Assert non-null
    
    const svgRef = useRef<SVGSVGElement>(null);
    const [layout, setLayout] = useState<LayoutType>('tree');
    const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 800 });
    const [isPanning, setIsPanning] = useState(false);
    const [addingToNode, setAddingToNode] = useState<LaidoutMindMapNode | null>(null);
    const [editingDatesNode, setEditingDatesNode] = useState<LaidoutMindMapNode | null>(null);
    const [editingTextNodeId, setEditingTextNodeId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
    
    const [newNodeName, setNewNodeName] = useState('');
    const [newNodeStartDate, setNewNodeStartDate] = useState('');
    const [newNodeEndDate, setNewNodeEndDate] = useState('');
    const newNodeInputRef = useRef<HTMLInputElement>(null);
    const editTextInputRef = useRef<HTMLTextAreaElement>(null);

    const isSubmittingRef = useRef(false); // Lock to prevent double submission
    const lastMousePos = useRef({ x: 0, y: 0 });

    const [editDateData, setEditDateData] = useState<{ startDate: string, endDate: string }>({ startDate: '', endDate: '' });

    const handleStartEditingDate = (node: LaidoutMindMapNode) => {
        setAddingToNode(null); // Close other forms
        setEditingTextNodeId(null);
        setEditingDatesNode(node);
        setEditDateData({
            startDate: node.task?.startDate || '',
            endDate: node.task?.endDate || '',
        });
    };

    const handleSaveDate = async () => {
        if (!editingDatesNode || !editingDatesNode.task) return;

        let { startDate, endDate } = editDateData;

        // If start is set but end isn't, set end to start.
        if (startDate && !endDate) {
            endDate = startDate;
        } 
        // If end is set but start isn't, set start to end.
        else if (!startDate && endDate) {
            startDate = endDate;
        }
        // If start is after end, swap them.
        else if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            [startDate, endDate] = [endDate, startDate];
        }

        await onUpdateTask({
            ...editingDatesNode.task,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
        });
        setEditingDatesNode(null); // Close the editor
    };
    
    const handleSaveName = async (node: LaidoutMindMapNode) => {
        if (node.task && editingText.trim() && editingText.trim() !== node.name) {
            await onUpdateTask({ ...node.task, name: editingText.trim() });
        }
        setEditingTextNodeId(null);
        setEditingText('');
    };

    useEffect(() => {
        if (addingToNode) {
            isSubmittingRef.current = false; // Reset lock when form appears
            newNodeInputRef.current?.focus();
        }
    }, [addingToNode]);
    
    useEffect(() => {
        if (editingDatesNode || editingTextNodeId) {
            setAddingToNode(null);
        }
    }, [editingDatesNode, editingTextNodeId]);

    useEffect(() => {
        if (editingTextNodeId) {
            editTextInputRef.current?.focus();
            editTextInputRef.current?.select();
        }
    }, [editingTextNodeId]);


    const { nodes, links } = useMemo(() => {
        const buildHierarchy = (tasks: Task[]): BaseMindMapNode[] => {
            return tasks.map(task => ({
                id: task.id,
                task,
                name: task.name,
                children: buildHierarchy(task.subtasks || []),
                isProject: false,
                isCompleted: task.completed,
                imageUrl: task.imageUrl,
            }));
        };

        const rootNode: BaseMindMapNode = {
            id: project.id,
            name: project.name,
            children: buildHierarchy(project.tasks),
            isProject: true,
            isCompleted: false,
        };

        const laidOutRoot = layout === 'tree'
            ? layoutTree(rootNode, 0, 0).laidOutNode
            : layoutRadial(rootNode);

        const flattenedNodes: LaidoutMindMapNode[] = [];
        const flattenedLinks: { source: LaidoutMindMapNode, target: LaidoutMindMapNode }[] = [];
        const traverse = (node: LaidoutMindMapNode) => {
            flattenedNodes.push(node);
            node.children.forEach(child => {
                flattenedLinks.push({ source: node, target: child });
                traverse(child);
            });
        };
        traverse(laidOutRoot);

        return { nodes: flattenedNodes, links: flattenedLinks };
    }, [project, layout]);
    
    useEffect(() => {
        if (svgRef.current && nodes.length > 0) {
            const { width: containerWidth, height: containerHeight } = svgRef.current.getBoundingClientRect();
            if (containerWidth === 0 || containerHeight === 0) return;

            // Calculate the bounding box of all nodes
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            nodes.forEach(node => {
                minX = Math.min(minX, node.x - NODE_WIDTH / 2);
                maxX = Math.max(maxX, node.x + NODE_WIDTH / 2);
                minY = Math.min(minY, node.y - NODE_HEIGHT / 2);
                maxY = Math.max(maxY, node.y + NODE_HEIGHT / 2);
            });
            
            // Handle case with single node
            if (nodes.length === 1) {
                const node = nodes[0];
                minX = node.x - NODE_WIDTH / 2;
                maxX = node.x + NODE_WIDTH / 2;
                minY = node.y - NODE_HEIGHT / 2;
                maxY = node.y + NODE_HEIGHT / 2;
            }

            const treeWidth = maxX - minX;
            const treeHeight = maxY - minY;
            const PADDING = 100;

            const contentWidthWithPadding = treeWidth + PADDING * 2;
            const contentHeightWithPadding = treeHeight + PADDING * 2;
            
            // Determine the scale to fit the content within the container
            const scaleX = containerWidth / contentWidthWithPadding;
            const scaleY = containerHeight / contentHeightWithPadding;
            const scale = Math.min(scaleX, scaleY);

            // The new viewBox dimensions are the container size scaled up
            const newViewBoxWidth = containerWidth / scale;
            const newViewBoxHeight = containerHeight / scale;

            // Center the viewBox on the content
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
        setEditingDatesNode(null);
    }, [project.id, layout, nodes]);


    const handleCreateSubNode = (e: React.MouseEvent, node: LaidoutMindMapNode) => {
        e.stopPropagation();
        setEditingDatesNode(null);
        setEditingTextNodeId(null);
        setAddingToNode(node);
    };

    const handleNewNodeCommit = async () => {
        if (isSubmittingRef.current || !addingToNode) return;

        const taskName = newNodeName.trim();

        if (taskName) {
            isSubmittingRef.current = true;
            if (addingToNode.id === project.id) {
                await onAddTask(taskName, newNodeStartDate, newNodeEndDate);
            } else {
                await onAddSubtask(addingToNode.id, taskName, newNodeStartDate, newNodeEndDate);
            }
        }
        setAddingToNode(null);
        setNewNodeName('');
        setNewNodeStartDate('');
        setNewNodeEndDate('');
    };
    
    const handleGenerateImage = async (node: LaidoutMindMapNode) => {
        if (!node.task) return;
        setGeneratingImageFor(node.id);
        try {
            const imageUrl = await generateImage(`A simple, clean icon representing: ${node.name}`);
            await onUpdateTask({ ...node.task, imageUrl });
        } catch (error) {
            console.error("Failed to generate image for task:", error);
            alert("Could not generate image. Please check the console for details.");
        } finally {
            setGeneratingImageFor(null);
        }
    };

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setAddingToNode(null);
            setEditingDatesNode(null);
            setEditingTextNodeId(null);
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            svgRef.current?.classList.add('cursor-grabbing');
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
        svgRef.current?.classList.remove('cursor-grabbing');
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        const scale = viewBox.w / (svgRef.current?.clientWidth || 1);
        setViewBox(vb => ({ ...vb, x: vb.x - dx * scale, y: vb.y - dy * scale }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    }, [isPanning, viewBox.w]);
    
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;

        const zoomFactor = 1.1;
        const { clientX, clientY, deltaY } = e;
        const rect = svg.getBoundingClientRect();

        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;

        const [svgX, svgY] = [
            (mouseX / rect.width) * viewBox.w + viewBox.x,
            (mouseY / rect.height) * viewBox.h + viewBox.y,
        ];
        
        const zoom = deltaY < 0 ? 1 / zoomFactor : zoomFactor;
        const newW = viewBox.w * zoom;
        const newH = viewBox.h * zoom;
        
        setViewBox({
            w: newW,
            h: newH,
            x: svgX - (mouseX / rect.width) * newW,
            y: svgY - (mouseY / rect.height) * newH,
        });
    }, [viewBox]);

    return (
        <div ref={ref} className="w-full h-full relative bg-app-background rounded-xl border border-border-color">
            <svg
                ref={svgRef}
                className="w-full h-full cursor-grab"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <g>
                    {links.map((link, i) => (
                        <path
                            key={`link-${link.source.id}-${link.target.id}-${i}`}
                            d={layout === 'tree' 
                                ? `M ${link.source.x + NODE_WIDTH / 2} ${link.source.y} C ${link.source.x + NODE_WIDTH / 2 + 30} ${link.source.y}, ${link.target.x - NODE_WIDTH / 2 - 30} ${link.target.y}, ${link.target.x - NODE_WIDTH / 2} ${link.target.y}`
                                : `M ${link.source.x} ${link.source.y} L ${link.target.x} ${link.target.y}`
                            }
                            stroke="#E5E7EB"
                            strokeWidth="2"
                            fill="none"
                        />
                    ))}
                </g>
                <g>
                    {nodes.map(node => (
                        <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            className="cursor-pointer group"
                            onDoubleClick={(e) => handleCreateSubNode(e, node)}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <rect
                                x={-NODE_WIDTH / 2}
                                y={-NODE_HEIGHT / 2}
                                width={NODE_WIDTH}
                                height={NODE_HEIGHT}
                                rx={20}
                                fill={node.isProject ? "#3B82F6" : "#FFFFFF"}
                                stroke={node.isProject ? "#3B82F6" : "#E5E7EB"}
                                strokeWidth="2"
                            />
                            {node.imageUrl && (
                                <image 
                                    href={node.imageUrl}
                                    x={-NODE_WIDTH / 2 + 8}
                                    y={-NODE_HEIGHT / 2 + (NODE_HEIGHT - 30) / 2}
                                    height="30"
                                    width="30"
                                    clipPath="inset(0% round 8px)"
                                />
                            )}
                            {editingTextNodeId === node.id && !node.isProject ? (
                                <foreignObject x={-NODE_WIDTH/2 + 5} y={-NODE_HEIGHT/2 + 5} width={NODE_WIDTH - 10} height={NODE_HEIGHT - 10}>
                                    <textarea
                                        ref={editTextInputRef}
                                        value={editingText}
                                        onChange={(e) => setEditingText(e.target.value)}
                                        onBlur={() => handleSaveName(node)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveName(node); }
                                            if (e.key === 'Escape') { setEditingTextNodeId(null); setEditingText(''); }
                                        }}
                                        className="w-full h-full text-center bg-white/90 rounded-lg focus:outline-none p-1 text-sm text-text-primary resize-none flex items-center justify-center"
                                    />
                                </foreignObject>
                            ) : (
                                <text
                                    x={node.imageUrl ? 20 : 0}
                                    y={node.task?.startDate && editingTextNodeId !== node.id ? -8 : 0}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill={node.isProject ? "#FFFFFF" : "#1F2937"}
                                    fontSize="14"
                                    onClick={() => {
                                        if (!node.isProject) {
                                            setEditingDatesNode(null);
                                            setAddingToNode(null);
                                            setEditingText(node.name);
                                            setEditingTextNodeId(node.id);
                                        }
                                    }}
                                    style={{ 
                                        textDecoration: node.isCompleted ? 'line-through' : 'none', 
                                        opacity: node.isCompleted ? 0.6 : 1,
                                        userSelect: 'none'
                                    }}
                                >
                                    {node.name.length > (node.imageUrl ? 15 : 20) 
                                        ? `${node.name.slice(0, node.imageUrl ? 14 : 19)}…` 
                                        : node.name}
                                </text>
                            )}

                             {node.task?.startDate && editingTextNodeId !== node.id && (
                                <text
                                    x={node.imageUrl ? 20 : 0}
                                    y={15}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill={node.isProject ? "#FFFFFF" : "#6B7280"}
                                    fontSize="11"
                                >
                                    {node.task.startDate} → {node.task.endDate}
                                </text>
                            )}
                            <g className="opacity-0 group-hover:opacity-100 transition-opacity" transform={`translate(95, -12)`}>
                                <g onClick={(e) => handleCreateSubNode(e, node)} className="cursor-pointer">
                                    <rect x="0" y="0" width="24" height="24" rx="4" fill="#FFFFFF" />
                                    <PlusIcon x="4" y="4" className="w-4 h-4 text-text-secondary" />
                                </g>
                                {!node.isProject && (
                                    <>
                                    <g onClick={(e) => { e.stopPropagation(); handleStartEditingDate(node); }} transform={`translate(28, 0)`} className="cursor-pointer">
                                        <rect x="0" y="0" width="24" height="24" rx="4" fill="#FFFFFF" />
                                        <EditIcon x="4" y="4" className="w-4 h-4 text-text-secondary"/>
                                    </g>
                                    <g onClick={(e) => { e.stopPropagation(); handleGenerateImage(node); }} transform={`translate(56, 0)`} className="cursor-pointer">
                                        {generatingImageFor === node.id ? (
                                            <foreignObject x="0" y="0" width="24" height="24"><Spinner /></foreignObject>
                                        ) : (
                                            <>
                                                <rect x="0" y="0" width="24" height="24" rx="4" fill="#FFFFFF" />
                                                <ImageIcon x="4" y="4" className="w-4 h-4 text-text-secondary"/>
                                            </>
                                        )}
                                    </g>
                                    </>
                                )}
                            </g>
                        </g>
                    ))}
                </g>
                {addingToNode && (
                     <foreignObject x={addingToNode.x + NODE_WIDTH/2 + 5} y={addingToNode.y - 25} width={NODE_WIDTH + 20} height={100}>
                        <form onSubmit={async (e) => { e.preventDefault(); await handleNewNodeCommit(); }}>
                            <input
                                ref={newNodeInputRef}
                                type="text"
                                value={newNodeName}
                                onChange={e => setNewNodeName(e.target.value)}
                                placeholder="New sub-task..."
                                className="w-full bg-card-background border border-accent-blue rounded-md p-2 text-sm text-text-primary focus:outline-none"
                                onClick={e => e.stopPropagation()}
                                onBlur={handleNewNodeCommit}
                                onKeyDown={(e) => { if (e.key === 'Escape') setAddingToNode(null); }}
                            />
                             <div className="flex gap-1 mt-1">
                                <input
                                    type="date"
                                    aria-label="Start Date"
                                    value={newNodeStartDate}
                                    onChange={(e) => setNewNodeStartDate(e.target.value)}
                                    max={newNodeEndDate || undefined}
                                    className="w-full bg-card-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                                />
                                <input
                                    type="date"
                                    aria-label="End Date"
                                    value={newNodeEndDate}
                                    onChange={(e) => setNewNodeEndDate(e.target.value)}
                                    min={newNodeStartDate || undefined}
                                    className="w-full bg-card-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                                />
                            </div>
                        </form>
                    </foreignObject>
                )}
                {editingDatesNode && editingDatesNode.task && (
                    <foreignObject x={editingDatesNode.x - NODE_WIDTH/2} y={editingDatesNode.y + NODE_HEIGHT/2 + 5} width={NODE_WIDTH} height={130}>
                        <div 
                            className="w-full h-full bg-card-background/95 backdrop-blur-sm rounded-2xl flex flex-col p-3 gap-1 shadow-lg border border-border-color"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <label className="text-xs font-medium text-text-secondary">Start Date</label>
                            <input
                                type="date"
                                value={editDateData.startDate}
                                onChange={(e) => setEditDateData(prev => ({ ...prev, startDate: e.target.value }))}
                                max={editDateData.endDate || undefined}
                                className="w-full bg-app-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                            />
                            <label className="text-xs font-medium text-text-secondary">End Date</label>
                            <input
                                type="date"
                                value={editDateData.endDate}
                                onChange={(e) => setEditDateData(prev => ({ ...prev, endDate: e.target.value }))}
                                min={editDateData.startDate || undefined}
                                className="w-full bg-app-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                            />
                            <div className="flex justify-end gap-2 mt-auto">
                                <button onClick={() => setEditingDatesNode(null)} className="px-2 py-1 text-xs rounded-md bg-app-background hover:bg-border-color">Cancel</button>
                                <button onClick={handleSaveDate} className="px-2 py-1 text-xs rounded-md text-white bg-accent-blue hover:opacity-90">Save</button>
                            </div>
                        </div>
                    </foreignObject>
                )}
            </svg>
            <div className="absolute top-4 left-4 flex items-center space-x-2 z-10">
                <button
                    onClick={() => {
                        const rootNode = nodes.find(n => n.isProject);
                        if (rootNode) handleCreateSubNode({ stopPropagation: () => {} } as React.MouseEvent, rootNode);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>Add Task</span>
                </button>
                <div className="bg-card-background p-1 rounded-lg flex space-x-1 border border-border-color">
                    <button onClick={() => setLayout('tree')} className={`p-1.5 rounded-md ${layout === 'tree' ? 'bg-accent-blue text-white' : 'hover:bg-app-background'}`} title="Tree Layout">
                        <MindMapIcon className={`w-5 h-5 ${layout === 'tree' ? '' : 'text-text-primary'}`} />
                    </button>
                    <button onClick={() => setLayout('radial')} className={`p-1.5 rounded-md ${layout === 'radial' ? 'bg-accent-blue text-white' : 'hover:bg-app-background'}`} title="Radial Layout">
                        <RadialMindMapIcon className={`w-5 h-5 ${layout === 'radial' ? '' : 'text-text-primary'}`} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default forwardRef(MindMapView);