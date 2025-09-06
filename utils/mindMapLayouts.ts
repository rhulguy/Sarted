import { BaseMindMapNode, LaidoutMindMapNode } from '../types';

const TREE_NODE_WIDTH = 220;
const TREE_NODE_HEIGHT = 80;

/**
 * Arranges nodes in a classic horizontal tree structure.
 * @param node The root node of the tree/subtree to lay out.
 * @param level The current depth of the node in the tree.
 * @param yOffset The starting Y position for this subtree.
 * @param direction The direction of expansion (-1 for left, 1 for right).
 * @returns An object containing the laid-out node and the total height of the subtree.
 */
export const layoutTree = (node: BaseMindMapNode, level: number, yOffset: number, direction: 1 | -1 = 1): { laidOutNode: LaidoutMindMapNode, height: number } => {
    let childY = yOffset;
    const laidOutChildren: LaidoutMindMapNode[] = [];
    let childrenHeight = 0;

    node.children.forEach(child => {
        const { laidOutNode: laidOutChild, height: childHeight } = layoutTree(child, level + 1, childY, direction);
        laidOutChildren.push(laidOutChild);
        childY += childHeight;
        childrenHeight += childHeight;
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
        x: direction * level * (TREE_NODE_WIDTH + 40),
        y: yPos,
        depth: level,
    };

    return { laidOutNode, height: nodeHeight };
};


const RADIUS_STEP = 130;

/**
 * A recursive helper to arrange nodes in a circular/radial pattern.
 * @param node The node to position.
 * @param depth The radial distance from the center.
 * @param startAngle The beginning of the angular segment available for this node and its children.
 * @param endAngle The end of the angular segment.
 * @returns The laid-out node with its children also laid out.
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
 * @param root The root node of the entire mind map.
 * @returns The fully laid-out tree with radial coordinates.
 */
export const layoutRadial = (root: BaseMindMapNode): LaidoutMindMapNode => {
    return radialLayoutRecursive(root, 0, 0, 2 * Math.PI);
};

/**
 * A specialized layout for the global view that arranges projects radially
 * and ensures their subtrees expand outwards to prevent overlapping.
 * @param root The 'All Projects' root node.
 * @returns The laid-out global tree.
 */
export const layoutGlobalTree = (root: BaseMindMapNode): LaidoutMindMapNode => {
    const laidOutRoot: LaidoutMindMapNode = { ...root, x: 0, y: 0, depth: 0, children: [] };
    const totalProjects = root.children.length;
    const angleStep = totalProjects > 0 ? (2 * Math.PI) / totalProjects : 0;

    laidOutRoot.children = root.children.map((projectNode, i) => {
        const angle = i * angleStep;
        const radius = RADIUS_STEP * 2.5;
        const projectX = radius * Math.cos(angle - Math.PI / 2);
        const projectY = radius * Math.sin(angle - Math.PI / 2);

        // Determine layout direction based on angle.
        // Projects on the left hemisphere of the circle (PI to 2*PI) expand left (-1).
        // Others (right hemisphere) expand right (1).
        const direction = (angle >= Math.PI) ? -1 : 1;

        // Layout the project's task tree with the correct direction, starting at level 0 for the project node.
        const { laidOutNode: laidOutProject } = layoutTree(projectNode, 0, 0, direction);

        // This helper translates the entire generated subtree.
        const translateTree = (node: LaidoutMindMapNode, dx: number, dy: number): LaidoutMindMapNode => ({
            ...node,
            x: node.x + dx,
            y: node.y + dy,
            children: node.children.map(child => translateTree(child, dx, dy))
        });
        
        // The layout returns a tree with the project node at x=0 and a calculated y.
        // We translate the tree so the project node's final position is (projectX, projectY).
        return translateTree(laidOutProject, projectX, projectY - laidOutProject.y);
    });

    return laidOutRoot;
};