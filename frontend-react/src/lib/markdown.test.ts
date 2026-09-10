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

  it('renders fenced code blocks', () => {
    const html = renderMarkdown('```sql\nSELECT 1;\n```')
    expect(html).toContain('<pre>')
    expect(html).toContain('SELECT 1;')
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
