#!/usr/bin/env python3
"""
Convert corpus WAV audio to compressed mono MP3s optimized for speech (48 kbps).
Parallelized across CPU cores.
"""

import os
import sys
import subprocess
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import time

def convert_wav(args):
    src, dst = args
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return True, 0
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    cmd = [
        'ffmpeg', '-y', '-v', 'error',
        '-i', str(src),
        '-c:a', 'libmp3lame',
        '-b:a', '48k',
        '-ac', '1',
        str(dst)
    ]
    res = subprocess.run(cmd)
    if res.returncode == 0:
        return True, os.path.getsize(dst)
    return False, 0

def collect_tasks(src_dir, dst_dir):
    tasks = []
    src_path = Path(src_dir)
    dst_path = Path(dst_dir)
    for root, _, files in os.walk(src_path):
        for f in files:
            if f.endswith('.wav'):
                s = Path(root) / f
                rel = s.relative_to(src_path)
                d = (dst_path / rel).with_suffix('.mp3')
                tasks.append((str(s), str(d)))
    return tasks

def main():
    mappings = [
        ('/Users/julietmcvicker/code/workshop-transcription/data/training/processed/sentence_audio', 'audio_mp3/sentence_audio'),
        ('/Users/julietmcvicker/code/workshop-transcription/data/projects/cherokee_new_testament/split_audio', 'audio_mp3/split_audio'),
        ('data/saving-the-voices/split_audio', 'audio_mp3/stv_audio'),
        ('data/saving-the-voices/turn_audio', 'audio_mp3/stv_turn_audio'),
    ]

    all_tasks = []
    for src, dst in mappings:
        t = collect_tasks(src, dst)
        print(f"Collected {len(t)} tasks from {src} -> {dst}")
        all_tasks.extend(t)

    print(f"Total files to convert: {len(all_tasks)}")
    t0 = time.time()
    total_size = 0
    completed = 0
    workers = min(os.cpu_count() or 4, 12)
    print(f"Starting conversion with {workers} parallel processes...")

    with ProcessPoolExecutor(max_workers=workers) as executor:
        for ok, size in executor.map(convert_wav, all_tasks, chunksize=20):
            if ok:
                completed += 1
                total_size += size
            if completed % 2000 == 0 or completed == len(all_tasks):
                elapsed = time.time() - t0
                rate = completed / elapsed if elapsed > 0 else 0
                print(f"Progress: {completed}/{len(all_tasks)} ({completed/len(all_tasks)*100:.1f}%) in {elapsed:.1f}s ({rate:.1f} files/sec)")

    print(f"Done! Converted {completed} files. Total MP3 size: {total_size / (1024*1024):.1f} MB in {time.time()-t0:.1f}s")

if __name__ == '__main__':
    main()
