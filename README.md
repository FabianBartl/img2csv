# Table OCR

Turn a scanned/photographed table into machine-readable data — with a GUI where
*you* define the grid (no auto-detection guessing), then OCR fills it in and
you correct it in place before exporting to CSV.

## How it works

1. **Upload** an image of a table (drag & drop or click to choose).
2. **Draw the table area**: click-drag over the table like a crop tool. A
   default 3x3 grid drops onto the area you selected.
3. **Adjust the grid**: use the Rows/Cols +/− steppers to match your table,
   drag any line to fine-tune its position (double-click a line to delete it),
   drag an edge to resize the whole area, or drag inside the area to move it.
4. **Run OCR**: each cell is cropped out of the original image and OCR'd
   individually with Tesseract (much more accurate than OCR-ing the whole
   table as one block).
5. **Edit**: the recognized text appears in editable boxes, still positioned
   exactly over each cell, with the grid lines still visible — the overlay is
   semi-transparent by default so you can compare the text against the
   original scan underneath. Click into any box and fix what OCR got wrong.
   Use the "Overlay opacity" slider to see more or less of the image through
   the text.
6. **Export CSV**.

Moving/resizing the grid after OCR keeps your edits as long as the number of
rows/columns doesn't change — repositioning just follows along. Adding or
removing a row/column line clears the affected results since the cell layout
changed; re-run OCR to refill.

## Setup

You need Python 3.9+ and the Tesseract OCR engine installed on your system.

**Install Tesseract:**
- macOS: `brew install tesseract`
- Ubuntu/Debian: `sudo apt-get install tesseract-ocr`
- Windows: install from https://github.com/UB-Mannheim/tesseract/wiki and
  make sure `tesseract.exe` is on your `PATH` (or set
  `pytesseract.pytesseract.tesseract_cmd` at the top of `app.py`).

**Install Python dependencies:**
```bash
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

Everything runs locally — the image is saved to the `uploads/` folder next to
`app.py` and never leaves your machine.

## Notes / tips

- For best OCR accuracy, add row/column lines so each cell contains just one
  value — don't try to make Tesseract read a whole row at once.
- If a column consistently misreads (e.g. digits vs letters confused), you can
  tighten that column's crop slightly by dragging its edges, or just correct
  it by hand in the overlay field — it's saved as typed.
- Multi-language documents: change the `lang` used by Tesseract by editing the
  `pytesseract.image_to_string(crop, config=config)` call in `app.py`, e.g.
  add `lang="deu"` for German (requires the matching Tesseract language pack
  to be installed).
- The grid you draw is remembered only for the current image/session (kept in
  the browser tab). If you have many similar-layout scans, add a "save/load
  grid" feature by serializing `colLines`/`rowLines` to JSON — happy to add
  that if useful.
