export function highlightText(text, searchText = '') {
  if (!searchText) return text
  
  const regex = new RegExp(`(${searchText})`, 'gi')
  return text.replace(regex, '<span class="highlight">$1</span>')
} 