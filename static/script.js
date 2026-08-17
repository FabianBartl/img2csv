let isDrawing = false;
let startX, startY;
let isFrozen = false;
let isCustomResized = false;

// Core State for Table
let tableRect = { x: 0, y: 0, w: 0, h: 0 };
let colPositions = []; // Normalized positions [0.0, ..., 1.0]
let rowPositions = []; // Normalized positions [0.0, ..., 1.0]

const imageInput = document.getElementById('image-upload');
const sourceImage = document.getElementById('source-image');
const drawLayer = document.getElementById('draw-layer');
const gridContainer = document.getElementById('grid-container');
const cellsLayer = document.getElementById('cells-layer');
const colHandlesDiv = document.getElementById('col-handles');
const rowHandlesDiv = document.getElementById('row-handles');
const moveHandle = document.getElementById('move-handle');
const resizeHandle = document.getElementById('resize-handle');

const rowsInput = document.getElementById('rows-input');
const colsInput = document.getElementById('cols-input');

// Initialize UI States
updateUIState(false);

imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            sourceImage.src = event.target.result;
            sourceImage.style.display = 'block';
            resetTable();
        };
        reader.readAsDataURL(file);
    }
});

function resetTable() {
    gridContainer.style.display = 'none';
    cellsLayer.innerHTML = '';
    colHandlesDiv.innerHTML = '';
    rowHandlesDiv.innerHTML = '';
    updateUIState(false);
}

function updateUIState(hasTable) {
    document.getElementById('btn-ocr').disabled = !hasTable;
    document.getElementById('btn-csv').disabled = !hasTable;
    document.getElementById('freeze-toggle').disabled = !hasTable;
    if (!hasTable) {
        document.getElementById('freeze-toggle').checked = false;
        toggleFreeze(false);
    }
}

function updateTextColor(color) {
    document.documentElement.style.setProperty('--text-color', color);
}

function updateOpacity(val) {
    gridContainer.style.opacity = val;
}

function startDrawing() {
    if (!sourceImage.src) return alert('Please load an image first!');
    toggleFreeze(false);
    document.getElementById('freeze-toggle').checked = false;
    drawLayer.style.display = 'block';
    gridContainer.style.display = 'none';
}

// 1. Drawing the Initial Table Grid
drawLayer.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const rect = drawLayer.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    
    tableRect = { x: startX, y: startY, w: 0, h: 0 };
    initProportionalGrid();

    gridContainer.style.left = startX + 'px';
    gridContainer.style.top = startY + 'px';
    gridContainer.style.width = '0px';
    gridContainer.style.height = '0px';
    gridContainer.style.display = 'block';
});

drawLayer.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const rect = drawLayer.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    tableRect.w = currentX - startX;
    tableRect.h = currentY - startY;
    
    tableRect.x = tableRect.w < 0 ? currentX : startX;
    tableRect.y = tableRect.h < 0 ? currentY : startY;
    tableRect.w = Math.abs(tableRect.w);
    tableRect.h = Math.abs(tableRect.h);

    gridContainer.style.left = tableRect.x + 'px';
    gridContainer.style.top = tableRect.y + 'px';
    gridContainer.style.width = tableRect.w + 'px';
    gridContainer.style.height = tableRect.h + 'px';

    renderGrid();
});

drawLayer.addEventListener('mouseup', () => {
    if (!isDrawing) return;
    isDrawing = false;
    drawLayer.style.display = 'none';
    if (tableRect.w > 20 && tableRect.h > 20) {
        updateUIState(true);
    } else {
        resetTable();
    }
});

function initProportionalGrid() {
    const rows = parseInt(rowsInput.value);
    const cols = parseInt(colsInput.value);
    colPositions = [];
    rowPositions = [];
    for (let c = 0; c <= cols; c++) colPositions.push(c / cols);
    for (let r = 0; r <= rows; r++) rowPositions.push(r / rows);
    isCustomResized = false;
}

// 2. Render Grid, Cells & Interactive Handles
function renderGrid() {
    cellsLayer.innerHTML = '';
    colHandlesDiv.innerHTML = '';
    rowHandlesDiv.innerHTML = '';

    const cols = colPositions.length - 1;
    const rows = rowPositions.length - 1;

    // Render Cells
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            
            const cellLeft = colPositions[c] * tableRect.w;
            const cellWidth = (colPositions[c+1] - colPositions[c]) * tableRect.w;
            const cellTop = rowPositions[r] * tableRect.h;
            const cellHeight = (rowPositions[r+1] - rowPositions[r]) * tableRect.h;

            cell.style.left = cellLeft + 'px';
            cell.style.top = cellTop + 'px';
            cell.style.width = cellWidth + 'px';
            cell.style.height = cellHeight + 'px';
            cell.dataset.row = r;
            cell.dataset.col = c;

            const textDiv = document.createElement('div');
            textDiv.className = 'cell-text';
            textDiv.contentEditable = true;
            cell.appendChild(textDiv);

            cellsLayer.appendChild(cell);
        }
    }

    // Render Col Handles (Inner dividers stick out at top)
    for (let c = 1; c < cols; c++) {
        const handle = document.createElement('div');
        handle.className = 'col-handle';
        handle.style.left = (colPositions[c] * tableRect.w) + 'px';
        
        const delBtn = document.createElement('span');
        delBtn.className = 'handle-del';
        delBtn.innerText = '×';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteCol(c); };
        handle.appendChild(delBtn);

        attachHandleDrag(handle, 'col', c);
        colHandlesDiv.appendChild(handle);
    }

    // Render Row Handles (Inner dividers stick out at left)
    for (let r = 1; r < rows; r++) {
        const handle = document.createElement('div');
        handle.className = 'row-handle';
        handle.style.top = (rowPositions[r] * tableRect.h) + 'px';

        const delBtn = document.createElement('span');
        delBtn.className = 'handle-del';
        delBtn.innerText = '×';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteRow(r); };
        handle.appendChild(delBtn);

        attachHandleDrag(handle, 'row', r);
        rowHandlesDiv.appendChild(handle);
    }
}

// 3. Handle Dragging Logic for Inner Lines
function attachHandleDrag(element, type, index) {
    element.onmousedown = (e) => {
        e.stopPropagation();
        isCustomResized = true;
        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const initialVal = type === 'col' ? colPositions[index] : rowPositions[index];

        const onMouseMove = (moveEvent) => {
            if (type === 'col') {
                const deltaX = moveEvent.clientX - startMouseX;
                let newVal = initialVal + (deltaX / tableRect.w);
                newVal = Math.max(colPositions[index - 1] + 0.02, Math.min(colPositions[index + 1] - 0.02, newVal));
                colPositions[index] = newVal;
            } else {
                const deltaY = moveEvent.clientY - startMouseY;
                let newVal = initialVal + (deltaY / tableRect.h);
                newVal = Math.max(rowPositions[index - 1] + 0.02, Math.min(rowPositions[index + 1] - 0.02, newVal));
                rowPositions[index] = newVal;
            }
            renderGrid();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
}

function deleteCol(index) {
    colPositions.splice(index, 1);
    colsInput.value = colPositions.length - 1;
    renderGrid();
}

function deleteRow(index) {
    rowPositions.splice(index, 1);
    rowsInput.value = rowPositions.length - 1;
    renderGrid();
}

// 4. Move Table & Resize Table
moveHandle.onmousedown = (e) => {
    e.stopPropagation();
    const startX = e.clientX - tableRect.x;
    const startY = e.clientY - tableRect.y;

    const onMouseMove = (moveEvent) => {
        tableRect.x = moveEvent.clientX - startX;
        tableRect.y = moveEvent.clientY - startY;
        gridContainer.style.left = tableRect.x + 'px';
        gridContainer.style.top = tableRect.y + 'px';
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

resizeHandle.onmousedown = (e) => {
    e.stopPropagation();
    const startW = tableRect.w;
    const startH = tableRect.h;
    const startX = e.clientX;
    const startY = e.clientY;

    const onMouseMove = (moveEvent) => {
        tableRect.w = Math.max(50, startW + (moveEvent.clientX - startX));
        tableRect.h = Math.max(50, startH + (moveEvent.clientY - startY));
        gridContainer.style.width = tableRect.w + 'px';
        gridContainer.style.height = tableRect.h + 'px';

        if (!isCustomResized) {
            initProportionalGrid();
        }
        renderGrid();
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

// 5. OCR & Freeze Logic
async function runOCR() {
    const cellsData = [];
    const cells = document.querySelectorAll('.grid-cell');
    
    const imgRect = sourceImage.getBoundingClientRect();
    const scaleX = sourceImage.naturalWidth / imgRect.width;
    const scaleY = sourceImage.naturalHeight / imgRect.height;

    cells.forEach((cell, index) => {
        const rect = cell.getBoundingClientRect();
        cellsData.push({
            id: index,
            x: (rect.left - imgRect.left) * scaleX,
            y: (rect.top - imgRect.top) * scaleY,
            width: rect.width * scaleX,
            height: rect.height * scaleY
        });
        cell.querySelector('.cell-text').innerText = "...";
    });

    document.getElementById('freeze-toggle').checked = true;
    toggleFreeze(true);

    try {
        const response = await fetch('/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: sourceImage.src,
                cells: cellsData
            })
        });
        const data = await response.json();
        
        data.results.forEach(res => {
            cells[res.id].querySelector('.cell-text').innerText = res.text;
        });
    } catch (error) {
        alert('Error connecting to OCR backend.');
        console.error(error);
    }
}

function toggleFreeze(freezeState) {
    isFrozen = freezeState;
    const ws = document.getElementById('workspace');
    if (isFrozen) {
        ws.classList.add('frozen');
    } else {
        ws.classList.remove('frozen');
    }
}

// 6. CSV Export with Smart Data-Type Detection
function formatValueForCSV(val) {
    const trimmed = val.trim();
    if (trimmed === '') return '';

    // Check for Integer / Float numbers
    const num = Number(trimmed);
    if (!isNaN(num) && !isNaN(parseFloat(trimmed))) {
        return trimmed; // Unquoted standard number
    }

    // Check for Boolean
    if (trimmed.toLowerCase() === 'true' || trimmed.toLowerCase() === 'false') {
        return trimmed.toUpperCase();
    }

    // Default String formatting (escape existing double quotes and wrap in quotes)
    return `"${trimmed.replace(/"/g, '""')}"`;
}

function exportCSV() {
    const cols = colPositions.length - 1;
    const rows = rowPositions.length - 1;
    const cells = document.querySelectorAll('.grid-cell .cell-text');
    
    let csvContent = "";
    let cellIndex = 0;
    
    for (let r = 0; r < rows; r++) {
        let rowData = [];
        for (let c = 0; c < cols; c++) {
            const formattedVal = formatValueForCSV(cells[cellIndex].innerText);
            rowData.push(formattedVal);
            cellIndex++;
        }
        csvContent += rowData.join(",") + "\n";
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "table_extract.csv";
    link.click();
}