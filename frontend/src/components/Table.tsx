import React from 'react'

interface Column<T extends object> {
  key: keyof T | string
  label: string
  render?: (value: any, row: T) => React.ReactNode
}

interface TableProps<T extends object> {
  data: T[]
  columns: Column<T>[]
  emptyMessage?: string
}

export default function Table<T extends object>({ data, columns, emptyMessage = 'Aucune donnée' }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y theme-border">
        <thead className="theme-bg-input">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="px-6 py-3 text-left text-xs font-medium theme-text-muted uppercase tracking-wider"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="theme-card divide-y theme-border">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-4 text-center theme-text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={rowIndex} className="theme-hover">
                {columns.map((column) => {
                  const value = column.key in row ? (row as any)[column.key] : null
                  return (
                    <td key={String(column.key)} className="px-6 py-4 whitespace-nowrap text-sm theme-text">
                      {column.render ? column.render(value, row) : value}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

