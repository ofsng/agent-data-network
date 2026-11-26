"""Builds the Turkish narrated explainer from the HD visuals.

For each entry in video-anlatim.json: Turkish TTS (edge-tts, tr-TR-EmelNeural), a slow
zoom over the 3840x2160 image, fade in/out; then concatenates and burns in subtitles.
Usage: python3 PROJE-REHBERI/kaynak/video.py <edge-tts binary> <work dir>
Output: PROJE-REHBERI/video/adn-proje-anlatimi-tr.mp4 (1920x1080, 30 fps)
"""
import json
import re
import subprocess
import sys
import time
from pathlib import Path

TTS, WORK = sys.argv[1], Path(sys.argv[2])
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / "video" / "adn-proje-anlatimi-tr.mp4"
WORK.mkdir(parents=True, exist_ok=True)
slides = json.loads((HERE / "video-anlatim.json").read_text())
PRE, POST, FPS = 0.6, 0.9, 30


def run(*a):
    subprocess.run(a, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]).decode())


def ts(t):
    h, r = divmod(t, 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def chunks(text, limit=74):
    out = []
    for sent in re.split(r"(?<=[.!?:])\s+", text):
        while len(sent) > limit:
            cut = sent.rfind(", ", 0, limit)
            cut = cut + 1 if cut > 25 else sent.rfind(" ", 0, limit)
            out.append(sent[:cut].strip())
            sent = sent[cut:].strip()
        if sent:
            out.append(sent)
    return out


events, clips, t0 = [], [], 0.0
for i, s in enumerate(slides):
    mp3 = WORK / f"s{i:02d}.mp3"
    if not mp3.exists() or mp3.stat().st_size < 2000:
        for attempt in range(8):  # the free TTS endpoint refuses some requests (403); retry
            try:
                run(TTS, "--voice", "tr-TR-EmelNeural", "--rate=+4%", "--text", s["text"], "--write-media", str(mp3))
                break
            except subprocess.CalledProcessError:
                mp3.unlink(missing_ok=True)
                time.sleep(4 + attempt * 3)
        else:
            raise SystemExit(f"TTS failed for slide {i + 1}")
    a = dur(mp3)
    d = PRE + a + POST
    n = int(d * FPS)
    clip = WORK / f"c{i:02d}.mp4"
    zoom = f"zoompan=z='1+0.05*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s=1920x1080:fps={FPS}"
    run("ffmpeg", "-y", "-loop", "1", "-i", str(ROOT / "gorseller" / s["img"]), "-i", str(mp3),
        "-filter_complex", f"[0:v]{zoom},fade=t=in:st=0:d=0.35,fade=t=out:st={d - 0.35:.2f}:d=0.35,format=yuv420p[v];[1:a]adelay={int(PRE * 1000)}|{int(PRE * 1000)},apad[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{d:.2f}", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", str(clip))
    parts = chunks(s["text"])
    total = sum(len(p) for p in parts)
    t = t0 + PRE
    for p in parts:
        span = a * len(p) / total
        events.append((t, t + span, p))
        t += span
    clips.append(clip)
    t0 += d
    print(f"slide {i + 1}/{len(slides)} {d:.1f}s", flush=True)

lst = WORK / "list.txt"
lst.write_text("".join(f"file '{c}'\n" for c in clips))
joined = WORK / "joined.mp4"
run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(joined))

ass = WORK / "sub.ass"
head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Lato,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&HB4000000,0,0,0,0,100,100,0,0,3,14,0,2,160,160,46,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ass.write_text(head + "".join(f"Dialogue: 0,{ts(a)},{ts(b)},Default,,0,0,0,,{p}\n" for a, b, p in events), encoding="utf-8")
OUT.parent.mkdir(parents=True, exist_ok=True)
run("ffmpeg", "-y", "-i", str(joined), "-vf", f"subtitles={ass}", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-c:a", "copy", "-movflags", "+faststart", str(OUT))
(ROOT / "video" / "adn-proje-anlatimi-tr.srt").write_text(
    "".join(f"{k + 1}\n{ts(a).replace('.', ',')}0 --> {ts(b).replace('.', ',')}0\n{p}\n\n" for k, (a, b, p) in enumerate(events)), encoding="utf-8")
print(f"done {OUT} {t0:.1f}s")
