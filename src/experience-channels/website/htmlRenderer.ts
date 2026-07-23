// ─────────────────────────────────────────────────────────────────────────────
// Website Channel · HTML RenderingPort adapter (STEP 4).
//
// Wraps the EXISTING SnapshotRenderer (website-platform/rendering/renderer.ts) as a
// RenderingPort. It reimplements NO rendering logic and duplicates NO block renderers — it
// reconstructs the { type, props } blocks the mapper preserved and hands them straight back
// to the existing renderer's renderPageBody, which dispatches through the same BLOCK_RENDERERS
// the public site uses. renderer.ts is pure (string output), so this port is fully testable.
// ─────────────────────────────────────────────────────────────────────────────
import { SnapshotRenderer } from '../../website-platform/rendering/renderer';
import type { CompiledPage } from '../../website-platform/publishing/contracts';
import type { RenderingPort, ExperienceResolution, ExperienceContext, WebsiteSchema, ComponentNode } from '../../experience-engine';

/** A RenderingPort that emits HTML for the Website channel via the existing SnapshotRenderer. */
export function createWebsiteHtmlRenderingPort(): RenderingPort<string> {
  const renderer = new SnapshotRenderer();
  return {
    target: 'html-string',
    render(resolution: ExperienceResolution, _context: ExperienceContext): string {
      const schema = resolution.schema as WebsiteSchema | undefined;
      if (!schema || !schema.layout) return '';

      // The base layout is the home page tree; its component nodes carry the original blocks.
      const children = 'children' in schema.layout ? (schema.layout.children ?? []) : [];
      const blocks = children
        .filter((n): n is ComponentNode => n.type === 'component')
        .map(n => ({ type: n.componentId, props: n.props }));

      // Shape the existing renderer expects: content.sections[].blocks[] of { type, props }.
      // Only `content` is read by renderPageBody, so a minimal CompiledPage is sufficient.
      const page = { content: { sections: [{ blocks }] } } as unknown as CompiledPage;
      return renderer.renderPageBody(page);
    },
  };
}
