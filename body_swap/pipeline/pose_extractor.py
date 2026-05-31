"""Extract body pose landmarks from every frame of a video using MediaPipe."""

import cv2
import mediapipe as mp
import numpy as np
from dataclasses import dataclass
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


@dataclass
class PoseFrame:
    landmarks: Optional[np.ndarray]  # (33, 3) x,y,z normalised; None if not detected
    world_landmarks: Optional[np.ndarray]
    frame_idx: int


class PoseExtractor:
    """Wraps MediaPipe Pose for whole-video extraction."""

    def __init__(self):
        self._mp_pose = mp.solutions.pose
        self._pose = self._mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=config.POSE_CONFIDENCE,
            min_tracking_confidence=config.POSE_TRACKING_CONFIDENCE,
        )

    def extract_from_video(self, video_path: str) -> tuple[list[PoseFrame], dict]:
        """Return (pose_frames, meta) where meta has fps, width, height, total_frames."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise FileNotFoundError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or config.TARGET_FPS
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        meta = {"fps": fps, "width": width, "height": height, "total_frames": total}
        pose_frames: list[PoseFrame] = []
        idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if idx >= config.MAX_FRAMES:
                print(f"[PoseExtractor] Reached MAX_FRAMES={config.MAX_FRAMES}, stopping early.")
                break

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = self._pose.process(rgb)

            if result.pose_landmarks:
                lm = np.array(
                    [[p.x, p.y, p.z] for p in result.pose_landmarks.landmark],
                    dtype=np.float32,
                )
                wlm = np.array(
                    [[p.x, p.y, p.z] for p in result.pose_world_landmarks.landmark],
                    dtype=np.float32,
                )
                pose_frames.append(PoseFrame(lm, wlm, idx))
            else:
                pose_frames.append(PoseFrame(None, None, idx))

            idx += 1

        cap.release()
        detected = sum(1 for pf in pose_frames if pf.landmarks is not None)
        print(
            f"[PoseExtractor] {detected}/{len(pose_frames)} frames with pose detected "
            f"from '{os.path.basename(video_path)}'"
        )
        return pose_frames, meta

    def draw_skeleton(self, frame: np.ndarray, landmarks: np.ndarray) -> np.ndarray:
        """Draw skeleton overlay on a frame (BGR). landmarks shape (33,3) normalised."""
        h, w = frame.shape[:2]
        out = frame.copy()
        mp_drawing = mp.solutions.drawing_utils
        mp_pose = mp.solutions.pose

        # Convert ndarray back to MediaPipe landmark list for drawing
        landmark_list = mp.framework.formats.landmark_pb2.NormalizedLandmarkList()
        for x, y, z in landmarks:
            lm = landmark_list.landmark.add()
            lm.x, lm.y, lm.z = float(x), float(y), float(z)

        mp_drawing.draw_landmarks(
            out,
            landmark_list,
            mp_pose.POSE_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=3),
            mp_drawing.DrawingSpec(color=(255, 0, 0), thickness=2),
        )
        return out

    def close(self):
        self._pose.close()
