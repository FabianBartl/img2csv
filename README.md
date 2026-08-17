# img2csv

An interactive web application for grid table detection, manual cell adjustment, OCR extraction, CSV export, and automated server-side fine-training dataset collection.

---

## System Requirements

* **Python:** 3.10 or higher
* **OCR Engine:** Tesseract OCR (v4.0+)
* **Dependencies:** OpenCV, PyTesseract, Flask, Flask-CORS, Pillow, Gunicorn

---

## Local Installation & Development (Ubuntu)

### 1. Install System Dependencies

```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv tesseract-ocr tesseract-ocr-eng libgl1
```

### 2. Set Up Application Directory & Virtual Environment

```bash
git clone <your-repository-url> ~/img2csv
cd ~/img2csv

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Run Development Server

```bash
python3 app.py
```

Access the application at `http://localhost:5000`.

---

## Production Deployment (Alpine Linux)

### 1. Install System Packages

Alpine uses `musl` libc. Install system dependencies and native OpenCV via `apk`:

```bash
apk add python3 py3-pip py3-opencv tesseract-ocr tesseract-ocr-data-eng gunicorn nginx wget
```

### 2. Set Up Virtual Environment with System Site Packages

Because `opencv-python` can be difficult to compile on Alpine, configure the virtual environment to inherit Alpine's system-installed `py3-opencv`:

```bash
cd ~/img2csv
python3 -m venv venv

# Grant virtual environment access to system OpenCV (py3-opencv)
sed -i 's/include-system-site-packages = false/include-system-site-packages = true/' venv/pyvenv.cfg

# Install remaining requirements using a custom temp dir (prevents tmpfs out-of-memory errors)
mkdir -p ~/tmp
TMPDIR=~/tmp venv/bin/pip install --no-cache-dir -r requirements.txt
```

### 3. Create Deployment Script (`restart.sh`)

Create `restart.sh` inside `~/img2csv`:

```sh
#!/bin/sh
pkill gunicorn || true

# Ensure log directory exists
mkdir -p /var/log/img2csv

# Start Gunicorn daemon using venv binary and unprivileged execution
~/img2csv/venv/bin/gunicorn --daemon \
    --workers 5 \
    --timeout 300 \
    --bind 0.0.0.0:5000 \
    --user nobody \
    --group nogroup \
    --chdir ~/img2csv \
    --access-logfile /var/log/img2csv/access.log \
    --error-logfile /var/log/img2csv/error.log \
    img2csv:app

tail -f /var/log/img2csv/error.log
```

Make the script executable:

```bash
chmod +x ~/img2csv/restart.sh
```

### 4. Enable Autostart on Reboot (OpenRC)

Create `/etc/local.d/img2csv.start`:

```sh
#!/bin/sh
~/img2csv/restart.sh
```

Make it executable and enable the `local` service:

```bash
chmod +x /etc/local.d/img2csv.start
rc-update add local default
```

### 5. Configure Nginx Reverse Proxy

Create `/etc/nginx/http.d/img2csv.conf`:

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name your-domain.com;

    # Important: Base64 image payloads require a higher body size limit
    client_max_body_size 50M;

    # SSL configuration
    ssl_certificate /etc/ssl/certs/your_cert.pem;
    ssl_certificate_key /etc/ssl/private/your_key.pem;

    # Performance buffers
    proxy_request_buffering off;
    proxy_buffering off;
    client_body_buffer_size 1024k;

    location / {
        proxy_pass [http://127.0.0.1:8080](http://127.0.0.1:8080);
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
```

Reload Nginx:

```bash
nginx -s reload
```

---

## Troubleshooting Accuracy & Tesseract Models

### Issue: Poor OCR Accuracy on Alpine Linux
If OCR performance and confidence levels on the server are noticeably worse than on a local workstation, the server is likely using `tessdata_fast`.

Alpine's default `tesseract-ocr-data-eng` package installs `tessdata_fast`, a heavily pruned model optimized for low memory usage that performs poorly on small table cell crops.

### Solution: Upgrade to `tessdata_best`

Replace the lightweight language model with the high-accuracy model:

```bash
# Download tessdata_best to system tesseract folder
wget [https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata](https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata) -O /usr/share/tessdata/eng.traineddata

# Ensure environment variable points to the directory
export TESSDATA_PREFIX=/usr/share/tessdata
```

Restart Gunicorn after replacing the file:

```bash
~/img2csv/restart.sh
```