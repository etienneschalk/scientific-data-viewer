"""Montage of the demo video recorded by record.mjs.

Title card, then the footage with what the recorder logged drawn over it (the
mouse cursor, click ripples, keyboard shortcuts, captions), its camera moves
(zooms on the part that matters) and fast-forwards (waits), then an end card.
Encoded as H.264 MP4 (CRF 26: about 9 MB, under GitHub's upload limit), and an
animated GIF with --gif (--gif-range START END: a highlight; the whole video
makes a GIF of 15 MB or more).

    uv run --no-project --with pillow --with imageio-ffmpeg \\
        python scripts/demo-video/montage.py [--recording DIR] [--out FILE.mp4]
        [--fps 30] [--scale 1.0] [--crf 26] [--gif] [--gif-range 44 64]
        [--sheet] [--stills 12.5 40 ...]

--sheet writes a contact sheet (one frame every 2 s) and --stills full-size
frames at the given output times, both instead of the video: to review the
montage quickly. ffmpeg comes from imageio-ffmpeg, else the PATH.
"""

from __future__ import annotations

import argparse
import bisect
import json
import math
import shutil
import subprocess
import sys
from dataclasses import dataclass
from functools import cache, lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = Path(__file__).resolve().parents[2]
ARTEFACTS = REPO / "artefacts" / "demo-video"
W, H = 1920, 1080

ACCENT = (33, 145, 140)  # viridis teal, the color of the extension icon
ACCENT_LIGHT = (94, 201, 98)  # viridis green
YELLOW = (253, 231, 37)  # viridis yellow
INK = (236, 239, 244)
MUTED = (160, 168, 182)
PANEL = (17, 20, 26)

INTRO_S = 3.6
OUTRO_S = 5.0
CROSSFADE_S = 0.7
FIT_SECONDS = 5.0  # output length of a fast-forward marked 'fit'
MAX_ZOOM = 2.0
CAPTION_MARGIN = 0.16  # bottom part of a zoomed view kept free for the caption

FONT_FILES = {
    "regular": ["/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf", "DejaVuSans.ttf"],
    "medium": ["/usr/share/fonts/truetype/ubuntu/Ubuntu-M.ttf", "DejaVuSans.ttf"],
    "bold": ["/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf", "DejaVuSans-Bold.ttf"],
    "light": ["/usr/share/fonts/truetype/ubuntu/Ubuntu-L.ttf", "DejaVuSans.ttf"],
    "mono": ["/usr/share/fonts/truetype/ubuntu/UbuntuMono-R.ttf", "DejaVuSansMono.ttf"],
}


@cache
def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in FONT_FILES[weight]:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def ease(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return 4 * u**3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2


def clamp01(u: float) -> float:
    return min(1.0, max(0.0, u))


def with_alpha(image: Image.Image, factor: float) -> Image.Image:
    """Copy of an RGBA sprite with its alpha multiplied by `factor`."""
    if factor >= 0.999:
        return image
    out = image.copy()
    out.putalpha(image.getchannel("A").point(lambda v: int(v * factor)))
    return out


def paste(
    base: Image.Image, sprite: Image.Image, x: float, y: float, alpha: float = 1.0
) -> None:
    if alpha <= 0.01:
        return
    sprite = with_alpha(sprite, alpha)
    base.paste(sprite, (round(x), round(y)), sprite)


def rounded_panel(
    width: int, height: int, radius: int, fill, outline=None, scale: int = 3
) -> Image.Image:
    """Antialiased rounded rectangle (drawn larger, then reduced)."""
    big = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, width * scale - 1, height * scale - 1),
        radius=radius * scale,
        fill=fill,
        outline=outline,
        width=scale if outline else 0,
    )
    return big.resize((width, height), Image.LANCZOS)


def shadowed(
    sprite: Image.Image, blur: int = 14, offset=(0, 6), opacity: float = 0.45
) -> tuple[Image.Image, int]:
    """Sprite with a soft drop shadow; returns it and the padding added on each side."""
    pad = blur * 2
    out = Image.new(
        "RGBA", (sprite.width + 2 * pad, sprite.height + 2 * pad), (0, 0, 0, 0)
    )
    shadow = Image.new("RGBA", sprite.size, (0, 0, 0, 255))
    shadow.putalpha(sprite.getchannel("A").point(lambda v: int(v * opacity)))
    out.paste(shadow, (pad + offset[0], pad + offset[1]), shadow)
    out = out.filter(ImageFilter.GaussianBlur(blur))
    out.alpha_composite(sprite, (pad, pad))
    return out, pad


# ---- sprites -------------------------------------------------------------------------


@lru_cache(maxsize=1)
def cursor_sprite() -> tuple[Image.Image, tuple[int, int]]:
    """Arrow cursor; returns the sprite and the position of its tip in it."""
    scale = 4
    unit = 1.75 * scale
    points = [
        (0, 0),
        (0, 17),
        (4.2, 13.2),
        (7.2, 20),
        (10, 18.8),
        (7.1, 12.2),
        (12.4, 12.2),
    ]
    margin = 3 * scale
    size = (int(14 * unit + 2 * margin), int(22 * unit + 2 * margin))
    big = Image.new("RGBA", size, (0, 0, 0, 0))
    poly = [(margin + x * unit, margin + y * unit) for x, y in points]
    draw = ImageDraw.Draw(big)
    draw.polygon(poly, fill=(255, 255, 255, 255))
    draw.line(
        [*poly, poly[0]], fill=(10, 10, 10, 255), width=int(1.3 * scale), joint="curve"
    )
    small = big.resize((size[0] // scale, size[1] // scale), Image.LANCZOS)
    sprite, pad = shadowed(small, blur=4, offset=(2, 3), opacity=0.5)
    return sprite, (pad + margin // scale, pad + margin // scale)


@lru_cache(maxsize=64)
def ripple_sprite(radius: int, alpha: int) -> Image.Image:
    scale = 4
    size = (radius + 6) * 2
    big = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    c = size * scale / 2
    r = radius * scale
    draw = ImageDraw.Draw(big)
    draw.ellipse(
        (c - r, c - r, c + r, c + r),
        fill=(*YELLOW, alpha // 5),
        outline=(*YELLOW, alpha),
        width=3 * scale,
    )
    return big.resize((size, size), Image.LANCZOS)


@lru_cache(maxsize=32)
def keys_sprite(label: str) -> Image.Image:
    """Key caps of a shortcut: 'Ctrl+Shift+P'."""
    keys = label.split("+")
    f = font("medium", 40)
    plus = font("regular", 36)
    caps = []
    for key in keys:
        tw = f.getlength(key)
        w = int(max(64, tw + 44))
        cap = rounded_panel(w, 74, 14, fill=(250, 251, 252, 255))
        inner = Image.new("RGBA", (w, 74), (0, 0, 0, 0))
        ImageDraw.Draw(inner).text(
            (w / 2, 35), key, font=f, fill=(25, 28, 34, 255), anchor="mm"
        )
        base = rounded_panel(w, 80, 14, fill=(150, 156, 168, 255))
        base.alpha_composite(cap, (0, 0))
        base.alpha_composite(inner, (0, 0))
        caps.append(base)
    gap = 44
    width = sum(c.width for c in caps) + gap * (len(caps) - 1) + 48
    panel = rounded_panel(
        width, 128, 26, fill=(*PANEL, 225), outline=(255, 255, 255, 30)
    )
    x = 24
    draw = ImageDraw.Draw(panel)
    for i, cap in enumerate(caps):
        panel.alpha_composite(cap, (x, 24))
        x += cap.width
        if i < len(caps) - 1:
            draw.text(
                (x + gap / 2, 62), "+", font=plus, fill=(*MUTED, 255), anchor="mm"
            )
            x += gap
    return shadowed(panel, blur=16, offset=(0, 8), opacity=0.5)[0]


@lru_cache(maxsize=64)
def caption_sprite(text: str, step: int | None, sub: str | None) -> Image.Image:
    f = font("medium", 38)
    fs = font("regular", 27)
    badge = 60 if step else 0
    text_w = max(f.getlength(text), fs.getlength(sub) if sub else 0)
    width = int(36 + (badge + 24 if step else 0) + text_w + 44)
    height = 122 if sub else 92
    panel = rounded_panel(
        width, height, 22, fill=(*PANEL, 232), outline=(255, 255, 255, 28)
    )
    draw = ImageDraw.Draw(panel)
    x = 32
    if step:
        b = rounded_panel(badge, badge, badge // 2, fill=(*ACCENT, 255))
        ImageDraw.Draw(b).text(
            (badge / 2, badge / 2 + 1),
            str(step),
            font=font("bold", 34),
            fill=(255, 255, 255, 255),
            anchor="mm",
        )
        panel.alpha_composite(b, (x, (height - badge) // 2))
        x += badge + 26
    if sub:
        draw.text((x, 20), text, font=f, fill=(*INK, 255))
        draw.text((x, 70), sub, font=fs, fill=(*MUTED, 255))
    else:
        draw.text((x, height / 2 + 1), text, font=f, fill=(*INK, 255), anchor="lm")
    if not step:
        # Accent bar on the left edge
        bar = rounded_panel(8, height - 36, 4, fill=(*ACCENT_LIGHT, 255))
        panel.alpha_composite(bar, (10, 18))
    return shadowed(panel, blur=18, offset=(0, 8), opacity=0.55)[0]


@lru_cache(maxsize=16)
def speed_sprite(factor: int, label: str | None) -> Image.Image:
    f = font("bold", 36)
    fl = font("regular", 30)
    text = f"\u00d7{factor}"  # multiplication sign
    w = int(
        34
        + 44
        + 14
        + f.getlength(text)
        + (24 + fl.getlength(label) if label else 0)
        + 30
    )
    panel = rounded_panel(w, 76, 38, fill=(*PANEL, 232), outline=(*YELLOW, 120))
    big = Image.new("RGBA", (44 * 4, 40 * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    d.polygon([(0, 0), (22 * 4, 20 * 4), (0, 40 * 4)], fill=(*YELLOW, 255))
    d.polygon([(22 * 4, 0), (44 * 4, 20 * 4), (22 * 4, 40 * 4)], fill=(*YELLOW, 255))
    icon = big.resize((33, 30), Image.LANCZOS)
    panel.alpha_composite(icon, (30, 23))
    draw = ImageDraw.Draw(panel)
    x = 30 + 33 + 16
    draw.text((x, 39), text, font=f, fill=(*YELLOW, 255), anchor="lm")
    if label:
        x += f.getlength(text) + 22
        draw.text((x, 40), label, font=fl, fill=(*INK, 255), anchor="lm")
    return shadowed(panel, blur=14, offset=(0, 6), opacity=0.5)[0]


# ---- title and end cards -----------------------------------------------------------------


def card_background() -> Image.Image:
    """Dark background with soft viridis glows."""
    bg = Image.new("RGB", (W, H), (13, 16, 22))
    glow = Image.new("RGB", (W // 8, H // 8), (13, 16, 22))
    d = ImageDraw.Draw(glow)
    d.ellipse((-40, -50, 110, 80), fill=(30, 52, 78))
    d.ellipse((150, 70, 300, 190), fill=(22, 70, 64))
    d.ellipse((170, -40, 260, 40), fill=(48, 34, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(22)).resize((W, H), Image.BICUBIC)
    return Image.blend(bg, glow, 0.55)


def text_layer(
    lines: list[tuple[str, ImageFont.FreeTypeFont, tuple, float]],
) -> Image.Image:
    """Centered lines: (text, font, color, y)."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for text, f, color, y in lines:
        d.text((W / 2, y), text, font=f, fill=color, anchor="mm")
    return layer


def icon_layer(size: int, center_y: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    disc = rounded_panel(size, size, size // 2, fill=(246, 248, 250, 255))
    icon = (
        Image.open(REPO / "media" / "icon.png")
        .convert("RGBA")
        .resize((int(size * 0.84),) * 2, Image.LANCZOS)
    )
    disc.alpha_composite(icon, ((size - icon.width) // 2, (size - icon.height) // 2))
    disc, pad = shadowed(disc, blur=24, offset=(0, 12), opacity=0.55)
    layer.alpha_composite(
        disc, (W // 2 - size // 2 - pad, int(center_y - size / 2) - pad)
    )
    return layer


def pill_layer(text: str, center_y: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    f = font("mono", 40)
    w = int(f.getlength(text) + 72)
    pill = rounded_panel(
        w, 76, 18, fill=(255, 255, 255, 18), outline=(255, 255, 255, 50)
    )
    ImageDraw.Draw(pill).text(
        (w / 2, 39), text, font=f, fill=(*YELLOW, 255), anchor="mm"
    )
    layer.alpha_composite(pill, (W // 2 - w // 2, int(center_y - 38)))
    return layer


@dataclass
class Card:
    background: Image.Image
    layers: list[tuple[Image.Image, float]]  # (RGBA layer, appear time in s)

    def render(self, t: float) -> Image.Image:
        frame = self.background.copy().convert("RGBA")
        for layer, start in self.layers:
            u = ease(clamp01((t - start) / 0.6))
            if u <= 0:
                continue
            moved = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            moved.alpha_composite(layer, (0, round((1 - u) * 18)) if u < 1 else (0, 0))
            frame.alpha_composite(with_alpha(moved, u))
        return frame.convert("RGB")


def intro_card(version: str) -> Card:
    return Card(
        card_background(),
        [
            (icon_layer(250, 330), 0.15),
            (
                text_layer(
                    [("Scientific Data Viewer", font("bold", 92), (*INK, 255), 560)]
                ),
                0.45,
            ),
            (
                text_layer(
                    [
                        (
                            "NetCDF · HDF5 · Zarr · GRIB · GeoTIFF · CDF, right inside VS Code",
                            font("regular", 42),
                            (*MUTED, 255),
                            650,
                        ),
                    ]
                ),
                0.75,
            ),
            (
                text_layer(
                    [
                        (
                            f"From install to first plot  ·  v{version}",
                            font("medium", 34),
                            (*ACCENT_LIGHT, 255),
                            760,
                        )
                    ]
                ),
                1.05,
            ),
        ],
    )


def outro_card() -> Card:
    return Card(
        card_background(),
        [
            (icon_layer(170, 250), 0.1),
            (
                text_layer(
                    [("Scientific Data Viewer", font("bold", 78), (*INK, 255), 420)]
                ),
                0.25,
            ),
            (
                text_layer(
                    [
                        (
                            "Free on the VS Code Marketplace and Open VSX",
                            font("regular", 40),
                            (*MUTED, 255),
                            505,
                        )
                    ]
                ),
                0.45,
            ),
            (pill_layer("ext install eschalk0.scientific-data-viewer", 625), 0.65),
            (
                text_layer(
                    [
                        (
                            "github.com/etienneschalk/scientific-data-viewer",
                            font("medium", 36),
                            (*ACCENT_LIGHT, 255),
                            760,
                        )
                    ]
                ),
                0.85,
            ),
        ],
    )


# ---- timeline --------------------------------------------------------------------------------


@dataclass
class Segment:
    s0: float  # source time, ms
    s1: float
    rate: float  # source ms per output ms; inf: cut
    label: str | None
    o0: float = 0.0  # output time of s0, ms

    @property
    def out_ms(self) -> float:
        return 0.0 if math.isinf(self.rate) else (self.s1 - self.s0) / self.rate


class Timeline:
    """Source time (recording) <-> output time of the footage."""

    def __init__(self, events: list[dict], start: float, end: float):
        segments = []
        rate, label, s0 = 1.0, None, start
        for e in events:
            if e["type"] not in ("speed", "cut", "uncut"):
                continue
            segments.append(Segment(s0, e["t"], rate, label))
            s0 = e["t"]
            if e["type"] == "speed":
                rate, label = e["factor"], e.get("label")
            elif e["type"] == "cut":
                rate, label = math.inf, None
            else:
                rate, label = 1.0, None
        segments.append(Segment(s0, end, rate, label))
        o = 0.0
        self.segments = []
        for seg in segments:
            if seg.s1 <= seg.s0:
                continue
            if seg.rate == "fit":
                seg.rate = max(1.0, (seg.s1 - seg.s0) / (FIT_SECONDS * 1000))
            seg.o0 = o
            o += seg.out_ms
            self.segments.append(seg)
        self.duration = o

    def source(self, o: float) -> tuple[float, Segment]:
        for seg in self.segments:
            if math.isinf(seg.rate):
                continue
            if o <= seg.o0 + seg.out_ms or seg is self.segments[-1]:
                return seg.s0 + (o - seg.o0) * seg.rate, seg
        last = self.segments[-1]
        return last.s1, last

    def output(self, s: float) -> float:
        for seg in self.segments:
            if s <= seg.s1:
                if math.isinf(seg.rate):
                    return seg.o0
                return seg.o0 + max(0.0, s - seg.s0) / seg.rate
        return self.duration


class Footage:
    def __init__(self, recording: Path):
        self.recording = recording
        frames = [
            json.loads(line)
            for line in (recording / "frames.jsonl").read_text().splitlines()
            if line
        ]
        frames.sort(key=lambda f: f["t"])
        self.frame_times = [f["t"] for f in frames]
        self.frame_files = [f["file"] for f in frames]
        self.events = [
            json.loads(line)
            for line in (recording / "events.jsonl").read_text().splitlines()
            if line
        ]
        self.events.sort(key=lambda e: e["t"])
        start = next(e["t"] for e in self.events if e["type"] == "start")
        end = next(
            (e["t"] for e in self.events if e["type"] == "end"), self.frame_times[-1]
        )
        self.timeline = Timeline(self.events, start, end)
        tl = self.timeline
        self.cursor = [
            (e["t"], e["x"], e["y"]) for e in self.events if e["type"] == "cursor"
        ]
        self.cursor_times = [c[0] for c in self.cursor]
        # Everything else in output time
        self.clicks = [
            (tl.output(e["t"]), e["x"], e["y"])
            for e in self.events
            if e["type"] == "click"
        ]
        self.keys = [
            (tl.output(e["t"]), e["label"]) for e in self.events if e["type"] == "keys"
        ]
        self.captions = [
            (tl.output(e["t"]), e.get("text"), e.get("step"), e.get("sub"))
            for e in self.events
            if e["type"] == "caption"
        ]
        self.zooms = [
            (tl.output(e["t"]), e.get("rect"), e.get("durationMs", 900))
            for e in self.events
            if e["type"] == "zoom"
        ]
        self._cache: tuple[str, Image.Image] | None = None

    def frame(self, s: float) -> Image.Image:
        i = max(0, bisect.bisect_right(self.frame_times, s) - 1)
        name = self.frame_files[i]
        if not self._cache or self._cache[0] != name:
            image = Image.open(self.recording / "frames" / name).convert("RGB")
            if image.size != (W, H):
                image = image.resize((W, H), Image.LANCZOS)
            self._cache = (name, image)
        return self._cache[1]

    def cursor_at(self, s: float) -> tuple[float, float] | None:
        i = bisect.bisect_right(self.cursor_times, s) - 1
        if i < 0:
            return None
        t0, x0, y0 = self.cursor[i]
        if i + 1 < len(self.cursor):
            t1, x1, y1 = self.cursor[i + 1]
            if t1 - t0 < 120:
                u = clamp01((s - t0) / (t1 - t0)) if t1 > t0 else 1
                return x0 + (x1 - x0) * u, y0 + (y1 - y0) * u
        return x0, y0


# ---- camera ------------------------------------------------------------------------------------

FULL = (0.0, 0.0, float(W), float(H))


def fit_rect(rect: dict | None) -> tuple[float, float, float, float]:
    """16:9 view around a rect (room left for the caption at the bottom), inside the frame."""
    if not rect:
        return FULL
    x, y, w, h = rect["x"], rect["y"], rect["width"], rect["height"]
    h = h / (1 - CAPTION_MARGIN)
    cx, cy = x + w / 2, y + h / 2
    if w / h > W / H:
        h = w * H / W
    else:
        w = h * W / H
    w = min(W, max(W / MAX_ZOOM, w))
    h = w * H / W
    x = min(W - w, max(0, cx - w / 2))
    y = min(H - h, max(0, cy - h / 2))
    return x, y, w, h


def camera_at(zooms, o: float) -> tuple[float, float, float, float]:
    view = FULL
    for t, rect, duration in zooms:
        if t > o:
            break
        target = fit_rect(rect)
        u = ease((o - t) / max(1, duration))
        if u >= 1:
            view = target
        else:
            # Center moves linearly, size changes geometrically: a steady zoom
            fx, fy, fw, fh = view
            tx, ty, tw, th = target
            w = math.exp(math.log(fw) + (math.log(tw) - math.log(fw)) * u)
            h = w * H / W
            cx = fx + fw / 2 + (tx + tw / 2 - fx - fw / 2) * u
            cy = fy + fh / 2 + (ty + th / 2 - fy - fh / 2) * u
            view = (
                min(W - w, max(0, cx - w / 2)),
                min(H - h, max(0, cy - h / 2)),
                w,
                h,
            )
            break
    return view


# ---- rendering ---------------------------------------------------------------------------------


def caption_state(captions, o: float):
    """[(sprite, alpha, dy)] of the captions to draw at output time o."""
    i = bisect.bisect_right([c[0] for c in captions], o) - 1
    if i < 0:
        return []
    out = []
    t, text, step, sub = captions[i]
    fade_out = 180.0
    previous = captions[i - 1] if i > 0 else None
    if previous and previous[1] and o - t < fade_out:
        u = 1 - (o - t) / fade_out
        out.append((caption_sprite(previous[1], previous[2], previous[3]), u, 0))
    if text:
        delay = fade_out if previous and previous[1] else 0
        u = ease((o - t - delay) / 320)
        if u > 0:
            out.append((caption_sprite(text, step, sub), u, (1 - u) * 18))
    return out


def render_footage(footage: Footage, o: float) -> Image.Image:
    s, seg = footage.timeline.source(o)
    view = camera_at(footage.zooms, o)
    base = footage.frame(s)
    vx, vy, vw, vh = view
    if view == FULL:
        frame = base.copy()
    else:
        frame = base.resize((W, H), Image.BICUBIC, box=(vx, vy, vx + vw, vy + vh))
    sx, sy = W / vw, H / vh

    def to_screen(x, y):
        return (x - vx) * sx, (y - vy) * sy

    # Click ripples
    for t, x, y in footage.clicks:
        age = o - t
        if 0 <= age < 520:
            u = age / 520
            radius = int(12 + 30 * ease(u))
            sprite = ripple_sprite(radius, int(235 * (1 - u)))
            px, py = to_screen(x, y)
            paste(frame, sprite, px - sprite.width / 2, py - sprite.height / 2)
    # Cursor
    pos = footage.cursor_at(s)
    if pos:
        sprite, tip = cursor_sprite()
        px, py = to_screen(*pos)
        paste(frame, sprite, px - tip[0], py - tip[1])
    # Shortcut keys
    for t, label in footage.keys:
        age = o - t
        if 0 <= age < 1700:
            alpha = min(clamp01(age / 140), clamp01((1700 - age) / 300))
            sprite = keys_sprite(label)
            paste(
                frame,
                sprite,
                W / 2 - sprite.width / 2,
                H * 0.62 + (1 - ease(age / 220)) * 14,
                alpha,
            )
    # Fast-forward badge
    if seg.rate > 1.01 and not math.isinf(seg.rate):
        into, left = o - seg.o0, seg.o0 + seg.out_ms - o
        alpha = min(clamp01(into / 200), clamp01(left / 200))
        sprite = speed_sprite(round(seg.rate), seg.label)
        paste(frame, sprite, W - sprite.width - 30, 70, alpha)
    # Caption
    for sprite, alpha, dy in caption_state(footage.captions, o):
        paste(frame, sprite, 30, H - sprite.height - 34 + dy, alpha)
    return frame


class Montage:
    def __init__(self, recording: Path, fps: int):
        self.fps = fps
        self.footage = Footage(recording)
        meta = (
            json.loads((recording / "meta.json").read_text())
            if (recording / "meta.json").exists()
            else {}
        )
        version = (
            meta.get("extensionVersion")
            or json.loads((REPO / "package.json").read_text())["version"]
        )
        self.intro = intro_card(version)
        self.outro = outro_card()
        self.footage_ms = self.footage.timeline.duration
        # intro | crossfade | footage | crossfade | outro
        self.t_footage = INTRO_S - CROSSFADE_S
        self.t_outro = self.t_footage + self.footage_ms / 1000 - CROSSFADE_S
        self.duration = self.t_outro + OUTRO_S

    def frame_count(self) -> int:
        return int(self.duration * self.fps)

    def render(self, t: float) -> Image.Image:
        """Frame at time t (s) of the video."""
        if t < self.t_footage:
            frame = self.intro.render(t)
        elif t < INTRO_S:
            u = ease((t - self.t_footage) / CROSSFADE_S)
            frame = Image.blend(
                self.intro.render(t),
                render_footage(self.footage, (t - self.t_footage) * 1000),
                u,
            )
        elif t < self.t_outro:
            frame = render_footage(self.footage, (t - self.t_footage) * 1000)
        elif t < self.t_outro + CROSSFADE_S:
            u = ease((t - self.t_outro) / CROSSFADE_S)
            last = render_footage(
                self.footage, min(self.footage_ms, (t - self.t_footage) * 1000)
            )
            frame = Image.blend(last, self.outro.render(t - self.t_outro), u)
        else:
            frame = self.outro.render(t - self.t_outro)
        # Fade in from black, fade out to black
        fade = min(clamp01(t / 0.5), clamp01((self.duration - t) / 0.7))
        if fade < 1:
            frame = Image.blend(Image.new("RGB", (W, H)), frame, fade)
        return frame


# ---- output ------------------------------------------------------------------------------------


def find_ffmpeg() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass
    found = shutil.which("ffmpeg")
    if not found:
        sys.exit(
            "ffmpeg not found: run with `uv run --no-project --with pillow --with imageio-ffmpeg python "
            "scripts/demo-video/montage.py`, or put ffmpeg on the PATH"
        )
    return found


def encode(montage: Montage, out: Path, scale: float, crf: int) -> None:
    size = (round(W * scale / 2) * 2, round(H * scale / 2) * 2)
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        find_ffmpeg(), "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{size[0]}x{size[1]}", "-r", str(montage.fps), "-i", "-",
        "-c:v", "libx264", "-preset", "slow" if scale >= 1 else "veryfast", "-crf", str(crf), "-tune", "stillimage",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out),
    ]  # fmt: skip
    process = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = montage.frame_count()
    for k in range(total):
        frame = montage.render(k / montage.fps)
        if size != (W, H):
            frame = frame.resize(size, Image.LANCZOS)
        process.stdin.write(frame.tobytes())
        if k % (montage.fps * 5) == 0:
            print(f"\r  frame {k}/{total}", end="", flush=True)
    process.stdin.close()
    if process.wait() != 0:
        sys.exit("ffmpeg failed")
    print(
        f"\r  {total} frames, {montage.duration:.1f} s -> {out} ({out.stat().st_size / 1e6:.1f} MB)"
    )


def make_gif(
    mp4: Path,
    gif: Path,
    time_range: list[float] | None,
    width: int = 800,
    fps: int = 10,
) -> None:
    graph = (
        f"fps={fps},scale={width}:-1:flags=lanczos,split[a][b];"
        "[a]palettegen=stats_mode=diff:max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle"
    )
    cut = (
        ["-ss", str(time_range[0]), "-t", str(time_range[1] - time_range[0])]
        if time_range
        else []
    )
    subprocess.run(
        [
            find_ffmpeg(),
            "-y",
            "-loglevel",
            "error",
            *cut,
            "-i",
            str(mp4),
            "-vf",
            graph,
            str(gif),
        ],
        check=True,
    )
    print(f"  GIF -> {gif} ({gif.stat().st_size / 1e6:.1f} MB)")


def contact_sheet(montage: Montage, out: Path, every: float = 2.0) -> None:
    times = [i * every for i in range(int(montage.duration / every) + 1)]
    tw, th, cols = 480, 270, 5
    rows = math.ceil(len(times) / cols)
    sheet = Image.new("RGB", (cols * tw, rows * (th + 30)), (30, 30, 30))
    d = ImageDraw.Draw(sheet)
    for i, t in enumerate(times):
        x, y = (i % cols) * tw, (i // cols) * (th + 30)
        sheet.paste(montage.render(t).resize((tw, th), Image.LANCZOS), (x, y + 30))
        d.text(
            (x + 8, y + 6), f"{t:5.1f} s", font=font("mono", 20), fill=(220, 220, 220)
        )
    sheet.save(out)
    print(f"  contact sheet ({len(times)} frames, {montage.duration:.1f} s) -> {out}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--recording", type=Path, default=ARTEFACTS / "recording")
    parser.add_argument(
        "--out", type=Path, default=ARTEFACTS / "scientific-data-viewer-demo.mp4"
    )
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument(
        "--scale",
        type=float,
        default=1.0,
        help="output size factor (0.5: quick preview)",
    )
    parser.add_argument(
        "--crf",
        type=int,
        default=26,
        help="H.264 quality, lower is better (default 26: under 10 MB, GitHub's limit)",
    )
    parser.add_argument(
        "--gif", action="store_true", help="also write an animated GIF (800 px, 10 fps)"
    )
    parser.add_argument(
        "--gif-range",
        type=float,
        nargs=2,
        metavar=("START", "END"),
        help="only this part of the video in the GIF (s)",
    )
    parser.add_argument(
        "--sheet", action="store_true", help="contact sheet instead of the video"
    )
    parser.add_argument(
        "--stills",
        type=float,
        nargs="*",
        help="full-size frames at these times (s) instead of the video",
    )
    args = parser.parse_args()

    montage = Montage(args.recording, args.fps)
    if args.sheet or args.stills is not None:
        if args.sheet:
            contact_sheet(montage, args.out.with_name("contact-sheet.png"))
        for t in args.stills or []:
            still = args.out.with_name(f"still-{t:06.2f}.png")
            montage.render(t).save(still)
            print(f"  {still}")
        return
    encode(montage, args.out, args.scale, args.crf)
    if args.gif or args.gif_range:
        make_gif(args.out, args.out.with_suffix(".gif"), args.gif_range)


if __name__ == "__main__":
    main()
