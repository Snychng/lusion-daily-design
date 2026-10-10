#!/usr/bin/env python3
"""Mirror only the public resources referenced by Lusion's published site.

Run from the case directory: python3 scripts/download.py
Original bytes remain in reference/. Sources, SHA-256 and HTTP publication
metadata are recorded in 分析/20261010-live/asset-manifest.json.
No login, private endpoints, analytics or form submissions are used.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import argparse, html, json, re, struct, urllib.request, urllib.parse, time

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / 'reference'
ANALYSIS = ROOT / '分析/20261010-live'
MANIFEST = ANALYSIS / 'asset-manifest.json'
ORIGIN = 'https://lusion.co'
CDN = 'https://lusion.dev'
records = {}
if MANIFEST.exists():
    records = {r['path']: r for r in json.loads(MANIFEST.read_text())['assets']}

def disk_path(path):
    path = urllib.parse.urlsplit(path).path
    if path.endswith('/') or '.' not in path.rsplit('/', 1)[-1]:
        path = path.rstrip('/') + '/index.html'
    return REF / path.lstrip('/')

def fetch(path):
    path = '/' + path.lstrip('/')
    dest = disk_path(path)
    if path in records and records[path].get('status') == 200 and dest.exists():
        return path, dest
    origin = CDN if path.startswith('/assets/') else ORIGIN
    url = origin + path
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 public-reference-archive'})
            with urllib.request.urlopen(req, timeout=120) as response:
                data = response.read()
                headers = dict(response.headers)
                ctype = response.headers.get('Content-Type', '')
                # A CDN fallback HTML page is not a valid binary resource.
                if path.startswith('/assets/') and 'text/html' in ctype:
                    raise ValueError('Asset returned HTML instead of the referenced binary type')
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
                records[path] = {
                    'path': path, 'url': url, 'resolved_url': response.url,
                    'file': str(dest.relative_to(ROOT)), 'bytes': len(data),
                    'sha256': sha256(data).hexdigest(), 'status': response.status,
                    'content_type': ctype, 'etag': headers.get('ETag'),
                    'last_modified': headers.get('Last-Modified'),
                    'downloaded_at': datetime.now(timezone.utc).isoformat(),
                }
                return path, dest
        except Exception as exc:
            if attempt < 2:
                time.sleep(attempt + 1)
            else:
                records[path] = {'path': path, 'url': url, 'file': str(dest.relative_to(ROOT)), 'status': 'failed', 'error': str(exc)}
                print('FAILED', path, str(exc), flush=True)
    return path, None

def save():
    ANALYSIS.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({
        'source': ORIGIN + '/', 'runtime_cdn': CDN,
        'observation_date': '2026-10-10',
        'published_release': {'javascript': '/_astro/hoisted.CUO_IjfL.js', 'css': '/_astro/about.CNa9RfUh.css', 'three_revision': '158'},
        'command': 'python3 scripts/download.py',
        'scope': 'Public homepage, About, project index and project-detail runtime dependencies; no remote analytics, newsletter requests or Vimeo embed stream extraction.',
        'assets': sorted(records.values(), key=lambda x: x['path']),
    }, ensure_ascii=False, indent=2) + '\n')

def batch(paths):
    paths = sorted(set(paths))
    print('Fetching', len(paths), 'referenced paths', flush=True)
    result = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for i, future in enumerate(as_completed([pool.submit(fetch, p) for p in paths]), 1):
            result.append(future.result())
            if i % 20 == 0 or i == len(paths):
                print('Completed', i, '/', len(paths), flush=True)
                save()
    save()
    return result

def text_resources(text):
    out = set()
    for raw in re.findall(r'(?:src|href|content)=["\']([^"\']+)["\']|url\(["\']?([^\)"\']+)', text):
        value = html.unescape(next((x for x in raw if x), ''))
        if value.startswith('./assets/'):
            value = value[1:]
        if value.startswith(ORIGIN):
            value = value[len(ORIGIN):]
        if value.startswith(('/assets/', '/_astro/')):
            out.add(value)
    # Detail image and video slots intentionally omit their file extension.
    for match in re.finditer(r'<[^>]+data-file(?:name|-name)=["\']([^"\']+)["\'][^>]*>', text):
        tag, name = match.group(0), html.unescape(match.group(1))
        if name.startswith('/assets/'):
            is_video = 'is-video' in tag
            ext = '.mp4' if is_video else '.webp'
            out.add(name + ext)
            # ProjectDetailsItem branches by mobile UA, independently of viewport width.
            mobile_name = name.replace('/video', '/mobile_video') if is_video else name.replace('/image', '/mobile_image')
            out.add(mobile_name + ext)
    return out

def runtime_resources(js):
    out = set()
    roots = {'MODEL': '/assets/models/', 'TEXTURE': '/assets/textures/', 'TEAM': '/assets/team/'}
    for kind, suffix in re.findall(r'settings\.(MODEL|TEXTURE|TEAM)_PATH\+"([^"\n]+)"', js):
        if re.search(r'\.(buf|webp|png|jpg|json|exr)$', suffix):
            out.add(roots[kind] + suffix.lstrip('/'))
    for lod in ['', '_ld']:
        out.add('/assets/models/home/cross' + lod + '.buf')
        out.add('/assets/textures/home/matcap' + lod + '.exr')
    for name in re.findall(r'fileName:"(line_[^"]+)"', js):
        out.add('/assets/models/lines/' + name + '.buf')
    for lod in ['ld', 'hd']:
        for kind in ['structure', 'base']:
            out.add(f'/assets/models/tunnels/grid_{kind}_{lod}.buf')
    for channel in ['arm', 'base', 'nor']:
        out.add(f'/assets/textures/tunnels/grids/greeble_{channel}.webp')
        for part in ['helmet', 'glove_shoes', 'wearpack']:
            out.add(f'/assets/textures/tunnels/astronaut/astronaut_{part}_{channel}.webp')
    for part in ['helmet', 'helmet_glass', 'glove_shoes', 'wearpack']:
        out.add(f'/assets/models/tunnels/astronaut_{part}.buf')
    for level in ['l', 'm', 's', 'xs']:
        out.add(f'/assets/models/about/sphere_{level}.buf')
    for i in range(4):
        for suffix in ['', '_low']:
            out.add(f'/assets/models/about/rock_{i}{suffix}.buf')
        out.add(f'/assets/models/about/rock_animation_{i}.buf')
    for device in ['desktop', 'mobile']:
        out.add(f'/assets/textures/reel/{device}.mp4')
    for name in ['stickers.png', 'stickers_low.png']:
        out.add('/assets/textures/tunnels/' + name)
    audio = js[js.index('AUDIO_DATA='):js.index(';class AudioGroup')]
    for name in re.findall(r'id:"([^"]+)"', audio):
        count = re.fullmatch(r'(.+)_\[(\d+)\]', name)
        ids = [f'{count[1]}_{i}' for i in range(int(count[2]))] if count else [name]
        out.update('/assets/audios/' + n + '.ogg' for n in ids)
    return out

def audit():
    """Offline integrity check and readable .buf schema inventory."""
    failures, schemas = [], []
    for record in records.values():
        path = ROOT / record['file']
        if record.get('status') != 200 or not path.exists():
            failures.append({'path': record['path'], 'error': 'not downloaded'})
            continue
        data = path.read_bytes()
        if len(data) != record['bytes'] or sha256(data).hexdigest() != record['sha256']:
            failures.append({'path': record['path'], 'error': 'original-byte fingerprint mismatch'})
        if path.suffix == '.buf':
            size = struct.unpack('<I', data[:4])[0]
            header = json.loads(data[4:4+size])
            widths = {'Float32Array': 4, 'Int32Array': 4, 'Uint32Array': 4, 'Uint16Array': 2, 'Int16Array': 2, 'Uint8Array': 1, 'Int8Array': 1}
            offset = 4 + size
            for attr in header['attributes']:
                count = header['indexCount'] if attr['id'] == 'indices' else header['vertexCount']
                width = widths[attr['storageType']]
                if offset % width:
                    failures.append({'path': record['path'], 'error': 'unaligned typed-array offset', 'attribute': attr['id']})
                offset += count * attr['componentSize'] * width
            if offset != len(data):
                failures.append({'path': record['path'], 'error': 'geometry payload length mismatch', 'expected': offset, 'actual': len(data)})
            schemas.append({'file': record['file'], 'bytes': len(data), 'header': header})
    report = {'checked_at': datetime.now(timezone.utc).isoformat(), 'files_checked': len(records), 'bytes': sum(r.get('bytes', 0) for r in records.values()), 'geometry_files': len(schemas), 'failures': failures}
    source = ANALYSIS/'source'
    source.mkdir(parents=True, exist_ok=True)
    (source/'geometry-schemas.json').write_text(json.dumps(schemas, ensure_ascii=False, indent=2) + '\n')
    (source/'asset-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False), flush=True)
    if failures:
        raise SystemExit(1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--extra', nargs='*', default=[], help='Additional paths actually observed in browser network requests')
    parser.add_argument('--audit', action='store_true', help='Verify the complete mirror offline; never contacts the network')
    args = parser.parse_args()
    if args.audit:
        audit()
        return
    if args.extra:
        batch(args.extra)
        return
    batch(['/', '/about', '/projects', '/_astro/hoisted.CUO_IjfL.js', '/_astro/about.CNa9RfUh.css'])
    html_paths = [REF/'index.html', REF/'about/index.html', REF/'projects/index.html']
    pages = '\n'.join(p.read_text() for p in html_paths)
    project_paths = set(re.findall(r'href="(/projects/[^"?#]+)"', pages))
    batch(project_paths)
    html_paths += [disk_path(p) for p in sorted(project_paths) if disk_path(p).exists()]
    paths = set()
    for p in html_paths + [REF/'_astro/about.CNa9RfUh.css']:
        paths.update(text_resources(p.read_text()))
    js = (REF/'_astro/hoisted.CUO_IjfL.js').read_text()
    paths.update(runtime_resources(js))
    for project in project_paths:
        name = project.rsplit('/', 1)[-1]
        for resource in ['home.webp', 'home_depth.webp']:
            paths.add(f'/assets/projects/{name}/{resource}')
    batch(paths)
    # The web app manifest references its icons relative to its own URL.
    webmanifest = REF/'assets/meta/site.webmanifest'
    if webmanifest.exists():
        icons = json.loads(webmanifest.read_text()).get('icons', [])
        batch(urllib.parse.urljoin('/assets/meta/site.webmanifest', icon['src']) for icon in icons)
    team_path = REF/'assets/team/team.json'
    if team_path.exists():
        team = json.loads(team_path.read_text())
        batch('/assets/team/' + person['id'] + '.buf' for person in team)
    success = [x for x in records.values() if x.get('status') == 200]
    failed = [x for x in records.values() if x.get('status') != 200]
    print(json.dumps({'downloaded_files': len(success), 'bytes': sum(x['bytes'] for x in success), 'failed': len(failed)}), flush=True)
    audit()

if __name__ == '__main__':
    main()
