import os
import re
import json
import sqlite3
import datetime
import uuid
from flask import Flask, request, jsonify, render_template, send_from_directory

from ocr_engine import MachineOCREngine

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IS_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

if IS_SERVERLESS:
    UPLOAD_FOLDER = "/tmp/uploads"
    DB_FILE = "/tmp/audit_trail.db"
else:
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    DB_FILE = os.path.join(BASE_DIR, "audit_trail.db")

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "static"), template_folder=os.path.join(BASE_DIR, "templates"))
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["SAMPLES_FOLDER"] = os.path.join(BASE_DIR, "samples")
app.config["DB_FILE"] = DB_FILE

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
os.makedirs(app.config["SAMPLES_FOLDER"], exist_ok=True)

def init_db():
    conn = sqlite3.connect(app.config["DB_FILE"])
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sap_confirmations (
            id TEXT PRIMARY KEY,
            created_at TEXT,
            department TEXT,
            machine_template TEXT,
            work_center TEXT,
            plant TEXT,
            order_id TEXT,
            operation TEXT,
            yield_qty REAL,
            yield_unit TEXT,
            run_time_hours REAL,
            idle_time_hours REAL,
            sap_conf_no TEXT,
            status TEXT,
            sap_response TEXT,
            operator_id TEXT,
            device_id TEXT
        )
    """)
    cursor.execute("PRAGMA table_info(sap_confirmations)")
    existing_cols = [c[1] for c in cursor.fetchall()]
    if "department" not in existing_cols:
        try:
            cursor.execute("ALTER TABLE sap_confirmations ADD COLUMN department TEXT DEFAULT 'New Spinning'")
        except Exception as e:
            pass
    conn.commit()
    conn.close()

init_db()
engine = MachineOCREngine()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/departments", methods=["GET"])
def get_departments():
    return jsonify({
        "status": "success",
        "departments": engine.get_departments()
    })

@app.route("/api/templates", methods=["GET"])
def get_templates():
    return jsonify({
        "status": "success",
        "departments": engine.get_departments(),
        "templates": engine.templates
    })

@app.route("/api/samples", methods=["GET"])
def get_samples():
    catalog = [
        {
            "filename": "carding.jpg",
            "title": "1. Carding Machine",
            "subtitle": "Shift 1 • 172.18 Kg • 53.14 Hanks • 88.52% Eff",
            "template_id": "carding",
            "department_id": "new_spinning",
            "department_name": "New Spinning",
            "category": "Stage 1: Carding"
        },
        {
            "filename": "breaker_br._draw_frame.jpg",
            "title": "2. Breaker Draw Frame (Br. DF)",
            "subtitle": "Shift 1 • 489.5 Kg • 151.1 Hanks • 10 Doffs",
            "template_id": "breaker_draw_frame",
            "department_id": "new_spinning",
            "department_name": "New Spinning",
            "category": "Stage 2: Breaker DF"
        },
        {
            "filename": "lap_former.jpg",
            "title": "3. Lap Former",
            "subtitle": "Shift 1 • 612.8 Kg • 36 Doffs • 42.94% Eff",
            "template_id": "lap_former",
            "department_id": "new_spinning",
            "department_name": "New Spinning",
            "category": "Stage 3: Lap Former"
        },
        {
            "filename": "comber.jpg",
            "title": "4. Comber",
            "subtitle": "Shift 1 • 197.05 Kg • 60.8 Hanks • 95.38% Eff",
            "template_id": "comber",
            "department_id": "new_spinning",
            "department_name": "New Spinning",
            "category": "Stage 4: Combing"
        },
        {
            "filename": "finisher_fr._draw_frame.jpg",
            "title": "5. Finisher Draw Frame (Fr. DF)",
            "subtitle": "Shift 1 • 432.4 Kg • 119.17 Hanks • 23 Doffs",
            "template_id": "finisher_draw_frame",
            "department_id": "new_spinning",
            "department_name": "New Spinning",
            "category": "Stage 5: Finisher DF"
        },
        {
            "filename": "speed_frame.jpg",
            "title": "6. Speed Frame (Roving Frame)",
            "subtitle": "Roving Frame Multi-Day Matrix (8 Shifts)",
            "template_id": "speed_frame",
            "department_id": "new_spinning",
            "department_name": "New Spinning",
            "category": "Stage 6: Roving Frame"
        },
        {
            "filename": "ring_frame.jpg",
            "title": "7. Ring Frame (Spinning)",
            "subtitle": "Shift 1 • 6.0 Hanks • 5.14 hrs • 34.0g/spindle",
            "template_id": "ring_frame",
            "department_id": "new_spinning",
            "department_name": "New Spinning",
            "category": "Stage 7: Ring Spinning"
        },
        {
            "filename": "link_conner.jpg",
            "title": "8. Link Conner (Autoconer 6)",
            "subtitle": "81.50 Kg • 44 Doffs • 68.7% Eff • Saurer",
            "template_id": "link_conner",
            "department_id": "new_spinning",
            "department_name": "New Spinning",
            "category": "Stage 8: Autoconer"
        }
    ]
    
    sample_files = []
    for item in catalog:
        p = os.path.join(app.config["SAMPLES_FOLDER"], item["filename"])
        if os.path.exists(p):
            sample_files.append({
                "url": f"/samples/{item['filename']}",
                **item
            })
    return jsonify({
        "status": "success",
        "current_department": "new_spinning",
        "samples": sample_files
    })

@app.route("/samples/<path:filename>")
def serve_sample(filename):
    return send_from_directory(app.config["SAMPLES_FOLDER"], filename)

@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

@app.route("/api/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "Empty filename"}), 400
    
    # Clean and sanitize filename (removes colons, spaces, unicode)
    clean_raw = re.sub(r'[^a-zA-Z0-9._-]', '_', file.filename)
    raw_ext = os.path.splitext(clean_raw)[1].lower() or ".jpg"
    unique_base = f"scan_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    unique_filename = f"{unique_base}{raw_ext}"
    dest_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)
    
    try:
        file.save(dest_path)
        # If uploaded file is iOS HEIC/HEIF or has EXIF orientation, standardize to high-quality JPEG
        try:
            from PIL import Image, ImageOps
            import pillow_heif
            pillow_heif.register_heif_opener()

            if raw_ext in [".heic", ".heif"]:
                jpg_filename = f"{unique_base}.jpg"
                jpg_dest_path = os.path.join(app.config["UPLOAD_FOLDER"], jpg_filename)
                with Image.open(dest_path) as im:
                    im = ImageOps.exif_transpose(im)
                    im.convert("RGB").save(jpg_dest_path, "JPEG", quality=95)
                unique_filename = jpg_filename
            else:
                # Transpose EXIF orientation if needed
                with Image.open(dest_path) as im:
                    transposed = ImageOps.exif_transpose(im)
                    if transposed is not im:
                        transposed.save(dest_path, quality=95)
        except Exception as conv_err:
            print("Image normalization notice:", conv_err)
    except Exception as save_err:
        print("File save warning:", save_err)

    template_hint = request.form.get("template_id")
    
    return jsonify({
        "status": "success",
        "filename": unique_filename,
        "url": f"/uploads/{unique_filename}",
        "template_hint": template_hint
    })

@app.route("/api/extract", methods=["POST"])
def extract_data():
    data = request.get_json(silent=True) or {}
    raw_filename = data.get("filename", "carding.jpg")
    filename = os.path.basename(raw_filename)
    template_id = data.get("template_id")
    calibration = data.get("calibration")
    client_image_url = data.get("image_url") # Preserves client-side Data URL
    
    try:
        base_dirs = [app.config["UPLOAD_FOLDER"], app.config["SAMPLES_FOLDER"]]
        result = engine.extract_screen_data(
            filename,
            template_id=template_id,
            base_dirs=base_dirs,
            calibration=calibration
        )
        
        # Determine image URL: If frontend provided a valid Data URL, use it directly (eliminates 404s)
        if client_image_url and client_image_url.startswith("data:image/"):
            result["image_url"] = client_image_url
        elif os.path.exists(os.path.join(app.config["UPLOAD_FOLDER"], filename)):
            result["image_url"] = f"/uploads/{filename}"
        elif os.path.exists(os.path.join(app.config["SAMPLES_FOLDER"], filename)):
            result["image_url"] = f"/samples/{filename}"
        else:
            result["image_url"] = f"/samples/{filename}"
            
        return jsonify({"status": "success", "data": result})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/sap/preview", methods=["POST"])
def preview_sap():
    data = request.json or {}
    extracted_data = data.get("extracted_data", {})
    custom_params = data.get("custom_params", {})
    
    bapi_payload = engine.build_sap_bapi_payload(extracted_data, custom_params)
    odata_payload = engine.build_sap_odata_payload(extracted_data, custom_params)
    
    return jsonify({
        "status": "success",
        "bapi_payload": bapi_payload,
        "odata_payload": odata_payload
    })

@app.route("/api/sap/submit", methods=["POST"])
def submit_to_sap():
    data = request.json or {}
    extracted_data = data.get("extracted_data", {})
    custom_params = data.get("custom_params", {})
    
    bapi_payload = engine.build_sap_bapi_payload(extracted_data, custom_params)
    ticket = bapi_payload["TIMETICKETS"][0]
    
    conf_no = f"100{int(datetime.datetime.now().timestamp()) % 1000000:06d}"
    doc_no = f"500{int(datetime.datetime.now().timestamp()) % 1000000:06d}"
    
    dept = extracted_data.get("department_name", "New Spinning")
    
    sap_response = {
        "RETURN": [
            {
                "TYPE": "S",
                "ID": "RU",
                "NUMBER": "010",
                "MESSAGE": f"Confirmation {conf_no} successfully saved for [{dept}] Order {ticket['ORDERID']} Operation {ticket['OPERATION']}",
                "LOG_NO": "",
                "LOG_MSG_NO": "000000",
                "MESSAGE_V1": conf_no,
                "MESSAGE_V2": ticket["ORDERID"]
            }
        ],
        "CONFIRMATION_NUMBER": conf_no,
        "MATERIAL_DOCUMENT": doc_no,
        "DEPARTMENT": dept,
        "ORDER_ID": ticket["ORDERID"],
        "OPERATION": ticket["OPERATION"],
        "WORK_CENTER": ticket["WORK_CNTR"],
        "POSTED_YIELD": f"{ticket['YIELD']} {ticket['CONF_QUAN_UNIT']}",
        "ACTUAL_MACHINE_HOURS": f"{ticket['ACT_WORK_2']} {ticket['UN_WORK_2']}",
        "TIMESTAMP": datetime.datetime.now().isoformat(),
        "STATUS": "SUCCESS"
    }
    
    try:
        conn = sqlite3.connect(app.config["DB_FILE"])
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sap_confirmations 
            (id, created_at, department, machine_template, work_center, plant, order_id, operation, yield_qty, yield_unit, run_time_hours, idle_time_hours, sap_conf_no, status, sap_response, operator_id, device_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(uuid.uuid4()),
            datetime.datetime.now().isoformat(),
            dept,
            extracted_data.get("template_name", "Unknown Template"),
            ticket["WORK_CNTR"],
            ticket["PLANT"],
            ticket["ORDERID"],
            ticket["OPERATION"],
            float(ticket["YIELD"]),
            ticket["CONF_QUAN_UNIT"],
            float(ticket["ACT_WORK_2"]),
            float(ticket["ACT_WORK_3"]),
            conf_no,
            "CONFIRMED_IN_SAP",
            json.dumps(sap_response),
            ticket.get("PERS_NO", "OPR-8420"),
            "ZEBRA-TC52-094"
        ))
        conn.commit()
        conn.close()
    except Exception as db_err:
        print("Audit DB notice:", db_err)
        
    return jsonify({
        "status": "success",
        "sap_response": sap_response
    })

@app.route("/api/audit-log", methods=["GET"])
def get_audit_log():
    try:
        conn = sqlite3.connect(app.config["DB_FILE"])
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sap_confirmations ORDER BY created_at DESC LIMIT 25")
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({"audit_logs": rows})
    except Exception:
        return jsonify({"audit_logs": []})

@app.route("/api/download-apk")
@app.route("/download-apk")
def download_apk():
    return send_from_directory(
        app.static_folder,
        "MachineVision_Zebra_Scanner_Android_Project.zip",
        as_attachment=True,
        download_name="MachineVision_Zebra_Scanner_Android_Project.zip"
    )

if __name__ == "__main__":
    print("Starting Industrial Machine Screen OCR & SAP Server on http://127.0.0.1:5050")
    app.run(host="0.0.0.0", port=5050, debug=True)
