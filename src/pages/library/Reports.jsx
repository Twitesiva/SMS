import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import LibraryPreloader from '../../components/LibraryPreloader'

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dateStr.slice(0, 10).split('-').reverse().join('/')
}

export default function Reports() {
  const [monthlySummary, setMonthlySummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [reportDetails, setReportDetails] = useState({
    issued: [],
    returned: [],
    overdue: [],
    damaged: [],
    missing: [],
    arrived: [],
    loading: false
  })
  const [activeTab, setActiveTab] = useState('issued')
  const [summaryFilter, setSummaryFilter] = useState('all')
  const [circulationFilter, setCirculationFilter] = useState('all')
  const [overdueFilter, setOverdueFilter] = useState('all')
  const [topBorrowedLimit, setTopBorrowedLimit] = useState('20')
  const [summaryMonthStart, setSummaryMonthStart] = useState('all')
  const [summaryMonthEnd, setSummaryMonthEnd] = useState('all')
  const [summaryYear, setSummaryYear] = useState('all')
  const [summaryCategory, setSummaryCategory] = useState('all')
  const [circulationMonthStart, setCirculationMonthStart] = useState('all')
  const [circulationMonthEnd, setCirculationMonthEnd] = useState('all')
  const [circulationYear, setCirculationYear] = useState('all')
  const [circulationCategory, setCirculationCategory] = useState('all')
  const [overdueMonthStart, setOverdueMonthStart] = useState('all')
  const [overdueMonthEnd, setOverdueMonthEnd] = useState('all')
  const [overdueYear, setOverdueYear] = useState('all')
  const [topMonthStart, setTopMonthStart] = useState('all')
  const [topMonthEnd, setTopMonthEnd] = useState('all')
  const [topYear, setTopYear] = useState('all')

  const [summaryPreview, setSummaryPreview] = useState({ rows: [], loading: false })
  const [circulationPreview, setCirculationPreview] = useState({ rows: [], loading: false })
  const [overduePreview, setOverduePreview] = useState({ rows: [], loading: false })
  const [topBorrowedPreview, setTopBorrowedPreview] = useState({ rows: [], loading: false })
  const [activePreview, setActivePreview] = useState(null)
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const monthOptions = useMemo(
    () => [
      { value: 'all', label: 'All months' },
      { value: '01', label: 'Jan' },
      { value: '02', label: 'Feb' },
      { value: '03', label: 'Mar' },
      { value: '04', label: 'Apr' },
      { value: '05', label: 'May' },
      { value: '06', label: 'Jun' },
      { value: '07', label: 'Jul' },
      { value: '08', label: 'Aug' },
      { value: '09', label: 'Sep' },
      { value: '10', label: 'Oct' },
      { value: '11', label: 'Nov' },
      { value: '12', label: 'Dec' }
    ],
    []
  )
  const headerGradient = 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)'
  const modalHeaderStyle = { background: headerGradient, color: '#ffffff' }

  const matchesMonthYear = (value, filters) => {
    const monthStart = filters?.monthStart ?? 'all'
    const monthEnd = filters?.monthEnd ?? 'all'
    const yearValue = filters?.year ?? 'all'
    const key = String(value || '').slice(0, 7)
    const [year, month] = key.split('-')
    const monthNumber = Number(month)
    const startMonthNumber = monthStart === 'all' ? null : Number(monthStart)
    const endMonthNumber = monthEnd === 'all' ? null : Number(monthEnd)
    if (Number.isNaN(monthNumber)) return false
    if (yearValue && yearValue !== 'all' && year !== yearValue) return false
    if (startMonthNumber && endMonthNumber) {
      const minMonth = Math.min(startMonthNumber, endMonthNumber)
      const maxMonth = Math.max(startMonthNumber, endMonthNumber)
      return monthNumber >= minMonth && monthNumber <= maxMonth
    }
    if (startMonthNumber) return monthNumber >= startMonthNumber
    if (endMonthNumber) return monthNumber <= endMonthNumber
    return true
  }
  const matchesCategory = (value, categoryValue) => {
    if (categoryValue === 'all') return true
    return String(value || '').trim().toLowerCase() === String(categoryValue || '').trim().toLowerCase()
  }
  const monthLabels = useMemo(() => {
    const now = new Date()
    const labels = []
    for (let i = 0; i < 3; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      labels.push({
        key,
        label: date.toLocaleString('en-US', { month: 'short', year: 'numeric' })
      })
    }
    return labels
  }, [])

  const loadCategories = async () => {
    setCategoriesLoading(true)
    try {
      const [categoryRes, bookRes] = await Promise.all([
        supabase
          .from('library_book_categories')
          .select('id, name')
          .order('name', { ascending: true }),
        supabase
          .from('library_books')
          .select('category')
      ])

      const categoryRows = categoryRes?.error ? [] : (categoryRes?.data || [])
      const bookRows = bookRes?.error ? [] : (bookRes?.data || [])

      if (categoryRes?.error) {
        console.log('Book categories table might not exist yet:', categoryRes.error?.message || categoryRes.error)
      }
      if (bookRes?.error) {
        console.log('Unable to load book categories from books:', bookRes.error?.message || bookRes.error)
      }

      const byName = new Map()
      categoryRows.forEach((row) => {
        const name = String(row?.name || '').trim()
        if (!name) return
        byName.set(name.toLowerCase(), { id: row.id, name })
      })

      bookRows.forEach((row) => {
        const name = String(row?.category || '').trim()
        if (!name) return
        const key = name.toLowerCase()
        if (!byName.has(key)) {
          byName.set(key, { id: `book-${encodeURIComponent(key)}`, name })
        }
      })

      const merged = Array.from(byName.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setCategories(merged)
    } catch (error) {
      console.log('Book categories load failed:', error?.message || error)
      setCategories([])
    } finally {
      setCategoriesLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])


  const handleMonthClick = async (month) => {
    setSelectedMonth(month)
    setReportDetails({
      issued: [],
      returned: [],
      overdue: [],
      damaged: [],
      missing: [],
      arrived: [],
      loading: true
    })
    setActiveTab('issued')

    try {
      const [year, m] = month.key.split('-').map(Number)
      const startDate = new Date(year, m - 1, 1).toISOString().slice(0, 10)
      const endDate = new Date(year, m, 1).toISOString().slice(0, 10)

      const selectQuery = `
        id,
        issued_at,
        returned_at,
        due_date,
        status,
        students (full_name, student_id),
        library_book_copies (
          book_id,
          library_books (title, author, shelf_code)
        )
      `

      const [issuedRes, returnedRes, overdueRes, damagedRes, missingRes, arrivedRes] = await Promise.all([
        supabase
          .from('library_loans')
          .select(selectQuery)
          .gte('issued_at', startDate)
          .lt('issued_at', endDate)
          .eq('status', 'ISSUED')
          .order('issued_at', { ascending: false }),
        supabase
          .from('library_loans')
          .select(selectQuery)
          .gte('returned_at', startDate)
          .lt('returned_at', endDate)
          .order('returned_at', { ascending: false }),
        supabase
          .from('library_loans')
          .select(selectQuery)
          .eq('status', 'ISSUED')
          .gte('due_date', startDate)
          .lt('due_date', endDate)
          .order('due_date', { ascending: true }),
        supabase
          .from('library_loans')
          .select(selectQuery)
          .gte('issued_at', startDate)
          .lt('issued_at', endDate)
          .eq('status', 'DAMAGED')
          .order('issued_at', { ascending: false }),
        supabase
          .from('library_loans')
          .select(selectQuery)
          .gte('issued_at', startDate)
          .lt('issued_at', endDate)
          .eq('status', 'MISSING')
          .order('issued_at', { ascending: false }),
        supabase
          .from('library_books')
          .select('id, title, author, category, shelf_code, status, arrival_date, created_at')
          .gte('arrival_date', startDate)
          .lt('arrival_date', endDate)
          .order('arrival_date', { ascending: false })
      ])

      if (issuedRes.error) throw issuedRes.error
      if (returnedRes.error) throw returnedRes.error
      if (overdueRes.error) throw overdueRes.error
      if (damagedRes.error) throw damagedRes.error
      if (missingRes.error) throw missingRes.error
      if (arrivedRes.error) throw arrivedRes.error

      setReportDetails({
        issued: issuedRes.data || [],
        returned: returnedRes.data || [],
        overdue: overdueRes.data || [],
        damaged: damagedRes.data || [],
        missing: missingRes.data || [],
        arrived: arrivedRes.data || [],
        loading: false
      })
    } catch (error) {
      console.error('Failed to fetch month details', error)
      showToast('Unable to load details.', { type: 'danger' })
      setReportDetails((prev) => ({ ...prev, loading: false }))
    }
  }

  const closeReportModal = () => {
    setSelectedMonth(null)
    setReportDetails({
      issued: [],
      returned: [],
      overdue: [],
      damaged: [],
      missing: [],
      arrived: [],
      loading: false
    })
  }

  const downloadCsv = (filename, headers, rows) => {
    const escapeCell = (value) => {
      const safe = value === null || value === undefined ? '' : String(value)
      return `"${safe.replace(/"/g, '""')}"`
    }
    const csv = [
      headers.map(escapeCell).join(','),
      ...rows.map((row) => row.map(escapeCell).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleLibrarySummaryDownload = async () => {
    try {
      const { data: books, error: bookError } = await supabase
        .from('library_books')
        .select('id, title, author, category, language, publisher, published_year, shelf_code, status, created_at')
        .order('created_at', { ascending: false })

      if (bookError) throw bookError

      const bookIds = (books || []).map((row) => row.id)
      let copiesByBook = {}
      if (bookIds.length > 0) {
        const { data: copies, error: copyError } = await supabase
          .from('library_book_copies')
          .select('book_id')
          .in('book_id', bookIds)

        if (copyError) throw copyError
        copiesByBook = (copies || []).reduce((acc, row) => {
          const key = String(row.book_id)
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {})
      }

      const headers = ['Title', 'Author', 'Language', 'Publisher', 'Year', 'Shelf', 'Status', 'Copies']
      const filteredBooks = (books || []).filter((book) => {
        const copyCount = copiesByBook[String(book.id)] || 0
        const statusValue = (book.status || '').toUpperCase()
        if (!matchesMonthYear(book.created_at, { monthStart: summaryMonthStart, monthEnd: summaryMonthEnd, year: summaryYear })) return false
        if (!matchesCategory(book.category, summaryCategory)) return false
        if (summaryFilter === 'available') return copyCount > 0
        if (summaryFilter === 'out') return copyCount === 0
        if (summaryFilter === 'public') return statusValue === 'PUBLIC'
        if (summaryFilter === 'private') return statusValue === 'PRIVATE'
        return true
      })

      if (filteredBooks.length === 0) {
        showToast('No records match the selected filter.', { type: 'warning' })
        return
      }

      const rows = filteredBooks.map((book) => ([
        book.title || '',
        book.author || '',
        book.language || '',
        book.publisher || '',
        book.published_year || '',
        book.shelf_code || '',
        book.status || '',
        copiesByBook[String(book.id)] || 0
      ]))

      const suffix = summaryFilter === 'all' ? '' : `-${summaryFilter}`
      downloadCsv(`library-summary${suffix}.csv`, headers, rows)
      showToast('Library summary downloaded.', { type: 'success' })
    } catch (error) {
      console.error('Failed to download library summary', error)
      showToast('Unable to download library summary.', { type: 'danger' })
    }
  }

  const previewLibrarySummary = async () => {
    setActivePreview('summary')
    setSummaryPreview({ rows: [], loading: true })
    try {
      const { data: books, error: bookError } = await supabase
        .from('library_books')
        .select('id, title, author, category, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (bookError) throw bookError

      const filteredBooks = (books || []).filter((book) => {
        if (!matchesMonthYear(book.created_at, { monthStart: summaryMonthStart, monthEnd: summaryMonthEnd, year: summaryYear })) return false
        if (!matchesCategory(book.category, summaryCategory)) return false
        const statusValue = (book.status || '').toUpperCase()
        if (summaryFilter === 'available' || summaryFilter === 'out') {
          return true // handled after counts
        }
        if (summaryFilter === 'public') return statusValue === 'PUBLIC'
        if (summaryFilter === 'private') return statusValue === 'PRIVATE'
        return true
      })

      const bookIds = filteredBooks.map((b) => b.id)
      let copiesByBook = {}
      if (bookIds.length > 0) {
        const { data: copies, error: copyError } = await supabase
          .from('library_book_copies')
          .select('book_id, availability')
          .in('book_id', bookIds)
        if (copyError) throw copyError
        copiesByBook = (copies || []).reduce((acc, row) => {
          const key = String(row.book_id)
          acc[key] = acc[key] || { total: 0, available: 0 }
          acc[key].total += 1
          if ((row.availability || '').toUpperCase() === 'AVAILABLE') acc[key].available += 1
          return acc
        }, {})
      }

      const rows = filteredBooks
        .map((book) => {
          const copyInfo = copiesByBook[String(book.id)] || { total: 0, available: 0 }
          return {
            title: book.title || 'Untitled',
            status: book.status || '-',
            copies: copyInfo.total,
            available: copyInfo.available,
            availabilityFlag:
              summaryFilter === 'available'
                ? copyInfo.available > 0
                : summaryFilter === 'out'
                ? copyInfo.available === 0
                : true
          }
        })
        .filter((row) => row.availabilityFlag)
        .slice(0, 8)
      setSummaryPreview({ rows, loading: false })
    } catch (error) {
      console.error('Unable to preview summary', error)
      setSummaryPreview({ rows: [], loading: false })
      showToast('Unable to load summary preview.', { type: 'danger' })
    }
  }

  const handleCirculationDownload = async () => {
    try {
      const { data: loans, error } = await supabase
        .from('library_loans')
        .select(
          'issued_at, returned_at, due_date, status, students(full_name,student_id), library_book_copies(book_id, library_books(title, author, shelf_code, category))'
        )
        .order('issued_at', { ascending: false })

      if (error) throw error

      const filteredLoans = (loans || []).filter((loan) => {
        const status = (loan.status || '').toUpperCase()
        const dueDateValue = loan.due_date ? new Date(loan.due_date) : null
        const isOverdue = dueDateValue ? (new Date(todayIso) > dueDateValue && status === 'ISSUED') : false

        if (!matchesMonthYear(loan.issued_at || loan.returned_at || loan.due_date, { monthStart: circulationMonthStart, monthEnd: circulationMonthEnd, year: circulationYear })) return false
        if (!matchesCategory(loan.library_book_copies?.library_books?.category, 'all')) return false

        if (circulationFilter === 'issued') return status === 'ISSUED'
        if (circulationFilter === 'returned') return status === 'RETURNED'
        if (circulationFilter === 'damaged') return status === 'DAMAGED'
        if (circulationFilter === 'missing') return status === 'MISSING'
        if (circulationFilter === 'overdue') return isOverdue
        return true
      })

      if (filteredLoans.length === 0) {
        showToast('No circulation records match the selected filter.', { type: 'warning' })
        return
      }

      const headers = ['Student', 'Student ID', 'Book', 'Author', 'Shelf', 'Issued At', 'Returned At', 'Due Date', 'Status']
      const rows = filteredLoans.map((loan) => ([
        loan.students?.full_name || '',
        loan.students?.student_id || '',
        loan.library_book_copies?.library_books?.title || '',
        loan.library_book_copies?.library_books?.author || '',
        loan.library_book_copies?.library_books?.shelf_code || '',
        formatDate(loan.issued_at),
        formatDate(loan.returned_at),
        formatDate(loan.due_date),
        loan.status || ''
      ]))

      const suffix = circulationFilter === 'all' ? '' : `-${circulationFilter}`
      downloadCsv(`circulation-report${suffix}.csv`, headers, rows)
      showToast('Circulation report downloaded.', { type: 'success' })
    } catch (error) {
      console.error('Failed to download circulation report', error)
      showToast('Unable to download circulation report.', { type: 'danger' })
    }
  }

  const previewCirculation = async () => {
    setActivePreview('circulation')
    setCirculationPreview({ rows: [], loading: true })
    try {
      const { data: loans, error } = await supabase
        .from('library_loans')
        .select(
          'issued_at, returned_at, due_date, status, students(full_name,student_id), library_book_copies(book_id, library_books(title, author, shelf_code, category))'
        )
        .order('issued_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const filteredLoans = (loans || []).filter((loan) => {
        const status = (loan.status || '').toUpperCase()
        const dueDateValue = loan.due_date ? new Date(loan.due_date) : null
        const isOverdue = dueDateValue ? new Date(todayIso) > dueDateValue && status === 'ISSUED' : false
        if (!matchesMonthYear(loan.issued_at || loan.returned_at || loan.due_date, { monthStart: circulationMonthStart, monthEnd: circulationMonthEnd, year: circulationYear })) return false
        if (!matchesCategory(loan.library_book_copies?.library_books?.category, 'all')) return false
        if (circulationFilter === 'issued') return status === 'ISSUED'
        if (circulationFilter === 'returned') return status === 'RETURNED'
        if (circulationFilter === 'damaged') return status === 'DAMAGED'
        if (circulationFilter === 'missing') return status === 'MISSING'
        if (circulationFilter === 'overdue') return isOverdue
        return true
      })

      const rows = filteredLoans.slice(0, 8).map((loan) => ({
        student: loan.students?.full_name || 'Unknown',
        studentId: loan.students?.student_id || '--',
        book: loan.library_book_copies?.library_books?.title || 'Unknown',
        status: loan.status || '-',
        due: loan.due_date
      }))

      setCirculationPreview({ rows, loading: false })
    } catch (err) {
      console.error('Unable to preview circulation', err)
      setCirculationPreview({ rows: [], loading: false })
      showToast('Unable to load circulation preview.', { type: 'danger' })
    }
  }

  const handleOverdueDownload = async () => {
    try {
      const { data: loans, error } = await supabase
        .from('library_loans')
        .select(
          'due_date, status, students(full_name,student_id), library_book_copies(book_id, library_books(title, category))'
        )
        .eq('status', 'ISSUED')
        .lt('due_date', todayIso)
        .order('due_date', { ascending: true })

      if (error) throw error

      const headers = ['Student', 'Student ID', 'Book', 'Due Date', 'Days Overdue']
      const today = new Date()
      const filtered = (loans || []).map((loan) => {
        const dueDateValue = loan.due_date ? new Date(loan.due_date) : null
        const daysOverdue = dueDateValue ? Math.max(0, Math.floor((today - dueDateValue) / (1000 * 60 * 60 * 24))) : 0
        return {
          row: [
            loan.students?.full_name || '',
            loan.students?.student_id || '',
            loan.library_book_copies?.library_books?.title || '',
            formatDate(loan.due_date),
            daysOverdue
          ],
          daysOverdue,
          dueKey: String(loan.due_date || '').slice(0, 7),
          loan
        }
      }).filter(({ daysOverdue, dueKey, loan }) => {
        if (!matchesMonthYear(`${dueKey}-01`, { monthStart: overdueMonthStart, monthEnd: overdueMonthEnd, year: overdueYear })) return false
        if (!matchesCategory(loan.library_book_copies?.library_books?.category, 'all')) return false
        if (overdueFilter === 'week') return daysOverdue <= 7
        if (overdueFilter === 'month') return daysOverdue > 7 && daysOverdue <= 30
        if (overdueFilter === 'overMonth') return daysOverdue > 30
        return true
      })

      if (filtered.length === 0) {
        showToast('No overdue records match the selected filter.', { type: 'warning' })
        return
      }

      const rows = filtered.map(({ row }) => row)

      const suffix = overdueFilter === 'all' ? '' : `-${overdueFilter}`
      downloadCsv(`overdue-report${suffix}.csv`, headers, rows)
      showToast('Overdue report downloaded.', { type: 'success' })
    } catch (error) {
      console.error('Failed to download overdue report', error)
      showToast('Unable to download overdue report.', { type: 'danger' })
    }
  }

  const previewOverdue = async () => {
    setActivePreview('overdue')
    setOverduePreview({ rows: [], loading: true })
    try {
      const { data: loans, error } = await supabase
        .from('library_loans')
        .select(
          'due_date, status, students(full_name,student_id), library_book_copies(book_id, library_books(title, category))'
        )
        .eq('status', 'ISSUED')
        .lt('due_date', todayIso)
        .order('due_date', { ascending: true })
        .limit(50)

      if (error) throw error

      const today = new Date()
      const filtered = (loans || []).map((loan) => {
        const dueDateValue = loan.due_date ? new Date(loan.due_date) : null
        const daysOverdue = dueDateValue ? Math.max(0, Math.floor((today - dueDateValue) / (1000 * 60 * 60 * 24))) : 0
        return { loan, daysOverdue }
      }).filter(({ daysOverdue, loan }) => {
        if (!matchesMonthYear(loan.due_date, { monthStart: overdueMonthStart, monthEnd: overdueMonthEnd, year: overdueYear })) return false
        if (!matchesCategory(loan.library_book_copies?.library_books?.category, 'all')) return false
        if (overdueFilter === 'week') return daysOverdue <= 7
        if (overdueFilter === 'month') return daysOverdue > 7 && daysOverdue <= 30
        if (overdueFilter === 'overMonth') return daysOverdue > 30
        return true
      })

      const rows = filtered.slice(0, 8).map(({ loan, daysOverdue }) => ({
        student: loan.students?.full_name || 'Unknown',
        studentId: loan.students?.student_id || '--',
        book: loan.library_book_copies?.library_books?.title || 'Unknown',
        due: loan.due_date,
        days: daysOverdue
      }))

      setOverduePreview({ rows, loading: false })
    } catch (err) {
      console.error('Unable to preview overdue', err)
      setOverduePreview({ rows: [], loading: false })
      showToast('Unable to load overdue preview.', { type: 'danger' })
    }
  }

  const handleTopBorrowedDownload = async () => {
    try {
      const { data: loans, error } = await supabase
        .from('library_loans')
        .select('issued_at, library_book_copies(book_id, library_books(title, category))')

      if (error) throw error

      const counts = (loans || []).reduce((acc, loan) => {
        if (!matchesMonthYear(loan.issued_at, { monthStart: topMonthStart, monthEnd: topMonthEnd, year: topYear })) return acc
        if (!matchesCategory(loan.library_book_copies?.library_books?.category, 'all')) return acc
        const bookTitle = loan.library_book_copies?.library_books?.title || 'Unknown'
        acc[bookTitle] = (acc[bookTitle] || 0) + 1
        return acc
      }, {})

      const rows = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topBorrowedLimit === 'all' ? undefined : Number(topBorrowedLimit))
        .map(([title, total]) => [title, total])

      if (rows.length === 0) {
        showToast('No borrowed records available.', { type: 'warning' })
        return
      }

      const suffix = topBorrowedLimit === 'all' ? '' : `-top${topBorrowedLimit}`
      downloadCsv(`top-borrowed${suffix}.csv`, ['Book Title', 'Total Issued'], rows)
      showToast('Top borrowed report downloaded.', { type: 'success' })
    } catch (error) {
      console.error('Failed to download top borrowed report', error)
      showToast('Unable to download top borrowed report.', { type: 'danger' })
    }
  }

  const previewTopBorrowed = async () => {
    setActivePreview('top')
    setTopBorrowedPreview({ rows: [], loading: true })
    try {
      const { data: loans, error } = await supabase
        .from('library_loans')
        .select('issued_at, library_book_copies(book_id, library_books(title, category))')

      if (error) throw error

      const counts = (loans || []).reduce((acc, loan) => {
        if (!matchesMonthYear(loan.issued_at, { monthStart: topMonthStart, monthEnd: topMonthEnd, year: topYear })) return acc
        if (!matchesCategory(loan.library_book_copies?.library_books?.category, 'all')) return acc
        const bookTitle = loan.library_book_copies?.library_books?.title || 'Unknown'
        acc[bookTitle] = (acc[bookTitle] || 0) + 1
        return acc
      }, {})

      const rows = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topBorrowedLimit === 'all' ? 10 : Number(topBorrowedLimit))
        .map(([title, total]) => ({ title, total }))

      setTopBorrowedPreview({ rows, loading: false })
    } catch (err) {
      console.error('Unable to preview top borrowed', err)
      setTopBorrowedPreview({ rows: [], loading: false })
      showToast('Unable to load top borrowed preview.', { type: 'danger' })
    }
  }

  // Auto-refresh the active preview only when filters change
  useEffect(() => {
    if (activePreview === 'summary') void previewLibrarySummary()
    else if (activePreview === 'circulation') void previewCirculation()
    else if (activePreview === 'overdue') void previewOverdue()
    else if (activePreview === 'top') void previewTopBorrowed()
  }, [
    activePreview,
    summaryFilter,
    circulationFilter,
    overdueFilter,
    topBorrowedLimit,
    summaryMonthStart,
    summaryMonthEnd,
    summaryYear,
    summaryCategory,
    circulationMonthStart,
    circulationMonthEnd,
    circulationYear,
    circulationCategory,
    overdueMonthStart,
    overdueMonthEnd,
    overdueYear,
    topMonthStart,
    topMonthEnd,
    topYear
  ])

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true)
      try {
        const { data: loanRows, error: loanError } = await supabase
          .from('library_loans')
          .select('issued_at, returned_at, due_date, status')

        if (loanError) throw loanError

        const { data: fineRows, error: fineError } = await supabase
          .from('library_fines')
          .select('paid_at, amount, status')

        if (fineError) throw fineError

        const summary = monthLabels.map((month) => {
          const issued = (loanRows || []).filter((loan) => String(loan.issued_at || '').slice(0, 7) === month.key && loan.status === 'ISSUED').length
          const returned = (loanRows || []).filter((loan) => String(loan.returned_at || '').slice(0, 7) === month.key).length
          const overdue = (loanRows || []).filter((loan) => {
            const dueKey = String(loan.due_date || '').slice(0, 7)
            return dueKey === month.key && loan.status === 'ISSUED'
          }).length
          const fines = (fineRows || [])
            .filter((fine) => fine.status === 'PAID' && String(fine.paid_at || '').slice(0, 7) === month.key)
            .reduce((sum, fine) => sum + Number(fine.amount || 0), 0)

          return {
            key: month.key,
            label: month.label,
            issued,
            returned,
            overdue,
            fines
          }
        })

        setMonthlySummary(summary)
      } catch (error) {
        console.error('Failed to load reports', error)
        setMonthlySummary([])
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [monthLabels])
  if (loading && monthlySummary.length === 0) {
    return (
      <LibraryPreloader
        title="Loading library reports"
        subtitle="Compiling monthly circulation snapshots."
        statCount={3}
        panelCount={3}
        rowCount={4}
      />
    )
  }

  return (
    <div className="desktop-container" style={{ overflowX: 'hidden' }}>
      <div className="row g-4 justify-content-center mx-0 mt-4">
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card card-soft p-4 h-100">
            <h5 className="mb-2">Library Summary</h5>
            <p className="text-muted small mb-3">Stock by category, location, and status.</p>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Filter</label>
              <select
                className="form-select form-select-sm"
                value={summaryFilter}
                onChange={(e) => {
                  setSummaryFilter(e.target.value)
                  setActivePreview('summary')
                }}
              >
                <option value="all">All stock</option>
                <option value="available">Available copies</option>
                <option value="out">Out of stock</option>
                <option value="public">Public status</option>
                <option value="private">Private status</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Category</label>
              <select
                className="form-select form-select-sm"
                value={summaryCategory}
                onChange={(e) => {
                  setSummaryCategory(e.target.value)
                  setActivePreview('summary')
                }}
                disabled={categoriesLoading}
              >
                <option value="all">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Month range</label>
              <div className="d-flex gap-2">
                <select
                  className="form-select form-select-sm"
                  value={summaryMonthStart}
                  onChange={(e) => {
                    setSummaryMonthStart(e.target.value)
                    setActivePreview('summary')
                  }}
                >
                  {monthOptions.map((opt) => (
                    <option key={`start-${opt.value}`} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  className="form-select form-select-sm"
                  value={summaryMonthEnd}
                  onChange={(e) => {
                    setSummaryMonthEnd(e.target.value)
                    setActivePreview('summary')
                  }}
                >
                  {monthOptions.map((opt) => (
                    <option key={`end-${opt.value}`} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Year</label>
              <input
                className="form-control form-control-sm"
                type="number"
                min="1900"
                max="9999"
                placeholder="All years"
                value={summaryYear === 'all' ? '' : summaryYear}
                onChange={(e) => {
                  setSummaryYear(e.target.value.trim() || 'all')
                  setActivePreview('summary')
                }}
              />
            </div>
            <button className="btn btn-outline-primary w-100" type="button" onClick={handleLibrarySummaryDownload}>
              Download
            </button>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card card-soft p-4 h-100">
            <h5 className="mb-2">Circulation Report</h5>
            <p className="text-muted small mb-3">Issued, returned, and renewals.</p>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Filter</label>
              <select
                className="form-select form-select-sm"
                value={circulationFilter}
                onChange={(e) => {
                  setCirculationFilter(e.target.value)
                  setActivePreview('circulation')
                }}
              >
                <option value="all">All statuses</option>
                <option value="issued">Issued</option>
                <option value="returned">Returned</option>
                <option value="overdue">Overdue</option>
                <option value="damaged">Damaged</option>
                <option value="missing">Missing</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Category</label>
              <select
                className="form-select form-select-sm"
                value={circulationCategory}
                onChange={(e) => {
                  setCirculationCategory(e.target.value)
                  setActivePreview('circulation')
                }}
                disabled={categoriesLoading}
              >
                <option value="all">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Month range</label>
              <div className="d-flex gap-2">
                <select
                  className="form-select form-select-sm"
                  value={circulationMonthStart}
                  onChange={(e) => {
                    setCirculationMonthStart(e.target.value)
                    setActivePreview('circulation')
                  }}
                >
                  {monthOptions.map((opt) => (
                    <option key={`start-${opt.value}`} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  className="form-select form-select-sm"
                  value={circulationMonthEnd}
                  onChange={(e) => {
                    setCirculationMonthEnd(e.target.value)
                    setActivePreview('circulation')
                  }}
                >
                  {monthOptions.map((opt) => (
                    <option key={`end-${opt.value}`} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Year</label>
              <input
                className="form-control form-control-sm"
                type="number"
                min="1900"
                max="9999"
                placeholder="All years"
                value={circulationYear === 'all' ? '' : circulationYear}
                onChange={(e) => {
                  setCirculationYear(e.target.value.trim() || 'all')
                  setActivePreview('circulation')
                }}
              />
            </div>
            <button className="btn btn-outline-primary w-100" type="button" onClick={handleCirculationDownload}>
              Download
            </button>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card card-soft p-4 h-100">
            <h5 className="mb-2">Overdue Report</h5>
            <p className="text-muted small mb-3">Pending returns and fine amounts.</p>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Filter</label>
              <select
                className="form-select form-select-sm"
                value={overdueFilter}
                onChange={(e) => {
                  setOverdueFilter(e.target.value)
                  setActivePreview('overdue')
                }}
              >
                <option value="all">All overdue</option>
                <option value="week">Up to 7 days</option>
                <option value="month">8 to 30 days</option>
                <option value="overMonth">Over 30 days</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Month range</label>
              <div className="d-flex gap-2">
                <select
                  className="form-select form-select-sm"
                  value={overdueMonthStart}
                  onChange={(e) => {
                    setOverdueMonthStart(e.target.value)
                    setActivePreview('overdue')
                  }}
                >
                  {monthOptions.map((opt) => (
                    <option key={`start-${opt.value}`} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  className="form-select form-select-sm"
                  value={overdueMonthEnd}
                  onChange={(e) => {
                    setOverdueMonthEnd(e.target.value)
                    setActivePreview('overdue')
                  }}
                >
                  {monthOptions.map((opt) => (
                    <option key={`end-${opt.value}`} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Year</label>
              <input
                className="form-control form-control-sm"
                type="number"
                min="1900"
                max="9999"
                placeholder="All years"
                value={overdueYear === 'all' ? '' : overdueYear}
                onChange={(e) => {
                  setOverdueYear(e.target.value.trim() || 'all')
                  setActivePreview('overdue')
                }}
              />
            </div>
            <button className="btn btn-outline-primary w-100" type="button" onClick={handleOverdueDownload}>
              Download
            </button>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card card-soft p-4 h-100">
            <h5 className="mb-2">Top Borrowed</h5>
            <p className="text-muted small mb-3">Most issued titles and trends.</p>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Limit</label>
              <select
                className="form-select form-select-sm"
                value={topBorrowedLimit}
                onChange={(e) => {
                  setTopBorrowedLimit(e.target.value)
                  setActivePreview('top')
                }}
              >
                <option value="10">Top 10</option>
                <option value="20">Top 20</option>
                <option value="50">Top 50</option>
                <option value="100">Top 100</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Month range</label>
              <div className="d-flex gap-2">
                <select
                  className="form-select form-select-sm"
                  value={topMonthStart}
                  onChange={(e) => {
                    setTopMonthStart(e.target.value)
                    setActivePreview('top')
                  }}
                >
                  {monthOptions.map((opt) => (
                    <option key={`start-${opt.value}`} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  className="form-select form-select-sm"
                  value={topMonthEnd}
                  onChange={(e) => {
                    setTopMonthEnd(e.target.value)
                    setActivePreview('top')
                  }}
                >
                  {monthOptions.map((opt) => (
                    <option key={`end-${opt.value}`} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Year</label>
              <input
                className="form-control form-control-sm"
                type="number"
                min="1900"
                max="9999"
                placeholder="All years"
                value={topYear === 'all' ? '' : topYear}
                onChange={(e) => {
                  setTopYear(e.target.value.trim() || 'all')
                  setActivePreview('top')
                }}
              />
            </div>
            <button className="btn btn-outline-primary w-100" type="button" onClick={handleTopBorrowedDownload}>
              Download
            </button>
          </div>
        </div>
      </div>

      <div className="card card-soft p-3 mt-2">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0">
            {activePreview === 'summary' && 'Library Summary Preview'}
            {activePreview === 'circulation' && 'Circulation Preview'}
            {activePreview === 'overdue' && 'Overdue Preview'}
            {activePreview === 'top' && 'Top Borrowed Preview'}
            {!activePreview && 'Preview'}
          </h6>
          <span className="text-muted small">
            {activePreview === 'summary' && `${summaryPreview.rows.length} rows`}
            {activePreview === 'circulation' && `${circulationPreview.rows.length} rows`}
            {activePreview === 'overdue' && `${overduePreview.rows.length} rows`}
            {activePreview === 'top' && `${topBorrowedPreview.rows.length} rows`}
            {!activePreview && ''}
          </span>
        </div>
        <div className="table-responsive">
          <table className="table table-sm mb-0 library-reports-preview-table">
            {activePreview && (
              <thead className="table-light">
                {activePreview === 'summary' && (
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th className="text-end">Copies</th>
                    <th className="text-end">Available</th>
                  </tr>
                )}
                {activePreview === 'circulation' && (
                  <tr>
                    <th>Student</th>
                    <th>Book</th>
                    <th>Status</th>
                    <th className="text-end">Due</th>
                  </tr>
                )}
                {activePreview === 'overdue' && (
                  <tr>
                    <th>Student</th>
                    <th>Book</th>
                    <th className="text-end">Due</th>
                    <th className="text-end">Days</th>
                  </tr>
                )}
                {activePreview === 'top' && (
                  <tr>
                    <th>Book</th>
                    <th className="text-end">Total Issued</th>
                  </tr>
                )}
              </thead>
            )}
            <tbody>
              {activePreview === 'summary' && (
                summaryPreview.loading ? (
                  <tr><td colSpan="4" className="text-center text-muted py-3">Loading...</td></tr>
                ) : summaryPreview.rows.length === 0 ? (
                  <tr><td colSpan="4" className="text-center text-muted py-3">No data.</td></tr>
                ) : (
                  summaryPreview.rows.map((row, idx) => (
                    <tr key={`${row.title}-${idx}`}>
                      <td>{row.title}</td>
                      <td>{row.status}</td>
                      <td className="text-end">{row.copies}</td>
                      <td className="text-end">{row.available}</td>
                    </tr>
                  ))
                )
              )}
              {activePreview === 'circulation' && (
                circulationPreview.loading ? (
                  <tr><td colSpan="4" className="text-center text-muted py-3">Loading...</td></tr>
                ) : circulationPreview.rows.length === 0 ? (
                  <tr><td colSpan="4" className="text-center text-muted py-3">No data.</td></tr>
                ) : (
                  circulationPreview.rows.map((row, idx) => (
                    <tr key={`${row.studentId}-${idx}`}>
                      <td>{row.student} ({row.studentId})</td>
                      <td>{row.book}</td>
                      <td>{row.status}</td>
                      <td className="text-end">{formatDate(row.due)}</td>
                    </tr>
                  ))
                )
              )}
              {activePreview === 'overdue' && (
                overduePreview.loading ? (
                  <tr><td colSpan="4" className="text-center text-muted py-3">Loading...</td></tr>
                ) : overduePreview.rows.length === 0 ? (
                  <tr><td colSpan="4" className="text-center text-muted py-3">No data.</td></tr>
                ) : (
                  overduePreview.rows.map((row, idx) => (
                    <tr key={`${row.studentId}-${idx}`}>
                      <td>{row.student} ({row.studentId})</td>
                      <td>{row.book}</td>
                      <td className="text-end">{formatDate(row.due)}</td>
                      <td className="text-end">{row.days}</td>
                    </tr>
                  ))
                )
              )}
              {activePreview === 'top' && (
                topBorrowedPreview.loading ? (
                  <tr><td colSpan="2" className="text-center text-muted py-3">Loading...</td></tr>
                ) : topBorrowedPreview.rows.length === 0 ? (
                  <tr><td colSpan="2" className="text-center text-muted py-3">No data.</td></tr>
                ) : (
                  topBorrowedPreview.rows.map((row, idx) => (
                    <tr key={`${row.title}-${idx}`}>
                      <td>{row.title}</td>
                      <td className="text-end">{row.total}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-soft p-4 mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h5 className="mb-1">Monthly Summary</h5>
            <p className="text-muted mb-0">Last 3 months overview.</p>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm">Export</button>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 library-reports-monthly-table">
            <thead className="table-light">
              <tr>
                <th>Month</th>
                <th>Issued</th>
                <th>Returned</th>
                <th>Overdue</th>
                <th className="text-end">Fines</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted py-4">No report data loaded.</td>
                </tr>
              ) : (
                monthlySummary.map((row) => (
                  <tr
                    key={row.key}
                    onClick={() => handleMonthClick(row)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{row.label}</td>
                    <td>{row.issued}</td>
                    <td>{row.returned}</td>
                    <td>{row.overdue}</td>
                    <td className="text-end">Rs. {row.fines}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedMonth && (
        <div
          className="modal d-block library-reports-modal"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}
          tabIndex="-1"
          role="dialog"
          onClick={closeReportModal}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered" role="document" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header p-3" style={modalHeaderStyle}>
                <div>
                  <div className="text-uppercase fw-bold text-white small" style={{ letterSpacing: '1px', color: '#ffffff' }}>Monthly Report</div>
                  <h5 className="modal-title fw-bold text-uppercase text-white mb-0" style={{ letterSpacing: '1px', color: '#ffffff' }}>
                    {selectedMonth.label}
                  </h5>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={closeReportModal} aria-label="Close"></button>
              </div>
              <div className="modal-body p-4 bg-white">
                {reportDetails.loading ? (
                  <div className="text-center py-5 text-muted">Loading details...</div>
                ) : (
                  <>
                    <div className="d-flex gap-2 flex-wrap mb-3">
                      <button
                        className={`btn btn-sm ${activeTab === 'issued' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('issued')}
                      >
                        Issued ({reportDetails.issued.length})
                      </button>
                      <button
                        className={`btn btn-sm ${activeTab === 'returned' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('returned')}
                      >
                        Returned ({reportDetails.returned.length})
                      </button>
                      <button
                        className={`btn btn-sm ${activeTab === 'overdue' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('overdue')}
                      >
                        Overdue ({reportDetails.overdue.length})
                      </button>
                      <button
                        className={`btn btn-sm ${activeTab === 'damaged' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('damaged')}
                      >
                        Damaged ({reportDetails.damaged.length})
                      </button>
                      <button
                        className={`btn btn-sm ${activeTab === 'missing' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('missing')}
                      >
                        Missed ({reportDetails.missing.length})
                      </button>
                      <button
                        className={`btn btn-sm ${activeTab === 'arrived' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('arrived')}
                      >
                        Arrived ({reportDetails.arrived.length})
                      </button>
                    </div>

                    <div className="table-responsive bg-white rounded border">
                      {activeTab === 'arrived' ? (
                        <table className="table table-hover mb-0 library-reports-details-table">
                          <thead className="table-light">
                            <tr>
                              <th>Arrived</th>
                              <th>Book Title</th>
                              <th>Author</th>
                              <th>Category</th>
                              <th>Shelf</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(reportDetails.arrived || []).length === 0 ? (
                              <tr>
                                <td colSpan="6" className="text-center py-4 text-muted">
                                  No records found for this category.
                                </td>
                              </tr>
                            ) : (
                              (reportDetails.arrived || []).map((item) => (
                                <tr key={item.id}>
                                  <td>{formatDate(item.arrival_date || item.created_at)}</td>
                                  <td>{item.title || 'Unknown Title'}</td>
                                  <td>{item.author || '-'}</td>
                                  <td>{item.category || '-'}</td>
                                  <td>{item.shelf_code || '-'}</td>
                                  <td>
                                    <span className={`badge ${ 
                                      item.status === 'ACTIVE' ? 'bg-success' :
                                      item.status === 'INACTIVE' ? 'bg-secondary' :
                                      item.status === 'ARCHIVED' ? 'bg-warning text-dark' : 'bg-secondary'
                                    }`}> 
                                      {item.status || 'UNKNOWN'}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      ) : (
                        <table className="table table-hover mb-0 library-reports-details-table">
                          <thead className="table-light">
                            <tr>
                              <th>Issued</th>
                              <th>Returned</th>
                              <th>Student</th>
                              <th>Book Title</th>
                              <th>Author</th>
                              <th>Shelf</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(reportDetails[activeTab] || []).length === 0 ? (
                              <tr>
                                <td colSpan="7" className="text-center py-4 text-muted">
                                  No records found for this category.
                                </td>
                              </tr>
                            ) : (
                              (reportDetails[activeTab] || []).map((item) => (
                                <tr key={item.id}>
                                  <td>{formatDate(item.issued_at)}</td>
                                  <td>{formatDate(item.returned_at)}</td>
                                  <td>
                                    <div className="fw-semibold">{item.students?.full_name || 'Unknown'}</div>
                                    <div className="small text-muted">{item.students?.student_id || '-'}</div>
                                  </td>
                                  <td>{item.library_book_copies?.library_books?.title || 'Unknown Title'}</td>
                                  <td>{item.library_book_copies?.library_books?.author || '-'}</td>
                                  <td>{item.library_book_copies?.library_books?.shelf_code || '-'}</td>
                                  <td>
                                    <span className={`badge ${ 
                                      item.status === 'ISSUED' ? 'bg-warning text-dark' :
                                      item.status === 'RETURNED' ? 'bg-success' :
                                      item.status === 'DAMAGED' ? 'bg-warning text-dark' :
                                      item.status === 'MISSING' ? 'bg-info text-white' : 'bg-secondary'
                                    }`}> 
                                      {item.status}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer bg-light border-0">
                <button type="button" className="btn btn-secondary px-4" onClick={closeReportModal}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
