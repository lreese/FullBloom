"""CSV parsing utility with encoding and delimiter auto-detection."""

import csv
import io


def parse_csv(file_content: bytes) -> list[dict]:
    """Parse CSV bytes into a list of dicts keyed by header names.

    Handles UTF-8 and latin-1 encoding, auto-detects comma vs tab delimiter,
    and strips whitespace from headers and values.
    """
    # Try UTF-8 first, fall back to latin-1
    try:
        text = file_content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = file_content.decode("latin-1")

    # Auto-detect delimiter from the first line
    first_line = text.split("\n", 1)[0]
    delimiter = "\t" if first_line.count("\t") > first_line.count(",") else ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    # Strip whitespace from header names
    if reader.fieldnames:
        reader.fieldnames = [f.strip() for f in reader.fieldnames]

    rows: list[dict] = []
    for row in reader:
        cleaned = {k.strip(): (v.strip() if v else v) for k, v in row.items()}
        rows.append(cleaned)

    return rows
