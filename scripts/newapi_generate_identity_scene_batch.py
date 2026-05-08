#!/usr/bin/env python3
"""Generate accelerated 9-image identity scene batches through local new-api."""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

from newapi_generate_venice_batch import (
    ANCHOR_FIRST_REFERENCE_IMAGE_PATHS,
    MODEL,
    WORKSPACE,
    get_newapi_token,
    image_data_url,
    stream_response,
)


DEFAULT_CONCURRENCY = int(os.environ.get("NEWAPI_IDENTITY_CONCURRENCY", "10"))
SOURCE_ROOT = WORKSPACE / "generated/identity_accelerated"
FINAL_ROOT = WORKSPACE / "final_4k"
CONTACT_ROOT = WORKSPACE / "review/contact_sheets"
REPORT_ROOT = WORKSPACE / "planning" / "06-执行报告"

FEMALE_REFERENCE_IMAGE_PATHS = [
    WORKSPACE / "reference/selected/female/F01_face_side_garden.jpg",
    WORKSPACE / "reference/selected/female/F02_face_front_garden.jpg",
    WORKSPACE / "reference/selected/female/F03_face_front_soft.jpg",
    WORKSPACE / "reference/selected/female/F06_veil_front_studio.jpg",
]

LENS_SEQUENCE = ["35mm", "50mm", "70-200mm", "35mm", "50mm", "70-200mm", "50mm", "35mm", "70-200mm"]
SIZE_SEQUENCE = ["1728x3072", "1728x3072", "1728x3072", "1728x3072", "1728x3072", "1728x3072", "1728x3072", "1728x3072", "3072x1728"]
TARGET_SEQUENCE = [(2160, 3840), (2160, 3840), (2160, 3840), (2160, 3840), (2160, 3840), (2160, 3840), (2160, 3840), (2160, 3840), (3840, 2160)]

SCENES: dict[str, dict[str, Any]] = {
    "wedding": {
        "label": "婚纱照",
        "subject": "一对年轻东亚新人，脸部和身高关系以参考图为准",
        "wardrobe": "高级婚纱、正式西装、真实布料和自然妆造",
        "identity": "couple",
        "backdrops": ["浅色建筑庭院", "海边步道", "花园拱门", "城市街角", "室内窗光", "夜景街区", "东方庭院", "湖边栈道", "目的地大场景"],
        "interactions": ["牵手看向镜头", "边走边笑", "新郎整理头纱", "轻靠肩膀", "交换眼神", "自然拥抱", "并肩站立", "低头整理裙摆", "远景故事感"]
    },
    "friendsWedding": {
        "label": "闺蜜婚纱",
        "subject": "两位或多位年轻东亚女生，亲密朋友关系，不是情侣",
        "wardrobe": "协调但不完全相同的白纱、短纱、缎面礼服或轻婚纱",
        "identity": "uploaded",
        "backdrops": ["奶油色摄影棚", "花园草坪", "海边白沙", "城市露台", "法式街角", "生日派对布景", "窗光室内", "白色建筑走廊", "轻奢夜景"],
        "interactions": ["一起看镜头", "互相整理头纱", "并肩走向镜头", "坐站组合", "举杯轻笑", "手捧花束", "交换眼神", "裙摆动感", "横版合照"]
    },
    "friends": {
        "label": "闺蜜照",
        "subject": "两位或多位年轻东亚女生，朋友关系自然清楚",
        "wardrobe": "同色系日常写真造型、轻礼服、针织、西装或小裙子",
        "identity": "uploaded",
        "backdrops": ["浅灰摄影棚", "春日公园", "城市咖啡店外", "花店门口", "海边步道", "生日聚会空间", "校园林荫路", "复古街角", "夜景天台"],
        "interactions": ["自然靠近微笑", "一人坐一人站", "并肩走路", "互相看一眼", "一起回头", "轻扶肩膀", "分享小蛋糕", "低头聊天", "横版故事感"]
    },
    "travel": {
        "label": "旅游照",
        "subject": "真实东亚人物或情侣，身份以参考图为准",
        "wardrobe": "松弛旅行穿搭、亚麻、风衣、针织、轻便裙装",
        "identity": "couple",
        "backdrops": ["海边栈道", "山间民宿", "老城石板路", "湖边晨光", "咖啡馆外", "博物馆走廊", "雪山木栈道", "雨天街口", "度假酒店露台"],
        "interactions": ["走向镜头", "坐在窗边", "整理帽子", "回头微笑", "看向远处", "低头聊天", "拎包漫步", "靠栏杆休息", "横版旅途收束"]
    },
    "landmark": {
        "label": "地标打卡照",
        "subject": "真实东亚人物或情侣，脸部清楚且人物不被地标吞掉",
        "wardrobe": "利落城市穿搭、风衣、黑裙、白衬衫或新中式",
        "identity": "couple",
        "backdrops": ["现代城市地标", "历史建筑门廊", "桥梁远景", "博物馆外立面", "塔楼广场", "夜景街区", "红墙建筑", "河岸天际线", "地标全景"],
        "interactions": ["站在前景", "自然走过建筑", "回头看镜头", "靠近栏杆", "抬头看建筑", "手拿咖啡", "并肩合影", "穿过广场", "横版纪念照"]
    },
    "child10": {
        "label": "儿童10岁照",
        "subject": "10岁左右东亚儿童，儿童年龄感准确，不成人化",
        "wardrobe": "干净校园风、生日装、针织开衫、背带裤或清爽连衣裙",
        "identity": "uploaded",
        "backdrops": ["明亮生日棚", "书桌窗边", "校园走廊", "操场边", "图书馆窗光", "家庭客厅", "户外草坪", "画室角落", "横版成长合照"],
        "interactions": ["看镜头微笑", "低头看蛋糕", "抱着书", "背书包站立", "坐在窗边", "手拿气球", "自然奔跑", "画画或读书", "横版生日记录"]
    },
    "portrait": {
        "label": "女生写真",
        "subject": "一位二十多岁东亚成年女性，脸部、年龄感和气质以参考图为准",
        "wardrobe": "端庄全身着装的法式胶片、杂志肖像、轻国风或干净日常写真造型，非性感、非私房",
        "identity": "female",
        "backdrops": ["窗边阅读空间", "浅灰摄影棚", "花店门口", "城市咖啡馆外", "米白窗光室内", "东方素色屏风", "春日公园", "复古街角", "横版杂志封面"],
        "interactions": ["自然看向镜头", "坐在窗边侧身", "手捧小束花", "整理耳边头发", "低头微笑", "扶着素色屏风", "走在树影下", "回头看镜头", "横版肖像收束"]
    },
    "senior": {
        "label": "夕阳红",
        "subject": "一对65到75岁左右的东亚长辈夫妻，健康、真实、温和",
        "wardrobe": "质感针织、衬衫、长裙、西裤、旗袍或中式礼服，端庄不过度年轻化",
        "identity": "uploaded",
        "backdrops": ["公园金色晨光", "温暖客厅窗边", "中式园林廊下", "城市河岸步道", "浅色摄影棚", "旅行古城街口", "家庭纪念空间", "旗袍礼服室内", "横版纪念合照"],
        "interactions": ["并肩看向镜头", "自然牵手散步", "坐在窗边微笑", "站在园林廊下", "互相整理衣领", "旅行中并肩停留", "一起看老照片", "端庄站姿合照", "横版家庭纪念感"]
    }
}


BASE_PROMPT = """Use case: identity-preserve / multi-scene photo batch
Asset type: accelerated 4K photo candidate

Output requirement:
- Generate the requested image directly.
- Return a single finished image, not text, advice, prompt notes, collage, watermark, or layout.
- Real high-resolution photography only.

Global quality rules:
- Keep face, body proportion, age, relationship, and wardrobe coherent across the batch.
- Keep every subject fully clothed, tasteful, non-sexual, client-ready, and suitable for a family photo studio catalog.
- Use natural lens detail, real skin texture, realistic fabric, believable shadows, and restrained color grading.
- Avoid AI glamour, over-retouching, porcelain skin, plastic skin, oil painting, illustration, CG render, fantasy glow, duplicate people, deformed hands, watermarks, text, logos, and signage gibberish.
"""


def scene_shots(scene_id: str) -> list[dict[str, Any]]:
    scene = SCENES[scene_id]
    shots = []
    for index, (backdrop, interaction) in enumerate(zip(scene["backdrops"], scene["interactions"]), start=1):
        shots.append({
            "index": index,
            "slug": slugify(f"{scene_id}_{index:02d}_{backdrop}"),
            "title": f"{scene['label']} {index:02d}",
            "lens": LENS_SEQUENCE[index - 1],
            "size": SIZE_SEQUENCE[index - 1],
            "target": TARGET_SEQUENCE[index - 1],
            "prompt": f"""Scene: {scene['label']} / {backdrop}.
Subject: {scene['subject']}.
Wardrobe: {scene['wardrobe']}.
Composition: {LENS_SEQUENCE[index - 1]} real photo, {'horizontal story frame' if index == 9 else 'vertical frame'}, subject faces clear enough for review.
Interaction: {interaction}.
Mood: polished but natural client-ready photo, compact story chapter {index} of 9, visually distinct from the other eight images."""
        })
    return shots


def shot_prompt(scene_id: str, shot: dict[str, Any], outfit: dict[str, str] | None, has_upload_refs: bool) -> str:
    scene = SCENES[scene_id]
    ref_note = "Use the attached reference images as the identity source." if has_upload_refs else default_reference_note(scene)
    outfit_note = ""
    if outfit:
        outfit_note = f"\nSelected outfit from the workbench:\n- {outfit.get('title', '').strip()}\n- {outfit.get('detail', '').strip()}\n- {outfit.get('prompt', '').strip()}\n"
    return f"""{BASE_PROMPT}
Identity and source policy:
- {ref_note}
- If references are present, keep the same person or people, face structure, age, body proportion, and relationship.
- If no reference is available for this scene, create realistic East Asian subjects without copying unrelated people.
{outfit_note}
Shot request:
{shot['prompt']}

Negative:
- No lingerie, swimwear, revealing outfit, boudoir mood, sensual pose, extra or missing main subjects, face swap, adult styling for children, wedding-romance posture for friends, text, watermark, or logo.
"""


def default_reference_note(scene: dict[str, Any]) -> str:
    if scene["identity"] == "couple":
        return "Use the built-in accepted bride and groom baseline references as the identity source."
    if scene["identity"] == "female":
        return "Use the built-in female portrait references only as soft identity anchors."
    return "No uploaded identity references were provided for this scene."


def output_folder(scene_id: str, job_id: str) -> str:
    return f"identity_{scene_id}_{job_id}"


def source_path(scene_id: str, job_id: str, shot: dict[str, Any]) -> Path:
    return SOURCE_ROOT / job_id / scene_id / f"identity_{scene_id}_{shot['index']:02d}_{shot['slug']}_source.png"


def final_path(scene_id: str, job_id: str, shot: dict[str, Any]) -> Path:
    folder = output_folder(scene_id, job_id)
    return FINAL_ROOT / folder / f"identity_{scene_id}_{shot['index']:02d}_{shot['slug']}_4k.png"


def contact_sheet_path(scene_id: str, job_id: str) -> Path:
    return CONTACT_ROOT / f"{output_folder(scene_id, job_id)}_review.jpg"


def report_path(scene_id: str, job_id: str) -> Path:
    report_labels = {
        "wedding": "婚纱照",
        "friendsWedding": "闺蜜婚礼照",
        "friends": "闺蜜照",
        "travel": "旅行人像照",
        "landmark": "地标人像照",
        "child10": "10岁照",
        "portrait": "女生写真",
        "senior": "夕阳红",
    }
    label = report_labels.get(scene_id, scene_id)
    return REPORT_ROOT / f"{label}-{job_id.replace('_', '-')}-执行报告.md"


def reference_paths(scene_id: str, config: dict[str, Any]) -> list[Path]:
    upload_refs = [Path(path) for path in config.get("referenceFiles", {}).get(scene_id, []) if path]
    if upload_refs:
        return upload_refs
    identity = SCENES[scene_id]["identity"]
    if identity == "couple":
        return [path for path in ANCHOR_FIRST_REFERENCE_IMAGE_PATHS if path.exists()]
    if identity == "female":
        return [path for path in FEMALE_REFERENCE_IMAGE_PATHS if path.exists()]
    return []


def has_uploaded_references(scene_id: str, config: dict[str, Any]) -> bool:
    return bool(config.get("referenceFiles", {}).get(scene_id))


def generate_one(token: str, scene_id: str, job_id: str, shot: dict[str, Any], config: dict[str, Any]) -> Path:
    out_path = source_path(scene_id, job_id, shot)
    force = os.environ.get("NEWAPI_IDENTITY_FORCE", "").strip() == "1"
    if out_path.exists() and not force:
        print(f"skip existing {out_path.relative_to(WORKSPACE)}", flush=True)
        return out_path

    outfit = config.get("outfits", {}).get(scene_id)
    refs = reference_paths(scene_id, config)
    content: list[dict[str, object]] = [{
        "type": "input_text",
        "text": shot_prompt(scene_id, shot, outfit, has_uploaded_references(scene_id, config)),
    }]
    max_edge = int(os.environ.get("NEWAPI_REFERENCE_MAX_EDGE", "1500"))
    for path in refs:
        content.append({"type": "input_image", "image_url": image_data_url(path, max_edge=max_edge)})

    payload = {
        "model": MODEL,
        "input": [{"role": "user", "content": content}],
        "tools": [{
            "type": "image_generation",
            "action": "generate",
            "size": shot["size"],
            "quality": "high",
            "output_format": "png",
        }],
    }

    print(f"generate scene={scene_id} shot={shot['index']:02d} lens={shot['lens']} refs={len(refs)}", file=sys.stderr, flush=True)
    image_b64 = stream_response(payload, token)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(base64.b64decode(image_b64))
    print(f"source {out_path.relative_to(WORKSPACE)}", flush=True)
    return out_path


def make_delivery(scene_id: str, job_id: str, shot: dict[str, Any]) -> Path:
    source = source_path(scene_id, job_id, shot)
    image = ImageOps.exif_transpose(Image.open(source)).convert("RGB")
    resized = image.resize(tuple(shot["target"]), Image.Resampling.LANCZOS)
    resized = resized.filter(ImageFilter.UnsharpMask(radius=0.9, percent=45, threshold=3))
    final = final_path(scene_id, job_id, shot)
    final.parent.mkdir(parents=True, exist_ok=True)
    resized.save(final, format="PNG", optimize=True)
    print(f"delivery {final.relative_to(WORKSPACE)} {resized.size}", flush=True)
    return final


def make_contact_sheet(scene_id: str, job_id: str, shots: list[dict[str, Any]], paths: list[Path]) -> None:
    cols, rows = 3, 3
    thumb_w, thumb_h = 300, 360
    label_h, pad = 58, 16
    sheet = Image.new("RGB", (cols * thumb_w + (cols + 1) * pad, rows * (thumb_h + label_h) + (rows + 1) * pad), (248, 246, 241))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
        small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
        small = ImageFont.load_default()

    for index, (shot, path) in enumerate(zip(shots, paths)):
        row, col = divmod(index, cols)
        x = pad + col * (thumb_w + pad)
        y = pad + row * (thumb_h + label_h + pad)
        image = Image.open(path).convert("RGB")
        image.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        bg = Image.new("RGB", (thumb_w, thumb_h), "white")
        bg.paste(image, ((thumb_w - image.width) // 2, (thumb_h - image.height) // 2))
        sheet.paste(bg, (x, y))
        draw.text((x, y + thumb_h + 6), f"{SCENES[scene_id]['label']} {shot['index']:02d} {shot['lens']}", fill=(20, 20, 20), font=font)
        draw.text((x, y + thumb_h + 31), f"{Image.open(path).size[0]}x{Image.open(path).size[1]}", fill=(90, 90, 90), font=small)

    out_path = contact_sheet_path(scene_id, job_id)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, quality=92, optimize=True)
    print(f"contact_sheet {out_path.relative_to(WORKSPACE)}", flush=True)


def write_report(scene_id: str, job_id: str, concurrency: int, shots: list[dict[str, Any]], failed: list[str]) -> None:
    path = report_path(scene_id, job_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# {SCENES[scene_id]['label']}加速生成记录",
        "",
        f"- job_id: `{job_id}`",
        f"- scene: `{scene_id}`",
        f"- concurrency: `{concurrency}`",
        f"- expected: `{len(shots)}`",
        f"- failed: `{len(failed)}`",
        f"- scene_result: `{FINAL_ROOT / output_folder(scene_id, job_id)}`",
        "- delivery_root: `final_4k/`",
        "- legacy_chengpin: `not synced; 成片/ only remains as historical compatibility data`",
        f"- contact_sheet: `{contact_sheet_path(scene_id, job_id)}`",
    ]
    if failed:
        lines.extend(["", "## Failed", *[f"- {item}" for item in failed]])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"report {path.relative_to(WORKSPACE)}", flush=True)


def generate_scenes_global(token: str, scenes: list[str], job_id: str, concurrency: int, config: dict[str, Any]) -> list[str]:
    shots_by_scene = {scene_id: scene_shots(scene_id) for scene_id in scenes}
    failed: dict[str, list[str]] = {scene_id: [] for scene_id in scenes}
    delivery_paths: dict[str, dict[int, Path]] = {scene_id: {} for scene_id in scenes}
    total = sum(len(shots) for shots in shots_by_scene.values())
    print(f"global_queue scenes={len(scenes)} shots={total} workers={concurrency}", flush=True)

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        future_map = {}
        for scene_id, shot in round_robin_scene_tasks(scenes, shots_by_scene):
            future = executor.submit(generate_with_retries, token, scene_id, job_id, shot, config)
            future_map[future] = (scene_id, shot)

        for future in as_completed(future_map):
            scene_id, shot = future_map[future]
            try:
                future.result()
                delivery_paths[scene_id][int(shot["index"])] = make_delivery(scene_id, job_id, shot)
            except Exception as exc:
                failed[scene_id].append(f"{shot['index']:02d} {shot['slug']}: {exc}")
                print(f"failed scene={scene_id} shot={shot['index']:02d} {exc}", file=sys.stderr, flush=True)

    errors: list[str] = []
    for scene_id in scenes:
        shots = shots_by_scene[scene_id]
        paths_for_scene = delivery_paths[scene_id]
        ordered_paths = [
            paths_for_scene[index]
            for index in range(1, len(shots) + 1)
            if index in paths_for_scene
        ]
        if len(ordered_paths) == len(shots):
            make_contact_sheet(scene_id, job_id, shots, ordered_paths)
        write_report(scene_id, job_id, concurrency, shots, failed[scene_id])
        if failed[scene_id]:
            errors.append(f"{scene_id}: failed {len(failed[scene_id])} shots")
    return errors


def round_robin_scene_tasks(scenes: list[str], shots_by_scene: dict[str, list[dict[str, Any]]]) -> list[tuple[str, dict[str, Any]]]:
    max_shots = max((len(shots) for shots in shots_by_scene.values()), default=0)
    tasks: list[tuple[str, dict[str, Any]]] = []
    for shot_index in range(max_shots):
        for scene_id in scenes:
            shots = shots_by_scene.get(scene_id, [])
            if shot_index < len(shots):
                tasks.append((scene_id, shots[shot_index]))
    return tasks


def generate_with_retries(token: str, scene_id: str, job_id: str, shot: dict[str, Any], config: dict[str, Any]) -> Path:
    last_error: Exception | None = None
    for attempt in range(1, 6):
        try:
            return generate_one(token, scene_id, job_id, shot, config)
        except Exception as exc:
            last_error = exc
            print(f"retryable_error scene={scene_id} shot={shot['index']:02d} attempt={attempt} {exc}", file=sys.stderr, flush=True)
            if attempt < 5:
                time.sleep(6 * attempt)
    if last_error:
        raise last_error
    raise RuntimeError("unknown generation failure")


def read_config(path: Path | None, args: argparse.Namespace) -> dict[str, Any]:
    if path:
        return json.loads(path.read_text(encoding="utf-8"))
    scenes = args.scenes or ["wedding"]
    if args.all_scenes:
        scenes = list(SCENES)
    return {
        "jobId": args.job_id or time.strftime("%Y%m%d%H%M%S"),
        "scenes": scenes,
        "outfits": {},
        "referenceFiles": {},
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path)
    parser.add_argument("--scene", dest="scenes", action="append", choices=sorted(SCENES))
    parser.add_argument("--all-scenes", action="store_true")
    parser.add_argument("--job-id")
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    return parser.parse_args(argv)


def slugify(value: str) -> str:
    text = value.lower()
    keep = []
    for char in text:
        if char.isascii() and char.isalnum():
            keep.append(char)
        elif char in {"_", "-"}:
            keep.append("_")
    slug = "".join(keep).strip("_")
    return slug or "shot"


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    config = read_config(args.config, args)
    scenes = [scene for scene in config.get("scenes", []) if scene in SCENES]
    if not scenes:
        raise RuntimeError("No valid scenes selected")
    job_id = str(config.get("jobId") or time.strftime("%Y%m%d%H%M%S"))
    concurrency = max(1, int(config.get("concurrency") or args.concurrency or DEFAULT_CONCURRENCY))
    token = get_newapi_token()
    print(f"job {job_id} scenes={','.join(scenes)} concurrency={concurrency}", flush=True)
    errors = generate_scenes_global(token, scenes, job_id, concurrency, config)
    if errors:
        for error in errors:
            print(error, file=sys.stderr, flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
