import json
import os
from http.server import BaseHTTPRequestHandler
from openai import OpenAI

# Lee el origen permitido configurado en Vercel
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

            # Permite imágenes en Base64 de hasta 4MB
            if content_length <= 0 or content_length > 4 * 1024 * 1024:
                self.send_json(413, {"error": "Petición demasiado grande (máx 4MB)."})
                return

            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            image_data = data.get("image")
            target = str(data.get("message", "personas")).strip()

            if not image_data:
                self.send_json(400, {"error": "Se requiere una imagen en la petición."})
                return

            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                self.send_json(500, {"error": "OPENAI_API_KEY no está configurada."})
                return

            client = OpenAI(api_key=api_key)

            prompt_system = f"""
            Locate all exact instances of '{target}' in the image.
            Return a strict JSON object with key 'detections' containing a list of detected objects.

            For each object, provide:
            - "box_2d": [ymin, xmin, ymax, xmax] as numbers on a normalized 0 to 1000 scale, where (0,0) is top-left and (1000,1000) is bottom-right. Be extremely precise and fit the bounding box tightly around the target.
            - "label": short string label of what was detected.

            Return raw JSON only, no markdown formatting.
            """

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt_system},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_data,
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1000
            )

            result_json = json.loads(response.choices[0].message.content)
            self.send_json(200, {"detections": result_json.get("detections", [])})

        except Exception as error:
            print(f"Error en /api/chat: {error}")
            self.send_json(500, {"error": f"Error interno: {type(error).__name__}"})

            