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
  getOrdersHistory: (from, to, userId = null) =>
    invoke('get_orders_history', { from, to, userId }),
  createOrder: (tableId, userId = null) => invoke('create_order', { tableId, userId }),
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
  getUserReport: (userId, from, to) => invoke('get_user_report', { userId, from, to }),

  // Auth / Users
  authenticate: (username, password) => invoke('authenticate', { username, password }),
  getUsers: () => invoke('get_users'),
  addUser: (username, password, role, fullName = null) =>
    invoke('add_user', { username, password, role, fullName }),
  updateUser: (id, username, role, fullName, active) =>
    invoke('update_user', { id, username, role, fullName, active }),
  deleteUser: (id) => invoke('delete_user', { id }),
  changePassword: (id, newPassword) => invoke('change_password', { id, newPassword }),

  // Printers
  getPrinters: () => invoke('get_printers'),
  printKitchenTicket: (printerName, content) =>
    invoke('print_kitchen_ticket', { printerName, content }),

  // Admin invoice edit
  adminEditOrder: (id, note, discount) => invoke('admin_edit_order', { id, note, discount }),
};
