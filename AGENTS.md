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

<!-- BEGIN:project-code-rules -->

# Project Code Rules

1. Always write code, code comments, toaster messages, and user-facing developer strings in English, even when the user prompt is written in Vietnamese.
2. Centralize shared constants in [src/constants/index.ts](/Users/0xtravis/Documents/AnyAxis/Project/hackathon/tickX/tickX-FE/src/constants/index.ts) instead of hardcoding unclear numeric or string literals in feature code.
3. Add a short English comment for each newly introduced shared constant to explain its purpose.
4. Reuse or extend existing constants before creating new ones, and keep constant names semantic and easy to understand.
5. Split components into sensible files and responsibilities. Do not place multiple unrelated components in one file.
6. When making changes, scope edits strictly to the requested behavior. Do not alter unrelated logic or UI unless it is required to keep the app working correctly.
7. If a requested change causes necessary side effects in nearby code, apply the minimal supporting fix needed to preserve normal app behavior.
8. Keep code clean, readable, and maintainable. Prefer straightforward control flow, clear naming, and low-complexity component structure.
9. Avoid unnecessary rerenders, memory leaks, and crash-prone patterns. Clean up effects correctly and preserve stable behavior during updates.
10. Before adding a new component, continue following the existing reuse rule above and check whether an existing project component can be reused or extended.

<!-- END:project-code-rules -->
