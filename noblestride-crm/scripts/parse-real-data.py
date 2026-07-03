#!/usr/bin/env python3
"""Parse the client's real spreadsheets into prisma/real-data.json.

Sources (relative to the repo parent directory):
  - data/decrypted/Engagement contract Tracker _ CRM.xlsx  -> mandates
  - data/decrypted/Tasks Tracker Whatsapp 2026_ CRM.xlsx   -> tasks

Output: prisma/real-data.json  { "mandates": [...], "tasks": [...] }
"""

import datetime
import json
import re
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")  # openpyxl extension warnings

import openpyxl

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT.parent / "data" / "decrypted"
ENGAGEMENT_XLSX = DATA_DIR / "Engagement contract Tracker _ CRM.xlsx"
TASKS_XLSX = DATA_DIR / "Tasks Tracker Whatsapp 2026_ CRM.xlsx"
OUT_PATH = REPO_ROOT / "prisma" / "real-data.json"

RECENT_CUTOFF = datetime.datetime(2025, 1, 1)


def norm_name(s):
    """casefold + collapse whitespace, for dedup keys."""
    return re.sub(r"\s+", " ", str(s)).strip().casefold()


def clean_str(v):
    if v is None:
        return None
    s = re.sub(r"\s+", " ", str(v)).strip()
    return s or None


def parse_date(v):
    """Return ISO date string or None. Handles datetimes plus the sheet's
    stringly-typed strays like '17/042025', ' 17/09/25', '14/5/2026'."""
    if isinstance(v, datetime.datetime):
        # guard against spreadsheet junk years
        if 2000 <= v.year <= 2030:
            return v.date().isoformat()
        return None
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"):
            try:
                d = datetime.datetime.strptime(s, fmt)
                if 2000 <= d.year <= 2030:
                    return d.date().isoformat()
            except ValueError:
                pass
        # digit-run heuristic: '17/042025' -> 17042025 (ddmmyyyy), '170925' (ddmmyy)
        digits = re.sub(r"\D", "", s)
        try:
            if len(digits) == 8:
                d = datetime.datetime.strptime(digits, "%d%m%Y")
            elif len(digits) == 6:
                d = datetime.datetime.strptime(digits, "%d%m%y")
            else:
                return None
            if 2000 <= d.year <= 2030:
                return d.date().isoformat()
        except ValueError:
            return None
    return None


def looks_like_junk_client(name):
    """Section headers / numeric noise in the Client column."""
    if re.fullmatch(r"[\d\s.,/–-]+", name):  # purely numeric-ish
        return True
    low = name.casefold()
    if low in {"client", "clients", "total", "n/a"}:
        return True
    if "tracker" in low and len(name) < 40:
        return True
    return False


def parse_mandates():
    wb = openpyxl.load_workbook(ENGAGEMENT_XLSX, data_only=True)
    ws = wb["Engagement Contract Tracker"]

    raw_rows = 0
    skipped_no_client = 0
    skipped_junk = 0
    deduped = {}  # norm name -> (sort_key, mandate dict)

    for row in ws.iter_rows(min_row=4, max_row=ws.max_row, max_col=10, values_only=True):
        sno, date, client, nda_sent, nda_signed, ea_sent, ea_signed, lead, source, deal = row
        if all(v is None or str(v).strip() == "" for v in row):
            continue
        client = clean_str(client)
        if not client:
            skipped_no_client += 1
            continue
        if looks_like_junk_client(client):
            skipped_junk += 1
            continue
        raw_rows += 1

        d = parse_date(date)
        nda_s, nda_g = parse_date(nda_sent), parse_date(nda_signed)
        ea_s, ea_g = parse_date(ea_sent), parse_date(ea_signed)

        nda_status = "Signed" if nda_g else ("Sent" if nda_s else "NotSent")
        ea_status = "Signed" if ea_g else ("Sent" if ea_s else "NotSent")
        if ea_g:
            stage = "Signed"
        elif ea_s:
            stage = "Negotiation"
        elif nda_g:
            stage = "Proposal"
        elif nda_s:
            stage = "Qualification"
        else:
            stage = "NewLead"

        all_dates = [x for x in (d, nda_s, nda_g, ea_s, ea_g) if x]
        recent = bool(all_dates) and max(all_dates) >= RECENT_CUTOFF.date().isoformat()

        mandate = {
            "clientName": client,
            "date": d,
            "ndaSentDate": nda_s,
            "ndaSignedDate": nda_g,
            "eaSentDate": ea_s,
            "eaSignedDate": ea_g,
            "ndaStatus": nda_status,
            "eaStatus": ea_status,
            "stage": stage,
            "leadName": clean_str(lead),
            "sourceReferee": clean_str(source),
            "dealInfo": clean_str(deal),
            "recent": recent,
        }

        # Dedup: keep the row with the most recent Date; tie -> most filled fields.
        filled = sum(1 for v in mandate.values() if v)
        sort_key = (d or "0000-00-00", filled)
        key = norm_name(client)
        if key not in deduped or sort_key > deduped[key][0]:
            deduped[key] = (sort_key, mandate)

    mandates = [m for _, m in deduped.values()]
    return mandates, raw_rows, skipped_no_client, skipped_junk


WEEK_DIVIDER_RE = re.compile(
    r"^\s*\d{1,2}\s*(st|nd|rd|th)?\s+?\w*\s*[-–]\s*\d{1,2}.*\d{4}\s*$", re.IGNORECASE
)

STATUS_MAP = {"done": "Done", "ongoing": "Ongoing", "pending": "Pending"}


def parse_tasks():
    wb = openpyxl.load_workbook(TASKS_XLSX, data_only=True)
    ws = wb["Task Tracker"]

    tasks = []
    dividers = 0
    empty = 0
    skipped_no_action = 0

    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=8, values_only=True):
        project, action, source, status, deadline, owner, assist, notes = row
        if all(v is None or str(v).strip() == "" for v in row):
            empty += 1
            continue
        project_s = clean_str(project)
        action_s = clean_str(action)
        if project_s and not action_s and WEEK_DIVIDER_RE.match(project_s):
            dividers += 1
            continue
        if not action_s:
            skipped_no_action += 1
            continue

        status_s = STATUS_MAP.get(str(status).strip().casefold() if status else "", "NotStarted")
        tasks.append(
            {
                "project": project_s,
                "actionPoint": action_s,
                "status": status_s,
                "deadline": parse_date(deadline),
                "ownerName": clean_str(owner),
                "assistName": clean_str(assist),
                "notes": clean_str(notes),
            }
        )
    return tasks, dividers, empty, skipped_no_action


def main():
    mandates, raw_rows, no_client, junk = parse_mandates()
    tasks, dividers, empty, no_action = parse_tasks()

    OUT_PATH.write_text(json.dumps({"mandates": mandates, "tasks": tasks}, indent=2))

    recent = sum(1 for m in mandates if m["recent"])
    stages = {}
    for m in mandates:
        stages[m["stage"]] = stages.get(m["stage"], 0) + 1
    statuses = {}
    for t in tasks:
        statuses[t["status"]] = statuses.get(t["status"], 0) + 1

    print(f"Engagement tracker: {raw_rows} client rows "
          f"(skipped: {no_client} no-client, {junk} junk)")
    print(f"  -> {len(mandates)} deduped mandates ({recent} recent >= {RECENT_CUTOFF.date()})")
    print(f"  stages: {stages}")
    print(f"Task tracker: {len(tasks)} tasks "
          f"(skipped: {dividers} week dividers, {empty} empty, {no_action} without action point)")
    print(f"  statuses: {statuses}")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    sys.exit(main())
