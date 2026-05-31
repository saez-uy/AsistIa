"""Setup script: install dependencies and verify GPU availability."""

import subprocess
import sys
import os


def run(cmd):
    print(f"$ {cmd}")
    subprocess.run(cmd, shell=True, check=True)


def main():
    print("=== Body Swap Setup ===\n")

    # Install requirements
    req = os.path.join(os.path.dirname(__file__), "requirements.txt")
    run(f"{sys.executable} -m pip install -r {req}")

    # Check torch + GPU
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\nPyTorch {torch.__version__} | device={device}")
    if device == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    else:
        print("No GPU detected — will run on CPU (slower but works)")

    # Check mediapipe
    import mediapipe as mp
    print(f"MediaPipe {mp.__version__} OK")

    # Check cv2
    import cv2
    print(f"OpenCV {cv2.__version__} OK")

    print("\nSetup complete! Next steps:")
    print("  1. python swap.py --download-bodies 5")
    print("  2. python swap.py --list-bodies")
    print("  3. python swap.py --input input/YOUR_VIDEO.mp4 --target-index 0")


if __name__ == "__main__":
    main()
