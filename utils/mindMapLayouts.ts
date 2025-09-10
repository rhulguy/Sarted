import { BaseMindMapNode, LaidoutMindMapNode } from '../types';

const TREE_NODE_WIDTH = 180;
const TREE_NODE_HEIGHT = 70;
const HORIZONTAL_SPACING = 80;
const VERTICAL_SPACING = 20;

/**
 * Arranges nodes in a classic horizontal tree structure.
 */
export const layoutTree = (node: BaseMindMapNode, level: number, yOffset: number, direction: 1 | -1 = 1): { laidOutNode: LaidoutMindMapNode, height: number } => {
    let childY = yOffset;
    const laidOutChildren: LaidoutMindMapNode[] = [];
    let childrenHeight = 0;

    node.children.forEach((child, index) => {
        if (index > 0) {
            childY += VERTICAL_SPACING;
        }
        const { laidOutNode: laidOutChild, height: childHeight } = layoutTree(child, level + 1, childY, direction);
        laidOutChildren.push(laidOutChild);
        childY += childHeight;
        childrenHeight = childY - yOffset;
    });

    const nodeHeight = Math.max(TREE_NODE_HEIGHT, childrenHeight);
    
    let yPos: number;
    if (laidOutChildren.length > 0) {
        const firstChildY = laidOutChildren[0].y;
        const lastChildY = laidOutChildren[laidOutChildren.length - 1].y;
        yPos = firstChildY + (lastChildY - firstChildY) / 2;
    } else {
        yPos = yOffset + nodeHeight / 2;
    }

    const laidOutNode: LaidoutMindMapNode = {
        ...node,
        children: laidOutChildren,
        x: direction * level * (TREE_NODE_WIDTH + HORIZONTAL_SPACING),
        y: yPos,
        depth: level,
    };

    return { laidOutNode, height: nodeHeight };
};

/**
 * Kicks off the radial layout process starting from the root node. This new version dynamically
 * adjusts the angle and radius for children to prevent overlaps.
 */
export const layoutRadial = (root: BaseMindMapNode): LaidoutMindMapNode => {
    const recursiveLayout = (node: BaseMindMapNode, depth: number, startAngle: number, angleSpan: number): LaidoutMindMapNode => {
        const angle = startAngle + angleSpan / 2;
        
        // Dynamically adjust radius based on depth and number of children to prevent crowding
        const radius = depth * (200 + node.children.length * 5);

        const laidOutNode: LaidoutMindMapNode = {
            ...node,
            x: radius * Math.cos(angle - Math.PI / 2),
            y: radius * Math.sin(angle - Math.PI / 2),
            angle,
            depth,
            children: [],
        };
        
        const numChildren = node.children.length;
        if (numChildren > 0) {
            // Give children more or less of an angle depending on grand-children count (weight)
            const weights = node.children.map(c => 1 + (c.children?.length ?? 0) * 0.1);
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            
            let currentAngle = startAngle;
            laidOutNode.children = node.children.map((child, i) => {
                const childAngleSpan = (angleSpan * weights[i]) / totalWeight;
                const childNode = recursiveLayout(child, depth + 1, currentAngle, childAngleSpan);
                currentAngle += childAngleSpan;
                return childNode;
            });
        }
        
        return laidOutNode;
    };
    
    return recursiveLayout(root, 0, 0, 2 * Math.PI);
};

/**
 * A specialized layout for the global view that creates a balanced tree.
 */
export const layoutGlobalTree = (root: BaseMindMapNode): LaidoutMindMapNode | null => {
    if (!root) return null;

    const laidOutRoot: LaidoutMindMapNode = { ...root, x: 0, y: 0, depth: 0, children: [] };
    
    const leftGroups = root.children.slice(0, Math.ceil(root.children.length / 2));
    const rightGroups = root.children.slice(Math.ceil(root.children.length / 2));

    const layoutBranch = (groups: BaseMindMapNode[], direction: 1 | -1): { nodes: LaidoutMindMapNode[], totalHeight: number } => {
        let y = 0;
        const nodes: LaidoutMindMapNode[] = [];
        groups.forEach((group, index) => {
            if (index > 0) {
                y += VERTICAL_SPACING * 2; // Extra spacing between groups
            }
            // Each group starts at level 1 relative to the root
            const { laidOutNode, height } = layoutTree(group, 1, y, direction);
            nodes.push(laidOutNode);
            y += height;
        });
        return { nodes, totalHeight: y };
    };

    const rightBranch = layoutBranch(rightGroups, 1);
    const leftBranch = layoutBranch(leftGroups, -1);

    const rightYShift = -rightBranch.totalHeight / 2;
    const leftYShift = -leftBranch.totalHeight / 2;

    const translateTree = (node: LaidoutMindMapNode, dy: number): LaidoutMindMapNode => ({
        ...node,
        y: node.y + dy,
        children: node.children.map(child => translateTree(child, dy))
    });

    const finalRightChildren = rightBranch.nodes.map(node => translateTree(node, rightYShift));
    const finalLeftChildren = leftBranch.nodes.map(node => translateTree(node, leftYShift));
    
    laidOutRoot.children = [...finalRightChildren, ...finalLeftChildren];

    return laidOutRoot;
};