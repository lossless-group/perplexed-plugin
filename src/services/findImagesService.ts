import type { App, Editor, TFile } from 'obsidian';
import { Notice, parseYaml, request } from 'obsidian';

export interface FindImagesSettings {
    perplexityApiKey: string;
    perplexityEndpoint: string;
    maxImages: number;
}

interface PerplexityImage {
    image_url?: string;
    origin_url?: string;
}

interface PerplexityResponse {
    choices?: { message?: { content?: string } }[];
    images?: PerplexityImage[];
}

function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function readFrontmatter(content: string): Record<string, unknown> {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    if (lines[0] !== '---') return {};
    let i = 1;
    while (i < lines.length && lines[i] !== '---') i++;
    if (i >= lines.length) return {};
    const yaml = lines.slice(1, i).join('\n');
    try {
        const parsed: unknown = parseYaml(yaml);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // ignore
    }
    return {};
}

function splitParagraphs(text: string): string[] {
    return text
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
}

interface ImagePlacement {
    paragraphIndex: number;
    description: string;
    imageNumber: number;
}

function parsePlacementMarkers(text: string): ImagePlacement[] {
    const re = /\[AFTER\s+(\d+)\]\s*\[IMAGE\s+(\d+):\s*([^\]]+)\]/gi;
    const out: ImagePlacement[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const para = parseInt(m[1] ?? '', 10);
        const num = parseInt(m[2] ?? '', 10);
        const desc = (m[3] ?? '').trim();
        if (!isNaN(para) && !isNaN(num) && desc) {
            out.push({ paragraphIndex: para, description: desc, imageNumber: num });
        }
    }
    return out;
}

export async function findImagesForSelection(
    app: App,
    settings: FindImagesSettings,
    activeFile: TFile,
    editor: Editor,
): Promise<void> {
    const selection = editor.getSelection().trim();
    if (!selection) {
        new Notice('Select text first to anchor image search.');
        return;
    }
    if (!settings.perplexityApiKey) {
        new Notice('Perplexity API key is not set. Configure it in perplexed settings.');
        return;
    }

    const paragraphs = splitParagraphs(selection);
    if (paragraphs.length === 0) {
        new Notice('Selection has no paragraphs.');
        return;
    }

    const fileContent = await app.vault.cachedRead(activeFile);
    const fm = readFrontmatter(fileContent);
    const entityName = typeof fm['site_name'] === 'string'
        ? fm['site_name']
        : typeof fm['title'] === 'string'
            ? fm['title']
            : activeFile.basename;
    const entityUrl = typeof fm['url'] === 'string' ? fm['url'] : '';
    const entityDomain = extractDomain(entityUrl);

    const N = Math.max(1, settings.maxImages);
    const numberedParagraphs = paragraphs.map((p, i) => `[${(i + 1).toString()}] ${p}`).join('\n\n');

    const prompt = `You are a visual editor. The passage below is divided into ${paragraphs.length.toString()} numbered paragraphs. Find up to ${N.toString()} screenshot, product, or feature images that visually illustrate the specific content of this passage.

${entityDomain ? `You are restricted to images on ${entityDomain}. Your search has already been domain-filtered to this site. Do NOT reference images from other domains.` : ''} Entity: "${entityName}"${entityUrl ? ' at ' + entityUrl : ''}.

For each image you select, output one line in this exact form, with no other prose:

[AFTER {paragraph_number}] [IMAGE {n}: <specific description of what the image shows>]

Where paragraph_number is the number of the paragraph the image best illustrates, and n is 1-indexed across your selected images. The description must be specific to the image (e.g., "ZAPI dashboard showing API discovery interface"), not generic. Do not return logos, favicons, or icons. If you cannot find ${N.toString()} on-domain images that genuinely illustrate the passage, return fewer images (or none) — never substitute generic stock images. Return only the placement lines, one per image, nothing else.

Passage:

${numberedParagraphs}`;

    interface PerplexityImagePayload {
        model: string;
        messages: { role: string; content: string }[];
        stream: boolean;
        return_citations: boolean;
        return_images: boolean;
        return_related_questions: boolean;
        search_domain_filter?: string[];
    }

    const payload: PerplexityImagePayload = {
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        return_citations: false,
        return_images: true,
        return_related_questions: false,
    };
    if (entityDomain) {
        // Constrain Perplexity's search itself to the entity's domain so the
        // model can only consider on-site pages and their images.
        payload.search_domain_filter = [entityDomain];
    }

    const loadingNotice = new Notice('Searching for images…', 0);
    try {
        const responseRaw = await request({
            url: settings.perplexityEndpoint,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.perplexityApiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = JSON.parse(responseRaw) as PerplexityResponse;
        const responseText = data.choices?.[0]?.message?.content ?? '';
        const images = data.images ?? [];

        if (images.length === 0) {
            new Notice('No images returned.');
            return;
        }

        const placements = parsePlacementMarkers(responseText);

        // Strict client-side domain filter. If we know the entity's domain,
        // reject every image whose origin or image URL is off-domain. Better to
        // surface "no on-domain images" than to silently insert third-party
        // stock illustrations.
        const onDomain = (img: PerplexityImage): boolean => {
            if (!entityDomain) return true;
            const originDomain = extractDomain(img.origin_url ?? '');
            const imageDomain = extractDomain(img.image_url ?? '');
            return (
                originDomain.endsWith(entityDomain) ||
                imageDomain.endsWith(entityDomain)
            );
        };
        const filteredImages = images.filter(onDomain);

        if (entityDomain && filteredImages.length === 0) {
            new Notice(`No on-domain images found for ${entityDomain}. Search did not return images hosted on the entity's site.`);
            return;
        }
        const orderedImages = filteredImages;

        // Build per-paragraph image queue.
        const perParagraphImages: Map<number, string[]> = new Map();
        const usedImageIndices = new Set<number>();

        for (const placement of placements.slice(0, N)) {
            // Placement marker indexes into the FULL images array (the model
            // sees all returned images). Resolve, then enforce the on-domain
            // filter — drop placements that point to off-domain images.
            const imgIdx = placement.imageNumber - 1;
            const img = images[imgIdx];
            if (!img?.image_url) continue;
            if (!onDomain(img)) continue;
            if (placement.paragraphIndex < 1 || placement.paragraphIndex > paragraphs.length) continue;
            const embed = `![${placement.description}](${img.image_url})`;
            const list = perParagraphImages.get(placement.paragraphIndex) ?? [];
            list.push(embed);
            perParagraphImages.set(placement.paragraphIndex, list);
            usedImageIndices.add(imgIdx);
        }

        // Fallback: if model emitted no placement markers, distribute the top-N
        // domain-preferred images evenly across paragraph boundaries.
        if (perParagraphImages.size === 0) {
            const fallbackImages = orderedImages.slice(0, N);
            const step = Math.max(1, Math.ceil(paragraphs.length / fallbackImages.length));
            fallbackImages.forEach((img, i) => {
                if (!img.image_url) return;
                const paraIdx = Math.min(paragraphs.length, (i + 1) * step);
                const desc = `${entityName} — illustration ${(i + 1).toString()}`;
                const embed = `![${desc}](${img.image_url})`;
                const list = perParagraphImages.get(paraIdx) ?? [];
                list.push(embed);
                perParagraphImages.set(paraIdx, list);
            });
        }

        if (perParagraphImages.size === 0) {
            new Notice('No usable images returned.');
            return;
        }

        // Reconstruct selection with images interspersed between paragraphs.
        const parts: string[] = [];
        for (let i = 0; i < paragraphs.length; i++) {
            parts.push(paragraphs[i] ?? '');
            const paraNum = i + 1;
            const imagesForPara = perParagraphImages.get(paraNum);
            if (imagesForPara) {
                for (const embed of imagesForPara) {
                    parts.push(embed);
                }
            }
        }
        const reconstructed = parts.join('\n\n');

        editor.replaceSelection(reconstructed);

        const totalEmbedded = Array.from(perParagraphImages.values()).reduce((acc, arr) => acc + arr.length, 0);
        new Notice(`Embedded ${totalEmbedded.toString()} image${totalEmbedded === 1 ? '' : 's'} across ${perParagraphImages.size.toString()} paragraph${perParagraphImages.size === 1 ? '' : 's'}.`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        new Notice(`Image search failed: ${msg}`);
    } finally {
        loadingNotice.hide();
    }
}
