"""
Body Swap — main entry point.

Usage examples
--------------
# Step 1: download 5 AI-generated target bodies (synthetic, no real people)
python swap.py --download-bodies 5

# Step 2: list available target bodies
python swap.py --list-bodies

# Step 3: run the swap
python swap.py --input input/my_video.mp4 --target-index 0

# Step 4: run without face preservation (full body swap)
python swap.py --input input/my_video.mp4 --target-index 0 --no-face

# Use a specific image as target body instead of the downloaded pool
python swap.py --input input/my_video.mp4 --target-image path/to/image.jpg
"""

import argparse
import os
import sys
import cv2
import numpy as np

import config
from pipeline.video_io import read_video, frames_to_video_ffmpeg
from pipeline.body_generator import BodyImageManager
from pipeline.motion_transfer import MotionTransfer
from pipeline.blending import BodyBlender
from utils.progress import Timer


def parse_args():
    p = argparse.ArgumentParser(description="Video body swap with AI-generated humans")
    p.add_argument("--input", help="Path to source video (your video)")
    p.add_argument("--target-index", type=int, default=None,
                   help="Index of AI-generated body image to use (default: random)")
    p.add_argument("--target-image", help="Path to a specific target body image")
    p.add_argument("--output", default=None, help="Output video path (default: output/<name>_swapped.mp4)")
    p.add_argument("--no-face", action="store_true",
                   help="Do not paste original face back (full body swap)")
    p.add_argument("--no-blend", action="store_true",
                   help="Skip background blending (faster, raw FOMM output)")
    p.add_argument("--download-bodies", type=int, metavar="N",
                   help="Download N AI-generated body images and exit")
    p.add_argument("--list-bodies", action="store_true",
                   help="List available body images and exit")
    p.add_argument("--max-frames", type=int, default=config.MAX_FRAMES,
                   help=f"Max frames to process (default: {config.MAX_FRAMES})")
    return p.parse_args()


def main():
    args = parse_args()
    manager = BodyImageManager()

    # ── Utility commands ──────────────────────────────────────────────────────
    if args.download_bodies:
        manager.download_generated_faces(args.download_bodies)
        print("Done. Run with --list-bodies to see available images.")
        return

    if args.list_bodies:
        imgs = manager.list_available()
        if not imgs:
            print(f"No images found in: {config.GENERATED_BODIES_DIR}")
            print("Run: python swap.py --download-bodies 5")
        else:
            print(f"Available body images ({len(imgs)}):")
            manager.show_gallery()
        return

    # ── Main pipeline ─────────────────────────────────────────────────────────
    if not args.input:
        print("Error: --input is required for body swap.")
        print("Run: python swap.py --help")
        sys.exit(1)

    if not os.path.isfile(args.input):
        print(f"Error: Input video not found: {args.input}")
        sys.exit(1)

    # 1. Load source video
    config.MAX_FRAMES = args.max_frames
    with Timer("Read video"):
        source_frames, meta = read_video(args.input, max_frames=args.max_frames)

    print(
        f"Video: {meta['width']}×{meta['height']} @ {meta['fps']:.1f}fps | "
        f"{len(source_frames)} frames loaded | device={config.DEVICE}"
    )

    # 2. Load target body image
    if args.target_image:
        target = cv2.imread(args.target_image)
        if target is None:
            print(f"Error: Cannot read image: {args.target_image}")
            sys.exit(1)
        target = cv2.resize(target, (config.TARGET_WIDTH, config.TARGET_HEIGHT))
        print(f"Using custom target image: {args.target_image}")
    else:
        target = manager.get_target_image(index=args.target_index)

    # 3. Motion transfer (FOMM)
    mt = MotionTransfer()
    with Timer("Motion transfer"):
        animated_frames = mt.animate(source_frames, target)

    # 4. Blend (optional)
    if not args.no_blend:
        blender = BodyBlender(preserve_face=not args.no_face)
        with Timer("Blending"):
            output_frames = blender.blend_video(source_frames, animated_frames)
        blender.close()
    else:
        output_frames = animated_frames

    # 5. Save output
    base = os.path.splitext(os.path.basename(args.input))[0]
    out_path = args.output or os.path.join(config.OUTPUT_DIR, f"{base}_swapped.mp4")
    with Timer("Write video"):
        frames_to_video_ffmpeg(output_frames, out_path, fps=meta["fps"])

    print(f"\nDone! Output saved to: {out_path}")


if __name__ == "__main__":
    main()
