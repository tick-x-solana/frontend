<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Codex Component Reuse Rule

Before creating a new component, always check whether an existing project component can be reused or extended. Prefer reuse over duplication.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:figma-mcp-color-token-rules -->

# Figma MCP Color Token Rules

When using Figma MCP to write component UI code:

1. Never hardcode colors in Tailwind classes if a matching design token already exists in `app/globals.css`.
2. Always check `app/globals.css` first and map through `--color-*` tokens in `@theme inline`.
3. Token naming rule: define semantic source token (e.g. `--background-main`, `--stroke-main`) and expose Tailwind token alias as `--color-*` (e.g. `--color-background-main`, `--color-border-main`).
4. Class mapping rule (generic):
   - `--color-background-main` -> `bg-background-main`
   - `--color-border-main` -> `border-border-main`
   - `--color-hint` -> `text-hint`
5. Example: if an element background color is `#040b18`, and `app/globals.css` has:
   - `--background-main: #040b18;`
   - `--color-background-main: var(--background-main);`
     then use class `bg-background-main`.
6. Example: if Figma shows `border: 1px solid var(--stroke-main, #1E3550)`, ensure:
   - `--stroke-main` is defined in `:root`
   - `--color-border-main: var(--stroke-main);` is defined in `@theme inline`
   - component uses `border border-border-main`
7. If a Figma color token does not exist in `app/globals.css`, define it first, then use the mapped Tailwind class.
8. Do not create custom `@utility` color alias classes when `--color-*` token mapping can produce native Tailwind classes.
9. Preferred output style: token-driven Tailwind classes (e.g. `bg-*`, `text-*`, `border-*`) over inline hex colors or arbitrary color literals.
10. When using Figma MCP outputs, you do not need to implement computed typography annotations like `line-height: 20px; /* 142.857% */` or `letter-spacing: -0.14px` by default. Only apply them if explicitly requested for pixel-perfect typography.
11. When implementing Figma MCP designs, prefer existing shadcn components (e.g. `Button`, `Input`, etc.) over raw HTML elements whenever they can represent the same UI.
12. When implementing Figma MCP designs, do not use Tailwind `leading-*` classes. Remove any `leading-*` classes from generated `className` strings unless the user explicitly requests exact line-height parity.
<!-- END:figma-mcp-color-token-rules -->
