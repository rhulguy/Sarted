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


const RADIUS_STEP = 130;

/**
 * A recursive helper to arrange nodes in a circular/radial pattern.
 */
const radialLayoutRecursive = (node: BaseMindMapNode, depth: number, startAngle: number, endAngle: number): LaidoutMindMapNode => {
    const angleRange = endAngle - startAngle;
    const angle = startAngle + angleRange / 2;

    const radius = depth * RADIUS_STEP;
    const x = radius * Math.cos(angle - Math.PI / 2);
    const y = radius * Math.sin(angle - Math.PI / 2);

    const totalChildren = node.children.length;
    const angleStep = totalChildren > 0 ? angleRange / totalChildren : 0;

    const laidOutChildren = node.children.map((child, i) => {
        const childStartAngle = startAngle + i * angleStep;
        const childEndAngle = childStartAngle + angleStep;
        return radialLayoutRecursive(child, depth + 1, childStartAngle, childEndAngle);
    });

    return { ...node, x, y, angle, depth, children: laidOutChildren };
};

/**
 * Kicks off the radial layout process starting from the root node.
 */
export const layoutRadial = (root: BaseMindMapNode): LaidoutMindMapNode => {
    return radialLayoutRecursive(root, 0, 0, 2 * Math.PI);
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
