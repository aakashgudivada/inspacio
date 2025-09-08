// ================== Fabric.js Canvas Setup ================== //
const canvas = new fabric.Canvas('editor', {
    width: 500,
    height: 500,
    backgroundColor: '#f0f0f0',
    preserveObjectStacking: true,
});

// ================== State & Pages Management ================== //
let pages = [];           // Each page holds JSON string of canvas state
let currentPageIndex = 0; // Tracks which page is active
let isDrawing = false;    // Pencil tool state
let canWork = true;       // To prevent spamming generate button

const loading = document.getElementById("load");
const genButton = document.getElementById("generateBtn");
const promptInput = document.getElementById("prompt");
const pageCountLabel = document.getElementById("pagecount");
const fileInput = document.getElementById("add");

// Hide loading after 2.5 seconds
window.onload = () => {
    setTimeout(() => {
        loading.style.display = "none";
    }, 2500);
};

// ================== Save/Load Canvas State ================== //
function savePageState() {
    // Save current canvas JSON into pages array at currentPageIndex
    pages[currentPageIndex] = JSON.stringify(canvas.toJSON());
    updatePageCount();
}

function loadPageState(index) {
    if (index < 0 || index >= pages.length) return;
    currentPageIndex = index;
    if (pages[index]) {
        canvas.loadFromJSON(pages[index], () => {
            canvas.renderAll();
        });
    } else {
        canvas.clear();
        canvas.backgroundColor = '#f0f0f0';
        canvas.renderAll();
    }
    updatePageCount();
    updateNavButtons();
}

// ================== Navigation ================== //
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

function updatePageCount() {
    pageCountLabel.textContent = `${currentPageIndex + 1}/${pages.length || 1} Pages`;
}

function updateNavButtons() {
    prevBtn.disabled = currentPageIndex === 0;
    nextBtn.disabled = currentPageIndex === pages.length - 1 || pages.length === 0;
}

prevBtn.onclick = () => {
    savePageState();
    if (currentPageIndex > 0) {
        loadPageState(currentPageIndex - 1);
    }
};

nextBtn.onclick = () => {
    savePageState();
    if (currentPageIndex < pages.length - 1) {
        loadPageState(currentPageIndex + 1);
    }
};

// ================== Canvas Interaction ================== //
// Discard active object when clicking on empty canvas space
canvas.on('mouse:down', (opt) => {
    if (!opt.target) {
        canvas.discardActiveObject();
        canvas.renderAll();
    }
});

canvas.on('object:modified', savePageState);
canvas.on('object:added', () => {
    if (!isDrawing) savePageState();
});

// ================== Tools ================== //

// Pencil tool toggle
document.getElementById("pencilBtn").onclick = () => {
    isDrawing = !canvas.isDrawingMode;
    canvas.isDrawingMode = !canvas.isDrawingMode;

    if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush.width = 3;
        canvas.freeDrawingBrush.color = "black";
        document.getElementById("pencilBtn").style.background = "#e0e0e0";
    } else {
        document.getElementById("pencilBtn").style.background = "";
        savePageState();
    }
};

// Add text tool
document.getElementById("textBtn").onclick = () => {
    isDrawing = false;
    const text = new fabric.Textbox("Click to edit text", {
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: 'center',
        originY: 'center',
        fontSize: 24,
        fill: "black",
        width: 200,
        hasControls: true,
    });
    canvas.add(text).setActiveObject(text);
    canvas.renderAll();
    savePageState();
};

// Undo / Redo system using fabric's history is not native,
// so we implement a simple undo/redo per page via history stacks:

let history = [[]];  // Array of arrays for each page
let historyStep = [0]; // Current index in history for each page

function saveHistory() {
    const state = JSON.stringify(canvas.toJSON());
    if (!history[currentPageIndex]) history[currentPageIndex] = [];
    history[currentPageIndex].splice(historyStep[currentPageIndex] + 1);
    history[currentPageIndex].push(state);
    historyStep[currentPageIndex]++;
    if (history[currentPageIndex].length > 50) history[currentPageIndex].shift();
}

function undo() {
    if (historyStep[currentPageIndex] > 0) {
        historyStep[currentPageIndex]--;
        const state = history[currentPageIndex][historyStep[currentPageIndex]];
        canvas.loadFromJSON(state, () => canvas.renderAll());
        savePageState();
    }
}

function redo() {
    if (history[currentPageIndex] && historyStep[currentPageIndex] < history[currentPageIndex].length - 1) {
        historyStep[currentPageIndex]++;
        const state = history[currentPageIndex][historyStep[currentPageIndex]];
        canvas.loadFromJSON(state, () => canvas.renderAll());
        savePageState();
    }
}

document.getElementById("undoBtn").onclick = () => {
    undo();
};

document.getElementById("redoBtn").onclick = () => {
    redo();
};

// After each modification, save history and page state
canvas.on('object:modified', () => {
    savePageState();
    saveHistory();
});

canvas.on('object:added', () => {
    savePageState();
    saveHistory();
});

// Eraser tool - remove selected object
document.getElementById("eraserBtn").onclick = () => {
    const active = canvas.getActiveObject();
    if (active) {
        canvas.remove(active);
        canvas.renderAll();
        savePageState();
        saveHistory();
    }
};

// Download canvas image
document.getElementById("downloadBtn").onclick = () => {
    const link = document.createElement("a");
    link.download = `canvas-page-${currentPageIndex + 1}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
};

// ================== Upload Image ================== //
fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (f) {
        fabric.Image.fromURL(f.target.result, (img) => {
            const maxWidth = canvas.width * 0.6;
            const maxHeight = canvas.height * 0.6;
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
            img.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: 'center',
                originY: 'center',
                scaleX: scale,
                scaleY: scale,
                hasControls: true,
            });
            canvas.add(img).setActiveObject(img);
            canvas.renderAll();
            savePageState();
            saveHistory();
        });
    };
    reader.readAsDataURL(file);
});

const defaulttext = "| The above is a drawing and a prompt combined, it may or may not include both. But based on the doodling or text added or any other requested. Please convert them into a new image based on context please. Ensure the size is 1:1 full to cover the canvas. Additionally, if there are any added images on the input image, make it so it fits/blends into the image by removing that image's background and/or making it look real please."

// Trigger file input on plus image click
const addImageIcon = document.querySelector('label[for="add"] img') || document.querySelector('img[title="Add Image"]');
if (addImageIcon) {
    addImageIcon.style.cursor = 'pointer';
    addImageIcon.addEventListener('click', () => fileInput.click());
}

// ================== Gemini Image Generation ================== //
async function generateImage() {
    if (!canWork) return;
    const prompt = promptInput && promptInput.value.trim() ? promptInput.value.trim() : "No specific detailed instructions. But look at the image please."
    canWork = false;
    genButton.textContent = "Generating...";
    genButton.disabled = true;

    try {
        // Prepare canvas data to send to API
        const canvasData = canvas.toDataURL('image/png').split(',')[1];

        // Compose prompt with any existing text objects info
        const texts = canvas.getObjects('textbox').map(t => t.text);
        const context = texts.length > 0 ? `Canvas text instructions: ${texts.join(", ")}. ` : "";
        const fullPrompt = context + prompt + defaulttext;

        // Fetch request to Gemini API
        const res = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=AIzaSyACphke4UCWwSvsMSSKP4LpKmIPIBl4RM8",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [
                                { text: fullPrompt },
                                {
                                    inlineData: {
                                        mimeType: "image/png",
                                        data: canvasData,
                                    },
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        const json = await res.json();
        if (!res.ok || !json?.candidates?.length) {
            throw new Error(json.error?.message || "Failed to generate image");
        }

        let generatedData = null;
        for (const part of json.candidates[0].content.parts) {
            if (part.inlineData?.data) {
                generatedData = part.inlineData.data;
                break;
            }
        }

        if (!generatedData) throw new Error("No image data returned from API");

        const newImageSrc = "data:image/png;base64," + generatedData;

        // Save current page state before switching
        savePageState();

        // Add new page with generated image
        const img = await new Promise((resolve) => {
            fabric.Image.fromURL(newImageSrc, (image) => {
                const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
                image.set({
                    left: canvas.width / 2,
                    top: canvas.height / 2,
                    originX: 'center',
                    originY: 'center',
                    scaleX: scale,
                    scaleY: scale,
                    hasControls: true,
                });
        
                resolve(image);
            });
        });
        
        // Manually create a blank canvas state and add this image
        const newCanvasObjects = [img];
        const newPageJSON = JSON.stringify({
            version: fabric.version,
            objects: newCanvasObjects.map(obj => obj.toObject(['left', 'top', 'scaleX', 'scaleY', 'originX', 'originY', 'hasControls'])),
            background: '#f0f0f0'
        });        

        // Add new page to pages array and switch to it
        pages.push(newPageJSON);
        currentPageIndex = pages.length - 1;

        loadPageState(currentPageIndex);
        promptInput.value = "";

    } catch (err) {
        alert("Failed to generate image: " + err.message);
        console.error(err);
    } finally {
        canWork = true;
        genButton.textContent = "Generate Image";
        genButton.disabled = false;
    }
}

genButton.onclick = generateImage;

// ================== Keyboard Shortcuts ================== //
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Ctrl+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
    }

    // Ctrl+Y for redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
    }

    // Delete key to erase selected object
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = canvas.getActiveObject();
        if (active) {
            canvas.remove(active);
            canvas.renderAll();
            savePageState();
            saveHistory();
        }
    }
});

// Trigger generate image when Enter is pressed in the prompt input
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        genButton.click();
    }
});

// ================== Initialization ================== //
// Initialize with one empty page
pages.push(null);
loadPageState(0);
saveHistory();