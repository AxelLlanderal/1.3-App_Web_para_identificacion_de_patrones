import json
import os
from http.server import BaseHTTPRequestHandler
from openai import OpenAI

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "").strip().rstrip("/")

class handler(BaseHTTPRequestHandler):

    def add_cors_headers(self):
        origin = self.headers.get("Origin", "")
        if not ALLOWED_ORIGIN or origin.strip().rstrip("/") == ALLOWED_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", origin if origin else "*")
            self.send_header("Vary", "Origin")

    def send_json(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.add_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.add_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))

            # CAMBIO AQUÍ: Se aumenta el límite de 5,000 bytes a 4 MB (4 * 1024 * 1024)
            if content_length <= 0 or content_length > 4 * 1024 * 1024:
                self.send_json(413, {"error": "Petición no válida o la imagen supera los 4MB."})
                return

            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            image_data = data.get("image")
            prompt_text = str(data.get("message", "")).strip() or "Identifica y cuenta los elementos presentes en la imagen."

            if not image_data:
                self.send_json(400, {"error": "Se requiere adjuntar una imagen."})
                return

            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                self.send_json(500, {"error": "OPENAI_API_KEY no está configurada."})
                return

            client = OpenAI(api_key=api_key)

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt_text},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_data,
                                    "detail": "low"  # 'low' para responder más rápido y gastar menos tokens
                                }
                            }
                        ]
                    }
                ],
                max_tokens=600
            )

            self.send_json(200, {"reply": response.choices[0].message.content})

        except Exception as error:
            print(f"Error en /api/chat: {error}")
            self.send_json(500, {"error": f"Error del servidor: {type(error).__name__}"})