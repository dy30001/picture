#!/usr/bin/env python3
"""Generate Venice images through local new-api Responses image generation."""

from __future__ import annotations

import base64
import csv
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote

from PIL import Image, ImageOps


WORKSPACE = Path("/Users/dy3000/code/pic")
API_BASE = os.environ.get("NEWAPI_BASE", "http://127.0.0.1:10000").rstrip("/")
MODEL = os.environ.get("NEWAPI_IMAGE_MODEL", "gpt-5.4")
PROMPT_CSV = WORKSPACE / "planning/07-结构化清单/威尼斯九图提示词.csv"

REFERENCE_IMAGE_PATHS = [
    WORKSPACE / "reference/selected/female/F01_face_side_garden.jpg",
    WORKSPACE / "reference/selected/female/F02_face_front_garden.jpg",
    WORKSPACE / "reference/selected/female/F03_face_front_soft.jpg",
    WORKSPACE / "reference/selected/female/F06_veil_front_studio.jpg",
    WORKSPACE / "reference/selected/male/M01_full_front_garden.jpg",
    WORKSPACE / "reference/selected/male/M04_face_front_frame.jpg",
    WORKSPACE / "reference/selected/male/M06_half_black_suit.jpg",
    WORKSPACE / "reference/selected/male/M08_face_black_bg.jpg",
    WORKSPACE / "reference/selected/couple/C01_white_full_front.jpg",
    WORKSPACE / "reference/selected/couple/C02_white_close_front.jpg",
    WORKSPACE / "reference/selected/couple/C06_white_close_studio.jpg",
    WORKSPACE / "reference/selected/couple/C08_black_bg_close.jpg",
    WORKSPACE / "reference/selected/couple/C09_black_bg_full.jpg",
    WORKSPACE / "generated/90_face_locked_samples/newapi_face_lock_trial_v02_original_refs.png",
]

MALE_LOCK_FIRST_REFERENCE_IMAGE_PATHS = [
    WORKSPACE / "reference/selected/male/M01_full_front_garden.jpg",
    WORKSPACE / "reference/selected/male/M04_face_front_frame.jpg",
    WORKSPACE / "reference/selected/male/M06_half_black_suit.jpg",
    WORKSPACE / "reference/selected/male/M08_face_black_bg.jpg",
    WORKSPACE / "reference/selected/couple/C01_white_full_front.jpg",
    WORKSPACE / "reference/selected/couple/C02_white_close_front.jpg",
    WORKSPACE / "reference/selected/couple/C06_white_close_studio.jpg",
    WORKSPACE / "reference/selected/couple/C08_black_bg_close.jpg",
    WORKSPACE / "reference/selected/couple/C09_black_bg_full.jpg",
    WORKSPACE / "generated/90_face_locked_samples/newapi_face_lock_trial_v02_original_refs.png",
    WORKSPACE / "reference/selected/female/F01_face_side_garden.jpg",
    WORKSPACE / "reference/selected/female/F02_face_front_garden.jpg",
    WORKSPACE / "reference/selected/female/F03_face_front_soft.jpg",
    WORKSPACE / "reference/selected/female/F06_veil_front_studio.jpg",
]

ANCHOR_FIRST_REFERENCE_IMAGE_PATHS = [
    WORKSPACE / "generated/90_face_locked_samples/newapi_face_lock_trial_v04_v02_exact_4k_delivery.png",
    WORKSPACE / "generated/90_face_locked_samples/newapi_face_lock_trial_v04_v02_exact_highres.png",
    WORKSPACE / "generated/90_face_locked_samples/newapi_face_lock_trial_v02_original_refs.png",
    WORKSPACE / "reference/selected/male/M01_full_front_garden.jpg",
    WORKSPACE / "reference/selected/male/M04_face_front_frame.jpg",
    WORKSPACE / "reference/selected/male/M06_half_black_suit.jpg",
    WORKSPACE / "reference/selected/male/M08_face_black_bg.jpg",
    WORKSPACE / "reference/selected/couple/C01_white_full_front.jpg",
    WORKSPACE / "reference/selected/couple/C02_white_close_front.jpg",
    WORKSPACE / "reference/selected/couple/C06_white_close_studio.jpg",
    WORKSPACE / "reference/selected/couple/C08_black_bg_close.jpg",
    WORKSPACE / "reference/selected/couple/C09_black_bg_full.jpg",
    WORKSPACE / "reference/selected/female/F01_face_side_garden.jpg",
    WORKSPACE / "reference/selected/female/F02_face_front_garden.jpg",
    WORKSPACE / "reference/selected/female/F03_face_front_soft.jpg",
    WORKSPACE / "reference/selected/female/F06_veil_front_studio.jpg",
]

SCENE_KEYS = {
    19: "grand_canal_lace_train",
    20: "gondola_vintage_lace",
    21: "stone_bridge_mermaid_close",
    22: "narrow_alley_short_train_walk",
    23: "canal_side_rain_satin",
    24: "arch_bridge_backstory_satin",
    25: "palazzo_burgundy_velvet",
    26: "gondola_satin_mermaid_detail",
    27: "night_canal_blue_satin",
}


def parse_dsn() -> tuple[str, str, str, str, str]:
    text = (WORKSPACE.parent / "newapi/.env.local").read_text(encoding="utf-8")
    dsn = ""
    for line in text.splitlines():
        if line.startswith("SQL_DSN="):
            dsn = line.split("=", 1)[1].strip().strip('"').strip("'")
            break
    match = re.match(r"([^:]+):([^@]+)@tcp\(([^:)]+):(\d+)\)/([^?]+)", dsn)
    if not match:
        raise RuntimeError("Could not parse SQL_DSN from newapi .env.local")
    return match.groups()


def get_newapi_token() -> str:
    user, password, host, port, database = parse_dsn()
    mysql = "/Users/dy3000/code/newapi/.mysql/install/mysql-8.4.8-macos15-arm64/bin/mysql"
    env = os.environ.copy()
    env["MYSQL_PWD"] = unquote(password)
    query = "select `key` from tokens where status=1 and user_id=1 order by id desc limit 1;"
    result = subprocess.check_output(
        [mysql, "-h", host, "-P", port, "-u", user, database, "-N", "-B", "-e", query],
        env=env,
        text=True,
    ).strip()
    if not result:
        raise RuntimeError("No active new-api token found")
    return result


def image_data_url(path: Path, max_edge: int | None = None) -> str:
    if max_edge is None:
        max_edge = int(os.environ.get("NEWAPI_REFERENCE_MAX_EDGE", "1600"))
    image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=85, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def find_image_b64(value: object) -> str | None:
    if isinstance(value, str):
        if len(value) > 1000 and re.fullmatch(r"[A-Za-z0-9+/=\s]+", value[:2000]):
            return value.split(",", 1)[-1].strip()
        return None
    if isinstance(value, list):
        for item in value:
            found = find_image_b64(item)
            if found:
                return found
    if isinstance(value, dict):
        for key in ("result", "image", "b64_json", "data"):
            found = find_image_b64(value.get(key))
            if found:
                return found
        for item in value.values():
            found = find_image_b64(item)
            if found:
                return found
    return None


def stream_response(payload: dict[str, object], token: str) -> str:
    stream_payload = dict(payload)
    stream_payload["stream"] = True
    request = urllib.request.Request(
        f"{API_BASE}/v1/responses",
        data=json.dumps(stream_payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    last_event: object = None
    with urllib.request.urlopen(request, timeout=900) as response:
        for raw_line in response:
            line = raw_line.decode("utf-8", errors="replace").strip()
            if not line or not line.startswith(("event:", "data:")):
                continue
            if line.startswith("data:"):
                data_text = line.split(":", 1)[1].strip()
                if data_text == "[DONE]":
                    break
                try:
                    event = json.loads(data_text)
                except json.JSONDecodeError:
                    continue
                last_event = event
                event_type = str(event.get("type", ""))
                if "image_generation" in event_type:
                    print(f"  {event_type}", file=sys.stderr)
                found = find_image_b64(event)
                if found:
                    return found
    raise RuntimeError(f"No image returned; last_event={json.dumps(last_event, ensure_ascii=False)[:1000]}")


def accepted_identity_prefix() -> str:
    return """Accepted face-lock baseline:
- `newapi_face_lock_trial_v02_original_refs.png` has been accepted by the user as exactly the bride and groom.
- Use the attached original wedding photos as the source-of-truth identity references.
- Use the accepted v02 image only as an additional face-lock anchor.
- Do not use old identity-lock crops or previous rejected generated faces.
- Preserve the same bride and groom as v02 and the original wedding photos.
- Bride hard rule: no glasses, no eyewear, no frame marks.
- Faces should remain recognizable even in destination compositions.

Current repair gate:
- The previous 4K Venice pass was rejected for male face drift, body/proportion drift, and too much oil-painting / overly polished illustration feeling.
- Male likeness is a hard priority: match the original groom references closely, especially the real face shape, eye spacing, eyelid shape, straight natural brows, nose bridge, mouth shape, cheek volume, jaw softness, hairline, and calm natural expression.
- Do not make the groom a generic handsome actor, influencer-template groom, westernized face, rounder face, puffy-cheek face, sharper idol jaw, larger eyes, thicker brows, taller forehead, or different smile.
- Body proportion is a hard priority: keep the real couple's natural height relationship and normal adult proportions. No elongated torso, tiny head, over-long legs, mannequin waist, exaggerated shoulders, or over-slimmed bride.
- Texture is a hard priority: this must look like real high-resolution digital wedding photography, not oil painting, not painterly, not illustration, not CG render, not AI gloss, not plastic skin, not beauty-filter skin.
- Preserve real skin texture, natural pores, normal facial asymmetry, realistic cloth grain, real lens detail, and documentary photographic color.
"""


def final_repair_suffix() -> str:
    return """
Final overriding repair constraints:
- If any instruction conflicts with identity, body proportion, or real-photography texture, follow this final section.
- Groom face must be the same real groom from the original male and couple references. Prioritize the groom over landmark, styling, lighting, drama, and fashion polish.
- The accepted v02 face-lock anchor is the safest current identity target; preserve the groom's face and couple proportions from that anchor unless it conflicts with the original references.
- The high-resolution v02-exact face-lock candidate should be used as the closest visual anchor for face, body proportion, and photographic texture.
- Preserve the groom's real softer lower face, natural cheek volume, straight dark eyebrows, modest natural eye size, original nose/mouth relationship, natural hairline, and calm expression.
- Do not make the groom's eyes larger, brows thicker or more arched, jaw sharper, face slimmer, forehead taller, nose more sculpted, or smile more actor-like.
- Keep both bodies realistic: normal head size, normal neck length, normal shoulder width, normal leg length, no runway-model stretching, no mannequin posture.
- Render as a clean real digital camera photograph: natural lens detail, real skin texture, true fabric texture, realistic canal light, natural color.
- Strictly avoid oil painting, painterly brush feel, illustration, CG render, fantasy lighting, waxy skin, porcelain skin, plastic skin, over-retouching, excessive glow, and AI glamour.
"""


def face_first_repair_prompt(row: dict[str, str]) -> str:
    return f"""Use case: identity-preserve / real destination wedding photography repair
Asset type: high-resolution repair sample

Primary goal:
- Create one Venice wedding photograph, but identity and real-photography texture are more important than scene drama, fashion styling, or landmark variety.
- Use the first attached high-resolution v02-exact anchor as the closest visual target for the bride, groom, couple body proportion, and natural photographic texture.
- Use the original male, bride, and couple photos as source-of-truth references.

Scene:
- Image ID: {row['id']}
- Venice setting: {row['landmark']}
- Orientation: {row['orientation']}
- Composition: a close-to-medium natural wedding photograph on or beside a Venice gondola, with old canal architecture softly behind.
- Keep both faces large, clear, front-to-three-quarter, and easy to compare.
- Keep the gondola/canal as real background context, not an illustrative fantasy scene.

Groom identity hard lock:
- Match the real groom from v02 and original male references.
- Preserve his real face shape, softer lower face, natural cheek volume, modest natural eye size, straight dark eyebrows, original nose-to-mouth relationship, natural lip line, real hairline, and calm expression.
- Do not make him a generic handsome actor, idol groom, westernized face, rounder face, sharper jaw, larger eyes, thicker brows, taller forehead, sculpted nose, or commercial smile.

Bride identity hard lock:
- Match the real bride from v02 and original references.
- No glasses, no eyewear, no frame marks.

Body and proportion:
- Keep the real couple height relationship and normal adult proportions.
- No elongated torso, tiny head, long mannequin neck, over-long legs, runway-model stretching, oversized shoulders, or over-slimmed waist.

Wardrobe:
- Bride wears a refined white satin or lace bridal gown with realistic fabric, not a costume.
- Groom wears a black tuxedo or black suit with natural fit.
- Wardrobe must not override identity or body proportion.

Photography texture:
- Real high-resolution digital wedding photography, natural lens detail, natural skin texture, realistic pores, true fabric grain, restrained color grading.
- Soft natural canal light, not fantasy blue-hour drama.
- Avoid oil painting, painterly brush texture, illustration, CG render, AI glamour, waxy skin, porcelain skin, plastic skin, heavy beauty filter, excessive smoothing, fake studio composite, and exaggerated glow.

Negative constraints:
- No extra people, duplicate bride, duplicate groom, watermark, text, logo, signage gibberish, face-covering veil, distorted hands, fused fingers, broken anatomy, or melted architecture.
"""


def prompt_for(row: dict[str, str]) -> str:
    if os.environ.get("NEWAPI_PROMPT_MODE", "").strip() == "face_first_repair":
        return accepted_identity_prefix() + "\n" + face_first_repair_prompt(row) + "\n" + final_repair_suffix()
    return accepted_identity_prefix() + "\n" + row["prompt"] + "\n" + final_repair_suffix()


def reference_paths() -> list[Path]:
    if os.environ.get("NEWAPI_ANCHOR_FIRST", "").strip() == "1":
        return ANCHOR_FIRST_REFERENCE_IMAGE_PATHS
    if os.environ.get("NEWAPI_MALE_LOCK_FIRST", "").strip() == "1":
        return MALE_LOCK_FIRST_REFERENCE_IMAGE_PATHS
    return REFERENCE_IMAGE_PATHS


def image_size_for(row: dict[str, str]) -> str:
    preset = os.environ.get("NEWAPI_IMAGE_SIZE_PRESET", "review").strip().lower()
    orientation = row["orientation"]
    if preset == "4k":
        return "3840x2160" if orientation == "horizontal" else "2160x3840"
    if preset == "near4k":
        return "3648x2048" if orientation == "horizontal" else "2048x3648"
    if preset == "review":
        return "1536x1024" if orientation == "horizontal" else "1024x1536"
    if "x" in preset:
        return preset
    raise RuntimeError(f"Unsupported NEWAPI_IMAGE_SIZE_PRESET={preset!r}")


def output_path(image_no: int, row: dict[str, str]) -> Path:
    scene_key = SCENE_KEYS[image_no]
    version = os.environ.get("NEWAPI_VENICE_VERSION", "v01")
    return WORKSPACE / row["output_folder"] / f"wedding_{image_no:03d}_venice_{scene_key}_{version}_review.png"


def load_rows() -> list[tuple[int, dict[str, str]]]:
    with PROMPT_CSV.open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    start = int(os.environ.get("NEWAPI_VENICE_START", "20"))
    end = int(os.environ.get("NEWAPI_VENICE_END", "27"))
    return [(index, row) for index, row in enumerate(rows, start=19) if start <= index <= end]


def generate_one(token: str, image_no: int, row: dict[str, str]) -> Path:
    out_path = output_path(image_no, row)
    if out_path.exists():
        print(f"skip existing {out_path.relative_to(WORKSPACE)}")
        return out_path

    prompt = prompt_for(row)
    content: list[dict[str, object]] = [{"type": "input_text", "text": prompt}]
    for path in reference_paths():
        content.append({"type": "input_image", "image_url": image_data_url(path)})

    size = image_size_for(row)
    payload = {
        "model": MODEL,
        "input": [{"role": "user", "content": content}],
        "tools": [{"type": "image_generation", "size": size, "quality": "high", "output_format": "png"}],
    }
    print(f"generate {image_no:03d} {row['id']} size={size}", file=sys.stderr)
    image_b64 = stream_response(payload, token)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(base64.b64decode(image_b64))
    print(out_path.relative_to(WORKSPACE))
    return out_path


def main() -> int:
    token = get_newapi_token()
    generated: list[Path] = []
    for image_no, row in load_rows():
        generated.append(generate_one(token, image_no, row))
    print("generated_or_existing=" + str(len(generated)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
