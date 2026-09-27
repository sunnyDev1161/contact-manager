// Every role below OWNER an owner can assign to a staff account. OWNER
// itself is fixed at business registration and never assigned here.
export const ASSIGNABLE_ROLES = [
  { value: 'STAFF', label: 'Cashier' },
  { value: 'ORDER_BOOKER', label: 'Order Booker' },
  { value: 'DELIVERY_RIDER', label: 'Delivery Rider' }
]

// Order Booker and Delivery Rider are accounts for the separate mobile app,
// not this desktop terminal — there's no order-taking or delivery screen
// here for them to use.
export const MOBILE_ONLY_ROLES = ['ORDER_BOOKER', 'DELIVERY_RIDER']

export function roleLabel(role) {
  if (role === 'OWNER') return 'Owner'
  return ASSIGNABLE_ROLES.find(r => r.value === role)?.label || role
}
