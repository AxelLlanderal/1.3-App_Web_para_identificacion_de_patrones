// URL de la API servida por Vercel
const API_URL = "https://1-2-aplicaciones-web-ia-sooty.vercel.app/api/chat";

const imageInput = document.getElementById("imageInput");
const promptInput = document.getElementById("promptInput");
const canvas = document.getElementById("resultCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("statusText");

let currentImage = null;

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
  // Limpia y redibuja la foto base
  ctx.drawImage(currentImage, 0, 0);

  detections.forEach((det, index) => {
    // Normalizar coordenadas [0-1000] a píxeles exactos
    const ymin = (det.box_2d[0] / 1000) * canvas.height;
    const xmin = (det.box_2d[1] / 1000) * canvas.width;
    const ymax = (det.box_2d[2] / 1000) * canvas.height;
    const xmax = (det.box_2d[3] / 1000) * canvas.width;

    const width = xmax - xmin;
    const height = ymax - ymin;

    // Dibujar Recuadro Verde Neón
    ctx.strokeStyle = "#00FF66";
    ctx.lineWidth = Math.max(3, canvas.width / 250);
    ctx.strokeRect(xmin, ymin, width, height);

    // Dibujar Etiqueta con Número
    const label = `#${index + 1} ${det.label || ""}`;
    const fontSize = Math.max(14, canvas.width / 35);
    ctx.font = `bold ${fontSize}px sans-serif`;

    const textWidth = ctx.measureText(label).width;
    const labelY = ymin - fontSize - 4 > 0 ? ymin - fontSize - 4 : ymin;

    ctx.fillStyle = "#00FF66";
    ctx.fillRect(xmin, labelY, textWidth + 8, fontSize + 6);

    ctx.fillStyle = "#000000";
    ctx.fillText(label, xmin + 4, labelY + fontSize);
  });
}

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