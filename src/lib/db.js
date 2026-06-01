import { invoke } from '@tauri-apps/api/core';

export const db = {
  // Settings
  getSettings: () => invoke('get_settings'),
  setSetting: (key, value) => invoke('set_setting', { key, value }),

  // Categories
  getCategories: () => invoke('get_categories'),
  addCategory: (name, color) => invoke('add_category', { name, color }),
  updateCategory: (id, name, color) => invoke('update_category', { id, name, color }),
  deleteCategory: (id) => invoke('delete_category', { id }),

  // Menu items
  getMenuItems: () => invoke('get_menu_items'),
  addMenuItem: (categoryId, name, price, description) =>
    invoke('add_menu_item', { categoryId, name, price, description }),
  updateMenuItem: (id, categoryId, name, price, description, available) =>
    invoke('update_menu_item', { id, categoryId, name, price, description, available }),
  deleteMenuItem: (id) => invoke('delete_menu_item', { id }),

  // Tables
  getTables: () => invoke('get_tables'),
  addTable: (number, name, capacity) => invoke('add_table', { number, name, capacity }),
  updateTable: (id, number, name, capacity) =>
    invoke('update_table', { id, number, name, capacity }),
  deleteTable: (id) => invoke('delete_table', { id }),

  // Orders
  getOpenOrders: () => invoke('get_open_orders'),
  getOrdersHistory: (from, to) => invoke('get_orders_history', { from, to }),
  createOrder: (tableId) => invoke('create_order', { tableId }),
  getOrderDetails: (orderId) => invoke('get_order_details', { orderId }),
  addOrderItem: (orderId, menuItemId, quantity, note = null) =>
    invoke('add_order_item', { orderId, menuItemId, quantity, note }),
  updateOrderItemQuantity: (itemId, quantity) =>
    invoke('update_order_item_quantity', { itemId, quantity }),
  removeOrderItem: (itemId) => invoke('remove_order_item', { itemId }),
  closeOrder: (orderId) => invoke('close_order', { orderId }),
  cancelOrder: (orderId) => invoke('cancel_order', { orderId }),

  // Reports
  getDailyReport: (date) => invoke('get_daily_report', { date }),
};
