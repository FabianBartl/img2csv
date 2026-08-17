let isDrawing = false;
let startX, startY;
let isFrozen = false;

let isFlickerEnabled = false;
let flickerInterval = null;
let flickerHz = 4;

let activeCellIndex = null;
let cellsMetadata = [];

let tableRect = { x: 0, y: 0, w: 0, h: 0 };
let colPositions = []; 
let rowPositions = []; 

const imageInput = document.getElementById('image-upload');
const sourceImage = document.getElementById('source-image');
const drawLayer = document.getElementById('draw-layer');
const gridContainer = document.getElementById('grid-container');
const cellsLayer = document.getElementById('cells-layer');
const colHandlesDiv = document.getElementById('col-handles');
const rowHandlesDiv = document.getElementById('row-handles');
const opacitySlider = document.getElementById('opacity-slider');
const flickerToggle = document.getElementById('flicker-toggle');
const inspectionStrip = document.getElementById('inspection-strip');
const stripCanvas = document.getElementById('strip-canvas');
const stripInput = document.getElementById('strip-input');
const stripMeta = document.getElementById('strip-meta');

const rowsInput = document.getElementById('rows-input');
const colsInput = document.getElementById('cols-input');

// Prevent accidental tab closure or refresh
window.addEventListener('beforeunload', (e) => {
    if (sourceImage.src || gridContainer.style.display !== 'none') {
        e.preventDefault();
        e.returnValue = '';
    }
});

rowsInput.addEventListener('change', () => { 
    if (gridContainer.style.display !== 'none') { 
        initProportionalGrid(); 
        renderGrid(); 
    }
});

colsInput.addEventListener('change', () => { 
    if (gridContainer.style.display !== 'none') { 
        initProportionalGrid(); 
        renderGrid(); 
    }
});

updateUIState(false);

imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            sourceImage.src = event.target.result;
            sourceImage.style.display = 'block';

            // Preserve table layout if one exists, reset cell content for the new image
            if (gridContainer.style.display !== 'none' && colPositions.length > 0) {
                cellsMetadata = [];
                activeCellIndex = null;
                inspectionStrip.classList.remove('active');
                document.querySelectorAll('.cell-text').forEach(el => el.innerText = '');
                renderGrid();
                updateUIState(true);
            } else {
                resetTable();
            }
        };
        reader.readAsDataURL(file);
    }
});

function resetTable() {
    stopFlicker();
    if (flickerToggle) flickerToggle.checked = false;
    isFlickerEnabled = false;

    gridContainer.style.display = 'none';
    cellsLayer.innerHTML = '';
    colHandlesDiv.innerHTML = '';
    rowHandlesDiv.innerHTML = '';
    inspectionStrip.classList.remove('active');
    activeCellIndex = null;
    cellsMetadata = [];
    updateUIState(false);
}

function updateUIState(hasTable) {
    document.getElementById('btn-ocr').disabled = !hasTable;
    document.getElementById('btn-csv').disabled = !hasTable;
    document.getElementById('btn-clear').disabled = !hasTable;
    document.getElementById('freeze-toggle').disabled = !hasTable;
    if (!hasTable) {
        toggleFreeze(false);
    }
}

function updateTextColor(color) { 
    document.documentElement.style.setProperty('--text-color', color); 
}

function updateOpacity(val) {
    if (!isFlickerEnabled) {
        gridContainer.style.opacity = val;
    }
}

function toggleFlicker(enabled) {
    isFlickerEnabled = enabled;
    if (isFlickerEnabled) {
        startFlicker();
    } else {
        stopFlicker();
    }
}

function updateFlickerSpeed(val) {
    flickerHz = parseInt(val);
    if (isFlickerEnabled) {
        startFlicker();
    }
}

function startFlicker() {
    stopFlicker();
    if (!isFlickerEnabled) return;

    const intervalMs = 1000 / flickerHz;
    let showGrid = true;

    flickerInterval = setInterval(() => {
        showGrid = !showGrid;
        const baseOpacity = parseFloat(opacitySlider.value) || 1;
        gridContainer.style.opacity = showGrid ? baseOpacity : '0';
    }, intervalMs);
}

function stopFlicker() {
    if (flickerInterval) {
        clearInterval(flickerInterval);
        flickerInterval = null;
    }
    gridContainer.style.opacity = opacitySlider.value;
}

function clearTexts() { 
    document.querySelectorAll('.cell-text').forEach(el => el.innerText = ''); 
    cellsMetadata.forEach(meta => meta.isEdited = true);
    renderGrid();
}

function startDrawing() {
    if (!sourceImage.src) return alert('Please load an image first!');
    
    stopFlicker();
    if (flickerToggle) flickerToggle.checked = false;
    isFlickerEnabled = false;

    toggleFreeze(false);
    drawLayer.style.display = 'block';
    gridContainer.style.display = 'none';
}

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
    
    tableRect.w = Math.abs(currentX - startX);
    tableRect.h = Math.abs(currentY - startY);
    tableRect.x = currentX < startX ? currentX : startX;
    tableRect.y = currentY < startY ? currentY : startY;

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
}

function renderGrid() {
    const oldTexts = Array.from(document.querySelectorAll('.cell-text')).map(el => el.innerText);

    cellsLayer.innerHTML = '';
    colHandlesDiv.innerHTML = '';
    rowHandlesDiv.innerHTML = '';

    const cols = colPositions.length - 1;
    const rows = rowPositions.length - 1;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cellIndex = (r * cols) + c;
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.style.left = (colPositions[c] * tableRect.w) + 'px';
            cell.style.top = (rowPositions[r] * tableRect.h) + 'px';
            cell.style.width = ((colPositions[c+1] - colPositions[c]) * tableRect.w) + 'px';
            cell.style.height = ((rowPositions[r+1] - rowPositions[r]) * tableRect.h) + 'px';

            const textDiv = document.createElement('div');
            textDiv.className = 'cell-text';
            textDiv.contentEditable = true;
            if (oldTexts[cellIndex]) {
                textDiv.innerText = oldTexts[cellIndex];
            }

            textDiv.addEventListener('input', () => {
                if (isFrozen) {
                    updateActiveCellText(textDiv.innerText);
                    stripInput.value = textDiv.innerText;
                }
            });

            if (isFrozen && cellsMetadata[cellIndex]) {
                const conf = cellsMetadata[cellIndex].confidence;
                if (cellsMetadata[cellIndex].isEdited) {
                    cell.classList.add('cell-edited');
                } else if (conf < 70) {
                    cell.classList.add('confidence-low');
                } else if (conf < 90) {
                    cell.classList.add('confidence-medium');
                }
            }

            if (cellIndex === activeCellIndex && isFrozen) {
                cell.classList.add('active-cell');
            }

            cell.addEventListener('mousedown', () => {
                if (isFrozen) setActiveCell(cellIndex);
            });

            cell.appendChild(textDiv);
            cellsLayer.appendChild(cell);
        }
    }

    for (let c = 1; c < cols; c++) {
        const handle = document.createElement('div');
        handle.className = 'col-handle';
        handle.style.left = (colPositions[c] * tableRect.w) + 'px';

        const bar = document.createElement('div');
        bar.className = 'col-handle-bar';

        const delBtn = document.createElement('span'); 
        delBtn.className = 'handle-del'; 
        delBtn.innerText = '×';
        delBtn.onmousedown = (e) => { e.stopPropagation(); deleteCol(c); };

        handle.appendChild(delBtn);
        handle.appendChild(bar);
        attachHandleDrag(handle, 'col', c);
        colHandlesDiv.appendChild(handle);
    }

    for (let r = 1; r < rows; r++) {
        const handle = document.createElement('div');
        handle.className = 'row-handle';
        handle.style.top = (rowPositions[r] * tableRect.h) + 'px';

        const bar = document.createElement('div');
        bar.className = 'row-handle-bar';

        const delBtn = document.createElement('span'); 
        delBtn.className = 'handle-del'; 
        delBtn.innerText = '×';
        delBtn.onmousedown = (e) => { e.stopPropagation(); deleteRow(r); };

        handle.appendChild(delBtn);
        handle.appendChild(bar);
        attachHandleDrag(handle, 'row', r);
        rowHandlesDiv.appendChild(handle);
    }
}

gridContainer.onmousedown = (e) => {
    if (isFrozen) return; 
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

document.getElementById('resize-br-handle').onmousedown = (e) => {
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
        renderGrid();
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

document.getElementById('resize-tl-handle').onmousedown = (e) => {
    e.stopPropagation();
    const startW = tableRect.w;
    const startH = tableRect.h;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = tableRect.x;
    const origY = tableRect.y;

    const onMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        const newW = Math.max(50, startW - deltaX);
        const newH = Math.max(50, startH - deltaY);

        tableRect.x = origX + (startW - newW);
        tableRect.y = origY + (startH - newH);
        tableRect.w = newW;
        tableRect.h = newH;

        gridContainer.style.left = tableRect.x + 'px';
        gridContainer.style.top = tableRect.y + 'px';
        gridContainer.style.width = tableRect.w + 'px';
        gridContainer.style.height = tableRect.h + 'px';
        renderGrid();
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

document.getElementById('add-col-btn').onmousedown = (e) => {
    e.stopPropagation();
    const cols = colPositions.length - 1;
    const avgColW = tableRect.w / cols;
    tableRect.w += avgColW;
    gridContainer.style.width = tableRect.w + 'px';
    
    const oldW = tableRect.w - avgColW;
    for (let i = 0; i < colPositions.length; i++) {
        colPositions[i] = (colPositions[i] * oldW) / tableRect.w;
    }
    colPositions.push(1.0);
    colsInput.value = colPositions.length - 1;
    renderGrid();
};

document.getElementById('add-row-btn').onmousedown = (e) => {
    e.stopPropagation();
    const rows = rowPositions.length - 1;
    const avgRowH = tableRect.h / rows;
    tableRect.h += avgRowH;
    gridContainer.style.height = tableRect.h + 'px';
    
    const oldH = tableRect.h - avgRowH;
    for (let i = 0; i < rowPositions.length; i++) {
        rowPositions[i] = (rowPositions[i] * oldH) / tableRect.h;
    }
    rowPositions.push(1.0);
    rowsInput.value = rowPositions.length - 1;
    renderGrid();
};

function attachHandleDrag(element, type, index) {
    element.onmousedown = (e) => {
        e.stopPropagation();
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

    try {
        const response = await fetch('/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: sourceImage.src, cells: cellsData })
        });
        const data = await response.json();
        
        cellsMetadata = [];
        data.results.forEach(res => {
            cellsMetadata[res.id] = { 
                confidence: res.confidence, 
                originalText: res.text,
                isEdited: false 
            };
            cells[res.id].querySelector('.cell-text').innerText = res.text;
        });

        toggleFreeze(true);
        if (cells.length > 0) setActiveCell(0);
    } catch (error) {
        alert('Error connecting to OCR backend.');
    }
}

function toggleFreeze(freezeState) {
    isFrozen = freezeState;
    document.getElementById('freeze-toggle').checked = freezeState;
    const ws = document.getElementById('workspace');
    
    if (isFrozen) {
        ws.classList.add('frozen');
        renderGrid();
        inspectionStrip.classList.add('active');
    } else {
        ws.classList.remove('frozen');
        inspectionStrip.classList.remove('active');
        if (activeCellIndex !== null) {
            const cells = document.querySelectorAll('.grid-cell');
            if (cells[activeCellIndex]) cells[activeCellIndex].classList.remove('active-cell');
        }
    }
}

function setActiveCell(index) {
    const cells = document.querySelectorAll('.grid-cell');
    if (!cells[index]) return;

    if (activeCellIndex !== null && cells[activeCellIndex]) {
        cells[activeCellIndex].classList.remove('active-cell');
    }

    activeCellIndex = index;
    cells[activeCellIndex].classList.add('active-cell');

    const cols = colPositions.length - 1;
    const r = Math.floor(index / cols) + 1;
    const c = (index % cols) + 1;
    const textVal = cells[index].querySelector('.cell-text').innerText;
    const conf = cellsMetadata[index] ? cellsMetadata[index].confidence : 100;

    if (stripMeta) stripMeta.innerText = `Row ${r}, Col ${c} (Confidence: ${conf}%)`;
    if (stripInput) stripInput.value = textVal;

    drawInspectionCrop(index);

    if (stripInput) {
        stripInput.focus();
        stripInput.select();
    }
}

function drawInspectionCrop(index) {
    const cells = document.querySelectorAll('.grid-cell');
    if (!cells[index]) return;

    const cellRect = cells[index].getBoundingClientRect();
    const imgRect = sourceImage.getBoundingClientRect();
    const scaleX = sourceImage.naturalWidth / imgRect.width;
    const scaleY = sourceImage.naturalHeight / imgRect.height;

    const sx = (cellRect.left - imgRect.left) * scaleX;
    const sy = (cellRect.top - imgRect.top) * scaleY;
    const sw = cellRect.width * scaleX;
    const sh = cellRect.height * scaleY;

    stripCanvas.width = sw;
    stripCanvas.height = sh;
    const ctx = stripCanvas.getContext('2d');
    ctx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, sw, sh);
}

function updateActiveCellText(newVal) {
    if (activeCellIndex === null) return;
    const cells = document.querySelectorAll('.grid-cell');
    if (!cells[activeCellIndex]) return;

    const cellTextEl = cells[activeCellIndex].querySelector('.cell-text');
    if (cellTextEl.innerText !== newVal) {
        cellTextEl.innerText = newVal;
    }

    if (!cellsMetadata[activeCellIndex]) {
        cellsMetadata[activeCellIndex] = { confidence: 100, originalText: '', isEdited: true };
    }

    const meta = cellsMetadata[activeCellIndex];
    if (meta.originalText !== undefined && newVal !== meta.originalText) {
        meta.isEdited = true;
        cells[activeCellIndex].classList.add('cell-edited');
        cells[activeCellIndex].classList.remove('confidence-low', 'confidence-medium');
    } else {
        meta.isEdited = false;
        cells[activeCellIndex].classList.remove('cell-edited');
        if (meta.confidence < 70) cells[activeCellIndex].classList.add('confidence-low');
        else if (meta.confidence < 90) cells[activeCellIndex].classList.add('confidence-medium');
    }
}

stripInput.addEventListener('input', (e) => {
    updateActiveCellText(e.target.value);
});

document.addEventListener('keydown', (e) => {
    if (!isFrozen || activeCellIndex === null) return;

    const cols = colPositions.length - 1;
    const rows = rowPositions.length - 1;
    const total = cols * rows;

    if (e.key === 'Tab') {
        e.preventDefault();
        const nextIdx = e.shiftKey ? activeCellIndex - 1 : activeCellIndex + 1;
        if (nextIdx >= 0 && nextIdx < total) {
            setActiveCell(nextIdx);
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        const nextIdx = e.shiftKey ? activeCellIndex - cols : activeCellIndex + cols;
        if (nextIdx >= 0 && nextIdx < total) {
            setActiveCell(nextIdx);
        }
    }
});

function exportCSV() {
    const cols = colPositions.length - 1;
    const rows = rowPositions.length - 1;
    const cells = document.querySelectorAll('.grid-cell .cell-text');
    let csvContent = "";
    let cellIndex = 0;
    
    for (let r = 0; r < rows; r++) {
        let rowData = [];
        for (let c = 0; c < cols; c++) {
            let val = cells[cellIndex].innerText.trim();
            if (!isNaN(Number(val)) && val !== '') {
                rowData.push(val);
            } else if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') {
                rowData.push(val.toUpperCase());
            } else {
                rowData.push(`"${val.replace(/"/g, '""')}"`);
            }
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