const imageInput = document.getElementById('imageInput');
const promptInput = document.getElementById('prompt');
const canvas = document.getElementById('resultCanvas');
const ctx = canvas.getContext('2d');
const statusText = document.getElementById('statusText');

let currentImage = null;

imageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  statusText.innerText = "Cargando imagen...";

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = async () => {
      currentImage = img;
      // Dibujar imagen limpia inicial
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Procesar la detección
      await analyzeImage(file);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

async function analyzeImage(file) {
  const prompt = promptInput.value.trim() || "personas";
  statusText.innerText = `Buscando y contando '${prompt}'...`;

  // Comprimir imagen antes de enviar
  const base64Image = await compressImage(currentImage);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        image: base64Image
      })
    });

    const data = await response.json();

    if (!response.ok) {
      statusText.innerText = `Error: ${data.error || 'Fallo en la detección'}`;
      return;
    }

    // Dibujar recuadros en la imagen
    drawDetections(data.detections);
    statusText.innerText = `Se encontraron ${data.detections.length} ${prompt}.`;

  } catch (err) {
    statusText.innerText = "Error al conectar con el servidor.";
    console.error(err);
  }
}

function drawDetections(detections) {
  // Redibujar imagen original
  ctx.drawImage(currentImage, 0, 0);

  detections.forEach((det, index) => {
    // Normalizar coordenadas de [0,1000] a pixeles reales del canvas
    const ymin = (det.box_2d[0] / 1000) * canvas.height;
    const xmin = (det.box_2d[1] / 1000) * canvas.width;
    const ymax = (det.box_2d[2] / 1000) * canvas.height;
    const xmax = (det.box_2d[3] / 1000) * canvas.width;

    const width = xmax - xmin;
    const height = ymax - ymin;

    // 1. Dibujar Bounding Box
    ctx.strokeStyle = '#00FF66'; // Verde Neón
    ctx.lineWidth = Math.max(3, canvas.width / 300);
    ctx.strokeRect(xmin, ymin, width, height);

    // 2. Dibujar Etiqueta con Número
    const label = `#${index + 1} ${det.label}`;
    ctx.fillStyle = '#00FF66';
    const fontSize = Math.max(14, canvas.width / 40);
    ctx.font = `bold ${fontSize}px sans-serif`;

    const textWidth = ctx.measureText(label).width;
    ctx.fillRect(xmin, ymin - fontSize - 6 > 0 ? ymin - fontSize - 6 : ymin, textWidth + 8, fontSize + 6);

    ctx.fillStyle = '#000000';
    ctx.fillText(label, xmin + 4, ymin - 6 > 0 ? ymin - 6 : ymin + fontSize);
  });
}

function compressImage(img) {
  return new Promise((resolve) => {
    const tempCanvas = document.createElement('canvas');
    const MAX_WIDTH = 1000;
    let width = img.width;
    let height = img.height;

    if (width > MAX_WIDTH) {
      height = Math.round((height * MAX_WIDTH) / width);
      width = MAX_WIDTH;
    }

    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, width, height);
    resolve(tempCanvas.toDataURL('image/jpeg', 0.8));
  });
}