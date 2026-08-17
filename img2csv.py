import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import io
import json
import os
import re
import uuid
import cv2
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
import numpy as np
from PIL import Image, ImageEnhance
import pytesseract

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

TRAINING_DIR = os.path.join(os.getcwd(), 'training_data')
os.makedirs(TRAINING_DIR, exist_ok=True)

# Dynamically allocate (Total Cores - 1) workers for parallel cell processing
MAX_WORKERS = max(1, (os.cpu_count() or 4) - 1)


def preprocess_cell_image(cropped_pil_img):
  """Cleans table cell images for Tesseract without erasing character ink."""
  img_np = np.array(cropped_pil_img.convert('L'))
  h, w = img_np.shape

  if h < 6 or w < 6:
    return cropped_pil_img

  _, thresh = cv2.threshold(
      img_np, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
  )

  horiz_size = int(w * 0.65)
  if horiz_size >= 5:
    horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (horiz_size, 1))
    horiz_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horiz_kernel)
    img_np[horiz_lines > 0] = 255

  pad = 2
  if h > 8 and w > 8:
    img_np[:pad, :] = 255
    img_np[-pad:, :] = 255
    img_np[:, :pad] = 255
    img_np[:, -pad:] = 255

  cleaned_pil = Image.fromarray(img_np)
  cleaned_pil = cleaned_pil.resize((w * 2, h * 2), Image.Resampling.LANCZOS)

  enhancer = ImageEnhance.Contrast(cleaned_pil)
  cleaned_pil = enhancer.enhance(1.8)

  return cleaned_pil


def process_single_cell(cell, img, custom_config):
  """Worker function to process OCR for a single table cell."""
  left = max(0, int(cell['x']))
  top = max(0, int(cell['y']))
  right = min(img.width, int(cell['x'] + cell['width']))
  bottom = min(img.height, int(cell['y'] + cell['height']))

  if right > left + 4 and bottom > top + 4:
    cropped_img = img.crop((left, top, right, bottom))
    processed_img = preprocess_cell_image(cropped_img)

    data_dict = pytesseract.image_to_data(
        processed_img, config=custom_config, output_type=pytesseract.Output.DICT
    )

    n_boxes = len(data_dict['text'])
    recognized_texts = []
    confidences = []

    for i in range(n_boxes):
      word = data_dict['text'][i].strip()
      conf = int(data_dict['conf'][i])
      if word:
        recognized_texts.append(word)
        if conf != -1:
          confidences.append(conf)

    text = ' '.join(recognized_texts)
    avg_conf = int(sum(confidences) / len(confidences)) if confidences else 100

    text = re.sub(r'^[_\-\s]+|[_\-\s]+$', '', text)
    text = re.sub(r'_{2,}', '', text)
  else:
    text = ''
    avg_conf = 100

  return {'id': cell['id'], 'text': text, 'confidence': avg_conf}


@app.route('/')
def index():
  return render_template('index.html')


@app.route('/ocr', methods=['POST'])
def run_ocr():
  data = request.json
  image_data = data['image'].split(',')[1]
  cells = data['cells']

  image_bytes = base64.b64decode(image_data)
  img = Image.open(io.BytesIO(image_bytes))
  img.load()  # Fully load pixel data into memory for thread safety

  custom_config = r'--oem 3 --psm 6 -c preserve_interword_spaces=1'

  # Run OCR in parallel across N-1 CPU cores while maintaining order
  with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    results = list(
        executor.map(
            lambda cell: process_single_cell(cell, img, custom_config), cells
        )
    )

  return jsonify({'results': results})


@app.route('/save_training_data', methods=['POST'])
def save_training_data():
  try:
    data = request.json
    image_data = data['image'].split(',')[1]
    image_bytes = base64.b64decode(image_data)

    unique_id = (
        f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    )
    image_filename = f'table_{unique_id}.png'
    json_filename = f'table_{unique_id}.json'

    image_path = os.path.join(TRAINING_DIR, image_filename)
    with open(image_path, 'wb') as f:
      f.write(image_bytes)

    training_record = {
        'image_filename': image_filename,
        'image_width': data['image_width'],
        'image_height': data['image_height'],
        'exported_at': data['timestamp'],
        'total_cells': len(data['cells']),
        'cells': data['cells'],
    }

    json_path = os.path.join(TRAINING_DIR, json_filename)
    with open(json_path, 'w', encoding='utf-8') as f:
      json.dump(training_record, f, indent=2)

    return jsonify({'status': 'success', 'id': unique_id})
  except Exception as e:
    return jsonify({'status': 'error', 'message': str(e)}), 500


if __name__ == '__main__':
  app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # Max 16MB per request
  app.run(debug=False, port=5000, host='0.0.0.0')
