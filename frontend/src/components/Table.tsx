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
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-700/30">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-slate-800/50 divide-y divide-slate-700/50">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-4 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-700/30">
                {columns.map((column) => {
                  const value = column.key in row ? (row as any)[column.key] : null
                  return (
                    <td key={String(column.key)} className="px-6 py-4 whitespace-nowrap text-sm text-white">
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

