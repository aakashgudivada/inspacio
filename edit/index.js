// ================== Fabric.js Canvas ================== //
const canvas = new fabric.Canvas('editor', {
    width: 500,
    height: 500,
    backgroundColor: '#f0f0f0'
});

// ================== State Management ================== //
let history = [];
let redoStack = [];
let generatedImages = [];
let currentIndex = 0;
let isEditing = false;
let canWork = true;

const outputImg = document.getElementById("outputImg");
const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const genButton = document.getElementById("generateBtn");

function saveState() {
    history.push(JSON.stringify(canvas.toJSON()));
    redoStack = [];
    if (history.length > 20) history.shift(); // Limit history
}

function enterEditingMode() {
    if (!isEditing) {
        isEditing = true;
        document.querySelector('.canvas-output-wrapper').classList.add('editing-mode');
        outputImg.classList.add('hidden');
        canvas.renderAll();
    }
}

function updateNavigationButtons() {
    document.getElementById("prevBtn").disabled = currentIndex <= 0 || generatedImages.length === 0;
    document.getElementById("nextBtn").disabled = currentIndex >= generatedImages.length - 1 || generatedImages.length === 0;
}

// ================== Add Image ================== //
document.getElementById("add").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    
    enterEditingMode();
    const reader = new FileReader();
    reader.onload = function (f) {
        fabric.Image.fromURL(f.target.result, function (img) {
            // Scale image to fit canvas better
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
                hasControls: true
            });
            canvas.add(img).setActiveObject(img);
            canvas.renderAll();
            saveState();
        });
    };
    reader.readAsDataURL(file);
});

// ================== Pencil Tool ================== //
document.getElementById("pencilBtn").onclick = () => {
    enterEditingMode();
    canvas.isDrawingMode = !canvas.isDrawingMode;
    
    if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush.width = 3;
        canvas.freeDrawingBrush.color = "black";
        document.getElementById("pencilBtn").style.background = "#e0e0e0";
    } else {
        document.getElementById("pencilBtn").style.background = "";
    }
};

// Save state after drawing
canvas.on('mouse:up', () => {
    if (canvas.isDrawingMode) {
        setTimeout(saveState, 100);
    }
});

canvas.on('mouse:down', function (options) {
    if (!options.target) {
        canvas.discardActiveObject();
        canvas.renderAll();
    }
});

// ================== Text Tool ================== //
document.getElementById("textBtn").onclick = () => {
    enterEditingMode();
    const text = new fabric.Textbox("Click to edit text", {
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: 'center',
        originY: 'center',
        fontSize: 24,
        fill: "black",
        width: 200,
        hasControls: true
    });
    canvas.add(text).setActiveObject(text);
    canvas.renderAll();
    saveState();
};

// ================== Undo / Redo ================== //
document.getElementById("undoBtn").onclick = () => {
    if (history.length > 1) {
        redoStack.push(history.pop());
        const restore = history[history.length - 1];
        if (restore) {
            canvas.loadFromJSON(restore, () => {
                canvas.renderAll();
            });
        } else {
            canvas.clear();
            canvas.renderAll();
        }
    }
};

document.getElementById("redoBtn").onclick = () => {
    if (redoStack.length > 0) {
        const restore = redoStack.pop();
        history.push(restore);
        canvas.loadFromJSON(restore, () => {
            canvas.renderAll();
        });
    }
};

// ================== Eraser Tool ================== //
document.getElementById("eraserBtn").onclick = () => {
    const active = canvas.getActiveObject();
    if (active) {
        canvas.remove(active);
        canvas.renderAll();
        saveState();
    }
};

// ================== Download ================== //
document.getElementById("downloadBtn").onclick = () => {
    const link = document.createElement("a");
    link.download = "canvas.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
};

function extractCanvasContent() {
    const textElements = [];
    const imageCount = canvas.getObjects('image').length;

    canvas.getObjects().forEach(obj => {
        if (obj.type === 'textbox' || obj.type === 'text') {
            textElements.push({
                text: obj.text,
                x: obj.left,
                y: obj.top
            });
        }
    });
    return {
        base64: canvas.toDataURL("image/png").split(",")[1],
        texts: textElements,
        imageCount
    };
}

// ================== Google Gemini Integration ================== //
async function generateImage() {
    const promptInput = document.getElementById("prompt").value.trim();
    
    if (!canWork) return;
    if (!promptInput) {
        alert("Please enter a prompt for image generation");
        return;
    }

    canWork = false;
    genButton.textContent = "Generating...";
    genButton.disabled = true;

    try {
        const contextInfo = texts.length > 0 
  ? `The current canvas contains ${imageCount} image(s) and the following instructions: ` +
    texts.map(t => `"${t.text}" at position (${Math.round(t.x)}, ${Math.round(t.y)})`).join(", ") + "." 
  : "";
  const geminiPrompt = `${contextInfo} ${promptInput}`;

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
                                { text: geminiPrompt },
                                {
                                    inlineData: {
                                        mimeType: "image/png",
                                        data: base64,
                                    },
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        const json = await res.json();
        console.log("API Response:", json);

        if (!res.ok || !json?.candidates?.length) {
            throw new Error(json.error?.message || "Failed to generate image");
        }

        let outImage = null;
        for (const part of json.candidates[0].content.parts) {
            if (part.inlineData?.data) {
                outImage = part.inlineData.data;
                break;
            }
        }

        if (!outImage) {
            throw new Error("No image returned from API");
        }

        const fullBase64 = "data:image/png;base64," + outImage;
        generatedImages.push(fullBase64);
        currentIndex = generatedImages.length - 1;
        
        // Show the generated image in modal
        showGeneratedImage(fullBase64);
        
    } catch (error) {
        console.error("Generation error:", error);
        alert("Failed to generate image: " + error.message);
    } finally {
        canWork = true;
        genButton.textContent = "Generate Image";
        genButton.disabled = false;
        updateNavigationButtons();
    }
}

// ================== Show Generated Image ================== //
function showGeneratedImage(imageUrl) {
    modalImage.src = imageUrl;
    imageModal.classList.add('show');
}

// ================== Modal Functions ================== //
function closeImageModal() {
    imageModal.classList.remove('show');
}

function addGeneratedToCanvas() {
    if (generatedImages[currentIndex]) {
        enterEditingMode();
        fabric.Image.fromURL(generatedImages[currentIndex], function (img) {
            const maxWidth = canvas.width * 0.7;
            const maxHeight = canvas.height * 0.7;
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
            
            img.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: 'center',
                originY: 'center',
                scaleX: scale,
                scaleY: scale,
                hasControls: true
            });
            canvas.add(img).setActiveObject(img);
            canvas.renderAll();
            saveState();
            closeImageModal();
        });
    }
}

function downloadGeneratedImage() {
    if (generatedImages[currentIndex]) {
        const link = document.createElement("a");
        link.download = `generated-image-${Date.now()}.png`;
        link.href = generatedImages[currentIndex];
        link.click();
    }
}

// ================== Navigation Arrows ================== //
document.getElementById("nextBtn").onclick = () => {
    if (generatedImages.length > 0 && currentIndex < generatedImages.length - 1) {
        currentIndex++;
        showGeneratedImage(generatedImages[currentIndex]);
        updateNavigationButtons();
    }
};

document.getElementById("prevBtn").onclick = () => {
    if (generatedImages.length > 0 && currentIndex > 0) {
        currentIndex--;
        showGeneratedImage(generatedImages[currentIndex]);
        updateNavigationButtons();
    }
};

// ================== Generate Button ================== //
genButton.onclick = generateImage;

// ================== Navbar Hover Label ================== //
const label = document.getElementById("label");
const navbarImgs = document.querySelectorAll(".navbar img, .navbar label img");

navbarImgs.forEach(img => {
    img.addEventListener("mouseenter", (e) => {
        const title = e.target.title || e.target.parentElement.querySelector('img')?.title || "Tool";
        label.textContent = title;
        label.style.display = 'block';
    });
    img.addEventListener("mouseleave", () => {
        label.style.display = 'none';
    });
});

// ================== Canvas Event Handlers ================== //
canvas.on('object:added', () => {
    if (canvas.getObjects().length > 0) {
        enterEditingMode();
    }
});

// ================== Initialization ================== //
saveState(); // Save initial empty state
updateNavigationButtons();

// Allow Enter key to generate
document.getElementById("prompt").addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        generateImage();
    }
});