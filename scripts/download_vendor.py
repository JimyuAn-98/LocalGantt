"""Utility to download third-party frontend libraries into static/lib.

Run this once after cloning the repo to cache dependencies locally and avoid CDN latency.
"""

import os
import sys

import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB_DIR = os.path.join(BASE_DIR, "static", "lib")
WEBFONTS_DIR = os.path.join(BASE_DIR, "static", "webfonts")

LIBRARIES = {
    "https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.0/dist/frappe-gantt.css": "frappe-gantt.css",
    "https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.0/dist/frappe-gantt.min.js": "frappe-gantt.min.js",
    # FontAwesome for icons (avoid tracking prevention issues)
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css": "font-awesome.min.css",
}

# Font files referenced by the FontAwesome CSS; they live under ../webfonts/
FONT_FILES = [
    "fa-solid-900.woff2",
    "fa-solid-900.ttf",
    "fa-regular-400.woff2",
    "fa-regular-400.ttf",
    "fa-brands-400.woff2",
    "fa-brands-400.ttf",
    # compatibility file (optional)
    "fa-v4compatibility.woff2",
    "fa-v4compatibility.ttf",
]



def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)


def download(url, dest):
    print(f"Downloading {url} -> {dest}")
    rsp = requests.get(url, stream=True)
    rsp.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in rsp.iter_content(8192):
            f.write(chunk)


def main():
    ensure_dir(LIB_DIR)
    ensure_dir(WEBFONTS_DIR)

    # download CSS and JS libraries
    for url, filename in LIBRARIES.items():
        dest_path = os.path.join(LIB_DIR, filename)
        # skip if already exists
        if os.path.exists(dest_path):
            print(f"Already have {filename}, skipping.")
            continue
        try:
            download(url, dest_path)
        except Exception as e:
            print(f"Failed to download {url}: {e}", file=sys.stderr)

    # download font files for FontAwesome
    fa_base = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/"
    for fname in FONT_FILES:
        dest_path = os.path.join(WEBFONTS_DIR, fname)
        if os.path.exists(dest_path):
            print(f"Already have {fname}, skipping.")
            continue
        try:
            download(fa_base + fname, dest_path)
        except Exception as e:
            print(f"Failed to download font {fname}: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
