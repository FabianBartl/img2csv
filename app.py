from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pytesseract
from PIL import Image
import io
import base64

# Flask looks for HTML in 'templates' and CSS/JS in 'static' by default
app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ocr', methods=['POST'])
def run_ocr():
    data = request.json
    image_data = data['image'].split(',')[1] # Remove base64 header
    cells = data['cells']
    
    # Load image from base64
    image_bytes = base64.b64decode(image_data)
    img = Image.open(io.BytesIO(image_bytes))
    
    results = []
    
    for cell in cells:
        # cell: {id, x, y, width, height}
        left = int(cell['x'])
        top = int(cell['y'])
        right = int(cell['x'] + cell['width'])
        bottom = int(cell['y'] + cell['height'])
        
        cropped_img = img.crop((left, top, right, bottom))
        
        # Run OCR (--psm 6 assumes a single uniform block of text)
        text = pytesseract.image_to_string(cropped_img, config='--psm 6').strip()
        results.append({
            'id': cell['id'],
            'text': text
        })
        
    return jsonify({'results': results})

if __name__ == '__main__':
    app.run(debug=True, port=5000)