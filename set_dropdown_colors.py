"""
เพิ่ม conditional formatting (สีพื้นหลัง) ให้ dropdown D, E, F, K
ใน worksheet อนุมัตินอกแผน
  D: ศูนย์วิทยาศาสตร์การแพทย์ = #bfe1f6 / อื่น ๆ = #ffcfc9
  E, F, K: สี 17 แบบ ไม่ซ้ำกัน
"""

import requests
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request as GoogleRequest

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SHEET_ID = "1MztCiuS6bT_sIfkLi-mBFvh8sm_H-8Exy3FhuNF1MEM"
WS_ID = 0
DATA_START = 2
DATA_END = 600

def _l(r, g, b, f=0.5):
    return (r+(1-r)*f, g+(1-g)*f, b+(1-b)*f)

COL_E = {
    "col": 4,   # E — หมวดงบ
    "colors": {
        "งบบุคลากร":      _l(1.000, 0.710, 0.757),  # ชมพูพาสเทล
        "งบดำเนินงาน":    _l(0.678, 0.847, 1.000),  # ฟ้าพาสเทล
        "งบลงทุน":        _l(1.000, 0.937, 0.604),  # เหลืองพาสเทล
        "งบเงินอุดหนุน":  _l(0.800, 0.702, 0.937),  # ม่วงพาสเทล
        "งบรายจ่ายอื่น":  _l(0.686, 0.933, 0.686),  # เขียวพาสเทล
    },
}

COL_F = {
    "col": 5,   # F — ประเภท
    "colors": {
        "พื้้นฐาน":               _l(1.000, 0.800, 0.600),  # ส้มพาสเทล
        "ครุภัณฑ์":               _l(0.627, 0.871, 0.871),  # teal พาสเทล
        "ที่ดินและสิ่งก่อสร้าง":  _l(0.929, 0.839, 0.686),  # น้ำตาลพาสเทล
        "ค่าใช้จ่ายบุคลากร":     _l(1.000, 0.639, 0.639),  # salmon พาสเทล
        "โครงการ":                _l(0.780, 0.937, 0.541),  # เขียวมะนาวพาสเทล
        "จ้างเหมาบุคลากร":       _l(1.000, 0.843, 0.302),  # เหลืองทองพาสเทล
        "สาธารณูปโภค":           _l(0.851, 0.851, 0.851),  # เทาพาสเทล
        "งานบริการ":              _l(0.918, 0.718, 0.878),  # ชมพูม่วงพาสเทล
    },
}

COL_K = {
    "col": 10,  # K — แหล่งเงิน
    "colors": {
        "เงินงบประมาณ":     _l(0.404, 0.635, 0.922),  # น้ำเงินพาสเทล
        "เงินบำรุงกรม":     _l(0.408, 0.749, 0.408),  # เขียวพาสเทล
        "เงินบำรุงศวก.":    _l(0.976, 0.498, 0.749),  # ชมพูร้อนพาสเทล
        "เงินแหล่งอื่น ๆ": _l(0.961, 0.549, 0.200),  # ส้มพาสเทล
    },
}


def delete_all_rules(headers, count):
    reqs = [
        {"deleteConditionalFormatRule": {"sheetId": WS_ID, "index": i}}
        for i in range(count - 1, -1, -1)
    ]
    r = requests.post(
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}:batchUpdate",
        headers=headers, json={"requests": reqs},
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
                    "startRowIndex": DATA_START, "endRowIndex": DATA_END,
                    "startColumnIndex": col_idx, "endColumnIndex": col_idx + 1,
                }],
                "booleanRule": {
                    "condition": {"type": "TEXT_EQ",
                                  "values": [{"userEnteredValue": text_value}]},
                    "format": {"backgroundColor": {"red": r, "green": g, "blue": b}},
                },
            },
        }
    }


def apply_colors():
    creds = Credentials.from_service_account_file("credentials.json", scopes=SCOPES)
    creds.refresh(GoogleRequest())
    headers = {"Authorization": f"Bearer {creds.token}", "Content-Type": "application/json"}

    r = requests.get(
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}",
        headers=headers,
        params={"fields": "sheets(properties(sheetId),conditionalFormats)"},
    )
    existing = 0
    for s in r.json().get("sheets", []):
        if s["properties"]["sheetId"] == WS_ID:
            existing = len(s.get("conditionalFormats", []))

    print(f"ลบ {existing} rules เก่าออก...")
    if existing:
        ok = delete_all_rules(headers, existing)
        print("ลบสำเร็จ" if ok else "ลบไม่สำเร็จ!")

    D_RANGE = {"sheetId": WS_ID, "startRowIndex": DATA_START, "endRowIndex": DATA_END,
               "startColumnIndex": 3, "endColumnIndex": 4}

    reqs = [
        # D — ศูนย์วิทยาศาสตร์การแพทย์ → #bfe1f6
        {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [D_RANGE],
            "booleanRule": {"condition": {"type": "TEXT_CONTAINS",
                "values": [{"userEnteredValue": "ศูนย์วิทยาศาสตร์การแพทย์"}]},
                "format": {"backgroundColor": {"red": 191/255, "green": 225/255, "blue": 246/255}}}}}},
        # D — อื่น ๆ (ไม่ว่าง) → #ffcfc9
        {"addConditionalFormatRule": {"index": 1, "rule": {"ranges": [D_RANGE],
            "booleanRule": {"condition": {"type": "CUSTOM_FORMULA",
                "values": [{"userEnteredValue":
                    '=AND(D3<>"",ISERROR(SEARCH("ศูนย์วิทยาศาสตร์การแพทย์",D3)))'}]},
                "format": {"backgroundColor": {"red": 255/255, "green": 207/255, "blue": 201/255}}}}}},
    ]

    i = 2
    for cfg in [COL_E, COL_F, COL_K]:
        for value, color in cfg["colors"].items():
            reqs.append(make_rule(cfg["col"], value, color, i))
            i += 1

    resp = requests.post(
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}:batchUpdate",
        headers=headers, json={"requests": reqs},
    )

    if resp.status_code == 200:
        print(f"\nเพิ่ม {len(reqs)} rules (D+E+F+K) สำเร็จ!")
    else:
        print(f"Error {resp.status_code}: {resp.text}")


if __name__ == "__main__":
    apply_colors()
