export const libraryNavGroups = [
  {
    title: 'Library',
    static: true,
    items: [
      {
        to: '/library',
        label: 'Dashboard',
        icon: 'bi-speedometer2',
        exact: true
      }
    ]
  },
  {
    title: 'Creation',
    items: [
      {
        to: '/library/books/categories',
        label: 'Categories',
        icon: 'bi-tags',
        exact: true
      },
      {
        to: '/library/settings',
        label: 'Charges & Penalties',
        icon: 'bi-gear',
        exact: true
      }
    ]
  },
  {
    title: 'Catalog',
    items: [
      {
        to: '/library/books',
        label: 'Book Entry',
        icon: 'bi-journal-plus',
        exact: true
      },
      {
        to: '/library/books/all',
        label: 'View Books',
        icon: 'bi-journal-text',
        exact: true
      }
    ]
  },
  {
    title: 'Book Activity',
    items: [
      {
        to: '/library/circulation',
        label: 'Book issue & return',
        icon: 'bi-arrow-left-right',
        exact: true
      },
      {
        to: '/library/fines',
        label: 'Fines Collection',
        icon: 'bi-cash-coin',
        exact: true
      }
    ]
  },

  {
    title: 'Reports',
    items: [
      {
        to: '/library/reports',
        label: 'Reports',
        icon: 'bi-graph-up',
        exact: true
      },
      {
        to: '/library/history',
        label: 'Student History',
        icon: 'bi-clock-history',
        exact: true
      }
    ]
  }
]
