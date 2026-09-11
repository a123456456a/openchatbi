// These markdown-it plugins ship without TypeScript declarations. They are all plain
// `(md: MarkdownIt, options?) => void` plugin functions, used only via `md.use(plugin)`.
declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt, options?: Record<string, unknown>) => void
  export default plugin
}

declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-mark' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-sub' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-sup' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-deflist' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-texmath' {
  import type MarkdownIt from 'markdown-it'
  const plugin: {
    use: (renderEngine: unknown) => (md: MarkdownIt, options?: Record<string, unknown>) => void
  }
  export default plugin
}
