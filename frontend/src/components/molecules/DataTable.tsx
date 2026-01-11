import { useState, useMemo } from 'react'
import type { TableColumn } from '@/types'
import { Icon, Spinner, Button } from '../atoms'
import { useTheme } from '../../contexts'

interface SortConfig {
  key: string | null
  direction: 'asc' | 'desc'
}

interface DataTableProps<T = any> {
  columns: TableColumn<T>[]
  data?: T[]
  loading?: boolean
  pageSize?: number
  emptyMessage?: string
  className?: string
}

const DataTable = <T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  pageSize = 10,
  emptyMessage = 'No data available',
  className = ''
}: DataTableProps<T>) => {
  const { isLight } = useTheme()
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'desc' }) // Default desc for time series

  // Reset page when data changes
  if (currentPage > Math.ceil((data?.length || 0) / pageSize) && data && data.length > 0) {
    setCurrentPage(1)
  }

  // Sorting
  const sortedData = useMemo(() => {
    if (!data) return []
    let sortableItems = [...data]
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key!]
        const bValue = b[sortConfig.key!]

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }
    return sortableItems
  }, [data, sortConfig])

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  return (
    <div className={`w-full ${className}`}>
      <div className={`overflow-hidden rounded-xl border ${isLight ? 'border-gray-200' : 'border-dark-700'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${isLight ? 'bg-gray-50' : 'bg-dark-800'}`}>
              <tr>
                {columns.map((col, index) => (
                  <th
                    key={index}
                    className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${
                      isLight ? 'text-gray-500 hover:bg-gray-100' : 'text-dark-300 hover:bg-dark-700'
                    } ${(col as any).className || ''}`}
                    onClick={() => col.sortable !== false && requestSort(col.accessor)}
                  >
                    <div className={`flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                      {col.header}
                      {col.sortable !== false && (
                        <div className="flex flex-col">
                          <Icon
                            name="arrow_drop_up"
                            size="xs"
                            className={`-mb-1.5 ${sortConfig.key === col.accessor && sortConfig.direction === 'asc' ? 'text-primary-500' : 'text-gray-300'}`}
                          />
                          <Icon
                            name="arrow_drop_down"
                            size="xs"
                            className={`-mt-0.5 ${sortConfig.key === col.accessor && sortConfig.direction === 'desc' ? 'text-primary-500' : 'text-gray-300'}`}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-dark-700'} ${isLight ? 'bg-white' : 'bg-dark-700/30'}`}>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <Spinner size="lg" />
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <div className={`flex flex-col items-center justify-center ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                      <Icon name="inbox" size="xl" className="mb-2" />
                      <p>{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={`transition-colors ${isLight ? 'hover:bg-gray-50' : 'hover:bg-dark-700/50'}`}
                  >
                    {columns.map((col, colIndex) => (
                      <td
                        key={colIndex}
                        className={`px-6 py-4 text-sm whitespace-nowrap ${
                          isLight ? 'text-gray-700' : 'text-gray-300'
                        } ${(col as any).className || ''}`}
                        style={{ textAlign: col.align || 'left' }}
                      >
                        {col.render ? col.render(row) : (row[col.accessor] !== undefined && row[col.accessor] !== null ? row[col.accessor] : '—')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && data && (
          <div className={`px-6 py-4 border-t flex items-center justify-between ${isLight ? 'border-gray-200 bg-gray-50' : 'border-dark-700 bg-dark-800'}`}>
            <div className={`text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
              Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, data.length)}</span> of <span className="font-medium">{data.length}</span> results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              >
                <Icon name="chevron_left" size="sm" />
              </Button>

              {/* Page Numbers - Simplified */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Logic to show pages around current page could be complex, simplifying to show first few or sliding window if needed.
                  // For now, let's just show a simple "Page X of Y" or a few buttons.
                  // Let's implement a sliding window around current page
                  let p = i + 1
                  if (totalPages > 5) {
                    if (currentPage > 3) {
                      p = currentPage - 2 + i
                    }
                    if (p > totalPages) {
                      p = totalPages - 4 + i
                    }
                  }

                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === p
                          ? 'bg-primary-500 text-white'
                          : isLight
                            ? 'hover:bg-gray-200 text-gray-600'
                            : 'hover:bg-dark-600 text-dark-400'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>

              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              >
                <Icon name="chevron_right" size="sm" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DataTable
