"""Video reading and writing utilities."""

import cv2
import os
import numpy as np
from tqdm import tqdm
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


def read_video(path: str, max_frames: int = config.MAX_FRAMES) -> tuple[list[np.ndarray], dict]:
    """Read up to max_frames BGR frames from video.

    Returns (frames, meta) where meta = {fps, width, height, total_frames}.
    """
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open: {path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or config.TARGET_FPS
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    frames = []
    pbar = tqdm(total=min(total, max_frames), desc="Reading video")
    while len(frames) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)
        pbar.update(1)
    cap.release()
    pbar.close()

    meta = {"fps": fps, "width": width, "height": height, "total_frames": total}
    print(f"[VideoIO] Read {len(frames)} frames from '{os.path.basename(path)}'")
    return frames, meta


def write_video(frames: list[np.ndarray], output_path: str, fps: float) -> str:
    """Write BGR frames to MP4.  Returns the output path."""
    if not frames:
        raise ValueError("No frames to write")

    h, w = frames[0].shape[:2]
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    writer = cv2.VideoWriter(output_path, fourcc, fps, (w, h))

    for f in tqdm(frames, desc="Writing video"):
        writer.write(f)
    writer.release()

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"[VideoIO] Saved {len(frames)} frames → '{output_path}' ({size_mb:.1f} MB)")
    return output_path


def frames_to_video_ffmpeg(frames: list[np.ndarray], output_path: str, fps: float) -> str:
    """Write frames using imageio/ffmpeg for better codec support."""
    try:
        import imageio
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        writer = imageio.get_writer(output_path, fps=fps)
        for f in tqdm(frames, desc="Encoding (ffmpeg)"):
            rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
            writer.append_data(rgb)
        writer.close()
        return output_path
    except ImportError:
        return write_video(frames, output_path, fps)


def resize_frames(frames: list[np.ndarray], width: int, height: int) -> list[np.ndarray]:
    return [cv2.resize(f, (width, height)) for f in frames]
