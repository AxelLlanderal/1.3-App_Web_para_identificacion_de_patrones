import os
import json
from flask import Flask, request, jsonify
from openai import OpenAI

app = Flask(__name__)
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        target = data.get("message", "personas")
        image_base64 = data.get("image", "")

        if not image_base64:
            return jsonify({"error": "No se proporcionó imagen"}), 400

        # Asegura prefijo data:image
        if not image_base64.startswith("data:image"):
            image_base64 = f"data:image/jpeg;base64,{image_base64}"

        prompt_system = (
            "You are an expert computer vision system for object detection and precise bounding box locator.\n"
            f"Detect EVERY individual instance matching '{target}' in the image without omitting any.\n"
            "Rules:\n"
            "1. Output exact coordinates [ymin, xmin, ymax, xmax] normalized on a 0 to 1000 scale.\n"
            "2. Ensure each bounding box tightly fits the detected subject/object.\n"
            "3. Do NOT duplicate coordinates or place all boxes in the same spot.\n"
            "4. Return a valid JSON with key 'detections' containing objects with 'box_2d' and 'label'."
        )

        response = client.chat.completions.create(
            model="gpt-4o",  # Cambiado al modelo superior de visión
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": prompt_system
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Detect all instances of '{target}'."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_base64,
                                "detail": "high"  # Obliga a analizar en alta definición
                            }
                        }
                    ]
                }
            ]
        )

        result_content = response.choices[0].message.content
        result_json = json.loads(result_content)

        return jsonify(result_json)

    except Exception as e:
        return jsonify({"error": str(e)}), 500