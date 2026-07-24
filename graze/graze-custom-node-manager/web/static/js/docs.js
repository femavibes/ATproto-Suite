// Documentation loader module

export async function loadGrazeDocs() {
    const content = document.getElementById('graze-content');
    const response = await fetch('/static/docs/graze.html');
    content.innerHTML = await response.text();
    document.getElementById('graze-search').oninput = (e) => window.filterCards(e.target.value, 'graze-content');
}

export async function loadMetadataDocs() {
    const content = document.getElementById('metadata-content');
    const response = await fetch('/static/docs/metadata.html');
    content.innerHTML = await response.text();
    document.getElementById('metadata-search').oninput = (e) => window.searchContent(e.target.value, 'metadata-content', 'metadata');
}

export async function loadReferenceDocs() {
    const response = await fetch('/api/docs/reference');
    const data = await response.json();
    document.getElementById('reference-content').innerHTML = '<pre style="white-space: pre-wrap;">' + data.content + '</pre>';
    document.getElementById('reference-search').oninput = (e) => window.searchContent(e.target.value, 'reference-content', 'reference');
}
