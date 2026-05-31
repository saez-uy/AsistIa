"""Optional post-processing: blend the animated body back onto the original background.

Keeps the user's head/face visible on top of the swapped body, which gives a more
realistic result without needing a face-swap model.
"""

import cv2
import numpy as np
import mediapipe as mp
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


class BodyBlender:
    """Composite the animated body output with the original video frames.

    Strategy:
    1. Use MediaPipe Selfie Segmentation to mask the body in the animated frame.
    2. Place the masked animated body on top of the original background.
    3. Optionally preserve the original face (head region).
    """

    def __init__(self, preserve_face: bool = True):
        self.preserve_face = preserve_face
        self._seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
        self._face = mp.solutions.face_detection.FaceDetection(
            model_selection=0, min_detection_confidence=0.5
        )

    def blend_frame(
        self,
        original: np.ndarray,
        animated: np.ndarray,
    ) -> np.ndarray:
        """Blend animated (swapped body) onto original background.

        Both frames should be same size (will be resized if not).
        """
        h, w = original.shape[:2]
        animated_r = cv2.resize(animated, (w, h))

        # Segmentation mask for animated frame
        rgb_anim = cv2.cvtColor(animated_r, cv2.COLOR_BGR2RGB)
        seg_result = self._seg.process(rgb_anim)
        mask = (seg_result.segmentation_mask > 0.5).astype(np.uint8)
        mask = cv2.GaussianBlur(mask.astype(np.float32), (21, 21), 0)
        mask3 = np.stack([mask, mask, mask], axis=2)

        # Composite: body from animated, background from original
        composite = (animated_r.astype(np.float32) * mask3 +
                     original.astype(np.float32) * (1 - mask3)).astype(np.uint8)

        if self.preserve_face:
            composite = self._paste_original_face(original, composite)

        return composite

    def _paste_original_face(self, original: np.ndarray, composite: np.ndarray) -> np.ndarray:
        """Detect face in original and paste that region back onto the composite."""
        h, w = original.shape[:2]
        rgb_orig = cv2.cvtColor(original, cv2.COLOR_BGR2RGB)
        faces = self._face.process(rgb_orig)
        if not faces.detections:
            return composite

        result = composite.copy()
        for det in faces.detections:
            bb = det.location_data.relative_bounding_box
            x1 = max(0, int(bb.xmin * w) - 20)
            y1 = max(0, int(bb.ymin * h) - 40)
            x2 = min(w, int((bb.xmin + bb.width) * w) + 20)
            y2 = min(h, int((bb.ymin + bb.height) * h) + 10)

            face_orig = original[y1:y2, x1:x2]
            if face_orig.size == 0:
                continue

            # Soft-edge paste using ellipse mask
            face_mask = np.zeros((y2 - y1, x2 - x1), dtype=np.uint8)
            cx, cy = (x2 - x1) // 2, (y2 - y1) // 2
            cv2.ellipse(face_mask, (cx, cy), (cx, cy), 0, 0, 360, 255, -1)
            face_mask = cv2.GaussianBlur(face_mask, (31, 31), 0).astype(np.float32) / 255.0
            face_mask3 = np.stack([face_mask, face_mask, face_mask], axis=2)

            region = result[y1:y2, x1:x2].astype(np.float32)
            blended = (face_orig.astype(np.float32) * face_mask3 +
                       region * (1 - face_mask3)).astype(np.uint8)
            result[y1:y2, x1:x2] = blended

        return result

    def blend_video(
        self,
        original_frames: list[np.ndarray],
        animated_frames: list[np.ndarray],
    ) -> list[np.ndarray]:
        from tqdm import tqdm
        n = min(len(original_frames), len(animated_frames))
        out = []
        for orig, anim in tqdm(
            zip(original_frames[:n], animated_frames[:n]),
            total=n,
            desc="Blending",
        ):
            out.append(self.blend_frame(orig, anim))
        return out

    def close(self):
        self._seg.close()
        self._face.close()
