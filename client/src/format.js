export function money(n) {
  return `Rs. ${Number(n).toFixed(2)}`
}

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Builds a CSV string from an array of rows and a `[label, getter]` column
// list, then triggers a browser download — no backend endpoint needed since
// every page that exports already has the full data loaded client-side.
export function downloadCsv(filename, columns, rows) {
  const header = columns.map(([label]) => csvCell(label)).join(',')
  const lines = rows.map(row => columns.map(([, get]) => csvCell(get(row))).join(','))
  const csv = [header, ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
