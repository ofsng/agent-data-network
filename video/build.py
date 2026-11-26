"""Assembles the Turkish explainer from record.ts output.

Speeds up the live-run segment, places each narration clip at its scene start on the
new timeline, burns in Turkish subtitles and encodes an MP4.
Usage: python3 video/build.py <tts dir> <output.mp4>
"""
import json
import re
import subprocess
import sys
from pathlib import Path

d = Path(sys.argv[1])
out = sys.argv[2]
here = Path(__file__).resolve().parent
marks = json.loads((d / "timeline.json").read_text())
dur = json.loads((d / "durations.json").read_text())
texts = {n["id"]: n["text"] for n in json.loads((here / "narration.json").read_text())}

rs, re_, end = marks["runStart"], marks["runEnd"], marks["end"]
fast = dur["c02"] + 2.5                       # length of the sped-up run on screen
factor = (re_ - rs) / fast


def remap(t):
    if t <= rs:
        return t
    if t <= re_:
        return rs + (t - rs) / factor
    return rs + fast + (t - re_)


starts = {k: remap(v) for k, v in marks.items() if k in dur}
starts["c02"] = rs + 1.0
total = remap(end)


def ts(t):
    h, rem = divmod(max(t, 0), 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def chunks(text, limit=80):
    """Sentence-sized subtitle lines, split further at commas when too long."""
    out = []
    for sent in re.split(r"(?<=[.!?:])\s+", text):
        while len(sent) > limit:
            cut = sent.rfind(", ", 0, limit)
            cut = cut + 1 if cut > 20 else sent.rfind(" ", 0, limit)
            out.append(sent[:cut].strip())
            sent = sent[cut:].strip()
        if sent:
            out.append(sent)
    return out


events = []
for k, start in sorted(starts.items(), key=lambda x: x[1]):
    parts = chunks(texts[k])
    weights = [len(p) + 8 for p in parts]
    t = start
    for p, w in zip(parts, weights):
        span = dur[k] * w / sum(weights)
        events.append(f"Dialogue: 0,{ts(t)},{ts(t + span)},Sub,,0,0,0,,{p}")
        t += span

(d / "subs.ass").write_text("""[Script Info]
ScriptType: v4.00+
PlayResX: 1440
PlayResY: 900
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,DejaVu Sans,28,&H00FFFFFF,&H00FFFFFF,&HB4000000,&HB4000000,0,0,0,0,100,100,0,0,3,10,0,2,120,120,58,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(events) + "\n", encoding="utf-8")

font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
label = f"x{round(factor)} hızlandırıldı"
vf = (
    f"[0:v]trim=0:{rs},setpts=PTS-STARTPTS[a];"
    f"[0:v]trim={rs}:{re_},setpts=(PTS-STARTPTS)/{factor},"
    f"drawtext=fontfile={font}:text='{label}':x=w-tw-40:y=118:fontsize=24:fontcolor=0x3ddc97:box=1:boxcolor=0x0a0e13@0.85:boxborderw=10[b];"
    f"[0:v]trim={re_}:{end},setpts=PTS-STARTPTS[c];"
    f"[a][b][c]concat=n=3:v=1:a=0,fps=30,subtitles={d / 'subs.ass'}[v]"
)
ids = sorted(starts, key=lambda k: starts[k])
inputs, af = [], []
for i, k in enumerate(ids, start=1):
    inputs += ["-i", str(d / f"{k}.mp3")]
    ms = int(starts[k] * 1000)
    af.append(f"[{i}:a]adelay={ms}|{ms},aresample=48000[s{i}]")
af.append("".join(f"[s{i}]" for i in range(1, len(ids) + 1)) + f"amix=inputs={len(ids)}:normalize=0,apad,atrim=0:{total}[aout]")
cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(d / "raw.webm"), *inputs,
       "-filter_complex", vf + ";" + ";".join(af), "-map", "[v]", "-map", "[aout]",
       "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-t", f"{total:.2f}", out]
subprocess.run(cmd, check=True)
print(f"{out}: {total:.1f}s, run segment x{factor:.1f}")
