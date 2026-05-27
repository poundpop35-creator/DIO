"""
เพิ่ม conditional formatting (สีพื้นหลัง) ให้ dropdown E, F, I
ใน worksheet อนุมัตินอกแผน — ไม่แตะ column D
สีทั้ง 17 ค่าไม่ซ้ำกันเลย
"""

import requests
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request as GoogleRequest

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SHEET_ID = "1MztCiuS6bT_sIfkLi-mBFvh8sm_H-8Exy3FhuNF1MEM"
WS_ID = 0
DATA_START = 2   # 0-based → แถวที่ 3
DATA_END = 600

# ─── ชุดสี 17 สี ไม่ซ้ำกันเลย (RGB 0-1) ──────────────────────────────────────
#
# E — หมวดงบ (5)  : โทนเย็น
# F — ประเภท (8)  : โทนอุ่น + กลาง
# I — แหล่งเงิน (4): โทนเข้ม/สด
#
COL_E = {
    "col": 4,
    "colors": {
        "งบบุคลากร":     (1.000, 0.710, 0.757),  # 1  ชมพูอ่อน
        "งบดำเนินงาน":   (0.678, 0.847, 1.000),  # 2  ฟ้าอ่อน
        "งบลงทุน":       (1.000, 0.937, 0.604),  # 3  เหลืองอ่อน
        "งบเงินอุดหนุน": (0.800, 0.702, 0.937),  # 4  ม่วงอ่อน
        "งบรายจ่ายอื่น": (0.686, 0.933, 0.686),  # 5  เขียวอ่อน
    },
}

COL_F = {
    "col": 5,
    "colors": {
        "พื้้นฐาน":              (1.000, 0.800, 0.600),  # 6  ส้มอ่อน
        "ครุภัณฑ์":              (0.627, 0.871, 0.871),  # 7  ฟิ้ลเขียว/teal
        "ที่ดินและสิ่งก่อสร้าง": (0.929, 0.839, 0.686),  # 8  น้ำตาลอ่อน/ข้าวสาลี
        "ค่าใช้จ่ายบุคลากร":    (1.000, 0.639, 0.639),  # 9  แดงอ่อน/salmon
        "โครงการ":               (0.780, 0.937, 0.541),  # 10 เขียวมะนาว
        "จ้างเหมาบุคลากร":      (1.000, 0.843, 0.302),  # 11 เหลืองทอง/amber
        "สาธารณูปโภค":          (0.851, 0.851, 0.851),  # 12 เทาอ่อน
        "งานบริการ":             (0.918, 0.718, 0.878),  # 13 ชมพูม่วง/orchid
    },
}

COL_I = {
    "col": 8,
    "colors": {
        "เงินงบประมาณ":     (0.404, 0.635, 0.922),  # 14 น้ำเงิน/cornflower
        "เงินบำรุงกรม":     (0.408, 0.749, 0.408),  # 15 เขียวเข้ม/medium green
        "เงินบำรุงศวก.":    (0.976, 0.498, 0.749),  # 16 ชมพูร้อน/hot pink
        "เงินแหล่งอื่น ๆ": (0.961, 0.549, 0.200),  # 17 ส้มเข้ม/tangerine
    },
}


def rgb(r, g, b):
    return {"red": r, "green": g, "blue": b}


def delete_all_rules(headers, count):
    """ลบ rules ทั้งหมดจากหลังไปหน้า เพื่อไม่ให้ index เลื่อน"""
    reqs = [
        {"deleteConditionalFormatRule": {"sheetId": WS_ID, "index": i}}
        for i in range(count - 1, -1, -1)
    ]
    r = requests.post(
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}:batchUpdate",
        headers=headers,
        json={"requests": reqs},
    )
    return r.status_code == 200


def make_rule(col_idx, text_value, color_tuple, index):
    r, g, b = color_tuple
    return {
        "addConditionalFormatRule": {
            "index": index,
            "rule": {
                "ranges": [{
                    "sheetId": WS_ID,
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

    # 1. นับ rules ที่มีอยู่
    r = requests.get(
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}",
        headers=headers,
        params={"fields": "sheets(properties(sheetId,title),conditionalFormats)"},
    )
    existing = 0
    for s in r.json().get("sheets", []):
        if s["properties"]["sheetId"] == WS_ID:
            existing = len(s.get("conditionalFormats", []))
    print(f"ลบ {existing} rules เก่าออก...")
    if existing:
        ok = delete_all_rules(headers, existing)
        print("ลบสำเร็จ" if ok else "ลบไม่สำเร็จ!")

    # 2. เพิ่ม rules ใหม่
    reqs = []
    idx = 0
    for col_cfg in [COL_E, COL_F, COL_I]:
        for value, color in col_cfg["colors"].items():
            reqs.append(make_rule(col_cfg["col"], value, color, idx))
            idx += 1

    resp = requests.post(
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}:batchUpdate",
        headers=headers,
        json={"requests": reqs},
    )

    if resp.status_code == 200:
        print(f"\nเพิ่ม {len(reqs)} rules ใหม่สำเร็จ!\n")
        labels = {1:"ชมพูอ่อน",2:"ฟ้าอ่อน",3:"เหลืองอ่อน",4:"ม่วงอ่อน",5:"เขียวอ่อน",
                  6:"ส้มอ่อน",7:"teal",8:"น้ำตาลอ่อน",9:"salmon",10:"เขียวมะนาว",
                  11:"เหลืองทอง",12:"เทา",13:"ชมพูม่วง",
                  14:"น้ำเงิน",15:"เขียวเข้ม",16:"ชมพูร้อน",17:"ส้มเข้ม"}
        n = 1
        for col_cfg, name in [(COL_E,"E-หมวดงบ"),(COL_F,"F-ประเภท"),(COL_I,"I-แหล่งเงิน")]:
            print(f"  {name}:")
            for val in col_cfg["colors"]:
                print(f"    #{n:02d}  {labels[n]:<12}  {val}")
                n += 1
    else:
        print(f"Error {resp.status_code}: {resp.text}")


if __name__ == "__main__":
    apply_colors()
