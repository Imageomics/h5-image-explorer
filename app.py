import os
import base64
import time
from pathlib import Path
import polars as pl
import h5py
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# Global data
lookup_df = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/load_lookup_path', methods=['POST'])
def load_lookup_path():
    """Load lookup file from provided path"""
    global lookup_df

    data = request.json
    file_path = data.get('path')

    if not file_path:
        return jsonify({"error": "No file path provided"}), 400

    try:
        path = Path(file_path)
        if not path.exists():
            return jsonify({"error": f"File does not exist: {file_path}"}), 400

        # Load lookup file
        if path.suffix.lower() == '.csv':
            lookup_df = pl.read_csv(path)
        elif path.suffix.lower() == '.parquet':
            lookup_df = pl.read_parquet(path)
        else:
            return jsonify({"error": "File must be CSV or Parquet"}), 400

        # Validate columns
        required_cols = ['uuid', 'filepath']
        missing_cols = [col for col in required_cols if col not in lookup_df.columns]
        if missing_cols:
            return jsonify({"error": f"Missing columns: {missing_cols}"}), 400

        summary = {
            "total_records": lookup_df.height,
            "unique_filepaths": lookup_df["filepath"].n_unique(),
            "columns": lookup_df.columns
        }

        return jsonify({"success": True, "summary": summary})

    except Exception as e:
        return jsonify({"error": f"Error loading file: {str(e)}"}), 500

@app.route('/get_uuid_page/<int:page>')
def get_uuid_page(page):
    """Get paginated UUID list"""
    if lookup_df is None:
        return jsonify({"error": "No lookup file loaded"}), 400

    page_size = 100
    offset = page * page_size

    if offset >= lookup_df.height:
        return jsonify([])

    page_data = lookup_df.slice(offset, page_size).to_dicts()
    return jsonify(page_data)

@app.route('/get_image', methods=['POST'])
def get_image():
    """Load image from H5 file"""
    data = request.json
    uuid_val = data.get('uuid')
    filepath = data.get('filepath')

    if not uuid_val or not filepath:
        return jsonify({"error": "Missing uuid or filepath"}), 400

    start_time = time.perf_counter()

    try:
        h5_file = f"{filepath}_images.h5"

        if not Path(h5_file).exists():
            return jsonify({"error": f"H5 file not found: {h5_file}"}), 404

        with h5py.File(h5_file, 'r') as f:
            if 'images' not in f or uuid_val not in f['images']:
                return jsonify({"error": f"Image {uuid_val} not found"}), 404

            image_data = f['images'][uuid_val][:]
            encoded_img = base64.b64encode(image_data).decode('utf-8')

        fetch_time = (time.perf_counter() - start_time) * 1000

        return jsonify({
            "image_b64": encoded_img,
            "fetch_time_ms": fetch_time
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_metadata', methods=['POST'])
def get_metadata():
    """Load metadata for UUID"""
    data = request.json
    uuid_val = data.get('uuid')
    filepath = data.get('filepath')

    if not uuid_val or not filepath:
        return jsonify({"error": "Missing uuid or filepath"}), 400

    try:
        metadata_file = f"{filepath}_metadata.parquet"

        if not Path(metadata_file).exists():
            return jsonify({"error": f"Metadata file not found: {metadata_file}"}), 404

        metadata_df = pl.read_parquet(metadata_file)
        record = metadata_df.filter(pl.col("uuid") == uuid_val)

        if record.height == 0:
            return jsonify({"error": f"No metadata found for UUID {uuid_val}"}), 404

        return jsonify(record.to_dicts()[0])

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5839, debug=True)