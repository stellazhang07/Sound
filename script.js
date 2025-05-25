document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('doodleArea');
    if (!canvas) {
        console.error("Fatal Error: Canvas element with ID 'doodleArea' not found.");
        alert("Fatal Error: Canvas element 'doodleArea' not found. The application cannot start. Please check the HTML ID.");
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Fatal Error: Unable to get 2D context from canvas.");
        alert("Fatal Error: Unable to get 2D context. Your browser might not support it or the canvas element is incorrect.");
        return;
    }

    const playSoundButton = document.getElementById('playSoundButton');
    const clearButton = document.getElementById('clearButton');
    const colorBrushes = document.querySelectorAll('.color-brush');
    const brushSizeInput = document.getElementById('brushSize');

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentColor = '#FF0000';
    let currentBrushSize = 10;

    let audioCtx;
    const LAZY_INIT_AUDIOCONTEXT = () => {
        if (!audioCtx || audioCtx.state === 'closed') {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(err => console.error("Error resuming AudioContext:", err));
        }
        return audioCtx;
    };

    function initializeCanvas() {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentBrushSize;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
    }
    initializeCanvas();

    function getMousePos(canvasDom, event) {
        const rect = canvasDom.getBoundingClientRect();
        let clientX, clientY;
        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        const scaleX = canvasDom.width / rect.width;
        const scaleY = canvasDom.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }
    
    function startDrawing(e) {
        LAZY_INIT_AUDIOCONTEXT(); 
        isDrawing = true;
        const pos = getMousePos(canvas, e);
        [lastX, lastY] = [pos.x, pos.y];
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, currentBrushSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = currentColor;
        ctx.fill();
        ctx.beginPath(); 
        ctx.moveTo(pos.x, pos.y);
        if (e.cancelable) e.preventDefault();
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getMousePos(canvas, e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastX = pos.x;
        lastY = pos.y;
        if (e.cancelable) e.preventDefault();
    }

    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        ctx.beginPath();
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    colorBrushes.forEach(brush => {
        brush.addEventListener('click', () => {
            currentColor = brush.dataset.color;
            ctx.strokeStyle = currentColor;
            ctx.fillStyle = currentColor;
            colorBrushes.forEach(b => b.classList.remove('active'));
            brush.classList.add('active');
        });
    });
    
    if (colorBrushes.length > 0) {
        colorBrushes[0].click();
    } else {
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
    }

    brushSizeInput.addEventListener('input', (e) => {
        currentBrushSize = e.target.value;
        ctx.lineWidth = currentBrushSize;
    });

    clearButton.addEventListener('click', () => {
        initializeCanvas();
    });

    const colorToSoundMap = {
        '#FF0000': { pianoVariant: 'standard', baseGain: 0.5 },
        '#00FF00': { pianoVariant: 'standard', baseGain: 0.45 },
        '#0000FF': { pianoVariant: 'standard', baseGain: 0.5 },
        '#FFFF00': { pianoVariant: 'standard', baseGain: 0.4 },
        '#FF00FF': { pianoVariant: 'standard', baseGain: 0.48 },
        '#00FFFF': { pianoVariant: 'standard', baseGain: 0.42 },
        '#FFA500': { pianoVariant: 'standard', baseGain: 0.5 },
        '#800080': { pianoVariant: 'standard', baseGain: 0.45 },
        '#A52A2A': { pianoVariant: 'standard', baseGain: 0.35 },
        '#000000': { pianoVariant: 'standard', baseGain: 0.4 },
    };

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    function playPianoNote(frequency, startTime, noteOverallDuration, soundParams) {
        const currentAudioCtx = LAZY_INIT_AUDIOCONTEXT();
        if (!currentAudioCtx) return;

        const oscillator = currentAudioCtx.createOscillator();
        oscillator.type = 'sawtooth'; // 或 'triangle'
        oscillator.frequency.setValueAtTime(frequency, startTime);

        const gainNode = currentAudioCtx.createGain();
        
        const attackTime = 0.01; 
        const decayTime = 0.2;  
        const sustainLevel = 0.3;

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(soundParams.baseGain, startTime + attackTime);
        gainNode.gain.exponentialRampToValueAtTime(soundParams.baseGain * sustainLevel, startTime + attackTime + decayTime);
        
        const actualReleaseStartTime = Math.max(startTime + attackTime + decayTime, startTime + noteOverallDuration * 0.7);
        // 确保在开始释放前，增益至少保持在衰减后的水平
        if (startTime + attackTime + decayTime < actualReleaseStartTime) {
             gainNode.gain.setValueAtTime(soundParams.baseGain * sustainLevel, startTime + attackTime + decayTime); // 明确设置持续音量
        }
        gainNode.gain.setValueAtTime(soundParams.baseGain * sustainLevel, actualReleaseStartTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + noteOverallDuration);

        oscillator.connect(gainNode);
        gainNode.connect(currentAudioCtx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + noteOverallDuration + 0.1); 
    }

    playSoundButton.addEventListener('click', () => {
        const currentAudioCtx = LAZY_INIT_AUDIOCONTEXT();
        if (!currentAudioCtx) {
            alert("Web Audio API is not supported or could not be initialized.");
            return;
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        const totalDurationSeconds = 5; 
        const timeStep = totalDurationSeconds / width;
        const noteDurationOnCanvas = 0.6; // 调整此值以改变音符的感知长度
        const minFreq = 50; 
        const maxFreq = 2000;

        for (let x = 0; x < width; x++) {
            const currentTime = currentAudioCtx.currentTime + x * timeStep;
            let playedInColumnForColor = {}; 

            for (let y = 0; y < height; y++) {
                const pixelIndex = (y * width + x) * 4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                const a = data[pixelIndex + 3];

                if (a > 128) { 
                    for (const hexColor in colorToSoundMap) {
                        if (playedInColumnForColor[hexColor]) continue;

                        const brushRgb = hexToRgb(hexColor);
                        if (!brushRgb) continue; 

                        const tolerance = 45; 
                        if (Math.abs(r - brushRgb.r) < tolerance &&
                            Math.abs(g - brushRgb.g) < tolerance &&
                            Math.abs(b - brushRgb.b) < tolerance) {
                            
                            const soundParams = colorToSoundMap[hexColor];
                            const frequency = maxFreq - (y / height) * (maxFreq - minFreq);
                            
                            playPianoNote(frequency, currentTime, noteDurationOnCanvas, soundParams);
                            playedInColumnForColor[hexColor] = true;
                        }
                    }
                }
            }
        }
    });
});