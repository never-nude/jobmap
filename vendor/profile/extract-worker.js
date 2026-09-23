// A dedicated worker keeps DOCX extraction off the UI thread. No network calls.
importScripts('./mammoth.browser.min.js');
self.onmessage = async ({ data }) => {
  try {
    const result = await self.mammoth.extractRawText({ arrayBuffer: data });
    if (result.value.length > 30000) throw Error('This document contains too much text. Paste the relevant CV sections instead (30,000 characters maximum).');
    self.postMessage({ text: result.value });
  } catch (error) {
    self.postMessage({ error: error.message || 'Could not read this Word document.' });
  }
};
