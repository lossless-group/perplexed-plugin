// Perplexity models offered when applying a directory template, in
// recommendation order. Shared by the single-file run dialog and the
// folder batch confirm so the two never drift.
export const PERPLEXITY_MODEL_CHOICES: { id: string; label: string }[] = [
    { id: 'sonar-pro', label: 'Sonar Pro — grounded search + citations, fast' },
    { id: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro — adds chain-of-thought' },
    { id: 'sonar', label: 'Sonar — lightweight, fastest' },
    { id: 'sonar-reasoning', label: 'Sonar Reasoning — lightweight + reasoning' },
    { id: 'sonar-deep-research', label: 'Sonar Deep Research — exhaustive, minutes-long' },
];

/** The template's cft `model:`, or sonar-pro when it names none. */
export function templateDefaultModel(cftConfig: Record<string, unknown>): string {
    const m = cftConfig['model'];
    return typeof m === 'string' && m.length > 0 ? m : 'sonar-pro';
}
