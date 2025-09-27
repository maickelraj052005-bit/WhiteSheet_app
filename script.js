class Whiteboard {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.miniMapCanvas = document.getElementById('miniMap');
        this.miniMapCtx = this.miniMapCanvas.getContext('2d');
        
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.currentTool = 'pencil';
        this.currentColor = '#000000';
        this.brushSize = 5;
        this.zoomLevel = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isPanning = false;
        this.lastPanPoint = { x: 0, y: 0 };
        
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        this.objects = [];
        this.tempShape = null;
        this.textInput = null;
        
        this.setupCanvas();
        this.setupEventListeners();
        this.updateMiniMap();
        this.hideLoading();
        
        // Tool name display
        this.setTool('pencil');
    }

    setupCanvas() {
        this.resizeCanvas();
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.clearCanvas();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - 70;
        this.miniMapCanvas.width = 150;
        this.miniMapCanvas.height = 100;
        this.redraw();
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.resizeCanvas());

        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouch(e));
        this.canvas.addEventListener('touchend', () => this.stopDrawing());

        // Tool buttons with tool names
        document.getElementById('pencilTool').addEventListener('click', () => this.setTool('pencil'));
        document.getElementById('eraserTool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('lineTool').addEventListener('click', () => this.setTool('line'));
        document.getElementById('rectangleTool').addEventListener('click', () => this.setTool('rectangle'));
        document.getElementById('circleTool').addEventListener('click', () => this.setTool('circle'));
        document.getElementById('arrowTool').addEventListener('click', () => this.setTool('arrow'));
        document.getElementById('textTool').addEventListener('click', () => this.setTool('text'));
        document.getElementById('stickyNoteTool').addEventListener('click', () => this.createStickyNote());

        // Color and brush size
        document.getElementById('colorPicker').addEventListener('change', (e) => {
            this.currentColor = e.target.value;
            this.updateToolDisplay();
        });

        document.getElementById('brushSize').addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            document.getElementById('brushSizeValue').textContent = this.brushSize + 'px';
            this.updateToolDisplay();
        });

        // Actions
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('saveBtn').addEventListener('click', () => this.save());
        document.getElementById('loadBtn').addEventListener('click', () => this.load());

        // Zoom
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(0.1));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(-0.1));
        document.getElementById('resetZoom').addEventListener('click', () => this.resetZoom());

        // Theme toggle
        document.getElementById('themeBtn').addEventListener('click', () => this.toggleTheme());

        // Panning
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                this.canvas.style.cursor = 'grab';
                this.isPanning = true;
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.canvas.style.cursor = this.getCursorForTool();
                this.isPanning = false;
            }
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomIntensity = 0.1;
            const wheel = e.deltaY < 0 ? 1 : -1;
            this.zoom(wheel * zoomIntensity, e.offsetX, e.offsetY);
        });
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.offsetX) / this.zoomLevel,
            y: (e.clientY - rect.top - this.offsetY) / this.zoomLevel
        };
    }

    startDrawing(e) {
        if (this.isPanning) {
            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            return;
        }

        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;

        if (['line', 'rectangle', 'circle', 'arrow'].includes(this.currentTool)) {
            this.tempShape = {
                type: this.currentTool,
                startX: pos.x,
                startY: pos.y,
                color: this.currentColor,
                size: this.brushSize
            };
        } else if (this.currentTool === 'text') {
            this.addText(pos.x, pos.y);
            this.isDrawing = false;
        }
    }

    draw(e) {
        if (!this.isDrawing) {
            if (this.isPanning && e.buttons === 1) {
                this.pan(e.clientX, e.clientY);
            }
            return;
        }

        const pos = this.getMousePos(e);
        
        if (this.tempShape) {
            // Draw temporary shape preview
            this.redraw();
            this.drawShapePreview(this.tempShape.type, this.tempShape.startX, this.tempShape.startY, pos.x, pos.y);
            return;
        }

        this.ctx.save();
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.translate(this.offsetX / this.zoomLevel, this.offsetY / this.zoomLevel);

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(pos.x, pos.y);

        if (this.currentTool === 'pencil') {
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.brushSize;
            this.ctx.stroke();
        } else if (this.currentTool === 'eraser') {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = this.brushSize;
            this.ctx.stroke();
        }

        this.ctx.restore();

        this.lastX = pos.x;
        this.lastY = pos.y;
    }

    drawShapePreview(type, startX, startY, endX, endY) {
        this.ctx.save();
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.translate(this.offsetX / this.zoomLevel, this.offsetY / this.zoomLevel);
        
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.brushSize;
        this.ctx.setLineDash([5, 5]);
        
        switch (type) {
            case 'line':
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY);
                this.ctx.lineTo(endX, endY);
                this.ctx.stroke();
                break;
            case 'rectangle':
                const rectWidth = endX - startX;
                const rectHeight = endY - startY;
                this.ctx.strokeRect(startX, startY, rectWidth, rectHeight);
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                this.ctx.beginPath();
                this.ctx.arc(startX, startY, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
            case 'arrow':
                this.drawArrow(startX, startY, endX, endY);
                break;
        }
        
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    drawArrow(fromX, fromY, toX, toY) {
        const headlen = 15;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        
        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(toX, toY);
        this.ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI/6), toY - headlen * Math.sin(angle - Math.PI/6));
        this.ctx.moveTo(toX, toY);
        this.ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI/6), toY - headlen * Math.sin(angle + Math.PI/6));
        this.ctx.stroke();
    }

    stopDrawing() {
        if (this.isDrawing && this.tempShape) {
            const pos = this.getMousePos(event);
            this.finalizeShape(this.tempShape.type, this.tempShape.startX, this.tempShape.startY, pos.x, pos.y);
            this.tempShape = null;
        }
        
        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveState();
        }
    }

    finalizeShape(type, startX, startY, endX, endY) {
        const shape = {
            type: type,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
            color: this.currentColor,
            size: this.brushSize,
            timestamp: Date.now()
        };
        
        this.objects.push(shape);
        this.redraw();
    }

    setTool(tool) {
        this.currentTool = tool;
        
        // Update active tool button
        document.querySelectorAll('.tool').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        
        // Change cursor
        this.canvas.style.cursor = this.getCursorForTool();
        
        // Update tool display
        this.updateToolDisplay();
    }

    getCursorForTool() {
        const cursors = {
            pencil: 'crosshair',
            eraser: 'cell',
            line: 'crosshair',
            rectangle: 'crosshair',
            circle: 'crosshair',
            arrow: 'crosshair',
            text: 'text'
        };
        return cursors[this.currentTool] || 'crosshair';
    }

    updateToolDisplay() {
        // Remove existing tool display
        const existingDisplay = document.querySelector('.tool-display');
        if (existingDisplay) {
            existingDisplay.remove();
        }
        
        // Create tool info display
        const toolDisplay = document.createElement('div');
        toolDisplay.className = 'tool-display';
        toolDisplay.innerHTML = `
            <strong>${this.currentTool.toUpperCase()}</strong> | 
            Size: ${this.brushSize}px | 
            Color: <span style="color:${this.currentColor}">■</span>
        `;
        toolDisplay.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: var(--toolbar-bg);
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 1000;
            border: 1px solid var(--border-color);
        `;
        
        document.body.appendChild(toolDisplay);
    }

    zoom(delta, x = this.canvas.width / 2, y = this.canvas.height / 2) {
        const zoomFactor = 1 + delta;
        const newZoom = this.zoomLevel * zoomFactor;
        this.zoomLevel = Math.max(0.1, Math.min(5, newZoom));
        
        this.offsetX -= (x - this.offsetX) * (zoomFactor - 1);
        this.offsetY -= (y - this.offsetY) * (zoomFactor - 1);
        
        this.redraw();
        this.updateToolDisplay();
    }

    pan(currentX, currentY) {
        const dx = currentX - this.lastPanPoint.x;
        const dy = currentY - this.lastPanPoint.y;
        
        this.offsetX += dx;
        this.offsetY += dy;
        
        this.lastPanPoint = { x: currentX, y: currentY };
        this.redraw();
    }

    resetZoom() {
        this.zoomLevel = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.redraw();
    }

    saveState() {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(this.canvas.toDataURL());
        this.historyIndex++;
        
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadState();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadState();
        }
    }

    loadState() {
        const img = new Image();
        img.onload = () => {
            this.clearCanvas();
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = this.history[this.historyIndex];
    }

    clearCanvas() {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
        
        this.drawGrid();
    }

 
    drawGrid() {
    // Plain white background - no grid
    this.ctx.save();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
}

    redraw() {
        this.clearCanvas();
        
        // Redraw all objects
        this.objects.forEach(obj => {
            this.drawObject(obj);
        });
        
        this.updateMiniMap();
    }

    drawObject(obj) {
        this.ctx.save();
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.translate(this.offsetX / this.zoomLevel, this.offsetY / this.zoomLevel);
        
        this.ctx.strokeStyle = obj.color;
        this.ctx.lineWidth = obj.size;
        this.ctx.fillStyle = obj.color;
        
        switch (obj.type) {
            case 'line':
                this.ctx.beginPath();
                this.ctx.moveTo(obj.startX, obj.startY);
                this.ctx.lineTo(obj.endX, obj.endY);
                this.ctx.stroke();
                break;
            case 'rectangle':
                const rectWidth = obj.endX - obj.startX;
                const rectHeight = obj.endY - obj.startY;
                this.ctx.strokeRect(obj.startX, obj.startY, rectWidth, rectHeight);
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(obj.endX - obj.startX, 2) + Math.pow(obj.endY - obj.startY, 2));
                this.ctx.beginPath();
                this.ctx.arc(obj.startX, obj.startY, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
            case 'arrow':
                this.drawArrow(obj.startX, obj.startY, obj.endX, obj.endY);
                break;
        }
        
        this.ctx.restore();
    }

    addText(x, y) {
        const text = prompt('Enter text:');
        if (text) {
            this.ctx.save();
            this.ctx.scale(this.zoomLevel, this.zoomLevel);
            this.ctx.translate(this.offsetX / this.zoomLevel, this.offsetY / this.zoomLevel);
            
            this.ctx.font = `${this.brushSize * 4}px Arial`;
            this.ctx.fillStyle = this.currentColor;
            this.ctx.fillText(text, x, y);
            
            this.ctx.restore();
            this.saveState();
        }
    }

    createStickyNote() {
        const note = document.createElement('div');
        note.className = 'sticky-note';
        note.innerHTML = `
            <div class="note-header">
                <button class="close-btn">×</button>
            </div>
            <textarea placeholder="Type your note here..." autofocus></textarea>
        `;
        
        note.style.left = '100px';
        note.style.top = '100px';
        
        // Close button functionality
        const closeBtn = note.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            note.remove();
        });
        
        this.makeDraggable(note);
        document.body.appendChild(note);
        
        // Auto-focus textarea
        const textarea = note.querySelector('textarea');
        textarea.focus();
    }

    makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        const header = element.querySelector('.note-header') || element;
        
        header.onmousedown = dragMouseDown;
        
        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        
        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }
        
        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    updateMiniMap() {
        // Clear mini-map
        const canvasBg = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg') || '#f8f8f8';
        this.miniMapCtx.fillStyle = canvasBg;
        this.miniMapCtx.fillRect(0, 0, this.miniMapCanvas.width, this.miniMapCanvas.height);
        
        // Scale factors
        const scaleX = this.miniMapCanvas.width / this.canvas.width;
        const scaleY = this.miniMapCanvas.height / this.canvas.height;
        
        // Draw scaled version of main canvas
        this.miniMapCtx.drawImage(
            this.canvas,
            0, 0, this.canvas.width, this.canvas.height,
            0, 0, this.miniMapCanvas.width, this.miniMapCanvas.height
        );
        
        // Draw viewport rectangle
        this.miniMapCtx.strokeStyle = 'red';
        this.miniMapCtx.lineWidth = 2;
        
        const viewportX = (-this.offsetX / this.zoomLevel) * scaleX;
        const viewportY = (-this.offsetY / this.zoomLevel) * scaleY;
        const viewportWidth = (this.canvas.width / this.zoomLevel) * scaleX;
        const viewportHeight = (this.canvas.height / this.zoomLevel) * scaleY;
        
        this.miniMapCtx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);
    }

    save() {
        // Save to localStorage
        const data = {
            objects: this.objects,
            zoomLevel: this.zoomLevel,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            currentColor: this.currentColor,
            brushSize: this.brushSize
        };
        
        localStorage.setItem('whiteboardData', JSON.stringify(data));
        
        // Export as PNG
        const link = document.createElement('a');
        link.download = 'whiteboard.png';
        link.href = this.canvas.toDataURL();
        link.click();
        
        alert('Whiteboard saved successfully!');
    }

    load() {
        const saved = localStorage.getItem('whiteboardData');
        if (saved) {
            const data = JSON.parse(saved);
            this.objects = data.objects || [];
            this.zoomLevel = data.zoomLevel || 1;
            this.offsetX = data.offsetX || 0;
            this.offsetY = data.offsetY || 0;
            this.currentColor = data.currentColor || '#000000';
            this.brushSize = data.brushSize || 5;
            
            this.redraw();
            this.updateToolDisplay();
            alert('Whiteboard loaded successfully!');
        } else {
            alert('No saved whiteboard found!');
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        document.getElementById('themeBtn').textContent = newTheme === 'dark' ? '☀️' : '🌙';
        
        localStorage.setItem('whiteboardTheme', newTheme);
        this.redraw();
    }

    handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        
        if (e.type === 'touchstart') {
            this.startDrawing(mouseEvent);
        } else if (e.type === 'touchmove') {
            this.draw(mouseEvent);
        }
    }

    hideLoading() {
        setTimeout(() => {
            document.getElementById('loadingOverlay').style.display = 'none';
        }, 500);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Whiteboard();
});

// Load saved theme
const savedTheme = localStorage.getItem('whiteboardTheme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
document.getElementById('themeBtn').textContent = savedTheme === 'dark' ? '☀️' : '🌙';