// State
let currentFilter = 'all';
let currentSystemIndex = 0;

// Elements
const svg = document.getElementById('lattice-svg');
const edgesLayer = document.getElementById('edges-layer');
const transferLayer = document.getElementById('transfer-edges-layer');
const nodesLayer = document.getElementById('nodes-layer');
const systemList = document.getElementById('system-list');
const filterBtns = document.querySelectorAll('.filter-btn');
const currentIdLabel = document.getElementById('current-id');
const currentTypeLabel = document.getElementById('current-type');
const groupToggle = document.getElementById('group-toggle');

let showGrouped = true;

// Constants
const MARGIN = 100;
const WIDTH = 1000;
const HEIGHT = 800;

function init() {
    if (typeof data === 'undefined') {
        console.error("Data not loaded. Please run the generator first.");
        return;
    }

    renderBaseLattice();
    renderList();
    updateFilterCounts();
    selectSystem(0);

    // Filter event listeners
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderList();
        });
    });

    // Group toggle listener
    if (groupToggle) {
        showGrouped = groupToggle.checked;
        groupToggle.addEventListener('change', () => {
            showGrouped = groupToggle.checked;
            renderBaseLattice();
            selectSystem(currentSystemIndex);
        });
    }
}

function updateFilterCounts() {
    const transfers = data.transfers;
    const counts = {
        all: transfers.length,
        Saturated: transfers.filter(t => t.type === 'Saturated' || t.type === 'Bisaturated').length,
        Cosaturated: transfers.filter(t => t.type === 'Cosaturated' || t.type === 'Bisaturated').length,
        Bisaturated: transfers.filter(t => t.type === 'Bisaturated').length
    };
    
    document.getElementById('count-all').textContent = `(${counts.all})`;
    document.getElementById('count-sat').textContent = `(${counts.Saturated})`;
    document.getElementById('count-cosat').textContent = `(${counts.Cosaturated})`;
    document.getElementById('count-bisat').textContent = `(${counts.Bisaturated})`;
}

function parsePos(posStr) {
    if (!posStr) return { x: 0, y: 0 };
    const match = posStr.match(/\(([^,]+),([^)]+)\)/);
    if (match) return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
    return { x: 0, y: 0 };
}

function renderBaseLattice() {
    nodesLayer.innerHTML = '';
    edgesLayer.innerHTML = '';

    if (showGrouped && data.subgroup_conjugates && data.conjugacy_classes) {
        renderGroupedLattice();
    } else {
        renderFullLattice();
    }
}

function calculateNodePositions(nodes) {
    // Coordinate Normalization
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // Check if we have valid coordinates
    const hasPositions = nodes.some(n => n.pos && n.pos !== "(0,0)");
    
    if (!hasPositions) {
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length - Math.PI/2;
            node.computedPos = {
                x: WIDTH / 2 + (WIDTH / 3) * Math.cos(angle),
                y: HEIGHT / 2 + (HEIGHT / 3) * Math.sin(angle)
            };
        });
    } else {
        nodes.forEach(node => {
            const p = parsePos(node.pos);
            node.rawX = p.x;
            node.rawY = -p.y; // Flip Y for SVG
            minX = Math.min(minX, node.rawX);
            maxX = Math.max(maxX, node.rawX);
            minY = Math.min(minY, node.rawY);
            maxY = Math.max(maxY, node.rawY);
        });

        const spanX = maxX - minX || 1;
        const spanY = maxY - minY || 1;

        nodes.forEach(node => {
            node.computedPos = {
                x: MARGIN + ((node.rawX - minX) / spanX) * (WIDTH - 2 * MARGIN),
                y: MARGIN + ((node.rawY - minY) / spanY) * (HEIGHT - 2 * MARGIN)
            };
        });
    }
}

function renderFullLattice() {
    const nodes = data.subgroups;
    const lattice = data.lattice;

    calculateNodePositions(nodes);

    // Draw edges
    lattice.forEach(edge => {
        const fromNode = nodes[edge.from];
        const toNode = nodes[edge.to];
        drawEdge(fromNode.computedPos, toNode.computedPos, edgesLayer, 'edge-path');
    });

    // Draw nodes
    nodes.forEach((node, i) => {
        drawNode(node.computedPos, node.label.replace(/[{}]/g, ''), `Index: ${i}\nLabel: ${node.label}`, nodesLayer);
    });
}

function renderGroupedLattice() {
    const classes = data.conjugacy_classes;
    const subConjs = data.subgroup_conjugates;
    const nodes = data.subgroups;

    // 1. Calculate class positions (average of member positions)
    classes.forEach((clr, cIdx) => {
        const members = [];
        subConjs.forEach((cc, sIdx) => { if (cc === cIdx) members.push(nodes[sIdx]); });
        
        let avgX = 0, avgY = 0, count = 0;
        members.forEach(m => {
            const p = parsePos(m.pos);
            avgX += p.x;
            avgY += -p.y;
            count++;
        });
        clr.pos = `(${avgX/count},${-avgY/count})`;
        clr.count = count;
    });

    calculateNodePositions(classes);

    // 2. Aggregate edges between classes
    const classEdges = new Set();
    data.lattice.forEach(edge => {
        const fromClass = subConjs[edge.from];
        const toClass = subConjs[edge.to];
        if (fromClass !== toClass) {
            classEdges.add(`${fromClass}->${toClass}`);
        }
    });

    // Draw class edges
    classEdges.forEach(key => {
        const [fromIdx, toIdx] = key.split('->').map(Number);
        drawEdge(classes[fromIdx].computedPos, classes[toIdx].computedPos, edgesLayer, 'edge-path');
    });

    // Draw class nodes
    classes.forEach((clr, i) => {
        const displayLabel = clr.size > 1 ? `${clr.size}${clr.label}` : clr.label;
        drawNode(clr.computedPos, displayLabel, `Class: ${clr.label}\nSize: ${clr.size}`, nodesLayer);
    });
}

function drawEdge(p1, p2, layer, className) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
    line.setAttribute('class', className);
    layer.appendChild(line);
    return line;
}

function drawNode(pos, label, titleText, layer) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'node-group');
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', 22); // Slightly larger for grouped labels
    circle.setAttribute('class', 'node-circle');
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', pos.x);
    text.setAttribute('y', pos.y);
    text.setAttribute('class', 'node-label');
    text.style.fontSize = label.length > 3 ? '12px' : '16px';
    text.textContent = label;
    
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = titleText;
    
    g.appendChild(circle);
    g.appendChild(text);
    g.appendChild(title);
    layer.appendChild(g);
}

function renderList() {
    systemList.innerHTML = '';
    const filtered = data.transfers.filter(sys => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'Bisaturated') return sys.type === 'Bisaturated';
        if (currentFilter === 'Saturated') return sys.type === 'Saturated' || sys.type === 'Bisaturated';
        if (currentFilter === 'Cosaturated') return sys.type === 'Cosaturated' || sys.type === 'Bisaturated';
        return true;
    });

    filtered.forEach(sys => {
        const li = document.createElement('li');
        li.setAttribute('class', 'system-item');
        if (sys.id === currentSystemIndex) li.classList.add('active');
        li.dataset.id = sys.id;
        li.innerHTML = `
            <span class="system-id">#${sys.id}</span>
            <div class="system-type-dot type-${sys.type}"></div>
        `;
        li.onclick = () => selectSystem(sys.id);
        systemList.appendChild(li);
    });
}

function selectSystem(index) {
    currentSystemIndex = index;
    const sys = data.transfers.find(t => t.id === index);
    if (!sys) return;

    // Update labels
    if (currentIdLabel) currentIdLabel.textContent = `#${index}`;
    if (currentTypeLabel) {
        currentTypeLabel.textContent = sys.type;
        currentTypeLabel.className = `badge type-${sys.type}`;
    }
    
    // Update list selection
    document.querySelectorAll('.system-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.id) === index);
    });

    // Draw transfer edges
    transferLayer.innerHTML = '';
    
    if (showGrouped && data.subgroup_conjugates) {
        // Aggregate transfer edges to class edges
        const activeClassEdges = new Set();
        sys.edges.forEach(edgeIdx => {
            const edge = data.lattice[edgeIdx];
            const fromClass = data.subgroup_conjugates[edge.from];
            const toClass = data.subgroup_conjugates[edge.to];
            if (fromClass !== toClass) {
                activeClassEdges.add(`${fromClass}->${toClass}`);
            }
        });

        activeClassEdges.forEach(key => {
            const [fromIdx, toIdx] = key.split('->').map(Number);
            drawEdge(data.conjugacy_classes[fromIdx].computedPos, data.conjugacy_classes[toIdx].computedPos, transferLayer, 'transfer-edge-path');
        });
    } else {
        sys.edges.forEach(edgeIdx => {
            const edge = data.lattice[edgeIdx];
            const fromNode = data.subgroups[edge.from];
            const toNode = data.subgroups[edge.to];
            drawEdge(fromNode.computedPos, toNode.computedPos, transferLayer, 'transfer-edge-path');
        });
    }
}

// Initial call
window.onload = init;
