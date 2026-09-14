# **Technical Report: Exporting Google Gemini Deep Research and Google Docs to Clean Markdown with Native LaTeX Fidelity**

Modern software engineering and scientific research workflows increasingly depend on frontier reasoning engines to generate technical design documents, systems architecture specifications, and formal literature reviews. Google Gemini Deep Research has emerged as an engine for synthesizing deep, multi-source inquiries, yet incorporating its outputs into version-controlled engineering repositories, documentation generators (such as Hugo, VitePress, and Docusaurus), and local-first knowledge bases (such as Obsidian) remains difficult.

The technical breakdown occurs at the interface between the web browser, the Google Docs document model, and plain-text markup formats. Exporting long-form reports containing heavy mathematical notation, complex tabular data, and academic citations routinely results in corrupted structural layouts, flattened text blocks, or equations converted into uneditable rasterized images. Resolving these issues requires an analysis of DOM tree representations, OpenXML document models, and modern parsing architectures.

## **Document Serialization Failures in AI Research Ingestion Pipelines**

The breakdown in document fidelity when moving content from Gemini Deep Research to Markdown stems from architectural differences across three format transformations: the Gemini web client Document Object Model (DOM), the Google Docs internal representation, and operating system clipboard serializers.

Gemini Deep Research outputs do not exist as static Markdown files on the client side; they are dynamically rendered into an Angular-based web application interface. Mathematical expressions are rendered using KaTeX to generate mathematical typography via HTML spans and embedded MathML structures. The rendered KaTeX block typically encapsulates two internal representations: an accessible MathML block (`.katex-mathml`) that contains an `<annotation encoding="application/x-tex">` element preserving the original LaTeX syntax, and a visual layer (`.katex-html`) consisting of nested spans positioned with explicit CSS sizing, struts, and font transformations. In addition, Gemini often attaches a `data-math` attribute to wrapping containers.

When an engineer copies a report using the native "Copy content" button in the Gemini web interface, the application relies on an internal DOM text serializer rather than returning the raw text string returned by the model. This serializer traverses the rendered layout and discards semantic block boundaries, heading hierarchies (`#`, `##`, `###`), and soft line breaks. The resulting plain-text clipboard buffer collapses multi-page technical analyses into an unsegmented block of text, stripping GitHub Flavored Markdown (GFM) tables of their pipe alignments and row structures.

A secondary failure occurs when users bypass clipboard operations using Gemini's native "Export to Google Docs" integration. Google Docs does not use Markdown or native LaTeX internally. Instead, it maps imported mathematical expressions into its proprietary Equation editor format or static vector/drawing structures.

When the user attempts to download this Google Doc as a Markdown archive (`File > Download > Markdown (.md)`), the export engine cannot translate these internal equations into standard TeX math syntax. The engine falls back to rasterization: every inline and display equation is converted into a PNG image and embedded within the Markdown document as a reference link paired with a Base64 data string.

A report containing dozens of mathematical derivations can balloon from 40 kilobytes of text into several megabytes of binary data, creating repository bloat and rendering mathematical equations unsearchable, non-editable, and poorly scaled on high-resolution displays. Gemini Deep Research also injects proprietary citation tokens, such as `[cite_start]` and `[cite: ...]` chips, directly into the layout tree, which disrupt downstream Markdown parsers if they are not transformed into standard footnotes or references.

## **Comparative Assessment of Export and Ingestion Architectures**

The software ecosystem offers several utilities designed to address these serialization bottlenecks, ranging from in-browser DOM traversers and RPC interceptors to command-line document transformation pipelines.

| Solution Name | Architecture Type | Star Metric / Maintenance State | Formula Fidelity (LaTeX / KaTeX) | GFM Table Preservation | Execution Context / Data Privacy | Software License | Core Architectural Bottleneck |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Voyager** (`Nagi-ovo/voyager`) | Browser Extension (Chromium, Edge, Safari) | 20,000+ Stars; Actively maintained | High: Extracts LaTeX from KaTeX annotations and MathML trees | Complete GFM table syntax with cell alignment preservation | 100% Local-First; zero external server requests on export | GNU GPL-3.0 | Subject to Google UI breakage when Angular Material class names change |
| **AI Chat Exporter** (`amazingpaddy/ai-chat-exporter`) | Browser Extension (Chromium, Firefox) | ~240 Stars; Actively maintained | High: Custom Turndown rules parsing `data-math` attributes | Full GFM pipe-table reconstruction | 100% Local-First; reads directly from authenticated DOM | Apache-2.0 | Requires automated page scrolling to hydrate long, virtualized reports |
| **Gemini Conversation Exporter** (`dikelps/gemini-conversation-exporter`) | UserScript (Tampermonkey) | Niche; Periodically updated | Native: Intercepts raw Batchexecute RPC payloads | Native GFM table extraction from server strings | Local-First; executes inside browser context | MIT | Fails to detect asynchronous Deep Research immersive panels |
| **Google Docs -> DOCX -> Pandoc Pipeline** | Document CLI Toolchain | Gold Standard CLI; Continuously maintained | Native: Translates OMML equations directly to `$ ... $` / `$$ ... $$` | High: Full GFM table generation from Word tables | Local-First CLI; relies on authenticated Google Drive file pull | GNU GPL-2.0 (Pandoc) | Requires intermediate file export (`.docx`) rather than a single click |
| **Docs to Markdown** (`GD2md-html`) | Google Workspace Add-on | Legacy Standard; Maintenance mode | Low: Replaces mathematical formulas with inline warning comments | High: Reliable HTML and GFM table generation | Cloud-executed within Google Apps Script sandbox | Apache-2.0 | Does not serialize native Google Docs Equation objects into LaTeX |
| **Defuddle** (`kepano/defuddle`) | TypeScript Library / CLI Engine | Rapid Growth; Actively maintained | Medium: Extracts raw text; lacks KaTeX annotation extraction rules | Standard HTML table cleanup | Local-First; executable in browser, Node.js, and WASM | MIT | Focuses on generic readability extraction, missing Gemini selectors |
| **CopyLaTeX** (`Mapaor/copy-latex-chrome-extension`) | Browser Extension | Community project; Stable | High: Extracts LaTeX from KaTeX/MathJax annotation nodes | N/A: Scoped strictly to formula isolation | Local-First | MIT | Lacks full-document parsing; cannot process entire reports |

### **Browser Extensions and UserScripts**

Within the browser environment, two primary methods extract Deep Research reports: direct DOM tree translation and network RPC interception.

The DOM translation method is demonstrated by **Voyager** (`Nagi-ovo/voyager`). Voyager identifies the specialized `deep-research-immersive-panel` interface element that Gemini initializes for research tasks. Rather than interacting with the lossy clipboard buffer, Voyager traverses the panel's active subtree, identifies KaTeX presentation nodes, and extracts the LaTeX string from the hidden `<annotation>` tag.

It also applies regular expression passes to strip internal citation wrappers like `[cite_start]` and resolves broken bold-delimiter formatting caused by injected UI elements. However, this deep DOM integration leaves the extension vulnerable to changes in Google's frontend; minor updates to Google's Angular component selectors can temporarily disable the export interface until patch releases are deployed.

Conversely, the RPC interception method, implemented by the **Gemini Conversation Exporter** user script, attempts to bypass the DOM entirely. It hooks into the browser's `fetch` and `XMLHttpRequest` pipelines to capture the raw protocol buffer and JSON payloads returned by Google's internal `batchexecute` API.

Because the backend service transmits responses as Markdown and uncompiled LaTeX strings before client-side hydration, intercepting these network streams yields clean output. However, this script is designed for standard chat conversations; because Gemini Deep Research streams long-form reports through asynchronous background endpoints and detached state machines, the script often fails to capture the full report.

### **The Google Docs Conversion Path**

When a report is exported directly to Google Docs, Workspace Add-ons like `GD2md-html` (Docs to Markdown) fail to solve the equation rasterization problem. The Google Apps Script Document API lacks native methods to read the TeX math backing its Equation elements. Consequently, `GD2md-html` skips these equations, inserting warning flags in the output text instead of mathematical markup.

The standard approach for converting equation-dense Google Docs into clean Markdown relies on an intermediate conversion through Microsoft Word's OpenXML container (`.docx`). When Google Docs exports to `.docx`, it translates internal equations into Office Math Markup Language (OMML) using `<m:oMath>` XML tags rather than flattening them to images.

Pandoc's native `.docx` reader can parse this OMML syntax and convert it into TeX math. Using Pandoc with the `--from=docx --to=gfm+tex_math_dollars` options converts these formulas into native inline `$ ... $` and display `$$ ... $$` delimiters, retains GFM table structures, and saves embedded diagrams to a local assets directory instead of embedding large Base64 strings.

### **Universal Clipboard and Parser Libraries**

Local-first web clippers and markdown transformation engines provide a flexible alternative for parsing clipboard contents. **Defuddle**, the extraction engine built for the Obsidian Web Clipper, strips boilerplate code, navigation frames, and tracking scripts from web pages. However, Defuddle is designed for standard web articles and lacks built-in rules for resolving KaTeX DOM subtrees. Running Defuddle against raw Gemini HTML often extracts unformatted MathML strings or drops formulas altogether.

Reliable HTML-to-Markdown conversion requires using the `turndown` engine paired with `turndown-plugin-gfm` and custom AST rules. By writing rules that target KaTeX DOM elements, developers can extract the contents of the `<annotation>` tag, discard visual formatting spans, and wrap the formula in standard LaTeX math delimiters.

```javascript
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

turndownService.use(gfm);

// Custom extraction rule for KaTeX math structures
turndownService.addRule('katex-parser', {
  filter: (node) => {
    return node.classList && (
      node.classList.contains('katex') || 
      node.classList.contains('math-inline') || 
      node.classList.contains('katex-display')
    );
  },
  replacement: (content, node) => {
    const texAnnotation = node.querySelector('annotation[encoding="application/x-tex"]');
    if (texAnnotation) {
      const tex = texAnnotation.textContent.trim();
      const isDisplay = node.classList.contains('katex-display') || node.tagName.toLowerCase() === 'div';
      return isDisplay ? `\n\n$$${tex}$$\n\n` : `$${tex}$`;
    }
    const dataMath = node.getAttribute('data-math');
    if (dataMath) {
      return `$${dataMath.trim()}$`;
    }
    return content;
  }
});
```

## **The Leading Operational Solution: Architectural Implementation and Workflows**

For interactive browser-based exports, the leading open-source tool for exporting Gemini Deep Research reports to clean Markdown is **Voyager** (`Nagi-ovo/voyager`). Voyager is an active browser extension suite that supports Gemini, Claude, and ChatGPT. It includes a specialized export pipeline designed specifically for the `deep-research-immersive-panel` interface.

### **Voyager Installation and Deployment**

Because Voyager is distributed as an open-source project, developers can install it via pre-built extension archives or build it directly from source:

```bash
# Clone the repository
git clone https://github.com/Nagi-ovo/voyager.git
cd voyager

# Install project dependencies and compile the extension bundles
npm install
npm run build
```

Once compiled, load the unpacked extension in any Chromium-based browser:
1. Open the browser and go to `chrome://extensions/`.
2. Toggle **Developer mode** in the upper-right corner.
3. Click **Load unpacked** and select the compiled `voyager/dist` directory.

### **Operational Export Workflow**

When navigating to `https://gemini.google.com`, Voyager injects an interface directly into Gemini's application layout. The export workflow follows this sequence:

```text
[Open Completed Deep Research Report]
                 │
                 ▼
[Deep Research Immersive Panel Mounted in DOM]
                 │
                 ▼
[Click Voyager "Deep Research Download" Menu Item]
                 │
                 ▼
[Voyager In-Memory Traversal: Resolves KaTeX <annotation> Nodes to $...$]
                 │
                 ▼
[Sanitization Pass: Regex Strips [cite_start] and Corrects Bolding]
                 │
                 ▼
[Direct File Stream: Browser Downloads Validated GFM .md Document]
```

1. Open a completed Deep Research session in the Gemini web interface.
2. Click the report to expand the full reading view (`deep-research-immersive-panel`).
3. Click the native Gemini "Share and export" icon. Voyager detects the active report container and injects two options into the Angular Material menu: **Deep Research Download** and **Save Report**.
4. Selecting **Deep Research Download** triggers Voyager's DOM traversal pipeline. The extension reads the rendered nodes, extracts the original LaTeX formulas from KaTeX annotation tags, normalizes code blocks, converts tables to GFM pipe format, removes internal citation markers, and downloads the output as a clean `.md` file.

### **Headless Enterprise Pipeline: Google Docs to Pandoc CLI**

In team settings where Deep Research reports are automatically saved to shared Google Drive folders or ingested via automated scripts, a command-line pipeline avoids manual browser exports. This approach uses the Google Drive API to download the file as a `.docx` container, then processes the OMML math with Pandoc.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Ingestion script: Converts a Google Doc containing Gemini research to clean GFM
# Usage: ./ingest-doc.sh <DOC_ID> <TARGET_NAME>

DOC_ID="$1"
TARGET_NAME="$2"

echo "Extracting document ${DOC_ID} via Google Drive API..."

# Request .docx export to preserve OMML equation structures
curl -s -L \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  "https://www.googleapis.com/drive/v3/files/${DOC_ID}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document" \
  -o "${TARGET_NAME}.docx"

echo "Executing Pandoc AST transformation..."

# Convert OMML math directly to LaTeX math delimiters in GFM
pandoc "${TARGET_NAME}.docx" \
  --from=docx \
  --to=gfm+tex_math_dollars \
  --extract-media="./assets/${TARGET_NAME}" \
  --wrap=none \
  -o "${TARGET_NAME}.md"

rm "${TARGET_NAME}.docx"
echo "Transformation complete: ${TARGET_NAME}.md"
```

This headless pipeline solves the image rasterization problem. Formulas parse directly into `$ ... $` and `$$ ... $$` delimiters, GFM table structures remain intact, and actual embedded diagrams are saved to a separate assets folder rather than serialized as Base64 strings.

## **Gap Analysis and Technical Bottlenecks**

While tools like Voyager and the Pandoc pipeline address the primary export issues, several edge cases persist across AI-generated technical reports:

### **DOM Selector Volatility**

Extensions that depend on client-side scraping are vulnerable to changes in Google's frontend code. The Gemini web client uses minified, dynamic class names and updates its Angular Material component hierarchies regularly.

For example, an update to Gemini's sharing UI altered the `[data-test-id="share-button-tooltip-container"]` selector, which temporarily prevented Voyager from mounting its export options in the menu. Exporters that rely on DOM scraping require regular updates to keep their selectors aligned with the web client.

### **Pipe Character Collisions in GFM Tables**

A recurring issue in mathematical reports involves using the vertical bar (`|`) within LaTeX expressions placed inside Markdown tables. The pipe character is standard LaTeX notation for determinants, absolute values ($|x|$), evaluations, and conditional probabilities ($P(A|B)$).

However, GitHub Flavored Markdown uses the pipe as its column delimiter. If an exporter extracts raw LaTeX strings into a GFM table cell without sanitization, downstream Markdown parsers interpret the equation's internal pipe characters as cell dividers, corrupting the table layout. Standard export tools often fail to catch this collision, which requires converting raw pipes inside table cells into `\vert`, `\mid`, or escaped characters (`\|`).

### **Citation Ingestion and Footnote Translation**

Gemini Deep Research outputs incorporate interactive citation chips linked to search results, styled as `[cite: source_id]` or `[cite_start]`. The available export tools handle these markers inconsistently:
- **AI Chat Exporter** uses regular expressions to strip citation tags entirely, removing the internal markers but discarding the reference links in the process.
- **Voyager** includes configuration options to either remove the markers or preserve them as raw text.
- No single tool currently parses these citation chips into standard GFM Markdown footnotes (e.g., `[^1]`) matched to a consolidated bibliography at the bottom of the document, which requires manual post-processing for academic and technical publications.

## **Engineering Recommendations: Build versus Adopt Evaluation**

Engineering organizations should decide whether to adopt existing tooling or build a custom utility based on their primary operating environment and automation requirements:

1. **For interactive, browser-based research:** Teams should adopt **Voyager** (`Nagi-ovo/voyager`). It provides a fast, one-click export experience directly within the Gemini interface. It extracts LaTeX from KaTeX structures and formats tables without requiring auxiliary CLI tools, making it the most practical choice for individual researchers, developers, and technical writers.
2. **For automated publishing, knowledge-base indexing, and CI/CD pipelines:** Teams should adopt the **Google Docs -> DOCX -> Pandoc Pipeline**. This workflow eliminates dependency on the browser DOM by pulling `.docx` files through the Google Drive API and converting OMML formulas into LaTeX via Pandoc. It is reliable, handles large document collections, and integrates cleanly into automated continuous delivery setups.
3. **When to build a custom micro-utility:** Teams should consider building a custom micro-utility only if they have specialized ingestion requirements that existing tools do not address. Such requirements typically include converting internal citation chips into GFM footnotes (`[^1]: URL`), escaping pipe characters within table-bound math formulas, or pushing cleaned reports directly into internal repository directories.
4. **Lightweight Custom Implementation:** Teams that choose to build a custom solution can do so with a small, maintainable codebase. Rather than writing a full browser extension or DOM parser from scratch, developers can create a lightweight user script or local ingestion server using `turndown` and `turndown-plugin-gfm`, combined with targeted extraction rules for KaTeX `<annotation>` elements and Gemini citation tags.

By selecting the appropriate tool for their operational context—Voyager for interactive browser use, Pandoc for automated backend workflows, or a targeted Turndown parser for custom pipelines—engineering teams can export Gemini Deep Research reports into clean Markdown with fully editable mathematical notation, intact tabular data, and consistent formatting.

#### **Works cited**

> 1. I made a Chrome extension to export entire Gemini conversations to, [https://www.reddit.com/r/GeminiAI/comments/1m1ii2t/i_made_a_chrome_extension_to_export_entire_gemini/](https://www.reddit.com/r/GeminiAI/comments/1m1ii2t/i_made_a_chrome_extension_to_export_entire_gemini/)  
> 2. Import and Export Markdown in Google Docs | Hacker News, [https://news.ycombinator.com/item?id=40982118](https://news.ycombinator.com/item?id=40982118)  
> 3. [Bug] Deep Research export buttons missing after Gemini removed, [https://github.com/Nagi-ovo/voyager/issues/882](https://github.com/Nagi-ovo/voyager/issues/882)  
> 4. amazingpaddy/ai-chat-exporter - GitHub, [https://github.com/amazingpaddy/ai-chat-exporter](https://github.com/amazingpaddy/ai-chat-exporter)  
> 5. copy-latex-chrome-extension/README.md at main - GitHub, [https://github.com/Mapaor/copy-latex-chrome-extension/blob/main/README.md](https://github.com/Mapaor/copy-latex-chrome-extension/blob/main/README.md)  
> 6. Export complete Google Gemini chat to markdown using DevTools, [https://gist.github.com/maciejkos/98afba3ff3443f2066e67f47bbe2ad0e](https://gist.github.com/maciejkos/98afba3ff3443f2066e67f47bbe2ad0e)  
> 7. The Best 33 Google Docs Add-Ons: The Ultimate Guide - Wordable, [https://wordable.io/best-google-docs-add-ons-old/](https://wordable.io/best-google-docs-add-ons-old/)  
> 8. LaTeX vs Google Docs for Academic Writing | LetX, [https://letx.app/compare/latex-vs-google-docs/](https://letx.app/compare/latex-vs-google-docs/)  
> 9. Google Docs to Markdown — Free Online Converter | MDisBetter, [https://mdisbetter.com/convert/google-docs-to-markdown](https://mdisbetter.com/convert/google-docs-to-markdown)  
> 10. How to migrate from Google Docs : r/ObsidianMD - Reddit, [https://www.reddit.com/r/ObsidianMD/comments/1k6ttdn/how_to_migrate_from_google_docs/](https://www.reddit.com/r/ObsidianMD/comments/1k6ttdn/how_to_migrate_from_google_docs/)  
> 11. GitHub - jujusharp/gemini-export: A Chrome Extension that allows, [https://github.com/jujusharp/gemini-export](https://github.com/jujusharp/gemini-export)  
> 12. Nagi-ovo/voyager: Enhancement suite for Gemini, AI Studio, Claude, [https://github.com/Nagi-ovo/voyager](https://github.com/Nagi-ovo/voyager)  
> 13. A curated index for DeepSeek Harness pluginsDSH-Plugin DSH, [https://www.yhbd.top/](https://www.yhbd.top/)  
> 14. claude-chat-exporter by agarwalvishal - SourcePulse, [https://www.sourcepulse.org/projects/25739368](https://www.sourcepulse.org/projects/25739368)  
> 15. Reliable single-conversation Markdown exporter for Gemini Web, [https://github.com/dikelps/gemini-conversation-exporter](https://github.com/dikelps/gemini-conversation-exporter)  
> 16. Gemini Conversation Exporter - Greasy Fork, [https://greasyfork.org/scripts/588720-gemini-conversation-exporter/code?locale=ar](https://greasyfork.org/scripts/588720-gemini-conversation-exporter/code?locale=ar)  
> 17. 8.13 Math - Pandoc, [https://pandoc.org/demo/example33/8.13-math.html](https://pandoc.org/demo/example33/8.13-math.html)  
> 18. How to Convert Latex to Word - Merge Docs Pro, [https://www.mergedocs.pro/convert-latex-to-word](https://www.mergedocs.pro/convert-latex-to-word)  
> 19. Convert Markdown to Word: Command Line Guide (Pandoc), [https://markdowntoword.pro/blog/markdown-to-word-command-line](https://markdowntoword.pro/blog/markdown-to-word-command-line)  
> 20. How to Use Pandoc – An Open Source Tool for Technical Writers, [https://www.freecodecamp.org/news/how-to-use-pandoc/](https://www.freecodecamp.org/news/how-to-use-pandoc/)  
> 21. Home · evbacher/gd2md-html Wiki - GitHub, [https://github.com/evbacher/gd2md-html/wiki](https://github.com/evbacher/gd2md-html/wiki)  
> 22. Vital Farms Stock: Can It Double in 3 Years? - KoalaGains, [https://koalagains.com/blogs/2026-02-05-vital-farms-can-it-double-in-3-years](https://koalagains.com/blogs/2026-02-05-vital-farms-can-it-double-in-3-years)  
> 23. Magna International (MGA) Valuation: EV/EBITDA, P/E, and FCF Yield, [https://koalagains.com/blogs/2026-02-05-magna-international-mga-valuation-ev-ebitda-pe-fcf-yield](https://koalagains.com/blogs/2026-02-05-magna-international-mga-valuation-ev-ebitda-pe-fcf-yield)  
> 24. Defuddle - Steph Ango, [https://stephango.com/defuddle](https://stephango.com/defuddle)  
> 25. kepano/defuddle: Get the main content of any page as Markdown., [https://github.com/kepano/defuddle](https://github.com/kepano/defuddle)  
> 26. defuddle package - github.com/vaayne/go-defuddle - Go Packages, [https://pkg.go.dev/github.com/vaayne/go-defuddle](https://pkg.go.dev/github.com/vaayne/go-defuddle)  
> 27. Show HN: Defuddle, an HTML-to-Markdown alternative to Readability, [https://web2md.org/blog/show-hn-defuddle-an-html-to-markdown-alternative-to-readabil](https://web2md.org/blog/show-hn-defuddle-an-html-to-markdown-alternative-to-readabil)  
> 28. HTML to Markdown — Best Practices | LLM to Doc, [https://llm2doc.app/guides/html-to-markdown](https://llm2doc.app/guides/html-to-markdown)  
> 29. gemini-voyager/.github/README_FR.md at main · Suibosama, [https://github.com/Suibosama/gemini-voyager/blob/main/.github/README_FR.md](https://github.com/Suibosama/gemini-voyager/blob/main/.github/README_FR.md)  
> 30. Chat Export | Nagi-ovo/gemini-voyager | DeepWiki, [https://deepwiki.com/Nagi-ovo/gemini-voyager/4.5-chat-export](https://deepwiki.com/Nagi-ovo/gemini-voyager/4.5-chat-export)  
> 31. Google Docs to Markdown, [https://www.docstomarkdown.pro/](https://www.docstomarkdown.pro/)
