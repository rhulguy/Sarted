import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Task, BaseMindMapNode, LaidoutMindMapNode } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { PlusIcon, ImageIcon, DownloadIcon, MindMapIcon, RadialMindMapIcon, EditIcon } from './IconComponents';
import Spinner from './Spinner';
import { generateImageForTask } from '../services/geminiService';
import { useDownloadImage } from '../hooks/useDownloadImage';
import { layoutTree, layoutRadial } from '../utils/mindMapLayouts';

type LayoutType = 'tree' | 'radial';

interface MindMapViewProps {
    onAddTask: (taskName: string, startDate?: string, endDate?: string) => Promise<void>;
    onAddSubtask: (parentId: string, subtaskName: string, startDate?: string, endDate?: string) => Promise<void>;
    onUpdateTask: (task: Task) => Promise<void>;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;

const MindMapView: React.FC<MindMapViewProps> = ({ onAddTask, onAddSubtask, onUpdateTask }) => {
    const { selectedProject } = useProject();
    const project = selectedProject!; // Assert non-null
    const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();
    
    const svgRef = useRef<SVGSVGElement>(null);
    const [layout, setLayout] = useState<LayoutType>('tree');
    const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 800 });
    const [isPanning, setIsPanning] = useState(false);
    const [addingToNode, setAddingToNode] = useState<LaidoutMindMapNode | null>(null);
    const [editingNode, setEditingNode] = useState<LaidoutMindMapNode | null>(null);
    const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
    
    const [newNodeName, setNewNodeName] = useState('');
    const [newNodeStartDate, setNewNodeStartDate] = useState('');
    const [newNodeEndDate, setNewNodeEndDate] = useState('');
    const newNodeInputRef = useRef<HTMLInputElement>(null);

    const isSubmittingRef = useRef(false); // Lock to prevent double submission
    const lastMousePos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (addingToNode) {
            isSubmittingRef.current = false; // Reset lock when form appears
            newNodeInputRef.current?.focus();
        }
    }, [addingToNode]);
    
    useEffect(() => {
        if (editingNode) {
            setAddingToNode(null);
        }
    }, [editingNode]);

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
            const { width, height } = svgRef.current.getBoundingClientRect();
            if (width > 0 && height > 0) {
                 if (layout === 'tree') {
                    const rootNode = nodes[0];
                    setViewBox({ w: width, h: height, x: rootNode.x - width / 4, y: rootNode.y - height / 2 });
                } else {
                    setViewBox({ w: width * 1.5, h: height * 1.5, x: -width * 0.75, y: -height * 0.75 });
                }
            }
        }
        setAddingToNode(null);
        setEditingNode(null);
    }, [project.id, layout]);


    const handleCreateSubNode = (e: React.MouseEvent, node: LaidoutMindMapNode) => {
        e.stopPropagation();
        setEditingNode(null);
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
            const imageUrl = await generateImageForTask(node.name);
            await onUpdateTask({ ...node.task, imageUrl });
        } catch (error) {
            console.error("Failed to generate image for task:", error);
            alert("Could not generate image. Please check the console for details.");
        } finally {
            setGeneratingImageFor(null);
        }
    };

    const handleDateUpdate = async (node: LaidoutMindMapNode, dates: { startDate?: string, endDate?: string }) => {
        if (!node.task) return;
        await onUpdateTask({ ...node.task, ...dates });
    };
    
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setAddingToNode(null);
            setEditingNode(null);
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
        <div ref={downloadRef} className="w-full h-full relative bg-app-background rounded-xl border border-border-color">
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
                            <text
                                x={node.imageUrl ? 20 : 0}
                                y={node.task?.startDate ? -8 : 0}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill={node.isProject ? "#FFFFFF" : "#1F2937"}
                                fontSize="14"
                                style={{ 
                                    textDecoration: node.isCompleted ? 'line-through' : 'none', 
                                    opacity: node.isCompleted ? 0.6 : 1,
                                    pointerEvents: 'none',
                                    userSelect: 'none'
                                }}
                            >
                                {node.name.length > (node.imageUrl ? 15 : 20) 
                                    ? `${node.name.slice(0, node.imageUrl ? 14 : 19)}…` 
                                    : node.name}
                            </text>
                             {node.task?.startDate && (
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
                                    <g onClick={(e) => { e.stopPropagation(); setEditingNode(node); }} transform={`translate(28, 0)`} className="cursor-pointer">
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
                 {editingNode && editingNode.task && (
                    <foreignObject x={editingNode.x - NODE_WIDTH/2} y={editingNode.y - NODE_HEIGHT/2} width={NODE_WIDTH} height={NODE_HEIGHT}>
                        <div 
                            className="w-full h-full bg-card-background/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-2 gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <input
                                type="date"
                                aria-label="Start Date"
                                defaultValue={editingNode.task.startDate}
                                onBlur={(e) => handleDateUpdate(editingNode, { startDate: e.target.value })}
                                onKeyDown={(e) => {if(e.key === 'Enter' || e.key === 'Escape') setEditingNode(null)}}
                                className="w-full bg-app-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                            />
                            <input
                                type="date"
                                aria-label="End Date"
                                defaultValue={editingNode.task.endDate}
                                onBlur={(e) => handleDateUpdate(editingNode, { endDate: e.target.value })}
                                onKeyDown={(e) => {if(e.key === 'Enter' || e.key === 'Escape') setEditingNode(null)}}
                                min={editingNode.task.startDate}
                                className="w-full bg-app-background border border-border-color rounded-md p-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                            />
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
                 <button 
                    onClick={() => downloadImage(`${project?.name}-mind-map.png`)} 
                    disabled={isDownloading} 
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-card-background text-text-secondary rounded-lg border border-border-color hover:bg-app-background transition-colors disabled:opacity-50"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    <span>{isDownloading ? 'Exporting...' : 'Export'}</span>
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

export default MindMapView;