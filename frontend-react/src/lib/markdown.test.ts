import { describe, expect, it } from 'vitest'

import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('renders headings, bold, italics and lists', () => {
    const html = renderMarkdown('## Title\n\n**bold** and *italic*\n\n- one\n- two')
    expect(html).toContain('<h2>Title</h2>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<li>one</li>')
  })

  it('renders GFM tables', () => {
    const html = renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<td>1</td>')
  })

  it('renders fenced code blocks with syntax highlighting', () => {
    const html = renderMarkdown('```sql\nSELECT 1;\n```')
    expect(html).toContain('<pre class="hljs">')
    expect(html).toContain('SELECT')
  })

  it('renders GFM task lists as checkboxes', () => {
    const html = renderMarkdown('- [x] done\n- [ ] todo')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
  })

  it('renders inline math via KaTeX', () => {
    const html = renderMarkdown('energy: $E=mc^2$')
    expect(html).toContain('class="katex"')
  })

  it('renders ==marked== text', () => {
    const html = renderMarkdown('==highlighted==')
    expect(html).toContain('<mark>highlighted</mark>')
  })

  it('renders a mermaid fence as a live-diagram placeholder', () => {
    const html = renderMarkdown('```mermaid\ngraph TD; A-->B;\n```')
    expect(html).toContain('class="mermaid"')
    expect(html).toContain('graph TD')
  })

  it('renders an echarts fence as a chart placeholder with an encoded option payload', () => {
    const html = renderMarkdown('```echarts\n{"series":[{"type":"bar","data":[1,2,3]}]}\n```')
    expect(html).toContain('class="echarts-block"')
    expect(html).toContain('data-option="')
  })

  it('turns single newlines into <br> (breaks mode)', () => {
    const html = renderMarkdown('line one\nline two')
    expect(html).toContain('<br>')
  })

  it('sanitizes raw HTML/script content', () => {
    const html = renderMarkdown('<script>alert(1)</script>hello')
    expect(html).not.toContain('<script>')
    expect(html).toContain('hello')
  })

  it('opens links in a new tab with rel=noopener', () => {
    const html = renderMarkdown('[click](https://example.com)')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('')
  })
})
