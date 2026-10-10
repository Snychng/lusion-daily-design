/**
 * Rebuild Daily Design .Art's content media without changing the reference files.
 * Run: node scripts/build-brand-media.mjs
 * Dependency: sharp (local, SHARP_MODULE, or the existing ActiveTheory workspace install),
 * plus ffprobe / ffmpeg for metadata and a complete decode check of copied videos.
 * This script copies existing recordings. It does not start a browser or record anything.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const workspace = path.resolve(root, '../..');
const formal = path.resolve(workspace, '../daily-design');
const reference = path.join(root, 'reference');
const output = path.join(root, 'brand-assets/media');
const require = createRequire(import.meta.url);
let sharp;
for (const candidate of [process.env.SHARP_MODULE, 'sharp', path.join(workspace, '原型/Daily-Design-ActiveTheory/node_modules/sharp')].filter(Boolean)) {
  try { sharp = require(candidate); break; } catch { /* Try an existing workspace dependency. */ }
}
if (!sharp) throw new Error('sharp is required. Install it locally or provide SHARP_MODULE; no files have been changed.');

const prototype = (file) => path.join(workspace, '原型', file);
const generated = (file) => prototype(`Daily-Design-ActiveTheory/public/assets/daily/${file}`);
const sources = {
  gallery: { path: path.join(formal, 'public/images/iridescent-gallery.png'), kind: 'existing-webpage-screenshot', note: 'Actual Gallery webpage; visible artwork and toolbar are part of the experiment.' },
  orbit: { path: path.join(formal, 'public/images/chromatic-orbit.png'), kind: 'existing-webpage-screenshot', note: 'Actual Orbit webpage, including the captured optical stretch.' },
  narrative: { path: prototype('Daily-Design-ActiveTheory/分析/20260930-original-motion/daily-home-ready.png'), kind: 'existing-webpage-screenshot', note: 'Existing Interactive Narrative webpage with a real brand D mesh; not a Lusion verification frame.' },
  structure: { path: prototype('建筑切片/分析/six-view-verification-20260920/desktop-oblique.png'), kind: 'existing-webpage-screenshot', note: 'Actual Spatial Layers experiment. LAYER ATLAS remains the experiment title inside the screenshot.' },
  ocean: { path: prototype('海平面之下/分析/github-public-20260924/browser-functional/02-half.png'), kind: 'existing-webpage-screenshot', note: 'Actual FFT ocean webpage; OCEAN is the experiment title inside the screenshot.' },
  blackhole: { path: prototype('黑洞/分析/运行验证/2026-09-23T07-02-35-582Z/wide-t4.png'), kind: 'existing-webpage-screenshot', note: 'Actual black-hole experiment. Its small astronaut is an existing generated original asset with no mission logo; historical image model is not verified.' },
  paper: { path: prototype('纸笺来信/分析/2108109442101182633/verification/final-desktop.jpg'), kind: 'existing-webpage-screenshot', note: 'Actual Paper Narrative webpage with personal design-note text. No new recording is implied.' },
  vinyl: { path: prototype('黑胶唱片/分析/x-2102252070984413540/recordings/2026-09-23T11-58-20-059Z/qa/landscape-1.5s.png'), kind: 'existing-webpage-recording-frame', note: 'Frame at 1.5s of the actual local vinyl webpage recording; a reference-led 2.5D experiment, not a recovered original 3D production.' },
  light: { path: generated('study-light-studies.jpg'), kind: 'existing-generated-concept-cover' },
  optic: { path: generated('study-optic-type.jpg'), kind: 'existing-generated-concept-cover' },
  gesture: { path: generated('study-gesture-studies.jpg'), kind: 'existing-generated-concept-cover' },
  slingshot: { path: generated('study-glass-slingshot.jpg'), kind: 'existing-generated-concept-cover', note: 'Existing concept illustration. No retained screenshot/recording of the Glass Slingshot webpage was found.' },
  material: { path: generated('study-material-lab.jpg'), kind: 'existing-generated-concept-cover' },
  spatial: { path: generated('study-spatial-notes.jpg'), kind: 'existing-generated-concept-cover' },
  liquid: { path: generated('study-liquid-feedback.jpg'), kind: 'existing-generated-concept-cover' },
  afterimage: { path: generated('study-afterimage.jpg'), kind: 'existing-generated-concept-cover' },
  color: { path: generated('cover-gallery.jpg'), kind: 'existing-generated-concept-cover' },
};
const recordings = {
  gallery: { path: path.join(formal, 'public/previews/iridescent-gallery.mp4'), title: 'Gallery', provenance: path.join(formal, 'README.md') },
  orbit: { path: path.join(formal, 'public/previews/chromatic-orbit.mp4'), title: 'Orbit', provenance: path.join(formal, 'README.md') },
  structure: { path: prototype('建筑切片/分析/demo-front-left-top-20260920/建筑切片-正左上-纯作品.mp4'), title: 'Spatial Layers', provenance: prototype('建筑切片/README.md') },
  vinyl: { path: prototype('黑胶唱片/分析/x-2102252070984413540/recordings/2026-09-23T11-58-20-059Z/vinyl-landscape-1920x1080.mp4'), title: 'Sound Forms', provenance: prototype('黑胶唱片/README.md') },
};
const projectSpecs = [
  ['oryzo_ai', 'Gallery', 'gallery', 'gallery', true],
  ['atlas_motion', 'Orbit', 'orbit', 'orbit', true],
  ['devin_ai', 'Interactive Narrative', 'narrative', 'gallery', false],
  ['of_the_oak', 'Spatial Layers', 'structure', 'structure', true],
  ['everswap', 'Ocean Interface', 'ocean', 'orbit', false],
  ['porsche_dream_machine', 'Light Studies', 'light', 'orbit', false],
  ['synthetic_human', 'Optic Type', 'optic', 'gallery', false],
  ['ddd_2024', 'Gesture Studies', 'gesture', 'orbit', false],
  ['spaace', 'Focus Field', 'blackhole', 'orbit', false],
  ['choo_choo_world', 'Glass Slingshot', 'slingshot', 'orbit', false],
  ['zero_tech', 'Material Lab', 'material', 'gallery', false],
  ['spatial_fusion', 'Spatial Notes', 'spatial', 'structure', false],
  ['worldcoin', 'Motion Loop', 'orbit', 'orbit', false],
  ['lusion_labs', 'Interface Studies', 'gallery', 'gallery', false],
  ['my_little_story_book', 'Paper Narrative', 'paper', 'gallery', false],
  ['soda_experience', 'Liquid Feedback', 'liquid', 'orbit', false],
  ['infinite_passerella', 'Afterimage', 'afterimage', 'gallery', false],
  ['the_turn_of_the_screw', 'Sound Forms', 'vinyl', 'vinyl', true],
  ['maxmara_bearings_gifts', 'Color Studies', 'color', 'gallery', false],
];
const projectSources = Object.fromEntries(projectSpecs.map(([slug, title, image, video, exactMotion]) => [slug, {
  title, imageSourceKey: image, videoSourceKey: video,
  category: ['worldcoin', 'lusion_labs'].includes(slug) || sources[image].kind === 'existing-generated-concept-cover' ? 'concept-study' : 'existing-webpage-experiment',
  imageKind: sources[image].kind,
  videoUse: exactMotion ? 'recording-of-the-displayed-experiment' : 'existing-motion-reference',
  motionReferenceTitle: recordings[video].title,
  requiredVideoCaption: exactMotion ? `${title} — existing webpage recording` : `Concept study · existing motion reference: ${recordings[video].title}`,
}]));
const generationProvenance = {
  status: 'Reused existing assets; no image generation performed in this task.',
  manifest: prototype('ActiveTheory/分析/20260930-daily-design-proposals/generation-manifest.json'),
  recordedModel: 'gpt-image-2.5-sunburst', recordedChannel: 'lj-awb',
  recordedModelGroupCode: 'GPT2_5_Sunburst_ImageCreate_Group',
  boundary: 'Historical third-party generation record; not recorded or presented as native generation. Some derived study covers share this asset family rather than an individually verified generation receipt.',
};
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');
const posix = (file) => file.split(path.sep).join('/');
const webPath = (file) => `/${posix(path.relative(root, file))}`;
const existing = async (file) => { try { await fs.access(file); return true; } catch { return false; } };
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.sort((a, b) => a.name.localeCompare(b.name)).map((item) => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]))).flat();
}
const fileCache = new Map();
async function fileInfo(file) {
  if (!fileCache.has(file)) fileCache.set(file, fs.readFile(file).then((buffer) => ({ path: file, relativeToWorkspace: posix(path.relative(workspace, file)), bytes: buffer.length, sha256: sha(buffer) })));
  return fileCache.get(file);
}
function probeVideo(file) {
  const metadata = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,nb_frames:format=duration,size', '-of', 'json', file], { encoding: 'utf8' }));
  const stream = metadata.streams[0];
  if (!stream) throw new Error(`Missing video stream: ${file}`);
  return { ...stream, durationSeconds: Number(metadata.format.duration), bytes: Number(metadata.format.size) };
}
async function write(file, bytes) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes); }
const outputs = new Map();
const replacements = {};
const originalURLs = {};
const entries = [];
async function addEntry(originalPath, target, attributes) {
  const originalFile = path.join(reference, originalPath);
  const original = await fileInfo(originalFile);
  const targetFile = path.join(root, target);
  const result = await fileInfo(targetFile);
  if (original.sha256 === result.sha256) throw new Error(`Original commercial asset was not replaced: ${originalPath}`);
  replacements[originalPath] = target;
  originalURLs[`https://lusion.co${originalPath}`] = target;
  originalURLs[`https://lusion.dev${originalPath}`] = target;
  entries.push({ originalPath, originalURL: `https://lusion.co${originalPath}`, originalCDNURL: `https://lusion.dev${originalPath}`, original: { bytes: original.bytes, sha256: original.sha256 }, targetURL: target, output: { bytes: result.bytes, sha256: result.sha256 }, ...attributes });
}

// Validate all sources before creating deliverables.
for (const source of [...Object.values(sources), ...Object.values(recordings)]) if (!await existing(source.path)) throw new Error(`Missing existing source: ${source.path}`);
const slugs = (await fs.readdir(path.join(reference, 'assets/projects'), { withFileTypes: true })).filter((item) => item.isDirectory()).map((item) => item.name).sort();
if (JSON.stringify(slugs) !== JSON.stringify(Object.keys(projectSources).sort())) throw new Error('Project inventory changed; update the 19-project source mapping.');

for (const [key, source] of Object.entries(sources)) {
  Object.assign(source, await fileInfo(source.path));
  const metadata = await sharp(source.path).metadata();
  source.width = metadata.width; source.height = metadata.height;
  if (source.kind === 'existing-generated-concept-cover') source.generation = generationProvenance;
}
for (const [key, recording] of Object.entries(recordings)) {
  const target = path.join(output, 'recordings', `${key}.mp4`);
  const metadata = probeVideo(recording.path);
  execFileSync('ffmpeg', ['-v', 'error', '-i', recording.path, '-map', '0:v:0', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  await write(target, await fs.readFile(recording.path));
  Object.assign(recording, await fileInfo(recording.path), { metadata, targetURL: webPath(target), transform: 'byte-for-byte copy; no re-encoding, retiming, cropping, or new recording', fullDecodeCheck: 'passed' });
}
const fit = { fit: 'contain', position: 'centre', background: { r: 8, g: 11, b: 18, alpha: 1 } };
async function imageOutput(sourceKey, width, height, depth = false) {
  const key = `${sourceKey}-${width}x${height}${depth ? '-luminance-depth' : ''}`;
  if (!outputs.has(key)) {
    const target = path.join(output, 'images', `${key}.webp`);
    let pipeline = sharp(sources[sourceKey].path).rotate().resize(width, height, fit).flatten({ background: '#080b12' }).removeAlpha().toColourspace('srgb');
    if (depth) {
      const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
      const linear = (value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      const gray = Buffer.alloc(info.width * info.height);
      for (let i = 0; i < gray.length; i++) {
        const j = i * info.channels;
        gray[i] = Math.round(255 * (0.2126 * linear(data[j]) + 0.7152 * linear(data[j + 1]) + 0.0722 * linear(data[j + 2])));
      }
      pipeline = sharp(gray, { raw: { width: info.width, height: info.height, channels: 1 } }).blur(2);
    }
    await write(target, await pipeline.webp({ quality: depth ? 100 : 92, effort: 4, ...(depth ? { lossless: true } : {}) }).toBuffer());
    outputs.set(key, webPath(target));
  }
  return outputs.get(key);
}

const projectFiles = await walk(path.join(reference, 'assets/projects'));
for (const originalFile of projectFiles) {
  const originalPath = `/${posix(path.relative(reference, originalFile))}`;
  const slug = originalPath.split('/')[3];
  const spec = projectSources[slug];
  const extension = path.extname(originalFile).toLowerCase();
  if (extension === '.mp4') {
    await addEntry(originalPath, recordings[spec.videoSourceKey].targetURL, { scope: 'project', project: slug, title: spec.title, kind: 'video', sourceKey: spec.videoSourceKey, source: recordings[spec.videoSourceKey].path, videoUse: spec.videoUse, requiredCaption: spec.requiredVideoCaption, originalMetadata: probeVideo(originalFile), targetMetadata: recordings[spec.videoSourceKey].metadata, transform: 'Original slot/container is preserved by the content adapter; media file is an unchanged existing recording. Source aspect and duration may differ.' });
  } else if (extension === '.webp') {
    const metadata = await sharp(originalFile).metadata();
    const depth = path.basename(originalFile).includes('_depth');
    const target = await imageOutput(spec.imageSourceKey, metadata.width, metadata.height, depth);
    await addEntry(originalPath, target, { scope: 'project', project: slug, title: spec.title, kind: depth ? 'luminance-depth-proxy' : 'image', sourceKey: spec.imageSourceKey, source: sources[spec.imageSourceKey].path, sourceKind: sources[spec.imageSourceKey].kind, dimensions: { width: metadata.width, height: metadata.height }, transform: depth ? 'Same contain transform as the matching image; sRGB linear relative luminance Y = 0.2126 R + 0.7152 G + 0.0722 B; 2px blur; lossless WebP. A content-derived parallax proxy, not measured geometric depth.' : 'Aspect-preserving contain into the original exact pixel dimensions with #080b12 letterbox; no interface redrawing or generative edits.' });
  } else throw new Error(`Unexpected project asset extension: ${originalFile}`);
}

const reel = { desktop: recordings.gallery.targetURL, mobile: recordings.orbit.targetURL };
for (const layout of ['desktop', 'mobile']) await addEntry(`/assets/textures/reel/${layout}.mp4`, reel[layout], { scope: 'reel', kind: 'video', sourceKey: layout === 'desktop' ? 'gallery' : 'orbit', source: recordings[layout === 'desktop' ? 'gallery' : 'orbit'].path, videoUse: 'existing-motion-reference', requiredCaption: `Existing webpage recording: ${layout === 'desktop' ? 'Gallery' : 'Orbit'}`, transform: 'Byte-for-byte existing preview; runtime keeps the original video surface and its responsive aspect/crop behavior.' });

const labels = ['UI', 'UX', 'MOTION', 'SHADER', 'GLASS', 'TYPE', 'COLOR', 'SPACE', 'FLOW', 'FOCUS', 'GRID', 'DEPTH', 'LIGHT', 'CURVE', 'CODE'];
const logoFiles = (await walk(path.join(reference, 'assets/images/logo'))).filter((file) => file.endsWith('.svg'));
if (logoFiles.length > labels.length) throw new Error('More original logos than original research labels.');
for (const [i, file] of logoFiles.entries()) {
  const original = await fs.readFile(file, 'utf8');
  const viewBox = original.match(/viewBox="([^"]+)"/)?.[1] || '0 0 240 240';
  const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
  const fontSize = Math.min(height * 0.17, width / (labels[i].length * 0.8));
  const target = path.join(output, 'labels', `${labels[i].toLowerCase()}.svg`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" role="img" aria-label="${labels[i]} research"><title>${labels[i]} research</title><text x="${x + width / 2}" y="${y + height / 2}" fill="#fff" font-family="monospace" font-size="${fontSize}" font-weight="500" letter-spacing="${fontSize * 0.12}" text-anchor="middle" dominant-baseline="middle">${labels[i]}</text></svg>\n`;
  await write(target, svg);
  await addEntry(`/${posix(path.relative(reference, file))}`, webPath(target), { scope: 'research-label', kind: 'svg', title: labels[i], sourceKind: 'original-typesetting', transform: 'New plain research-word typography, same SVG viewBox, no commercial logo shape retained.' });
}
for (const filename of ['bodoni-moda-italic.ttf', 'OFL.txt']) await write(path.join(output, 'fonts', filename), await fs.readFile(path.join(formal, 'public/fonts', filename)));
await write(path.join(output, 'gallery.webp'), await sharp(sources.gallery.path).webp({ quality: 92 }).toBuffer());
await write(path.join(output, 'favicon.svg'), await fs.readFile(path.join(formal, 'public/favicon.svg')));

// data-filename is intentionally kept separate from replacements: the runtime appends
// .webp/.mp4 and sometimes mobile_, so replacing an extensionless stem with a URL
// containing an extension would break loading. The build may overlay original paths.
const filenameSlots = [];
const htmlFiles = (await walk(reference)).filter((file) => file.endsWith('.html'));
for (const file of htmlFiles) {
  const html = await fs.readFile(file, 'utf8');
  for (const tag of html.matchAll(/<[^>]*\bdata-filename="([^"]+)"[^>]*>/g)) {
    const base = tag[1];
    const type = tag[0].match(/data-type="([^"]+)"/)?.[1] || 'unknown';
    const stem = path.posix.basename(base);
    const dir = path.posix.dirname(base);
    const variants = entries.filter((entry) => path.posix.dirname(entry.originalPath) === dir && [stem, `mobile_${stem}`].includes(path.posix.basename(entry.originalPath, path.posix.extname(entry.originalPath))));
    const expected = `${base}.${type === 'video' ? 'mp4' : 'webp'}`;
    if (!replacements[expected]) throw new Error(`Unmapped data-filename primary media: ${expected}`);
    filenameSlots.push({ page: `/${posix(path.relative(reference, file))}`, originalStem: base, dataType: type, expectedPrimary: expected, targetPrimary: replacements[expected], variants: variants.map(({ originalPath, targetURL, kind }) => ({ originalPath, targetURL, kind })) });
  }
}
const runtimeFile = (await walk(path.join(reference, '_astro'))).find((file) => file.endsWith('.js') && fsSync.statSync(file).size > 1e6);
const runtime = await fs.readFile(runtimeFile, 'utf8');
const teamFiles = await walk(path.join(reference, 'assets/team'));
const runtimeAudit = {
  runtime: posix(path.relative(root, runtimeFile)),
  runtimeSha256: (await fileInfo(runtimeFile)).sha256,
  reel: { original: ['settings.TEXTURE_PATH + "reel/desktop.mp4"', 'settings.TEXTURE_PATH + "reel/mobile.mp4"'], mapped: reel },
  thumb: { observation: 'HomeReelSection uses the same VideoTexture as reel for the thumbnail-to-screen transition. No separately referenced thumbnail bitmap was found.', independentMediaFiles: [] },
  office: { observation: 'The current runtime contains line_office.buf as a geometric line element, but no office photo/video path. The line is a mechanism asset, not commercial media content.', mediaFiles: [], geometry: '/assets/models/lines/line_office.buf' },
  team: { observation: 'TEAM_PATH loads team.json and seven .buf point-cloud models. These are identity data / geometry and require the separate brand model/data adapter; they are not image/video files and are not modified by this media script.', files: teamFiles.map((file) => `/${posix(path.relative(reference, file))}`), handledBy: 'separate brand geometry and team-content adapter', remainingForParent: true },
  fullScreenVideos: { '761102167': 'Main reel', '783015830': 'Original Porsche external Vimeo link' },
  scanChecks: { hasReelDesktop: runtime.includes('reel/desktop.mp4'), hasReelMobile: runtime.includes('reel/mobile.mp4'), hasSharedThumb: runtime.includes('u_domXYFrom:this.ufxMeshThumb'), hasTeamJSON: runtime.includes('team.json'), hasOfficeLine: runtime.includes('line_office') },
};
const videos = { '761102167': reel.desktop, '783015830': recordings.orbit.targetURL };
for (const [id, target] of Object.entries(videos)) originalURLs[`https://player.vimeo.com/video/${id}`] = target;

const counts = {
  projects: slugs.length,
  projectFiles: projectFiles.length,
  projectImages: entries.filter((item) => item.scope === 'project' && item.kind === 'image').length,
  projectDepthProxies: entries.filter((item) => item.kind === 'luminance-depth-proxy').length,
  projectVideos: entries.filter((item) => item.scope === 'project' && item.kind === 'video').length,
  reelVideos: 2,
  researchLabelSVGs: logoFiles.length,
  canonicalReplacements: Object.keys(replacements).length,
  fullOriginalURLReplacements: Object.keys(originalURLs).length,
  filenameSlots: filenameSlots.length,
  uniqueImageSources: Object.keys(sources).length,
  uniqueImageSourceFingerprints: new Set(Object.values(sources).map((source) => source.sha256)).size,
  existingWebpageImageSources: Object.values(sources).filter((item) => item.kind.startsWith('existing-webpage')).length,
  existingGeneratedConceptSources: Object.values(sources).filter((item) => item.kind === 'existing-generated-concept-cover').length,
  uniqueExistingGeneratedConceptFingerprints: new Set(Object.values(sources).filter((item) => item.kind === 'existing-generated-concept-cover').map((source) => source.sha256)).size,
  uniqueGeneratedImageOutputs: outputs.size,
  uniqueCopiedRecordings: Object.keys(recordings).length,
  sourceRecordingsFullyDecoded: Object.keys(recordings).length,
  staticVideoFallbacks: 0,
  unmappedProjectFiles: projectFiles.length - entries.filter((item) => item.scope === 'project').length,
};
const boundaries = [
  'All 19 original project slugs are content slots for personal experiments or explicitly labeled concept studies; no commercial clients, production credits or business outcomes are claimed.',
  'Images are existing website screenshots or existing generated concept covers. Only contain resizing/letterbox and grayscale depth computation are performed; no new image generation or fabricated UI.',
  'The 17 image source paths have 13 unique content fingerprints: eight webpage captures and five historical concept-cover families. Several study slots intentionally reuse a cover family, rather than claiming 19 distinct executable projects.',
  '19 home depth maps are recomputed relative-luminance proxies aligned to each replacement screenshot/cover. They keep the depth-texture contract, but they do not recover the source scene geometry or reproduce the original depth silhouette.',
  'Copied videos are existing actual webpage recordings. Most concept slots deliberately reuse a Gallery/Orbit motion reference; projectSources.requiredVideoCaption distinguishes them from recordings of the shown study. The original source aspect ratio/duration can differ from the reference commercial video.',
  'This media task does not implement or validate Lusion WebGL effects; screenshots and videos remain content planes, never a replacement for realtime 3D, fluid or particle mechanisms.',
  'No Dispersion screenshot containing old AI-product copy, Star Ring photography, or restricted PixCodec scene content is included.',
  'Team identity point clouds and team.json are outside image/video handling and must be covered by the separate brand geometry/data adapter.',
];
const manifest = { schemaVersion: 1, generator: 'scripts/build-brand-media.mjs', generatedAt: new Date().toISOString(), sourceReference: 'https://lusion.co/', counts, imageTransform: fit, depthTransform: 'sRGB relative luminance, blur sigma 2; non-geometric parallax proxy', sources, recordings, generationProvenance, projectSources, runtimeAudit, boundaries, entries };
const mapping = { schemaVersion: 1, replacements, originalURLs, reel, videos, projectSources, filenameSlots, audit: '/brand-assets/media/media-audit.json', counts };

// A clearly labeled review sheet, not user-facing project media.
const cellWidth = 400, cellHeight = 263, columns = 4;
const reviewCells = [];
for (const [index, [slug, title, sourceKey]] of projectSpecs.entries()) {
  const left = (index % columns) * cellWidth, top = Math.floor(index / columns) * cellHeight;
  const frame = await sharp(sources[sourceKey].path).resize(cellWidth, 225, fit).webp().toBuffer();
  reviewCells.push({ input: frame, left, top });
  const escaped = title.replaceAll('&', '&amp;');
  const label = Buffer.from(`<svg width="400" height="38" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="38" fill="#171b24"/><text x="10" y="16" fill="#fff" font-family="sans-serif" font-size="13">${index + 1}. ${escaped}</text><text x="10" y="31" fill="#bdc5d4" font-family="sans-serif" font-size="10">${sources[sourceKey].kind}</text></svg>`);
  reviewCells.push({ input: label, left, top: top + 225 });
}
await write(path.join(output, 'source-review.webp'), await sharp({ create: { width: columns * cellWidth, height: Math.ceil(projectSpecs.length / columns) * cellHeight, channels: 3, background: '#080b12' } }).composite(reviewCells).webp({ quality: 92 }).toBuffer());
await write(path.join(output, 'media-audit.json'), JSON.stringify(manifest, null, 2) + '\n');
await write(path.join(root, 'brand-content/media-map.json'), JSON.stringify(mapping, null, 2) + '\n');

const missingTargets = [];
for (const target of new Set(Object.values(replacements))) if (!await existing(path.join(root, target))) missingTargets.push(target);
if (missingTargets.length || counts.unmappedProjectFiles) throw new Error(`Media validation failed: ${JSON.stringify({ missingTargets, counts })}`);
console.log(JSON.stringify({ result: 'passed', ...counts, mediaMap: 'brand-content/media-map.json', audit: 'brand-assets/media/media-audit.json', sourceReview: 'brand-assets/media/source-review.webp' }, null, 2));
