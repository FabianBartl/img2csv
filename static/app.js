let isDrawing = false;
let startX, startY;
let gridRect = { x: 0, y: 0, w: 0, h: 0 };
let isFrozen = false;

const imageInput = document.getElementById('image-upload');
const sourceImage = document.getElementById('source-image');
const drawLayer = document.getElementById('draw-layer');
const gridContainer = document.getElementById('grid-container');
const rowsInput = document.getElementById('rows-input');
const colsInput = document.getElementById('cols-input');

// Load Image
imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            sourceImage.src = event.target.result;
            sourceImage.style.display = 'block';
            gridContainer.style.display = 'none'; // Reset grid
            gridContainer.innerHTML = '';
        };
        reader.readAsDataURL(file);
    }
});

function startDrawing() {
    if (!sourceImage.src) return alert('Load an image first!');
    isFrozen = false;
    document.getElementById('workspace').classList.remove('frozen');
    drawLayer.style.display = 'block'; // Enable drawing layer
    gridContainer.style.display = 'none';
}

// Drag to draw bounding box
drawLayer.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const rect = drawLayer.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    gridRect = { x: startX, y: startY, w: 0, h: 0 };
    
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
    
    gridRect.w = currentX - startX;
    gridRect.h = currentY - startY;
    
    // Handle dragging backwards
    gridContainer.style.left = (gridRect.w < 0 ? currentX : startX) + 'px';
    gridContainer.style.top = (gridRect.h < 0 ? currentY : startY) + 'px';
    gridContainer.style.width = Math.abs(gridRect.w) + 'px';
    gridContainer.style.height = Math.abs(gridRect.h) + 'px';
    
    renderGridLines(); // Live preview of evenly spaced cells
});

drawLayer.addEventListener('mouseup', () => {
    isDrawing = false;
    drawLayer.style.display = 'none'; // Disable draw layer, allow grid interaction
    
    // Normalize negatives
    gridRect.x = parseInt(gridContainer.style.left);
    gridRect.y = parseInt(gridContainer.style.top);
    gridRect.w = parseInt(gridContainer.style.width);
    gridRect.h = parseInt(gridContainer.style.height);
});

function renderGridLines() {
    gridContainer.innerHTML = ''; // Clear old lines
    const rows = parseInt(rowsInput.value);
    const cols = parseInt(colsInput.value);
    const w = Math.abs(gridRect.w);
    const h = Math.abs(gridRect.h);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.style.left = (c * (w / cols)) + 'px';
            cell.style.top = (r * (h / rows)) + 'px';
            cell.style.width = (w / cols) + 'px';
            cell.style.height = (h / rows) + 'px';
            cell.dataset.row = r;
            cell.dataset.col = c;
            
            // Add content editable div for OCR text
            const textDiv = document.createElement('div');
            textDiv.className = 'cell-text';
            textDiv.contentEditable = true;
            cell.appendChild(textDiv);
            
            gridContainer.appendChild(cell);
        }
    }
}

async function runOCR() {
    if (gridContainer.style.display === 'none') return alert('Draw a grid first!');
    
    const cellsData = [];
    const cells = document.querySelectorAll('.grid-cell');
    
    // Calculate absolute positions based on source image scale
    const imgRect = sourceImage.getBoundingClientRect();
    const scaleX = sourceImage.naturalWidth / imgRect.width;
    const scaleY = sourceImage.naturalHeight / imgRect.height;

    cells.forEach((cell, index) => {
        const rect = cell.getBoundingClientRect();
        // Map screen coordinates to actual image coordinates
        cellsData.push({
            id: index,
            x: (rect.left - imgRect.left) * scaleX,
            y: (rect.top - imgRect.top) * scaleY,
            width: rect.width * scaleX,
            height: rect.height * scaleY
        });
        cell.querySelector('.cell-text').innerText = "Loading...";
    });

    // Freeze the grid immediately upon OCR request
    if (!isFrozen) toggleFreeze();

    try {
        // Changed to relative path since it's hosted by Flask now
        const response = await fetch('/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: sourceImage.src,
                cells: cellsData
            })
        });
        const data = await response.json();
        
        // Populate text
        data.results.forEach(res => {
            cells[res.id].querySelector('.cell-text').innerText = res.text;
        });
        
    } catch (error) {
        alert('Error connecting to OCR backend.');
        console.error(error);
    }
}

function toggleFreeze() {
    isFrozen = !isFrozen;
    const ws = document.getElementById('workspace');
    if (isFrozen) {
        ws.classList.add('frozen');
    } else {
        ws.classList.remove('frozen');
    }
}

function updateOpacity(val) {
    gridContainer.style.opacity = val;
}

function exportCSV() {
    const rows = parseInt(rowsInput.value);
    const cols = parseInt(colsInput.value);
    const cells = document.querySelectorAll('.grid-cell .cell-text');
    
    let csvContent = "";
    let cellIndex = 0;
    
    for (let r = 0; r < rows; r++) {
        let rowData = [];
        for (let c = 0; c < cols; c++) {
            // Escape quotes and wrap in quotes for proper CSV formatting
            let text = cells[cellIndex].innerText.replace(/"/g, '""');
            rowData.push(`"${text}"`);
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