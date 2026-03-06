#!/usr/bin/env python3
"""Extract individual sprite frames from Murloc and Isaac sprite sheets."""

import os
import sys
from PIL import Image
import numpy as np

SPRITES_DIR = '/home/thomas/.claude/coding-companion/sprites'


def remove_bg(arr, bg_color, tolerance=30):
    """Replace background-colored pixels with transparent."""
    diff = np.abs(arr[:, :, :3].astype(int) - np.array(bg_color, dtype=int))
    max_diff = np.max(diff, axis=2)
    result = arr.copy()
    result[max_diff < tolerance, 3] = 0
    return result


def trim_to_content(img_arr):
    """Trim transparent padding around sprite content."""
    alpha = img_arr[:, :, 3]
    rows = np.any(alpha > 0, axis=1)
    cols = np.any(alpha > 0, axis=0)
    if not np.any(rows):
        return img_arr
    r_min, r_max = np.argmax(rows), len(rows) - np.argmax(rows[::-1])
    c_min, c_max = np.argmax(cols), len(cols) - np.argmax(cols[::-1])
    return img_arr[r_min:r_max, c_min:c_max]


def find_sprites_in_region(arr, bg_color, min_size=8, tolerance=30):
    """Find individual sprite bounding boxes in a region using connected components."""
    diff = np.abs(arr[:, :, :3].astype(int) - np.array(bg_color, dtype=int))
    max_diff = np.max(diff, axis=2)
    mask = max_diff >= tolerance  # non-background pixels

    # Simple column-based segmentation: find vertical gaps
    col_has_content = np.any(mask, axis=0)

    # Find contiguous horizontal runs
    sprites = []
    in_sprite = False
    start_x = 0
    for x in range(len(col_has_content)):
        if col_has_content[x] and not in_sprite:
            start_x = x
            in_sprite = True
        elif not col_has_content[x] and in_sprite:
            if x - start_x >= min_size:
                # Find vertical bounds in this column range
                region_mask = mask[:, start_x:x]
                row_has = np.any(region_mask, axis=1)
                if np.any(row_has):
                    y_min = np.argmax(row_has)
                    y_max = len(row_has) - np.argmax(row_has[::-1])
                    if y_max - y_min >= min_size:
                        sprites.append((start_x, y_min, x, y_max))
            in_sprite = False
    if in_sprite and len(col_has_content) - start_x >= min_size:
        region_mask = mask[:, start_x:]
        row_has = np.any(region_mask, axis=1)
        if np.any(row_has):
            y_min = np.argmax(row_has)
            y_max = len(row_has) - np.argmax(row_has[::-1])
            if y_max - y_min >= min_size:
                sprites.append((start_x, y_min, len(col_has_content), y_max))

    return sprites


def extract_murloc():
    """Extract SNES variant murloc frames from sheet."""
    sheet_path = os.path.join(SPRITES_DIR, 'murloc', 'sheet.png')
    out_dir = os.path.join(SPRITES_DIR, 'murloc')

    img = Image.open(sheet_path).convert('RGBA')
    arr = np.array(img)
    bg_color = [0, 172, 255]  # Cyan background

    # SNES variant is left column (x < 117). Sheet is 234 wide, split in half.
    left_half = arr[:, :117, :]

    # The sheet has rows: Stand, Walking, Running, Attacking, Swimming, Dancing, etc.
    # Each row is separated by text labels. Let me segment by finding horizontal gaps.

    # Remove text: text pixels are very dark (black). We want to keep sprites but ignore text.
    # Actually, the text rows have very few non-bg pixels spread thinly.
    # Strategy: split into horizontal bands by finding empty rows, then extract per-band.

    diff = np.abs(left_half[:, :, :3].astype(int) - np.array(bg_color, dtype=int))
    max_diff = np.max(diff, axis=2)
    row_content = np.sum(max_diff >= 30, axis=1)

    # Find row bands: group consecutive rows with significant content (> 3 non-bg pixels)
    # This filters out text label rows (which have very thin, scattered pixels)
    bands = []
    in_band = False
    band_start = 0
    for y in range(len(row_content)):
        if row_content[y] > 3 and not in_band:
            band_start = y
            in_band = True
        elif row_content[y] <= 3 and in_band:
            if y - band_start >= 8:  # minimum band height for a sprite
                bands.append((band_start, y))
            in_band = False
    if in_band and len(row_content) - band_start >= 8:
        bands.append((band_start, len(row_content)))

    print(f"Murloc: found {len(bands)} row bands: {bands}")

    # Extract individual frames from each band
    frame_idx = 0
    anim_info = {
        'idle': [], 'walk': [], 'run': [], 'attack': [], 'dance': []
    }
    # Expected order of bands: Stand, Walking, Running, Attacking, Swimming, Dancing, ...
    band_names = ['idle', 'walk', 'run', 'attack', 'swim', 'dance', 'extra1', 'extra2', 'extra3']

    # Delete old frames
    for f in os.listdir(out_dir):
        if f.startswith('murloc_') and f.endswith('.png'):
            os.remove(os.path.join(out_dir, f))

    for band_i, (y_start, y_end) in enumerate(bands):
        band = left_half[y_start:y_end, :, :]
        sprites = find_sprites_in_region(band, bg_color, min_size=5)

        band_name = band_names[band_i] if band_i < len(band_names) else f'extra{band_i}'
        print(f"  Band {band_i} ({band_name}): y={y_start}-{y_end}, {len(sprites)} frames")

        # Skip swim and extras - we only want stand, walk, run, attack, dance
        if band_name in ('swim', 'extra1', 'extra2', 'extra3'):
            continue

        for sx, sy, ex, ey in sprites:
            frame = band[sy:ey, sx:ex, :].copy()
            # Remove background
            frame = remove_bg(frame, bg_color)
            frame = trim_to_content(frame)

            if frame.shape[0] < 10 or frame.shape[1] < 10:
                print(f"    Skipped tiny frame ({frame.shape[1]}x{frame.shape[0]})")
                continue

            result = Image.fromarray(frame)
            filename = f"murloc_{frame_idx}.png"
            result.save(os.path.join(out_dir, filename))
            print(f"    Saved {filename} ({result.size[0]}x{result.size[1]})")
            frame_idx += 1

    print(f"Murloc: extracted {frame_idx} frames total")
    return frame_idx


def extract_isaac():
    """Extract Isaac frames from sheet."""
    sheet_path = os.path.join(SPRITES_DIR, 'isaac', 'sheet.png')
    out_dir = os.path.join(SPRITES_DIR, 'isaac')

    img = Image.open(sheet_path).convert('RGBA')
    arr = np.array(img)

    # Isaac sheet is 132x224 with white/light background
    # Check background color
    bg_sample = arr[0, 0, :3]
    print(f"\nIsaac: sheet {img.size}, bg color: {bg_sample}")

    # The sheet has various Isaac poses scattered around
    # Let me detect the background more carefully
    # Looking at the image: it seems to have a white/light gray background
    # with some colored areas

    # Check if alpha channel has useful info
    alpha_info = np.unique(arr[:, :, 3])
    print(f"Alpha values present: {alpha_info}")

    # Try detecting bg as the most common color
    # For Isaac, the bg appears to be white (255,255,255) or near-white
    bg_color = [255, 255, 255]

    # Alternative: use alpha channel if available
    has_transparency = np.any(arr[:, :, 3] < 255)
    print(f"Has transparency: {has_transparency}")

    if has_transparency:
        # Use alpha to find sprites - non-transparent regions are sprites
        # Find connected sprite regions
        alpha = arr[:, :, 3]
        mask = alpha > 10  # non-transparent
    else:
        # Use color-based detection
        diff = np.abs(arr[:, :, :3].astype(int) - np.array(bg_color, dtype=int))
        max_diff = np.max(diff, axis=2)
        mask = max_diff >= 20

    # Delete old frames
    for f in os.listdir(out_dir):
        if f.startswith('isaac_') and f.endswith('.png'):
            os.remove(os.path.join(out_dir, f))

    # Find horizontal bands of content
    row_content = np.sum(mask, axis=1)
    bands = []
    in_band = False
    band_start = 0
    for y in range(len(row_content)):
        if row_content[y] > 2 and not in_band:
            band_start = y
            in_band = True
        elif row_content[y] <= 2 and in_band:
            if y - band_start >= 6:
                bands.append((band_start, y))
            in_band = False
    if in_band and len(row_content) - band_start >= 6:
        bands.append((band_start, len(row_content)))

    print(f"Isaac: found {len(bands)} row bands: {bands}")

    frame_idx = 0
    for band_i, (y_start, y_end) in enumerate(bands):
        band_mask = mask[y_start:y_end, :]
        band_arr = arr[y_start:y_end, :, :]

        # Find columns with content
        col_content = np.any(band_mask, axis=0)

        # Segment into individual sprites
        sprites = []
        in_sprite = False
        start_x = 0
        for x in range(len(col_content)):
            if col_content[x] and not in_sprite:
                start_x = x
                in_sprite = True
            elif not col_content[x] and in_sprite:
                if x - start_x >= 5:
                    sprites.append((start_x, x))
                in_sprite = False
        if in_sprite and len(col_content) - start_x >= 5:
            sprites.append((start_x, len(col_content)))

        print(f"  Band {band_i}: y={y_start}-{y_end}, {len(sprites)} sprites")

        for sx, ex in sprites:
            frame = band_arr[:, sx:ex, :].copy()

            # If not already transparent, make bg transparent
            if not has_transparency:
                frame = remove_bg(frame, bg_color)

            frame = trim_to_content(frame)
            if frame.shape[0] < 5 or frame.shape[1] < 5:
                continue

            result = Image.fromarray(frame)
            filename = f"isaac_{frame_idx}.png"
            result.save(os.path.join(out_dir, filename))
            print(f"    Saved {filename} ({result.size[0]}x{result.size[1]})")
            frame_idx += 1

    print(f"Isaac: extracted {frame_idx} frames total")
    return frame_idx


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'all'

    if target in ('murloc', 'all'):
        extract_murloc()
    if target in ('isaac', 'all'):
        extract_isaac()
