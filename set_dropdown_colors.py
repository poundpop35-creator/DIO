"""
เพิ่ม conditional formatting (สีพื้นหลัง) ให้ dropdown E, F, I
ใน worksheet อนุมัตินอกแผน — ไม่แตะ column D
"""

import requests
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request as GoogleRequest

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SHEET_ID = "1MztCiuS6bT_sIfkLi-mBFvh8sm_H-8Exy3FhuNF1MEM"
WS_ID = 0        # sheetId ของ อนุมัตินอกแผน
DATA_START = 2   # startRowIndex (0-based) = แถวที่ 3
DATA_END = 600   # endRowIndex (exclusive) ครอบคลุมแถวในอนาคต

# ─── ชุดสี (RGB 0-1) ──────────────────────────────────────────────────────────

# E — หมวดงบ  (น้ำเงิน / เขียว / ส้ม / ม่วง / เหลือง)
COL_E = {
    "col": 4,
    "colors": {
        "งบบุคลากร":       (0.643, 0.761, 0.957),   # ฟ้า
        "งบดำเนินงาน":     (0.714, 0.843, 0.659),   # เขียว
        "งบลงทุน":         (0.976, 0.796, 0.612),   # ส้ม
        "งบเงินอุดหนุน":   (0.706, 0.655, 0.839),   # ม่วง
        "งบรายจ่ายอื่น":   (1.000, 0.898, 0.600),   # เหลือง
    },
}

# F — ประเภท  (หลากสีพาสเทล)
COL_F = {
    "col": 5,
    "colors": {
        "พื้้นฐาน":              (0.714, 0.843, 0.659),   # เขียว
        "ครุภัณฑ์":              (0.624, 0.773, 0.910),   # ฟ้าอ่อน
        "ที่ดินและสิ่งก่อสร้าง": (0.635, 0.769, 0.788),   # ฟ้าเทา
        "ค่าใช้จ่ายบุคลากร":    (0.918, 0.600, 0.600),   # ชมพูเข้ม
        "โครงการ":               (0.627, 0.839, 0.878),   # ฟ้าเขียว
        "จ้างเหมาบุคลากร":      (1.000, 0.898, 0.600),   # เหลือง
        "สาธารณูปโภค":          (0.851, 0.851, 0.851),   # เทา
        "งานบริการ":             (0.851, 0.824, 0.914),   # ลาเวนเดอร์
    },
}

# I — แหล่งเงิน  (4 สีชัดเจน)
COL_I = {
    "col": 8,
    "colors": {
        "เงินงบประมาณ":     (0.533, 0.749, 0.933),   # ฟ้าเข้ม
        "เงินบำรุงกรม":     (0.576, 0.769, 0.490),   # เขียวเข้ม
        "เงินบำรุงศวก.":    (1.000, 0.851, 0.400),   # เหลืองทอง
        "เงินแหล่งอื่น ๆ": (0.976, 0.663, 0.420),   # ส้มเข้ม
    },
}


def rgb(r, g, b):
    return {"red": r, "green": g, "blue": b}


def make_rule(sheet_id, col_idx, text_value, color_tuple, index):
    r, g, b = color_tuple
    return {
        "addConditionalFormatRule": {
            "index": index,
            "rule": {
                "ranges": [{
                    "sheetId": sheet_id,
                    "startRowIndex": DATA_START,
                    "endRowIndex": DATA_END,
                    "startColumnIndex": col_idx,
                    "endColumnIndex": col_idx + 1,
                }],
                "booleanRule": {
                    "condition": {
                        "type": "TEXT_EQ",
                        "values": [{"userEnteredValue": text_value}],
                    },
                    "format": {"backgroundColor": rgb(r, g, b)},
                },
            },
        }
    }


def apply_colors():
    creds = Credentials.from_service_account_file("credentials.json", scopes=SCOPES)
    creds.refresh(GoogleRequest())
    headers = {"Authorization": f"Bearer {creds.token}", "Content-Type": "application/json"}

    requests_list = []
    idx = 0
    for col_cfg in [COL_E, COL_F, COL_I]:
        for value, color in col_cfg["colors"].items():
            requests_list.append(make_rule(WS_ID, col_cfg["col"], value, color, idx))
            idx += 1

    body = {"requests": requests_list}
    resp = requests.post(
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}:batchUpdate",
        headers=headers,
        json=body,
    )

    if resp.status_code == 200:
        print(f"สำเร็จ! เพิ่ม {len(requests_list)} conditional format rules")
        print("\nสรุปสีที่ตั้ง:")
        for col_cfg, name in [(COL_E,"E-หมวดงบ"),(COL_F,"F-ประเภท"),(COL_I,"I-แหล่งเงิน")]:
            print(f"\n  {name}:")
            for val in col_cfg["colors"]:
                print(f"    • {val}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")


if __name__ == "__main__":
    apply_colors()
