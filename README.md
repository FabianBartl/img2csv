# img2csv

An interactive web application for grid table detection, manual cell adjustment, OCR extraction, CSV export, and automated fine-training dataset collection.

---

## System Requirements

* **Python:** 3.10+
* **OCR Engine:** Tesseract OCR (v4.0+)
* **Dependencies:** OpenCV, PyTesseract, Flask, Flask-CORS, Pillow, Gunicorn, NumPy

---

## Local Development Setup (Ubuntu)

### 1. System Dependencies

```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv tesseract-ocr tesseract-ocr-eng libgl1
```

### 2. Environment & Application Setup

```bash
git clone <your-repository-url> ~/img2csv
cd ~/img2csv

python3 -m venv v
source v/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Run Development Server

```bash
python3 img2csv.py
```
Access the local server at `http://localhost:5000`.

---

## Production Deployment (Alpine Linux)

Deploying on Alpine Linux requires using the system-compiled `py3-opencv` native binaries and linking them into an isolated Python virtual environment.

### 1. Install Alpine System Packages

```bash
apk add python3 py3-pip py3-opencv tesseract-ocr tesseract-ocr-data-eng gunicorn nginx wget
```

### 2. Set Up Virtual Environment & Symlink Global OpenCV

Create the virtual environment (`v`), keep global package isolation turned off, and symlink system OpenCV into `v`:

```bash
cd ~/img2csv
python3 -m venv v

# Ensure isolated packages mode
sed -i 's/include-system-site-packages = true/include-system-site-packages = false/' ~/img2csv/v/pyvenv.cfg

# Symlink global system-installed OpenCV into the virtual environment
ln -sf /usr/lib/python3.*/site-packages/cv2* ~/img2csv/v/lib/python3.*/site-packages/

# Install python dependencies inside the virtual environment
mkdir -p ~/tmp
TMPDIR=~/tmp ~/img2csv/v/bin/pip install --no-cache-dir flask flask-cors pytesseract pillow gunicorn numpy
```

### 3. Download High-Accuracy Tesseract Model (`tessdata_best`)

Alpine defaults to `tessdata_fast`, which produces poor OCR results on tiny table cell crops. Upgrade to `tessdata_best`:

```bash
wget [https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata](https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata) -O /usr/share/tessdata/eng.traineddata
export TESSDATA_PREFIX=/usr/share/tessdata
```

### 4. Deployment Control Script (`restart.sh`)

Create `restart.sh` in `~/img2csv`:

```sh
#!/bin/sh

# Export Tesseract language data path
export TESSDATA_PREFIX=/usr/share/tessdata

# Prepend virtual environment binaries to PATH
export PATH="$HOME/img2csv/v/bin:$PATH"

# Ensure log directory exists
mkdir -p /var/log/img2csv
touch /var/log/img2csv/access.log
touch /var/log/img2csv/error.log

# Stop existing processes
pkill gunicorn || true

# Start Gunicorn daemon
gunicorn --daemon \
    --workers 5 \
    --timeout 300 \
    --bind 0.0.0.0:5000 \
    --user nobody \
    --group nogroup \
    --chdir "$HOME/img2csv" \
    --access-logfile /var/log/img2csv/access.log \
    --error-logfile /var/log/img2csv/error.log \
    img2csv:app

tail -f /var/log/img2csv/error.log
```

Make the script executable:

```bash
chmod +x ~/img2csv/restart.sh
```

### 5. Enable Service Autostart (OpenRC)

Create `/etc/local.d/img2csv.start`:

```sh
#!/bin/sh
~/img2csv/restart.sh
```

Enable the OpenRC `local` service:

```bash
chmod +x /etc/local.d/img2csv.start
rc-update add local default
```

---

## Troubleshooting

### Low Recognition Accuracy
* **Cause:** Alpine's default `tesseract-ocr-data-eng` package uses pruned `tessdata_fast` models.
* **Fix:** Download `eng.traineddata` from `tessdata_best` into `/usr/share/tessdata/` and restart Gunicorn.

### ModuleNotFoundError: `No module named 'flask_cors'` or `numpy`
* **Cause:** Gunicorn executed using system Python (`/usr/lib/python3.12/...`) rather than the virtual environment interpreter (`v/bin/gunicorn`).
* **Fix:** Ensure `export PATH="$HOME/img2csv/v/bin:$PATH"` is present at the top of `restart.sh` and `gunicorn` is installed directly inside `v/bin/`.