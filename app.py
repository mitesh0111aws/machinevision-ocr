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
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scanned_records (
            id TEXT PRIMARY KEY,
            created_at TEXT,
            scan_date TEXT,
            plant_id TEXT,
            plant_name TEXT,
            department_id TEXT,
            department_name TEXT,
            machine_template TEXT,
            machine_name TEXT,
            image_filename TEXT,
            image_url TEXT,
            operator_id TEXT,
            operator_name TEXT,
            operator_role TEXT,
            overall_confidence REAL,
            extracted_data TEXT,
            summary_yield TEXT,
            summary_runtime TEXT,
            summary_idletime TEXT,
            summary_efficiency TEXT,
            summary_doffs TEXT,
            summary_hanks TEXT,
            sap_status TEXT DEFAULT 'Scanned'
        )
    """)
    cursor.execute("PRAGMA table_info(sap_confirmations)")
    existing_cols = [c[1] for c in cursor.fetchall()]
    if "department" not in existing_cols:
        try:
            cursor.execute("ALTER TABLE sap_confirmations ADD COLUMN department TEXT DEFAULT 'New Spinning'")
        except Exception:
            pass
    conn.commit()
    conn.close()

init_db()
engine = MachineOCREngine()

def record_scan_event(result, filename, image_url, operator_id="operator", operator_name="Shift Operator", operator_role="Operator", plant_id="1000", plant_name="Bed Sheet Plant Anjar", dept_id="new_spinning", dept_name="New Spinning"):
    try:
        conn = sqlite3.connect(app.config["DB_FILE"])
        cursor = conn.cursor()
        record_id = f"scn_{uuid.uuid4().hex[:12]}"
        now = datetime.datetime.now()
        created_at = now.isoformat()
        scan_date = now.strftime("%Y-%m-%d")

        fields = result.get("fields", [])
        field_map = {f.get("key"): f.get("value") for f in fields}

        summary_yield = str(field_map.get("production_kgs", field_map.get("total_production_kg", "")))
        summary_runtime = str(field_map.get("run_time", field_map.get("running_hours", "")))
        summary_idletime = str(field_map.get("idle_time", field_map.get("stoppage_hours", "")))
        summary_efficiency = str(field_map.get("machine_efficiency", field_map.get("efficiency", "")))
        summary_doffs = str(field_map.get("doffs", field_map.get("doff_count", "")))
        summary_hanks = str(field_map.get("hanks", ""))

        cursor.execute("""
            INSERT INTO scanned_records 
            (id, created_at, scan_date, plant_id, plant_name, department_id, department_name, machine_template, machine_name, image_filename, image_url, operator_id, operator_name, operator_role, overall_confidence, extracted_data, summary_yield, summary_runtime, summary_idletime, summary_efficiency, summary_doffs, summary_hanks, sap_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record_id,
            created_at,
            scan_date,
            str(plant_id),
            str(plant_name),
            str(dept_id),
            str(dept_name),
            str(result.get("template_id", "")),
            str(result.get("template_name", "")),
            str(filename),
            str(image_url),
            str(operator_id).lower(),
            str(operator_name),
            str(operator_role),
            float(result.get("overall_confidence", 0.95)),
            json.dumps(result),
            summary_yield,
            summary_runtime,
            summary_idletime,
            summary_efficiency,
            summary_doffs,
            summary_hanks,
            "Scanned"
        ))
        conn.commit()
        conn.close()
        return record_id
    except Exception as err:
        print("Record scan event error:", err)
        return None

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", "")).strip()

    # Static credentials catalog
    valid_users = {
        "admin": {"password": "admin123", "name": "Mitesh Bambhaniya (Mill Admin)", "role": "Administrator"},
        "operator": {"password": "operator123", "name": "Shift Operator - Line 1", "role": "Operator"},
        "supervisor": {"password": "supervisor123", "name": "Spinning Supervisor", "role": "Supervisor"},
        "welspun": {"password": "welspun2026", "name": "Plant In-Charge", "role": "Manager"}
    }

    if username in valid_users and valid_users[username]["password"] == password:
        user_info = valid_users[username]
        return jsonify({
            "status": "success",
            "token": f"tk_{uuid.uuid4().hex[:16]}",
            "username": username,
            "name": user_info["name"],
            "role": user_info["role"]
        })
    elif username and password:
        return jsonify({
            "status": "error",
            "message": "Invalid credentials. Use demo credentials: operator / operator123 or admin / admin123"
        }), 401
    else:
        return jsonify({
            "status": "error",
            "message": "Please enter both username and password."
        }), 400

@app.route("/api/plants", methods=["GET"])
def get_plants():
    return jsonify({
        "status": "success",
        "plants": [
            {
                "id": "1000",
                "code": "PLANT-1000",
                "name": "Bed Sheet Plant Anjar",
                "location": "Anjar, Gujarat",
                "status": "Active",
                "badge": "Bed Sheet Unit",
                "departments": ["new_spinning", "warping", "weaving"]
            },
            {
                "id": "2000",
                "code": "PLANT-2000",
                "name": "Terry Towel Plant Anjar",
                "location": "Anjar, Gujarat",
                "status": "Connected",
                "badge": "Terry Towel Unit",
                "departments": ["new_spinning", "warping", "weaving"]
            },
            {
                "id": "3000",
                "code": "PLANT-3000",
                "name": "Terry Towel Plant Vapi",
                "location": "Vapi, Gujarat",
                "status": "Standby",
                "badge": "Vapi Complex",
                "departments": ["new_spinning"]
            }
        ]
    })

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

        # Automatic Database Recording for Scan History & Audit
        operator_id = data.get("operator_id", "operator")
        operator_name = data.get("operator_name", "Shift Operator")
        operator_role = data.get("operator_role", "Operator")
        plant_id = data.get("plant_id", "1000")
        plant_name = data.get("plant_name", "Bed Sheet Plant Anjar")
        dept_id = data.get("department_id", "new_spinning")
        dept_name = data.get("department_name", "New Spinning")

        record_id = record_scan_event(
            result,
            filename=filename,
            image_url=result["image_url"],
            operator_id=operator_id,
            operator_name=operator_name,
            operator_role=operator_role,
            plant_id=plant_id,
            plant_name=plant_name,
            dept_id=dept_id,
            dept_name=dept_name
        )
        result["scan_record_id"] = record_id
            
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

        # Update latest matching scan record to 'Confirmed in SAP'
        cursor.execute("""
            UPDATE scanned_records
            SET sap_status = 'Confirmed in SAP'
            WHERE id = (
                SELECT id FROM scanned_records
                WHERE machine_template = ?
                ORDER BY created_at DESC LIMIT 1
            )
        """, (extracted_data.get("template_id", ""),))

        conn.commit()
        conn.close()
    except Exception as db_err:
        print("Audit DB notice:", db_err)
        
    return jsonify({
        "status": "success",
        "sap_response": sap_response
    })

@app.route("/api/scans", methods=["GET"])
def get_scans():
    req_operator_id = request.args.get("operator_id", "").strip().lower()
    req_role = request.args.get("role", "Operator").strip()

    filter_dept = request.args.get("department", "all").strip().lower()
    filter_machine = request.args.get("machine", "all").strip().lower()
    filter_date = request.args.get("date", "all").strip()
    filter_search = request.args.get("search", "").strip().lower()
    filter_operator = request.args.get("filter_operator", "all").strip().lower()

    try:
        conn = sqlite3.connect(app.config["DB_FILE"])
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        query = "SELECT * FROM scanned_records WHERE 1=1"
        params = []

        # RBAC: Operators can ONLY view their own records
        if req_role.lower() == "operator":
            query += " AND LOWER(operator_id) = ?"
            params.append(req_operator_id or "operator")
        elif filter_operator and filter_operator != "all":
            # Admin can filter by any specific operator
            query += " AND LOWER(operator_id) = ?"
            params.append(filter_operator)

        # Department filter
        if filter_dept and filter_dept != "all":
            query += " AND (LOWER(department_id) = ? OR LOWER(department_name) LIKE ?)"
            params.extend([filter_dept, f"%{filter_dept}%"])

        # Machine filter
        if filter_machine and filter_machine != "all":
            query += " AND (LOWER(machine_template) = ? OR LOWER(machine_name) LIKE ?)"
            params.extend([filter_machine, f"%{filter_machine}%"])

        # Date filter
        if filter_date and filter_date != "all":
            if filter_date == "today":
                today_str = datetime.date.today().strftime("%Y-%m-%d")
                query += " AND scan_date = ?"
                params.append(today_str)
            else:
                query += " AND scan_date LIKE ?"
                params.append(f"{filter_date}%")

        # Free search
        if filter_search:
            query += " AND (LOWER(machine_name) LIKE ? OR LOWER(summary_yield) LIKE ? OR LOWER(image_filename) LIKE ?)"
            params.extend([f"%{filter_search}%", f"%{filter_search}%", f"%{filter_search}%"])

        query += " ORDER BY created_at DESC LIMIT 100"
        cursor.execute(query, params)
        rows = [dict(row) for row in cursor.fetchall()]

        for r in rows:
            if r.get("extracted_data"):
                try:
                    r["extracted_data"] = json.loads(r["extracted_data"])
                except Exception:
                    pass

        conn.close()
        return jsonify({
            "status": "success",
            "total": len(rows),
            "records": rows,
            "role_applied": req_role
        })
    except Exception as err:
        return jsonify({"status": "error", "message": str(err), "records": []}), 500

@app.route("/api/scans/<record_id>", methods=["GET"])
def get_scan_detail(record_id):
    try:
        conn = sqlite3.connect(app.config["DB_FILE"])
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM scanned_records WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            rec = dict(row)
            if rec.get("extracted_data"):
                try:
                    rec["extracted_data"] = json.loads(rec["extracted_data"])
                except Exception:
                    pass
            return jsonify({"status": "success", "record": rec})
        return jsonify({"status": "error", "message": "Record not found"}), 404
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500

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

def seed_initial_scans():
    try:
        conn = sqlite3.connect(app.config["DB_FILE"])
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM scanned_records")
        count = cursor.fetchone()[0]
        if count == 0:
            samples = [
                {
                    "template": "carding", "name": "1. Carding Machine", "file": "carding.jpg",
                    "operator": "operator", "op_name": "Shift Operator - Line 1", "role": "Operator",
                    "yield": "172.18 Kg", "runtime": "17:21", "idle": "01:55", "eff": "88.52%", "doffs": "4", "hanks": "53.14",
                    "status": "Confirmed in SAP", "date_offset": 0
                },
                {
                    "template": "breaker_draw_frame", "name": "2. Breaker Draw Frame (Br. DF)", "file": "breaker_br._draw_frame.jpg",
                    "operator": "operator", "op_name": "Shift Operator - Line 1", "role": "Operator",
                    "yield": "498.5 Kg", "runtime": "02:27", "idle": "00:40", "eff": "78.19%", "doffs": "10", "hanks": "153.90",
                    "status": "Confirmed in SAP", "date_offset": 0
                },
                {
                    "template": "comber", "name": "4. Comber", "file": "comber.jpg",
                    "operator": "operator", "op_name": "Shift Operator - Line 1", "role": "Operator",
                    "yield": "86.455 Kg", "runtime": "02:09", "idle": "00:53", "eff": "97.24%", "doffs": "4", "hanks": "26.677",
                    "status": "Scanned", "date_offset": 1
                },
                {
                    "template": "lap_former", "name": "3. Lap Former", "file": "lap_former.jpg",
                    "operator": "admin", "op_name": "Mitesh Bambhaniya (Mill Admin)", "role": "Administrator",
                    "yield": "612.8 Kg", "runtime": "03:40", "idle": "04:52", "eff": "42.94%", "doffs": "36", "hanks": "--",
                    "status": "Confirmed in SAP", "date_offset": 1
                },
                {
                    "template": "finisher_draw_frame", "name": "5. Finisher Draw Frame (Fr. DF)", "file": "finisher_fr._draw_frame.jpg",
                    "operator": "admin", "op_name": "Mitesh Bambhaniya (Mill Admin)", "role": "Administrator",
                    "yield": "432.4 Kg", "runtime": "06:12", "idle": "01:48", "eff": "77.50%", "doffs": "23", "hanks": "119.17",
                    "status": "Scanned", "date_offset": 2
                },
                {
                    "template": "ring_frame", "name": "7. Ring Frame (Spinning)", "file": "ring_frame.jpg",
                    "operator": "supervisor", "op_name": "Spinning Supervisor", "role": "Supervisor",
                    "yield": "285.40 Kg", "runtime": "07:30", "idle": "00:30", "eff": "93.75%", "doffs": "6", "hanks": "88.20",
                    "status": "Confirmed in SAP", "date_offset": 3
                }
            ]
            now = datetime.datetime.now()
            for s in samples:
                rec_date = (now - datetime.timedelta(days=s["date_offset"])).strftime("%Y-%m-%d")
                rec_time = (now - datetime.timedelta(days=s["date_offset"], hours=2)).isoformat()
                rec_id = f"scn_{uuid.uuid4().hex[:12]}"
                mock_data = {
                    "template_id": s["template"],
                    "template_name": s["name"],
                    "fields": [
                        {"key": "production_kgs", "label": "Production Output", "value": s["yield"]},
                        {"key": "run_time", "label": "Run Time", "value": s["runtime"]},
                        {"key": "idle_time", "label": "Idle Time", "value": s["idle"]},
                        {"key": "machine_efficiency", "label": "Machine Efficiency", "value": s["eff"]},
                        {"key": "doffs", "label": "Doffs", "value": s["doffs"]},
                        {"key": "hanks", "label": "Hanks", "value": s["hanks"]}
                    ]
                }
                cursor.execute("""
                    INSERT INTO scanned_records
                    (id, created_at, scan_date, plant_id, plant_name, department_id, department_name, machine_template, machine_name, image_filename, image_url, operator_id, operator_name, operator_role, overall_confidence, extracted_data, summary_yield, summary_runtime, summary_idletime, summary_efficiency, summary_doffs, summary_hanks, sap_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    rec_id, rec_time, rec_date, "1000", "Bed Sheet Plant Anjar", "new_spinning", "New Spinning",
                    s["template"], s["name"], s["file"], f"/samples/{s['file']}",
                    s["operator"], s["op_name"], s["role"], 0.98, json.dumps(mock_data),
                    s["yield"], s["runtime"], s["idle"], s["eff"], s["doffs"], s["hanks"], s["status"]
                ))
            conn.commit()
        conn.close()
    except Exception as err:
        print("Seed scans notice:", err)

seed_initial_scans()

if __name__ == "__main__":
    print("Starting Industrial Machine Screen OCR & SAP Server on http://127.0.0.1:5050")
    app.run(host="0.0.0.0", port=5050, debug=True)
