# Production Machine Screen OCR & SAP Integration

An end-to-end industrial solution for capturing photos of machine HMI screens (e.g. LMW Spinning Touch Screens, Siemens Simatic Panels, Electro-Jet Rovematic ADR), extracting key operational metrics via Computer Vision/OCR, validating data with operator feedback, and confirming production tickets into SAP ERP (ECC & S/4HANA).

---

## Quickstart: Run the MVP Web Application

The repository includes a ready-to-run interactive web application with sample photos and live SAP BAPI payload simulation.

### 1. Start the Local Server
```bash
python3 app.py
```

### 2. Access the Application
Open your browser at:
**`http://127.0.0.1:5050`**

### 3. Features Included
- **Eye-Friendly Industrial Theme**: Ergonomic Slate Dark Mode & Industrial Daylight Light Mode with 1-click toggle.
- **Enterprise Static Authentication**: Shift Operator & Mill Admin login with 1-click quick-access demo chips.
- **Plant & Department Hierarchy**: Plant 1000 (Welspun Anjar) & New Spinning (8 sequential machines).
- **8 Value Chain Stages**: Carding, Breaker DF, Lap Former, Comber, Finisher DF, Speed Frame, Ring Frame, Link Conner.
- **AI Auto-Calibrated OCR**: Angle, distance, and lighting invariant live computer vision extraction.
- **SAP ERP Integration**: Automatic `BAPI_PRODORDCONF_CREATE_TT` and S/4HANA OData payload confirmation.
- **Sample Screen Selector**: 1-click test with real machine photos (LMW Blue Screen, Electro-Jet Rovematic table, Siemens Simatic Panel).
- **Photo Upload**: Upload any new machine photo taken from the factory floor.
- **Visual Bounding Box Overlay**: Interactive Canvas/SVG showing exactly where each metric was located.
- **Operator Verification Form**: Confidence scores (Green/Amber), data type validation, and inline editing.
- **SAP BAPI & OData Generator**: Live payload preview for `BAPI_PRODORDCONF_CREATE_TT` (CO11N) and SAP S/4HANA OData.
- **Simulated SAP ERP Submission**: Real-time confirmation numbers, yield records, and persistent SQLite audit trail.
- **Zebra TC52 Simulator Mode**: Switch view to test the handheld experience with simulated hardware scan triggers.

---

## Zebra Rugged Android Blueprint (`android_zebra_blueprint/`)

Contains native Android Kotlin code and architecture for deployment onto Zebra rugged handhelds (TC21, TC26, TC52, TC57, TC53, TC58):

1. **`ZebraDataWedgeManager.kt`**: Controls Zebra hardware imager via DataWedge Intent API and handles machine barcode scanning.
2. **`MachineScreenAnalyzer.kt`**: CameraX + Google ML Kit offline vision analyzer for instant (~120ms) on-device text parsing.
3. **`OfflineSyncManager.kt`**: Android Jetpack Room DB + WorkManager background sync queue for offline factory zones.
4. **`SAPIntegrationGuide.md`**: Complete enterprise mapping for SAP PP / PM confirmations (`CO11N`, `COR6N`, OData).
