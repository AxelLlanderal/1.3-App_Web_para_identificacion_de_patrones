const API_URL = "https://1-2-aplicaciones-web-ia-sooty.vercel.app/api/chat";

const form = document.getElementById("chatForm");
const fileInput = document.getElementById("imageInput");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");

// Convierte la imagen a Base64
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

function addMessage(contentData, type) {
    const container = document.createElement("div");
    container.classList.add("message", type);

    const label = document.createElement("div");
    label.classList.add("message-label");
    label.textContent = type === "user" ? "Tú (Imagen)" : "IA";

    const content = document.createElement("div");
    content.classList.add("message-content");

    if (type === "user" && contentData.imageSrc) {
        const img = document.createElement("img");
        img.src = contentData.imageSrc;
        img.style.maxWidth = "250px";
        img.style.borderRadius = "8px";
        content.appendChild(img);
    } else if (type === "assistant" && typeof marked !== "undefined") {
        content.innerHTML = marked.parse(contentData.text || contentData);
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
    if (!file) return;

    try {
        const base64Image = await convertFileToBase64(file);

        // Renderiza la vista previa del usuario
        addMessage({ imageSrc: base64Image }, "user");

        fileInput.disabled = true;
        sendButton.disabled = true;

        const loading = addMessage("Analizando elementos y contando...", "loading");

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Image })
        });

        const data = await response.json();
        loading.remove();

        if (!response.ok) throw new Error(data.error || "Error del servidor");

        addMessage(data.reply, "assistant");

    } catch (error) {
        addMessage("Error: " + error.message, "assistant");
    } finally {
        fileInput.value = "";
        fileInput.disabled = false;
        sendButton.disabled = false;
    }
});