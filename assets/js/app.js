const API_URL = "https://1-2-aplicaciones-web-ia-sooty.vercel.app/api/chat";

const form = document.getElementById("chatForm");
const textInput = document.getElementById("messageInput");
const fileInput = document.getElementById("imageInput");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");

// Función para comprimir y redimensionar la imagen antes de enviarla
function processAndResizeImage(file, maxWidth = 1024, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                // Convierte a JPEG liviano (soluciona problemas de formato AVIF/PNG pesados)
                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

function addMessage(contentData, type) {
    const container = document.createElement("div");
    container.classList.add("message", type);

    const label = document.createElement("div");
    label.classList.add("message-label");
    label.textContent = type === "user" ? "Tú" : "IA";

    const content = document.createElement("div");
    content.classList.add("message-content");

    if (type === "user") {
        if (contentData.text) {
            const txt = document.createElement("p");
            txt.textContent = contentData.text;
            content.appendChild(txt);
        }
        if (contentData.imageSrc) {
            const img = document.createElement("img");
            img.src = contentData.imageSrc;
            img.style.maxWidth = "220px";
            img.style.borderRadius = "8px";
            img.style.marginTop = "6px";
            content.appendChild(img);
        }
    } else if (type === "assistant" && typeof marked !== "undefined") {
        content.innerHTML = marked.parse(typeof contentData === 'string' ? contentData : contentData.text);
    } else {
        content.textContent = typeof contentData === 'string' ? contentData : contentData.text;
    }

    container.appendChild(label);
    container.appendChild(content);
    messages.appendChild(container);
    messages.scrollTop = messages.scrollHeight;

    return container;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = fileInput.files[0];
    const userInstruction = textInput.value.trim();

    if (!file) return;

    try {
        fileInput.disabled = true;
        textInput.disabled = true;
        sendButton.disabled = true;

        const loading = addMessage("Procesando y optimizando imagen...", "loading");

        // Redimensiona y convierte a JPEG optimizado en el navegador
        const optimizedBase64Image = await processAndResizeImage(file);

        loading.remove();
        addMessage({ text: userInstruction, imageSrc: optimizedBase64Image }, "user");

        const aiLoading = addMessage("Analizando elementos...", "loading");

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                image: optimizedBase64Image,
                message: userInstruction
            })
        });

        const data = await response.json();
        aiLoading.remove();

        if (!response.ok) throw new Error(data.error || "Error al procesar la imagen");

        addMessage(data.reply, "assistant");

    } catch (error) {
        addMessage("Error: " + error.message, "assistant");
    } finally {
        fileInput.value = "";
        textInput.value = "";
        fileInput.disabled = false;
        textInput.disabled = false;
        sendButton.disabled = false;
    }
});