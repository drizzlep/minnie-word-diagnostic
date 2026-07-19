#!/usr/bin/env python3
"""Create small original mnemonic illustrations for the summer training deck."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "memory"
OUT.mkdir(parents=True, exist_ok=True)
FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

SCENES = {
    "adventure": ("阿德背包去冒险", "ad + venture", "mountain"),
    "direction": ("迪迪用指南针找方向", "di + rec + tion", "compass"),
    "festival": ("节日 fest 里大家一起玩", "fest + i + val", "lanterns"),
    "restaurant": ("餐馆里一桌香喷喷的饭", "rest + aurant", "restaurant"),
    "delicious": ("弟弟说：好吃！delicious", "de + li + cious", "food"),
    "comfortable": ("坐进堡垒一样舒服的沙发", "com + fort + able", "sofa"),
    "classmate": ("class 里的 mate 是同学", "class + mate", "classmate"),
    "building": ("build 建造出的 building", "build + ing", "building"),
    "interesting": ("有趣的故事让人一直听", "in + ter + est + ing", "story"),
    "important": ("重要的事情要打星号", "im + por + tant", "star"),
    "medicine": ("med 药箱里的 medicine", "med + i + cine", "medicine"),
    "dangerous": ("Dan 看到危险标志", "dan + ger + ous", "danger"),
    "telescope": ("用 telescope 看远方", "tele + scope", "telescope"),
    "lighthouse": ("发光的 light house", "light + house", "lighthouse"),
    "masterpiece": ("大师 master 的作品 piece", "master + piece", "masterpiece"),
    "observatory": ("在天文台观察星星", "obser + va + tory", "observatory"),
    "constellation": ("把星星连成星座", "con + stell + ation", "constellation"),
    "encyclopedia": ("百科全书里有很多知识", "en + cyclo + pedia", "book"),
    "supermarket": ("super 超级 market 市场", "super + market", "supermarket"),
    "celebration": ("庆祝 celebration 一起拍手", "cele + bra + tion", "celebration"),
}

COLORS = {"navy": "#173f5f", "yellow": "#ffd166", "cream": "#fff8e7", "coral": "#ef8354", "green": "#70c1b3", "purple": "#8f7cff", "ink": "#203040"}

def font(size, bold=False, text=""):
    try:
        source = FONT if any("\u4e00" <= ch <= "\u9fff" for ch in text) else (BOLD if bold else FONT)
        return ImageFont.truetype(source, size)
    except OSError:
        return ImageFont.load_default()

def txt(draw, xy, text, size, fill=COLORS["ink"], bold=False, anchor=None):
    draw.text(xy, text, font=font(size, bold, text), fill=fill, anchor=anchor)

def base(title, chunks):
    im = Image.new("RGB", (640, 400), COLORS["cream"])
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((18, 18, 622, 382), radius=28, fill="#ffffff", outline="#d9e5e8", width=3)
    txt(d, (40, 38), title, 28, COLORS["navy"], True)
    d.rounded_rectangle((40, 320, 600, 365), radius=15, fill="#edf5f5")
    txt(d, (320, 342), chunks, 23, COLORS["navy"], True, "mm")
    return im, d

def draw_scene(kind, d):
    if kind == "mountain":
        d.polygon([(90, 300), (240, 100), (370, 300)], fill="#70c1b3")
        d.polygon([(250, 300), (430, 70), (590, 300)], fill="#8f7cff")
        d.polygon([(430, 70), (390, 130), (470, 130)], fill="white")
        d.ellipse((170, 185, 215, 230), fill="#ffd166", outline=COLORS["ink"], width=3)
        d.line((192, 230, 192, 275), fill=COLORS["ink"], width=7)
        d.line((192, 245, 165, 260), fill=COLORS["ink"], width=6)
        d.line((192, 245, 220, 255), fill=COLORS["ink"], width=6)
        d.rectangle((170, 225, 214, 270), fill="#ef8354", outline=COLORS["ink"], width=3)
    elif kind == "compass":
        d.ellipse((190, 85, 450, 345), fill="#ffd166", outline=COLORS["navy"], width=8)
        d.ellipse((220, 115, 420, 315), fill="white", outline=COLORS["navy"], width=4)
        d.polygon([(320, 135), (350, 260), (320, 295), (290, 260)], fill="#ef5350")
        d.polygon([(320, 295), (290, 260), (320, 135), (350, 260)], fill="#70c1b3")
        txt(d, (320, 105), "N", 24, COLORS["navy"], True, "mm")
        txt(d, (320, 330), "方向", 22, COLORS["navy"], True, "mm")
    elif kind == "lanterns":
        d.line((100, 80, 540, 80), fill=COLORS["navy"], width=6)
        for x, c in [(150, "#ef8354"), (260, "#ffd166"), (370, "#70c1b3"), (480, "#8f7cff")]:
            d.line((x, 80, x, 115), fill=COLORS["navy"], width=3)
            d.ellipse((x-38, 110, x+38, 210), fill=c, outline=COLORS["navy"], width=3)
            d.line((x-26, 210, x+26, 210), fill=COLORS["navy"], width=4)
            d.line((x, 210, x, 240), fill=COLORS["navy"], width=3)
        txt(d, (320, 280), "festival", 32, COLORS["navy"], True, "mm")
    elif kind in {"restaurant", "food", "supermarket", "medicine", "book"}:
        d.rounded_rectangle((115, 120, 525, 285), radius=24, fill="#ffd166", outline=COLORS["navy"], width=5)
        if kind == "restaurant":
            txt(d, (320, 155), "RESTAURANT", 28, COLORS["navy"], True, "mm")
            d.ellipse((230, 195, 410, 300), fill="#ffffff", outline=COLORS["navy"], width=4)
            d.ellipse((270, 220, 370, 280), fill="#ef8354")
        elif kind == "food":
            d.ellipse((220, 190, 420, 300), fill="#ffffff", outline=COLORS["navy"], width=4)
            d.ellipse((270, 215, 370, 278), fill="#ef8354")
            txt(d, (320, 150), "好吃！", 34, COLORS["navy"], True, "mm")
        elif kind == "supermarket":
            txt(d, (320, 155), "SUPER", 34, COLORS["navy"], True, "mm")
            d.rectangle((220, 200, 420, 270), fill="#70c1b3", outline=COLORS["navy"], width=4)
            d.line((245, 200, 245, 270), fill="white", width=4); d.line((300, 200, 300, 270), fill="white", width=4); d.line((355, 200, 355, 270), fill="white", width=4)
        elif kind == "medicine":
            d.rectangle((265, 180, 375, 300), fill="#ffffff", outline=COLORS["navy"], width=4)
            d.rectangle((300, 200, 340, 280), fill="#ef5350"); d.rectangle((280, 220, 360, 260), fill="#ef5350")
            txt(d, (320, 150), "MED", 34, COLORS["navy"], True, "mm")
        else:
            d.rectangle((235, 150, 405, 290), fill="#ef8354", outline=COLORS["navy"], width=4)
            d.line((320, 150, 320, 290), fill="#ffffff", width=5)
            txt(d, (320, 225), "ABC", 28, "white", True, "mm")
    elif kind == "sofa":
        d.rounded_rectangle((170, 190, 470, 300), radius=25, fill="#8f7cff", outline=COLORS["navy"], width=5)
        d.rounded_rectangle((200, 125, 440, 230), radius=25, fill="#8f7cff", outline=COLORS["navy"], width=5)
        d.ellipse((285, 170, 355, 240), fill="#ffd166", outline=COLORS["navy"], width=4)
        txt(d, (320, 95), "comfortable", 30, COLORS["navy"], True, "mm")
    elif kind == "classmate":
        for x, c in [(245, "#ffd166"), (390, "#ef8354")]:
            d.ellipse((x-35, 125, x+35, 195), fill=c, outline=COLORS["navy"], width=4)
            d.rounded_rectangle((x-55, 190, x+55, 300), radius=25, fill="#70c1b3", outline=COLORS["navy"], width=4)
        d.line((300, 230, 335, 230), fill=COLORS["navy"], width=6)
        txt(d, (320, 95), "class + mate", 30, COLORS["navy"], True, "mm")
    elif kind == "building":
        d.rectangle((210, 95, 430, 300), fill="#70c1b3", outline=COLORS["navy"], width=5)
        for x in [245, 310, 375]:
            for y in [130, 190]: d.rectangle((x, y, x+32, y+32), fill="#ffd166", outline=COLORS["navy"], width=2)
        d.rectangle((300, 245, 340, 300), fill="#ef8354", outline=COLORS["navy"], width=3)
        txt(d, (320, 72), "build + ing", 30, COLORS["navy"], True, "mm")
    elif kind in {"story", "star", "danger", "telescope", "lighthouse", "masterpiece", "observatory", "constellation", "celebration"}:
        # A simple, readable icon keeps the visual cue small and original.
        if kind == "star":
            d.regular_polygon((320, 205, 105), 5, rotation=0, fill="#ffd166", outline=COLORS["navy"])
        elif kind in {"telescope", "observatory"}:
            d.ellipse((260, 120, 390, 220), fill="#8f7cff", outline=COLORS["navy"], width=5); d.line((325, 210, 270, 300), fill=COLORS["navy"], width=7); d.line((325, 210, 380, 300), fill=COLORS["navy"], width=7)
        elif kind in {"lighthouse"}:
            d.polygon([(255, 300), (285, 125), (355, 125), (390, 300)], fill="#ef8354", outline=COLORS["navy"])
            d.rectangle((275, 95, 365, 140), fill="#ffd166", outline=COLORS["navy"], width=4)
            d.line((320, 75, 320, 95), fill=COLORS["navy"], width=5)
        elif kind == "danger":
            d.polygon([(320, 90), (475, 300), (165, 300)], fill="#ffd166", outline="#ef5350")
            txt(d, (320, 220), "!", 100, "#ef5350", True, "mm")
        else:
            d.ellipse((205, 110, 435, 300), fill="#70c1b3", outline=COLORS["navy"], width=5)
            txt(d, (320, 205), "✦", 80, "white", True, "mm")
    else:
        d.ellipse((220, 120, 420, 300), fill="#70c1b3", outline=COLORS["navy"], width=5)

def main():
    for word, (title, chunks, kind) in SCENES.items():
        im, d = base(title, chunks)
        draw_scene(kind, d)
        im.save(OUT / f"{word}.jpg", "JPEG", quality=72, optimize=True, progressive=True)
    print(f"Generated {len(SCENES)} memory images in {OUT}")

if __name__ == "__main__":
    main()
