// URL de la API servida por Vercel
const API_URL = "https://1-2-aplicaciones-web-ia-sooty.vercel.app/api/chat";

const imageInput = document.getElementById("imageInput");
const promptInput = document.getElementById("promptInput");
const canvas = document.getElementById("resultCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("statusText");
const downloadBtn = document.getElementById("downloadBtn");

let currentImage = null;
// Oculta el botón antes de procesar
downloadBtn.style.display = "none";

// ... dentro de analyzeImage(), después de ejecutar drawDetections(data.detections):
drawDetections(data.detections);
statusText.innerText = `Éxito: Se detectaron ${data.detections.length} elemento(s).`;

// Muestra el botón de descarga
downloadBtn.style.display = "inline-block";

imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    statusText.innerText = "Procesando imagen local...";

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
            currentImage = img;
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            await analyzeImage();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

async function analyzeImage() {
    const targetText = promptInput.value.trim() || "personas";
    statusText.innerText = `Analizando imagen en busca de '${targetText}'...`;

    const compressedBase64 = compressImage(currentImage);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: targetText,
                image: compressedBase64
            })
        });

        const data = await response.json();

        if (!response.ok) {
            statusText.innerText = `Error: ${data.error || "No se pudo realizar el análisis."}`;
            return;
        }

        if (!data.detections || data.detections.length === 0) {
            statusText.innerText = `No se encontraron coincidencias para '${targetText}'.`;
            ctx.drawImage(currentImage, 0, 0);
            return;
        }

        drawDetections(data.detections);
        statusText.innerText = `Éxito: Se detectaron ${data.detections.length} elemento(s) ('${targetText}').`;

    } catch (err) {
        statusText.innerText = "Error de conexión con el servidor de IA.";
        console.error(err);
    }
}

function drawDetections(detections) {
    // Redibuja la imagen original de fondo
    ctx.drawImage(currentImage, 0, 0);

    detections.forEach((det, index) => {
        let [ymin, xmin, ymax, xmax] = det.box_2d;

        // Si la API devolvió valores entre 0 y 1, los ajusta a la escala 0-1000
        if (ymax <= 1.0 && xmax <= 1.0) {
            ymin *= 1000;
            xmin *= 1000;
            ymax *= 1000;
            xmax *= 1000;
        }

        // Convierte las coordenadas relativas [0-1000] a píxeles reales del Canvas
        const x = (xmin / 1000) * canvas.width;
        const y = (ymin / 1000) * canvas.height;
        const width = ((xmax - xmin) / 1000) * canvas.width;
        const height = ((ymax - ymin) / 1000) * canvas.height;

        // 1. Dibujar Bounding Box
        ctx.strokeStyle = "#00FF66";
        ctx.lineWidth = Math.max(3, canvas.width / 250);
        ctx.strokeRect(x, y, width, height);

        // 2. Dibujar Etiqueta con Número
        const label = `#${index + 1} ${det.label || ""}`;
        const fontSize = Math.max(14, canvas.width / 35);
        ctx.font = `bold ${fontSize}px sans-serif`;

        const textWidth = ctx.measureText(label).width;
        const labelY = y - fontSize - 4 > 0 ? y - fontSize - 4 : y;

        ctx.fillStyle = "#00FF66";
        ctx.fillRect(x, labelY, textWidth + 8, fontSize + 6);

        ctx.fillStyle = "#000000";
        ctx.fillText(label, x + 4, labelY + fontSize);
    });
}

downloadBtn.addEventListener("click", () => {
  if (!canvas) return;

  // Convertir el contenido visual del canvas a un enlace descargable
  const link = document.createElement("a");
  const targetText = promptInput.value.trim() || "resultado";
  
  link.download = `deteccion_${targetText.replace(/\s+/g, "_")}.jpg`;
  link.href = canvas.toDataURL("image/jpeg", 0.95);
  link.click();
});

function compressImage(img) {
    const tempCanvas = document.createElement("canvas");
    const MAX_WIDTH = 1024;
    let width = img.width;
    let height = img.height;

    if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
    }

    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(img, 0, 0, width, height);

    return tempCanvas.toDataURL("image/jpeg", 0.8);
}