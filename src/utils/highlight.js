function escapeHtml(text) {
  return text.replace(/[&<>"']/g, function (c) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c];
  });
}

export function highlightText(text, searchText = '') {
  const safeText = escapeHtml(text)
  if (!searchText) return safeText
  const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return safeText.replace(regex, '<span class="highlight">$1</span>')
} 