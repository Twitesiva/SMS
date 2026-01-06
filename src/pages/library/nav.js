export const libraryNavGroups = [
  {
    title: 'Library',
    static: true,
    items: [
      {
        to: '/library',
        label: 'Dashboard',
        icon: 'bi-speedometer2'
      }
    ]
  },
  {
    title: 'Catalog',
    items: [
      {
        to: '/library/books',
        label: 'Book Entry',
        icon: 'bi-journal-plus'
      },
      {
        to: '/library/books/all',
        label: 'View Books',
        icon: 'bi-journal-text'
      }
    ]
  },
  {
    title: 'Book Outgoing',
    items: [
      {
        to: '/library/circulation',
        label: 'Book issue & return',
        icon: 'bi-arrow-left-right'
      },
      {
        to: '/library/fines',
        label: 'Fines',
        icon: 'bi-cash-coin'
      }
    ]
  },
  {
    title: 'Insights',
    items: [
      {
        to: '/library/inventory',
        label: 'Library Insights',
        icon: 'bi-clipboard-data'
      },
      {
        to: '/library/reports',
        label: 'Reports',
        icon: 'bi-graph-up'
      }
    ]
  }
]
