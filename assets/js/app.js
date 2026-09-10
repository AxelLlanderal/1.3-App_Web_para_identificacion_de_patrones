const API_URL = "https://1-2-aplicaciones-web-ia-sooty.vercel.app/api/chat";

const imageInput = document.getElementById("imageInput");
const promptInput = document.getElementById("promptInput");
const canvas = document.getElementById("resultCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("statusText");
const downloadBtn = document.getElementById("downloadBtn");

let currentImage = null;

imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  statusText.innerText = "Procesando imagen local...";
  if (downloadBtn) downloadBtn.style.display = "none";

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

    const data = await response.json(); // <-- AQUÍ SE DEFINE 'data'

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
    statusText.innerText = `Éxito: Se detectaron ${data.detections.length} elemento(s).`;
    
    if (downloadBtn) downloadBtn.style.display = "inline-flex";

  } catch (err) {
    statusText.innerText = "Error de conexión con el servidor de IA.";
    console.error(err);
  }
}

function drawDetections(detections) {
  ctx.drawImage(currentImage, 0, 0);

  detections.forEach((det, index) => {
    let [ymin, xmin, ymax, xmax] = det.box_2d;

    // Normalizar si la escala viene entre 0 y 1
    if (ymax <= 1.0 && xmax <= 1.0) {
      ymin *= 1000;
      xmin *= 1000;
      ymax *= 1000;
      xmax *= 1000;
    }

    // Convertir de escala 1000 a dimensiones del canvas
    const x = (xmin / 1000) * canvas.width;
    const y = (ymin / 1000) * canvas.height;
    const width = ((xmax - xmin) / 1000) * canvas.width;
    const height = ((ymax - ymin) / 1000) * canvas.height;

    // Dibujar caja
    ctx.strokeStyle = "#00FF66";
    ctx.lineWidth = Math.max(3, canvas.width / 250);
    ctx.strokeRect(x, y, width, height);

    // Dibujar etiqueta
    const label = `#${index + 1} ${det.label || "objeto"}`;
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
function compressImage(img) {
  const tempCanvas = document.createElement("canvas");
  // Aumentar la resolución máxima para conservar detalles
  const MAX_WIDTH = 2048; 
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

  // Subir la calidad del JPG al 95%
  return tempCanvas.toDataURL("image/jpeg", 0.95); 
}

if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    if (!canvas) return;
    const link = document.createElement("a");
    const targetText = promptInput.value.trim() || "resultado";
    link.download = `deteccion_${targetText.replace(/\s+/g, "_")}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  });
}