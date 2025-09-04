import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Task } from '../types';
import { PlusIcon, DownloadIcon } from './IconComponents';
import { useProject } from '../contexts/ProjectContext';
import { useDownloadImage } from '../hooks/useDownloadImage';

interface UnlaidoutRadialNode {
    id: string;
    name: string;
    children: UnlaidoutRadialNode[];
    depth: number;
    isProject: boolean;
    isCompleted: boolean;
    imageUrl?: string;
}

interface RadialNode extends UnlaidoutRadialNode {
    children: RadialNode[];
    x: number;
    y: number;
    angle: number;
}

interface RadialMindMapViewProps {
    onAddTask: (taskName: string) => Promise<void>;
    onAddSubtask: (parentId: string, subtaskName: string) => Promise<void>;
}

const RADIUS_STEP = 120;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 40;

const layoutRadialTree = (node: UnlaidoutRadialNode, parentAngle: number, startAngle: number, endAngle: number): RadialNode => {
    const angle = parentAngle + (startAngle + endAngle) / 2;
    const radius = node.depth * RADIUS_STEP;
    const x = radius * Math.cos(angle - Math.PI / 2);
    const y = radius * Math.sin(angle - Math.PI / 2);

    const totalChildren = node.children.length;
    const angleStep = totalChildren > 0 ? (endAngle - startAngle) / totalChildren : 0;

    const laidOutChildren = node.children.map((child, i) => {
        const childStartAngle = startAngle + i * angleStep;
        const childEndAngle = childStartAngle + angleStep;
        return layoutRadialTree(child, angle, childStartAngle, childEndAngle);
    });

    return { ...node, x, y, angle, children: laidOutChildren };
};

const RadialMindMapView: React.FC<RadialMindMapViewProps> = ({ onAddTask, onAddSubtask }) => {
    const { selectedProject } = useProject();
    const project = selectedProject!; // Assert non-null
    const { ref: downloadRef, downloadImage, isDownloading } = useDownloadImage<HTMLDivElement>();

    const svgRef = useRef<SVGSVGElement>(null);
    const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 800 });
    const [isPanning, setIsPanning] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [addingToNode, setAddingToNode] = useState<RadialNode | null>(null);
    const newNodeInputRef = useRef<HTMLInputElement>(null);
    const isSubmittingRef = useRef(false); // Lock to prevent double submission
    const lastMousePos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (addingToNode) {
            isSubmittingRef.current = false; // Reset lock when form appears
            newNodeInputRef.current?.focus();
        }
    }, [addingToNode]);

    const { nodes, links } = useMemo(() => {
        const buildHierarchy = (tasks: Task[], depth: number): UnlaidoutRadialNode[] => {
            return tasks.map(task => ({
                id: task.id,
                name: task.name,
                depth,
                children: buildHierarchy(task.subtasks || [], depth + 1),
                isProject: false,
                isCompleted: task.completed,
                imageUrl: task.imageUrl,
            }));
        };

        const root: UnlaidoutRadialNode = {
            id: project.id,
            name: project.name,
            depth: 0,
            children: buildHierarchy(project.tasks, 1),
            isProject: true,
            isCompleted: false,
        };

        const laidOutRoot = layoutRadialTree(root, 0, 0, 2 * Math.PI);

        const flattenedNodes: RadialNode[] = [];
        const flattenedLinks: { source: RadialNode, target: RadialNode }[] = [];
        const traverse = (node: RadialNode) => {
            flattenedNodes.push(node);
            node.children.forEach(child => {
                flattenedLinks.push({ source: node, target: child });
                traverse(child);
            });
        };
        traverse(laidOutRoot);

        return { nodes: flattenedNodes, links: flattenedLinks };
    }, [project]);

    useEffect(() => {
        if (svgRef.current) {
            const { width, height } = svgRef.current.getBoundingClientRect();
            if (width > 0 && height > 0) {
                setViewBox({ w: width, h: height, x: -width / 2, y: -height / 2 });
            }
        }
        setSelectedNodeId(null);
        setAddingToNode(null);
    }, [project.id]);

    const handleNewNodeCommit = async () => {
        if (isSubmittingRef.current || !addingToNode) return;

        const taskName = newNodeInputRef.current?.value.trim();

        if (taskName) {
            isSubmittingRef.current = true;
            if (addingToNode.id === project.id) {
                await onAddTask(taskName);
            } else {
                await onAddSubtask(addingToNode.id, taskName);
            }
        }
        setAddingToNode(null);
    };
    
    const handleAddTaskClick = () => {
        const rootNode = nodes.find(n => n.isProject);
        if (rootNode) {
            setSelectedNodeId(rootNode.id);
            setAddingToNode(rootNode);
        }
    };
    
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
             setAddingToNode(null);
             setSelectedNodeId(null);
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
        <div ref={downloadRef} className="w-full h-full relative bg-secondary rounded-lg">
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
                            key={`link-${i}`}
                            d={`M ${link.source.x} ${link.source.y} L ${link.target.x} ${link.target.y}`}
                            stroke="#30363D"
                            strokeWidth="2"
                        />
                    ))}
                </g>
                <g>
                    {nodes.map(node => {
                        const isSelected = selectedNodeId === node.id;
                        return (
                            <g
                                key={node.id}
                                transform={`translate(${node.x}, ${node.y})`}
                                className="cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); setAddingToNode(null); }}
                            >
                                <rect
                                    x={-NODE_WIDTH / 2}
                                    y={-NODE_HEIGHT / 2}
                                    width={NODE_WIDTH}
                                    height={NODE_HEIGHT}
                                    rx={8}
                                    fill={node.isProject ? "#58A6FF" : "#21262D"}
                                    stroke={isSelected ? "#C9D1D9" : "#8B949E"}
                                    strokeWidth={isSelected ? 3 : 2}
                                />
                                {node.imageUrl && (
                                    <image 
                                        href={node.imageUrl}
                                        x={-NODE_WIDTH / 2 + 5}
                                        y={-NODE_HEIGHT / 2 + 7}
                                        height="26"
                                        width="26"
                                        clipPath="inset(0% round 4px)"
                                    />
                                )}
                                <text
                                    x={node.imageUrl ? 15 : 0}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="#C9D1D9"
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
                                {isSelected && !addingToNode && (
                                     <g
                                        transform={`translate(${NODE_WIDTH / 2 + 5}, 0)`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setAddingToNode(node);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <circle r="12" fill="#58A6FF" />
                                        <PlusIcon className="w-4 h-4 text-white" x="-8" y="-8" strokeWidth="3" />
                                    </g>
                                )}
                            </g>
                        )
                    })}
                </g>
                 {addingToNode && (
                    <foreignObject x={addingToNode.x + NODE_WIDTH / 2 + 20} y={addingToNode.y - NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT+10} >
                        <form onSubmit={async (e) => { e.preventDefault(); await handleNewNodeCommit(); }}>
                            <input
                                ref={newNodeInputRef}
                                type="text"
                                placeholder="New task..."
                                className="w-full bg-highlight border border-accent rounded-md p-2 text-sm text-text-primary focus:outline-none"
                                onClick={e => e.stopPropagation()}
                                onBlur={handleNewNodeCommit}
                                onKeyDown={(e) => { if (e.key === 'Escape') setAddingToNode(null) }}
                            />
                        </form>
                    </foreignObject>
                )}
            </svg>
            <div className="absolute top-4 left-4 flex items-center space-x-2 z-10">
                <button
                    onClick={handleAddTaskClick}
                    className="flex items-center space-x-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-500 transition-colors duration-200"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>Add Task</span>
                </button>
                 <button 
                    onClick={() => downloadImage(`${project?.name}-radial-map.png`)} 
                    disabled={isDownloading} 
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-highlight text-text-secondary rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    <span>{isDownloading ? 'Exporting...' : 'Export'}</span>
                </button>
            </div>
        </div>
    );
};

export default RadialMindMapView;