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
      }
    ]
  },
  {
    title: 'Circulation',
    items: [
      {
        to: '/library/circulation',
        label: 'Book Outgoing',
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
        to: '/library/reports',
        label: 'Reports',
        icon: 'bi-graph-up'
      }
    ]
  }
]
