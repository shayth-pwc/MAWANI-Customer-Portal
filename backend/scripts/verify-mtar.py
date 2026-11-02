#!/usr/bin/env python3
"""Inspect a Cloud MTA archive (including nested ZIP modules) for local secrets.

The check is filename-based and cannot guarantee a file contains no embedded
secrets. Always review configuration and use your organization's scanning tools.
"""
import io
import sys
import zipfile
from pathlib import PurePosixPath

BLOCK_NAMES = {".env", ".cdsrc-private.json", "default-env.json"}
BLOCK_EXTENSIONS = {".pem", ".key", ".p12", ".pfx"}


def is_sensitive(path):
    path = PurePosixPath(path)
    parts = path.parts
    name = path.name
    return (
        name in BLOCK_NAMES
        or (name.startswith(".env.") and name != ".env.example")
        or path.suffix.lower() in BLOCK_EXTENSIONS
        or "mta_archives" in parts
    )


def scan_zip(data, where, findings, depth=0):
    if depth > 5:
        raise RuntimeError("MTA nested archive depth exceeded")
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for entry in zf.infolist():
            if entry.is_dir():
                continue
            path = where + "/" + entry.filename
            if is_sensitive(entry.filename):
                findings.append(path)
            if entry.filename.lower().endswith((".zip", ".jar", ".mtar")):
                try:
                    scan_zip(zf.read(entry), path, findings, depth + 1)
                except zipfile.BadZipFile:
                    pass


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/verify-mtar.py <path.mtar>")
    path = sys.argv[1]
    with open(path, "rb") as f:
        data = f.read()
    findings = []
    scan_zip(data, path, findings)
    if findings:
        print("FAILED: potential credential/local files found inside MTAR:")
        for item in findings:
            print("  " + item)
        raise SystemExit(1)
    print("PASS: no known local credential filenames detected (including nested ZIPs)")


if __name__ == "__main__":
    main()
