from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import io
import base64

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

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
    
    # Tesseract configuration for table cell blocks
    custom_config = r'--oem 3 --psm 6 -c preserve_interword_spaces=1'
    
    for cell in cells:
        left = max(0, int(cell['x']))
        top = max(0, int(cell['y']))
        right = min(img.width, int(cell['x'] + cell['width']))
        bottom = min(img.height, int(cell['y'] + cell['height']))
        
        if right > left and bottom > top:
            cropped_img = img.crop((left, top, right, bottom))
            
            # --- IMAGE PREPROCESSING (Mimicking img2table) ---
            # 1. Grayscale
            cropped_img = cropped_img.convert('L')
            
            # 2. Resize/Upscale (Tesseract performs much better on large text)
            width, height = cropped_img.size
            cropped_img = cropped_img.resize((width * 3, height * 3), Image.Resampling.LANCZOS)
            
            # 3. Enhance Contrast (Acts as a soft binarization)
            enhancer = ImageEnhance.Contrast(cropped_img)
            cropped_img = enhancer.enhance(2.0)
            
            # 4. Sharpen edges
            cropped_img = cropped_img.filter(ImageFilter.SHARPEN)
            # -------------------------------------------------

            text = pytesseract.image_to_string(cropped_img, config=custom_config).strip()
        else:
            text = ""
            
        results.append({
            'id': cell['id'],
            'text': text
        })
        
    return jsonify({'results': results})

if __name__ == '__main__':
    app.run(debug=True, port=5000)