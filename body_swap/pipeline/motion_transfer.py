"""Motion transfer using First Order Motion Model (FOMM).

On first run this downloads the pre-trained VoxCeleb checkpoint (~700 MB).
FOMM animates a single target image using the motion extracted from a driving
video — perfect for our use case (source video → target AI-generated body).

The actual FOMM code lives at:
  https://github.com/AliaksandrSiarohin/first-order-model

We download and import it at runtime to keep this repo lightweight.
"""

import os
import sys
import subprocess
import importlib
import numpy as np
import torch
import cv2
from tqdm import tqdm

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

FOMM_REPO_DIR = os.path.join(config.MODELS_DIR, "first-order-model")
FOMM_CHECKPOINT = os.path.join(config.MODELS_DIR, "vox-cpk.pth.tar")
FOMM_CONFIG_FILE = os.path.join(config.MODELS_DIR, "vox-256.yaml")


def _ensure_fomm_repo():
    if not os.path.isdir(FOMM_REPO_DIR):
        print("[FOMM] Cloning First Order Motion Model repository…")
        subprocess.run(
            ["git", "clone", "https://github.com/AliaksandrSiarohin/first-order-model",
             FOMM_REPO_DIR],
            check=True,
        )
    if FOMM_REPO_DIR not in sys.path:
        sys.path.insert(0, FOMM_REPO_DIR)


def _ensure_checkpoint():
    if not os.path.isfile(FOMM_CHECKPOINT):
        print(f"[FOMM] Downloading VoxCeleb checkpoint (~700 MB) → {FOMM_CHECKPOINT}")
        try:
            import gdown
            gdown.download(
                id=config.FOMM_CHECKPOINT_GDRIVE_ID,
                output=FOMM_CHECKPOINT,
                quiet=False,
            )
        except Exception as e:
            print(
                f"[FOMM] Auto-download failed: {e}\n"
                "Please download manually from:\n"
                "  https://drive.google.com/file/d/1PyQJmkdCsAkOYwUyaj_l-l0as-iLDgeH\n"
                f"and place it at: {FOMM_CHECKPOINT}"
            )
            raise


def _ensure_config():
    if not os.path.isfile(FOMM_CONFIG_FILE):
        import urllib.request
        print(f"[FOMM] Downloading config → {FOMM_CONFIG_FILE}")
        urllib.request.urlretrieve(config.FOMM_CONFIG_URL, FOMM_CONFIG_FILE)


class MotionTransfer:
    """Wraps FOMM to animate a target image with motion from a source video."""

    def __init__(self):
        self._generator = None
        self._kp_detector = None
        self._loaded = False

    def _load_models(self):
        if self._loaded:
            return
        _ensure_fomm_repo()
        _ensure_checkpoint()
        _ensure_config()

        # Import FOMM modules (available after clone)
        from demo import load_checkpoints  # type: ignore[import]

        self._generator, self._kp_detector = load_checkpoints(
            config_path=FOMM_CONFIG_FILE,
            checkpoint_path=FOMM_CHECKPOINT,
            cpu=(config.DEVICE == "cpu"),
        )
        self._loaded = True
        print(f"[FOMM] Models loaded on {config.DEVICE}")

    def animate(
        self,
        source_frames: list[np.ndarray],
        target_image: np.ndarray,
        relative: bool = True,
        adapt_movement: bool = True,
    ) -> list[np.ndarray]:
        """Animate `target_image` using motion from `source_frames`.

        Args:
            source_frames: List of BGR uint8 frames from the user's video.
            target_image:  BGR uint8 target body image (512×512).
            relative:      Use relative keypoint mode (recommended).
            adapt_movement: Scale movement amplitude to target body proportions.

        Returns:
            List of BGR uint8 output frames (same length as source_frames).
        """
        self._load_models()

        from demo import make_animation  # type: ignore[import]
        import imageio

        size = (config.TARGET_WIDTH, config.TARGET_HEIGHT)

        # Convert target to float RGB [0,1]
        target_rgb = cv2.cvtColor(
            cv2.resize(target_image, size), cv2.COLOR_BGR2RGB
        ).astype(np.float32) / 255.0

        # Convert source frames to float RGB [0,1] + resize
        driving_frames = []
        for f in source_frames:
            f_rgb = cv2.cvtColor(cv2.resize(f, size), cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            driving_frames.append(f_rgb)

        print(f"[FOMM] Animating {len(driving_frames)} frames…")
        predictions = make_animation(
            source_image=target_rgb,
            driving_video=driving_frames,
            generator=self._generator,
            kp_detector=self._kp_detector,
            relative=relative,
            adapt_movement_scale=adapt_movement,
            cpu=(config.DEVICE == "cpu"),
        )

        # Back to BGR uint8
        out_frames = []
        for pred in predictions:
            bgr = cv2.cvtColor((pred * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
            out_frames.append(bgr)

        print(f"[FOMM] Animation done: {len(out_frames)} output frames")
        return out_frames
