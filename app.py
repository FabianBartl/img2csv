from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pytesseract
from PIL import Image
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
    
    for cell in cells:
        left = max(0, int(cell['x']))
        top = max(0, int(cell['y']))
        right = min(img.width, int(cell['x'] + cell['width']))
        bottom = min(img.height, int(cell['y'] + cell['height']))
        
        # Avoid zero-size crop errors
        if right > left and bottom > top:
            cropped_img = img.crop((left, top, right, bottom))
            text = pytesseract.image_to_string(cropped_img, config='--psm 6').strip()
        else:
            text = ""
            
        results.append({
            'id': cell['id'],
            'text': text
        })
        
    return jsonify({'results': results})

if __name__ == '__main__':
    app.run(debug=True, port=5000)