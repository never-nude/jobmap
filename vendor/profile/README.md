# Local document parsers

- PDF.js / pdfjs-dist 6.3.289: `legacy/build/pdf.min.mjs` and `legacy/build/pdf.worker.min.mjs` (compatibility build with required polyfills), Apache 2.0 (PDFJS-LICENSE).
- Mammoth 1.12.3: `mammoth.browser.min.js`, BSD 2-Clause (MAMMOTH-LICENSE).
- `extract-worker.js` is Jobmap's small wrapper around Mammoth's text-only API.

Installed from version-pinned npm package tarballs. These assets load from the same site; resume files never go to an external document conversion service. Extraction supports text PDFs and DOCX. Scanned PDFs need the user to paste text; there is no OCR. Legacy .doc files are not supported. The editor lets the user review extraction before sending selected text to the configured backend.
