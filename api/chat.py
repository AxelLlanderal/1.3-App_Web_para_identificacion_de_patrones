import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI

app = Flask(__name__)
CORS(app)

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_message = data.get("message", "people")
        image_data = data.get("image")

        if not image_data:
            return jsonify({"error": "No image provided"}), 400

        # Prompt optimizado para detección estricta de objetos/personas
        system_prompt = (
            f"You are a precise object detection system. Locate ALL instances of the user's request: '{user_message}'.\n"
            "Respond ONLY with a valid JSON object matching this structure:\n"
            "{\n"
            '  "detections": [\n'
            '    {\n'
            '      "box_2d": [ymin, xmin, ymax, xmax],\n'
            '      "label": "short label"\n'
            "    }\n"
            "  ]\n"
            "}\n"
            "Rules:\n"
            "- Coordinates must be normalized integers from 0 to 1000.\n"
            "- 'ymin', 'xmin', 'ymax', 'xmax' must fit tightly around the entire detected target.\n"
            "- Detect EVERY single matching target in the image, do not skip any.\n"
            "- Do NOT wrap output in markdown ```json ``` blocks. Return pure raw JSON."
        )

        response = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Detect all: {user_message}"},
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
            temperature=0.1,
            max_tokens=1500
        )

        raw_content = response.choices[0].message.content.strip()
        parsed_data = json.loads(raw_content)

        return jsonify(parsed_data)

    except Exception as e:
        print("API Error:", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=3000)