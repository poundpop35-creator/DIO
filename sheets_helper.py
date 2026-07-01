"""
Google Sheets Helper Script
ต้องการ: credentials JSON file และ URL ของ Google Sheet
"""

import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

CREDENTIALS_FILE = "credentials.json"   # <- เปลี่ยนเป็นชื่อไฟล์ของคุณ
SHEET_URL = "https://docs.google.com/spreadsheets/d/1MztCiuS6bT_sIfkLi-mBFvh8sm_H-8Exy3FhuNF1MEM/edit?usp=sharing"
WORKSHEET_NAME = "งบนโยบาย"             # <- เปลี่ยนเป็น tab ที่ต้องการ


def connect() -> gspread.Worksheet:
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
    client = gspread.authorize(creds)
    sheet = client.open_by_url(SHEET_URL)
    return sheet.worksheet(WORKSHEET_NAME)


# ─── READ ────────────────────────────────────────────────────────────────────

def read_all(ws: gspread.Worksheet) -> list[dict]:
    """ดึงทุกแถวเป็น list of dict (แถวแรกเป็น header)"""
    return ws.get_all_records()


def read_cell(ws: gspread.Worksheet, row: int, col: int) -> str:
    """ดึงค่าของเซลล์เดียว เช่น row=2, col=1 คือ A2"""
    return ws.cell(row, col).value


# ─── APPEND ──────────────────────────────────────────────────────────────────

def append_row(ws: gspread.Worksheet, values: list) -> None:
    """เพิ่มแถวใหม่ต่อท้าย sheet เช่น ["Alice", 25, "Bangkok"]"""
    ws.append_row(values)


# ─── UPDATE ──────────────────────────────────────────────────────────────────

def update_cell(ws: gspread.Worksheet, row: int, col: int, value) -> None:
    """แก้ไขค่าในเซลล์เดียว"""
    ws.update_cell(row, col, value)


def update_range(ws: gspread.Worksheet, range_name: str, values: list[list]) -> None:
    """แก้ไขหลายเซลล์พร้อมกัน เช่น range_name='A2:C2'"""
    ws.update(range_name, values)


# ─── DELETE ──────────────────────────────────────────────────────────────────

def delete_row(ws: gspread.Worksheet, row: int) -> None:
    """ลบแถวทั้งแถว (row index เริ่มที่ 1)"""
    ws.delete_rows(row)


def clear_range(ws: gspread.Worksheet, range_name: str) -> None:
    """ล้างข้อมูลใน range แต่ไม่ลบแถว เช่น 'A2:C10'"""
    ws.batch_clear([range_name])


# ─── EXAMPLE ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ws = connect()
    print("เชื่อมต่อสำเร็จ:", ws.title)

    # อ่านข้อมูลทั้งหมด
    records = read_all(ws)
    print(f"พบ {len(records)} แถว")
    for r in records[:3]:  # แสดง 3 แถวแรก
        print(r)

    # ตัวอย่างเพิ่มแถว (uncomment เพื่อใช้งาน)
    # append_row(ws, ["ชื่อ", "ค่า1", "ค่า2"])

    # ตัวอย่างแก้ไขเซลล์
    # update_cell(ws, row=2, col=1, value="ค่าใหม่")

    # ตัวอย่างลบแถว
    # delete_row(ws, row=3)
