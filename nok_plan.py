"""
จัดการ worksheet "อนุมัตินอกแผน" — ทะเบียนคุม 2569
แถวที่ 1 = title, แถวที่ 2 = header, ข้อมูลเริ่มแถวที่ 3
"""

import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
CREDENTIALS_FILE = "credentials.json"
SHEET_URL = "https://docs.google.com/spreadsheets/d/1MztCiuS6bT_sIfkLi-mBFvh8sm_H-8Exy3FhuNF1MEM/edit?usp=sharing"
WS_NAME = "อนุมัตินอกแผน"
HEADER_ROW = 2   # แถว header จริงอยู่แถวที่ 2
DATA_START = 3   # ข้อมูลเริ่มที่แถว 3

# ลำดับ columns (0-based index)
COL = {
    "ลำดับ": 0, "เลขหนังสือ": 1, "วันที่อนุมัติ": 2, "หน่วยงาน": 3,
    "หมวดงบ": 4, "ประเภท": 5, "รายการ": 6, "จำนวนเงิน": 7,
    "แหล่งเงิน": 8, "รหัสโครงการ": 9, "TOR": 10, "ราคากลาง": 11,
    "พิจารณาผล": 12, "ประกาศผู้ชนะ": 13, "อุทธรณ์": 14,
    "ทำสัญญา": 15, "วงเงินสัญญา": 16, "ผูก PO": 17, "เสร็จแล้ว": 18,
    "หมายเหตุ": 19, "ผู้ติดต่อ": 20, "เบอร์โทร": 21,
    "หมายเหตุ2": 22, "เหตุผลเดิม": 23,
}


def connect() -> gspread.Worksheet:
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
    client = gspread.authorize(creds)
    return client.open_by_url(SHEET_URL).worksheet(WS_NAME)


# ─── READ ────────────────────────────────────────────────────────────────────

def read_all(ws: gspread.Worksheet) -> list[dict]:
    """ดึงทุกแถวเป็น list of dict"""
    rows = ws.get_all_values()
    headers = rows[HEADER_ROW - 1]
    return [
        dict(zip(headers, row))
        for row in rows[DATA_START - 1:]
        if any(row)
    ]


def find_by_order(ws: gspread.Worksheet, order_num: int | str) -> dict | None:
    """หาแถวจาก ลำดับ"""
    for record in read_all(ws):
        if str(record.get("ลำดับ", "")).strip() == str(order_num):
            return record
    return None


def find_by_agency(ws: gspread.Worksheet, agency: str) -> list[dict]:
    """หาทุกแถวของ หน่วยงาน ที่ระบุ"""
    return [r for r in read_all(ws) if agency in r.get("หน่วยงาน", "")]


# ─── APPEND ──────────────────────────────────────────────────────────────────

def append_row(ws: gspread.Worksheet, data: dict) -> None:
    """
    เพิ่มแถวใหม่ต่อท้าย ส่งเป็น dict เช่น:
    {
        "ลำดับ": 71,
        "เลขหนังสือ": "สธ 0618/12345 ลว 1 มิ.ย. 69",
        "วันที่อนุมัติ": "5 มิ.ย. 69",
        "หน่วยงาน": "...",
        "หมวดงบ": "งบดำเนินงาน",
        "ประเภท": "โครงการ",
        "รายการ": "...",
        "จำนวนเงิน": "1,000,000.00",
        "แหล่งเงิน": "เงินบำรุงกรม",
    }
    """
    total_cols = len(COL)
    row = [""] * total_cols
    for key, val in data.items():
        if key in COL:
            row[COL[key]] = val
    ws.append_row(row, value_input_option="USER_ENTERED")
    print(f"เพิ่มแถวสำเร็จ: ลำดับ {data.get('ลำดับ', '?')}")


# ─── UPDATE ──────────────────────────────────────────────────────────────────

def _find_row_index(ws: gspread.Worksheet, order_num: int | str) -> int | None:
    """หาหมายเลขแถวจริงใน sheet จาก ลำดับ"""
    col_a = ws.col_values(1)
    for i, val in enumerate(col_a):
        if str(val).strip() == str(order_num):
            return i + 1  # gspread ใช้ 1-based
    return None


def update_cell_by_order(
    ws: gspread.Worksheet,
    order_num: int | str,
    column_name: str,
    new_value,
) -> None:
    """แก้ไขค่าใน column ที่ระบุ โดยหาจาก ลำดับ"""
    row_idx = _find_row_index(ws, order_num)
    if row_idx is None:
        print(f"ไม่พบลำดับ {order_num}")
        return
    col_idx = COL.get(column_name)
    if col_idx is None:
        print(f"ไม่พบ column '{column_name}'")
        return
    ws.update_cell(row_idx, col_idx + 1, new_value)
    print(f"อัปเดต ลำดับ {order_num} / {column_name} = '{new_value}' สำเร็จ")


def update_row_by_order(
    ws: gspread.Worksheet,
    order_num: int | str,
    updates: dict,
) -> None:
    """แก้ไขหลาย column พร้อมกัน ส่งเป็น dict {'column': 'ค่าใหม่', ...}"""
    row_idx = _find_row_index(ws, order_num)
    if row_idx is None:
        print(f"ไม่พบลำดับ {order_num}")
        return
    cells = []
    for col_name, value in updates.items():
        if col_name in COL:
            cells.append(
                gspread.Cell(row_idx, COL[col_name] + 1, value)
            )
    ws.update_cells(cells, value_input_option="USER_ENTERED")
    print(f"อัปเดต ลำดับ {order_num} สำเร็จ ({len(cells)} columns)")


# ─── DELETE ──────────────────────────────────────────────────────────────────

def delete_row_by_order(ws: gspread.Worksheet, order_num: int | str) -> None:
    """ลบแถวทั้งแถวจาก ลำดับ"""
    row_idx = _find_row_index(ws, order_num)
    if row_idx is None:
        print(f"ไม่พบลำดับ {order_num}")
        return
    ws.delete_rows(row_idx)
    print(f"ลบลำดับ {order_num} (แถว {row_idx}) สำเร็จ")


def clear_field_by_order(
    ws: gspread.Worksheet,
    order_num: int | str,
    column_name: str,
) -> None:
    """ล้างค่าในช่องเดียว โดยไม่ลบแถว"""
    update_cell_by_order(ws, order_num, column_name, "")


# ─── EXAMPLE ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ws = connect()
    print(f"เชื่อมต่อสำเร็จ: {ws.title}\n")

    # --- อ่านข้อมูลทั้งหมด ---
    records = read_all(ws)
    print(f"จำนวนรายการ: {len(records)} แถว")

    # --- ค้นหาจากลำดับ ---
    r = find_by_order(ws, 1)
    if r:
        print(f"\nลำดับ 1: {r['หน่วยงาน']} | {r['รายการ'][:40]}")

    # --- แก้ไข หมายเหตุ ของลำดับ 1 (uncomment เพื่อใช้) ---
    # update_cell_by_order(ws, 1, "หมายเหตุ", "อัปเดตสถานะใหม่")

    # --- แก้ไขหลาย field พร้อมกัน ---
    # update_row_by_order(ws, 5, {
    #     "ทำสัญญา": "✓",
    #     "วงเงินสัญญา": "9,300,000",
    #     "หมายเหตุ": "ทำสัญญาแล้ว 30 ต.ค. 68",
    # })

    # --- เพิ่มแถวใหม่ ---
    # append_row(ws, {
    #     "ลำดับ": 71,
    #     "เลขหนังสือ": "สธ 0618/99999 ลว 1 มิ.ย. 69",
    #     "วันที่อนุมัติ": "5 มิ.ย. 69",
    #     "หน่วยงาน": "ชื่อหน่วยงาน",
    #     "หมวดงบ": "งบดำเนินงาน",
    #     "ประเภท": "โครงการ",
    #     "รายการ": "ชื่อโครงการ",
    #     "จำนวนเงิน": "1,000,000.00",
    #     "แหล่งเงิน": "เงินบำรุงกรม",
    # })

    # --- ลบแถว ---
    # delete_row_by_order(ws, 71)
