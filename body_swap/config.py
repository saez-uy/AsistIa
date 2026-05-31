import os

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(BASE_DIR, "input")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
MODELS_DIR = os.path.join(BASE_DIR, "models")
GENERATED_BODIES_DIR = os.path.join(BASE_DIR, "generated_bodies")

os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(GENERATED_BODIES_DIR, exist_ok=True)

# Video processing
TARGET_FPS = 25
TARGET_WIDTH = 512
TARGET_HEIGHT = 512
MAX_FRAMES = 500          # limit for basic GPUs

# Pose extraction
POSE_CONFIDENCE = 0.5
POSE_TRACKING_CONFIDENCE = 0.5

# Motion transfer (FOMM-style)
# Checkpoint downloaded on first run
FOMM_CONFIG_URL = "https://raw.githubusercontent.com/AliaksandrSiarohin/first-order-model/master/config/vox-256.yaml"
FOMM_CHECKPOINT_GDRIVE_ID = "1PyQJmkdCsAkOYwUyaj_l-l0as-iLDgeH"  # vox-cpk.pth.tar

# Device
import torch
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
