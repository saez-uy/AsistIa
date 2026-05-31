"""Manage the pool of AI-generated human body images used as swap targets.

Images must be pre-downloaded (e.g. from thispersondoesnotexist.com scraper or
a local StyleGAN2 run).  This module loads them, lets the user pick one, and
crops/resizes to the canonical 512×512 size.
"""

import os
import random
import requests
import cv2
import numpy as np
from PIL import Image
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


TPDNE_URL = "https://thispersondoesnotexist.com/"


class BodyImageManager:
    def __init__(self, bodies_dir: str = config.GENERATED_BODIES_DIR):
        self.bodies_dir = bodies_dir
        os.makedirs(bodies_dir, exist_ok=True)

    # ── Download helpers ──────────────────────────────────────────────────────

    def download_generated_faces(self, count: int = 5) -> list[str]:
        """Download `count` AI-generated face images from thispersondoesnotexist.com.

        These are entirely synthetic — no real person's likeness is used.
        """
        saved = []
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
            )
        }
        for i in range(count):
            try:
                resp = requests.get(TPDNE_URL, headers=headers, timeout=10)
                resp.raise_for_status()
                path = os.path.join(self.bodies_dir, f"generated_{i:03d}.jpg")
                with open(path, "wb") as f:
                    f.write(resp.content)
                saved.append(path)
                print(f"[BodyGenerator] Downloaded synthetic face {i+1}/{count} → {path}")
            except Exception as e:
                print(f"[BodyGenerator] Download {i+1} failed: {e}")
        return saved

    # ── Load & select ─────────────────────────────────────────────────────────

    def list_available(self) -> list[str]:
        exts = {".jpg", ".jpeg", ".png", ".webp"}
        return [
            os.path.join(self.bodies_dir, f)
            for f in sorted(os.listdir(self.bodies_dir))
            if os.path.splitext(f)[1].lower() in exts
        ]

    def get_target_image(self, index: int | None = None) -> np.ndarray:
        """Return a 512×512 BGR numpy array for the chosen target body image."""
        available = self.list_available()
        if not available:
            raise FileNotFoundError(
                f"No images in '{self.bodies_dir}'. "
                "Run download_generated_faces() first or drop images there manually."
            )
        if index is None:
            path = random.choice(available)
        else:
            path = available[index % len(available)]

        img = cv2.imread(path)
        if img is None:
            raise ValueError(f"Cannot read image: {path}")
        img = cv2.resize(img, (config.TARGET_WIDTH, config.TARGET_HEIGHT))
        print(f"[BodyGenerator] Using target image: {os.path.basename(path)}")
        return img

    def show_gallery(self) -> None:
        """Print paths & indices for all available images."""
        for i, p in enumerate(self.list_available()):
            print(f"  [{i}] {p}")
