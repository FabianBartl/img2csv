import base64
import io
import re
import cv2
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
import numpy as np
from PIL import Image, ImageEnhance
import pytesseract

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)


def preprocess_cell_image(cropped_pil_img):
  """Cleans table cell images for Tesseract without erasing character ink."""
  # Convert PIL Image to OpenCV Grayscale
  img_np = np.array(cropped_pil_img.convert('L'))
  h, w = img_np.shape

  if h < 6 or w < 6:
    return cropped_pil_img

  # 1. Binarize temporarily only to locate full-width separator lines
  _, thresh = cv2.threshold(
      img_np, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
  )

  # Detect horizontal lines spanning at least 65% of the cell width
  horiz_size = int(w * 0.65)
  if horiz_size >= 5:
    horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (horiz_size, 1))
    horiz_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horiz_kernel)
    # Erase only long horizontal sum/divider lines in the grayscale image
    img_np[horiz_lines > 0] = 255

  # 2. White-out 2px edge borders where box grid lines bleed into crops
  pad = 2
  if h > 8 and w > 8:
    img_np[:pad, :] = 255
    img_np[-pad:, :] = 255
    img_np[:, :pad] = 255
    img_np[:, -pad:] = 255

  cleaned_pil = Image.fromarray(img_np)

  # 3. Upscale x2 with LANCZOS for smoother character curves
  cleaned_pil = cleaned_pil.resize((w * 2, h * 2), Image.Resampling.LANCZOS)

  # 4. Moderate contrast boost while maintaining soft grayscale text edges
  enhancer = ImageEnhance.Contrast(cleaned_pil)
  cleaned_pil = enhancer.enhance(1.8)

  return cleaned_pil


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

  results = []
  custom_config = r'--oem 3 --psm 6 -c preserve_interword_spaces=1'

  for cell in cells:
    left = max(0, int(cell['x']))
    top = max(0, int(cell['y']))
    right = min(img.width, int(cell['x'] + cell['width']))
    bottom = min(img.height, int(cell['y'] + cell['height']))

    if right > left + 4 and bottom > top + 4:
      cropped_img = img.crop((left, top, right, bottom))
      processed_img = preprocess_cell_image(cropped_img)

      # Extract detailed data including confidence scores
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

      # Strip leftover underscores/dashes caused by sum lines
      text = re.sub(r'^[_\-\s]+|[_\-\s]+$', '', text)
      text = re.sub(r'_{2,}', '', text)
    else:
      text = ''
      avg_conf = 100

    results.append({'id': cell['id'], 'text': text, 'confidence': avg_conf})

  return jsonify({'results': results})


if __name__ == '__main__':
  app.run(debug=True, port=5000)