use rusqlite::{Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

fn hash_pw(password: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(password.as_bytes());
    format!("{:x}", h.finalize())
}

pub struct DbState(pub Mutex<Connection>);

// ========== Models ==========

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MenuItem {
    pub id: i64,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub name: String,
    pub price: f64,
    pub description: Option<String>,
    pub available: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TableRow {
    pub id: i64,
    pub number: i64,
    pub name: Option<String>,
    pub capacity: i64,
    pub status: String,
    pub current_order_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Order {
    pub id: i64,
    pub table_id: Option<i64>,
    pub table_number: Option<i64>,
    pub status: String,
    pub total: f64,
    pub discount: f64,
    pub note: Option<String>,
    pub created_at: String,
    pub closed_at: Option<String>,
    pub user_id: Option<i64>,
    pub user_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrderItem {
    pub id: i64,
    pub order_id: i64,
    pub menu_item_id: i64,
    pub item_name: String,
    pub quantity: i64,
    pub price: f64,
    pub subtotal: f64,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrderDetail {
    pub order: Order,
    pub items: Vec<OrderItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyReport {
    pub date: String,
    pub total_orders: i64,
    pub total_revenue: f64,
    pub orders: Vec<Order>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub full_name: Option<String>,
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserReport {
    pub user_id: i64,
    pub user_name: String,
    pub full_name: Option<String>,
    pub from_date: String,
    pub to_date: String,
    pub total_orders: i64,
    pub total_revenue: f64,
    pub orders: Vec<Order>,
}

// ========== DB Init ==========

fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS categories (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            color      TEXT NOT NULL DEFAULT '#f59e0b',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS menu_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            name        TEXT NOT NULL,
            price       REAL NOT NULL DEFAULT 0,
            description TEXT,
            available   INTEGER NOT NULL DEFAULT 1,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tables (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            number   INTEGER NOT NULL UNIQUE,
            name     TEXT,
            capacity INTEGER NOT NULL DEFAULT 4,
            status   TEXT NOT NULL DEFAULT 'available'
        );

        CREATE TABLE IF NOT EXISTS orders (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            table_id   INTEGER REFERENCES tables(id) ON DELETE SET NULL,
            user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
            status     TEXT NOT NULL DEFAULT 'open',
            total      REAL NOT NULL DEFAULT 0,
            discount   REAL NOT NULL DEFAULT 0,
            note       TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at  DATETIME
        );

        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL DEFAULT 'cashier',
            full_name     TEXT,
            active        INTEGER NOT NULL DEFAULT 1,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
            quantity     INTEGER NOT NULL DEFAULT 1,
            price        REAL NOT NULL DEFAULT 0,
            note         TEXT
        );",
    )?;

    conn.execute_batch(
        "INSERT OR IGNORE INTO settings(key, value) VALUES ('restaurant_name', 'My Restaurant');
         INSERT OR IGNORE INTO settings(key, value) VALUES ('currency', '$');
         INSERT OR IGNORE INTO settings(key, value) VALUES ('tax_rate', '0');
         INSERT OR IGNORE INTO settings(key, value) VALUES ('receipt_footer', 'Thank you for dining with us!');
         INSERT OR IGNORE INTO settings(key, value) VALUES ('kitchen_printer', '');
         INSERT OR IGNORE INTO settings(key, value) VALUES ('receipt_printer', '');",
    )?;

    // Safe migrations for existing DBs
    let _ = conn.execute("ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id)", []);
    let _ = conn.execute("ALTER TABLE orders ADD COLUMN discount REAL NOT NULL DEFAULT 0", []);

    // Create default admin if no users exist
    let user_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))
        .unwrap_or(0);
    if user_count == 0 {
        let hash = hash_pw("admin123");
        let _ = conn.execute(
            "INSERT INTO users(username, password_hash, role, full_name) VALUES('admin', ?1, 'admin', 'Administrator')",
            [&hash],
        );
    }

    Ok(())
}

// ========== Settings ==========

#[tauri::command]
fn get_settings(state: State<DbState>) -> Result<serde_json::Value, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;
    let mut map = serde_json::Map::new();
    let rows = stmt
        .query_map([], |row| {
            let k: String = row.get(0)?;
            let v: String = row.get(1)?;
            Ok((k, v))
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (k, v) = row.map_err(|e| e.to_string())?;
        map.insert(k, serde_json::Value::String(v));
    }
    Ok(serde_json::Value::Object(map))
}

#[tauri::command]
fn set_setting(key: String, value: String, state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings(key,value) VALUES(?1,?2)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [&key, &value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ========== Categories ==========

#[tauri::command]
fn get_categories(state: State<DbState>) -> Result<Vec<Category>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, color FROM categories ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
fn add_category(name: String, color: String, state: State<DbState>) -> Result<Category, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO categories(name, color) VALUES(?1, ?2)",
        [&name, &color],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Category { id, name, color })
}

#[tauri::command]
fn update_category(
    id: i64,
    name: String,
    color: String,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE categories SET name=?1, color=?2 WHERE id=?3",
        rusqlite::params![name, color, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_category(id: i64, state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM categories WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========== Menu Items ==========

#[tauri::command]
fn get_menu_items(state: State<DbState>) -> Result<Vec<MenuItem>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.category_id, c.name, m.name, m.price, m.description, m.available
             FROM menu_items m
             LEFT JOIN categories c ON m.category_id = c.id
             ORDER BY c.name, m.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(MenuItem {
                id: row.get(0)?,
                category_id: row.get(1)?,
                category_name: row.get(2)?,
                name: row.get(3)?,
                price: row.get(4)?,
                description: row.get(5)?,
                available: row.get::<_, i64>(6)? == 1,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
fn add_menu_item(
    category_id: Option<i64>,
    name: String,
    price: f64,
    description: Option<String>,
    state: State<DbState>,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO menu_items(category_id, name, price, description) VALUES(?1,?2,?3,?4)",
        rusqlite::params![category_id, name, price, description],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn update_menu_item(
    id: i64,
    category_id: Option<i64>,
    name: String,
    price: f64,
    description: Option<String>,
    available: bool,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE menu_items SET category_id=?1, name=?2, price=?3, description=?4, available=?5
         WHERE id=?6",
        rusqlite::params![category_id, name, price, description, available as i64, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_menu_item(id: i64, state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM menu_items WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========== Tables ==========

#[tauri::command]
fn get_tables(state: State<DbState>) -> Result<Vec<TableRow>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.number, t.name, t.capacity, t.status,
                    (SELECT id FROM orders WHERE table_id=t.id AND status='open' LIMIT 1)
             FROM tables t
             ORDER BY t.number",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(TableRow {
                id: row.get(0)?,
                number: row.get(1)?,
                name: row.get(2)?,
                capacity: row.get(3)?,
                status: row.get(4)?,
                current_order_id: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
fn add_table(
    number: i64,
    name: Option<String>,
    capacity: i64,
    state: State<DbState>,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO tables(number, name, capacity) VALUES(?1,?2,?3)",
        rusqlite::params![number, name, capacity],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn update_table(
    id: i64,
    number: i64,
    name: Option<String>,
    capacity: i64,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tables SET number=?1, name=?2, capacity=?3 WHERE id=?4",
        rusqlite::params![number, name, capacity, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_table(id: i64, state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tables WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========== Orders ==========

#[tauri::command]
fn get_open_orders(state: State<DbState>) -> Result<Vec<Order>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT o.id, o.table_id, t.number, o.status, o.total,
                    COALESCE(o.discount,0), o.note, o.created_at, o.closed_at,
                    o.user_id, u.username
             FROM orders o
             LEFT JOIN tables t ON o.table_id = t.id
             LEFT JOIN users u ON o.user_id = u.id
             WHERE o.status='open'
             ORDER BY o.created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Order {
                id: row.get(0)?,
                table_id: row.get(1)?,
                table_number: row.get(2)?,
                status: row.get(3)?,
                total: row.get(4)?,
                discount: row.get(5)?,
                note: row.get(6)?,
                created_at: row.get(7)?,
                closed_at: row.get(8)?,
                user_id: row.get(9)?,
                user_name: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
fn get_orders_history(
    from: String,
    to: String,
    user_id: Option<i64>,
    state: State<DbState>,
) -> Result<Vec<Order>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let sql = if user_id.is_some() {
        "SELECT o.id, o.table_id, t.number, o.status, o.total,
                COALESCE(o.discount,0), o.note, o.created_at, o.closed_at,
                o.user_id, u.username
         FROM orders o
         LEFT JOIN tables t ON o.table_id = t.id
         LEFT JOIN users u ON o.user_id = u.id
         WHERE o.status='closed' AND date(o.closed_at) BETWEEN ?1 AND ?2
               AND o.user_id = ?3
         ORDER BY o.closed_at DESC"
    } else {
        "SELECT o.id, o.table_id, t.number, o.status, o.total,
                COALESCE(o.discount,0), o.note, o.created_at, o.closed_at,
                o.user_id, u.username
         FROM orders o
         LEFT JOIN tables t ON o.table_id = t.id
         LEFT JOIN users u ON o.user_id = u.id
         WHERE o.status='closed' AND date(o.closed_at) BETWEEN ?1 AND ?2
         ORDER BY o.closed_at DESC"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let map_row = |row: &rusqlite::Row| {
        Ok(Order {
            id: row.get(0)?,
            table_id: row.get(1)?,
            table_number: row.get(2)?,
            status: row.get(3)?,
            total: row.get(4)?,
            discount: row.get(5)?,
            note: row.get(6)?,
            created_at: row.get(7)?,
            closed_at: row.get(8)?,
            user_id: row.get(9)?,
            user_name: row.get(10)?,
        })
    };
    let rows = if let Some(uid) = user_id {
        stmt.query_map(rusqlite::params![from, to, uid], map_row)
    } else {
        stmt.query_map(rusqlite::params![from, to], map_row)
    }
    .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
fn create_order(table_id: Option<i64>, user_id: Option<i64>, state: State<DbState>) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO orders(table_id, user_id, status) VALUES(?1, ?2, 'open')",
        rusqlite::params![table_id, user_id],
    )
    .map_err(|e| e.to_string())?;
    let order_id = conn.last_insert_rowid();
    if let Some(tid) = table_id {
        conn.execute(
            "UPDATE tables SET status='occupied' WHERE id=?1",
            [tid],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(order_id)
}

#[tauri::command]
fn get_order_details(order_id: i64, state: State<DbState>) -> Result<OrderDetail, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let order = conn
        .query_row(
            "SELECT o.id, o.table_id, t.number, o.status, o.total,
                    COALESCE(o.discount,0), o.note, o.created_at, o.closed_at,
                    o.user_id, u.username
             FROM orders o
             LEFT JOIN tables t ON o.table_id = t.id
             LEFT JOIN users u ON o.user_id = u.id
             WHERE o.id=?1",
            [order_id],
            |row| {
                Ok(Order {
                    id: row.get(0)?,
                    table_id: row.get(1)?,
                    table_number: row.get(2)?,
                    status: row.get(3)?,
                    total: row.get(4)?,
                    discount: row.get(5)?,
                    note: row.get(6)?,
                    created_at: row.get(7)?,
                    closed_at: row.get(8)?,
                    user_id: row.get(9)?,
                    user_name: row.get(10)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT oi.id, oi.order_id, oi.menu_item_id, m.name,
                    oi.quantity, oi.price, oi.quantity * oi.price, oi.note
             FROM order_items oi
             JOIN menu_items m ON oi.menu_item_id = m.id
             WHERE oi.order_id=?1",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map([order_id], |row| {
            Ok(OrderItem {
                id: row.get(0)?,
                order_id: row.get(1)?,
                menu_item_id: row.get(2)?,
                item_name: row.get(3)?,
                quantity: row.get(4)?,
                price: row.get(5)?,
                subtotal: row.get(6)?,
                note: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .map(|r| r.map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(OrderDetail { order, items })
}

#[tauri::command]
fn add_order_item(
    order_id: i64,
    menu_item_id: i64,
    quantity: i64,
    note: Option<String>,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let price: f64 = conn
        .query_row(
            "SELECT price FROM menu_items WHERE id=?1",
            [menu_item_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM order_items WHERE order_id=?1 AND menu_item_id=?2",
            rusqlite::params![order_id, menu_item_id],
            |row| row.get(0),
        )
        .ok();

    if let Some(item_id) = existing {
        conn.execute(
            "UPDATE order_items SET quantity = quantity + ?1 WHERE id=?2",
            rusqlite::params![quantity, item_id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO order_items(order_id, menu_item_id, quantity, price, note)
             VALUES(?1,?2,?3,?4,?5)",
            rusqlite::params![order_id, menu_item_id, quantity, price, note],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "UPDATE orders
         SET total = COALESCE((SELECT SUM(quantity*price) FROM order_items WHERE order_id=?1), 0)
         WHERE id=?1",
        [order_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_order_item_quantity(
    item_id: i64,
    quantity: i64,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let order_id: i64 = conn
        .query_row(
            "SELECT order_id FROM order_items WHERE id=?1",
            [item_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    if quantity <= 0 {
        conn.execute("DELETE FROM order_items WHERE id=?1", [item_id])
            .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE order_items SET quantity=?1 WHERE id=?2",
            rusqlite::params![quantity, item_id],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "UPDATE orders
         SET total = COALESCE((SELECT SUM(quantity*price) FROM order_items WHERE order_id=?1), 0)
         WHERE id=?1",
        [order_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn remove_order_item(item_id: i64, state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let order_id: i64 = conn
        .query_row(
            "SELECT order_id FROM order_items WHERE id=?1",
            [item_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM order_items WHERE id=?1", [item_id])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE orders
         SET total = COALESCE((SELECT SUM(quantity*price) FROM order_items WHERE order_id=?1), 0)
         WHERE id=?1",
        [order_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_order(order_id: i64, state: State<DbState>) -> Result<f64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE orders SET status='closed', closed_at=CURRENT_TIMESTAMP WHERE id=?1",
        [order_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tables SET status='available'
         WHERE id=(SELECT table_id FROM orders WHERE id=?1)",
        [order_id],
    )
    .map_err(|e| e.to_string())?;
    let total: f64 = conn
        .query_row(
            "SELECT total FROM orders WHERE id=?1",
            [order_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(total)
}

#[tauri::command]
fn cancel_order(order_id: i64, state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE orders SET status='cancelled' WHERE id=?1",
        [order_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tables SET status='available'
         WHERE id=(SELECT table_id FROM orders WHERE id=?1)",
        [order_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ========== Reports ==========

#[tauri::command]
fn get_daily_report(date: String, state: State<DbState>) -> Result<DailyReport, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let total_orders: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM orders WHERE status='closed' AND date(closed_at)=?1",
            [&date],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let total_revenue: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total),0) FROM orders WHERE status='closed' AND date(closed_at)=?1",
            [&date],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT o.id, o.table_id, t.number, o.status, o.total,
                    COALESCE(o.discount,0), o.note, o.created_at, o.closed_at,
                    o.user_id, u.username
             FROM orders o
             LEFT JOIN tables t ON o.table_id = t.id
             LEFT JOIN users u ON o.user_id = u.id
             WHERE o.status='closed' AND date(o.closed_at)=?1
             ORDER BY o.closed_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let orders = stmt
        .query_map([&date], |row| {
            Ok(Order {
                id: row.get(0)?,
                table_id: row.get(1)?,
                table_number: row.get(2)?,
                status: row.get(3)?,
                total: row.get(4)?,
                discount: row.get(5)?,
                note: row.get(6)?,
                created_at: row.get(7)?,
                closed_at: row.get(8)?,
                user_id: row.get(9)?,
                user_name: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .map(|r| r.map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(DailyReport {
        date,
        total_orders,
        total_revenue,
        orders,
    })
}

// ========== Auth / Users ==========

#[tauri::command]
fn authenticate(
    username: String,
    password: String,
    state: State<DbState>,
) -> Result<Option<User>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let hash = hash_pw(&password);
    let result = conn.query_row(
        "SELECT id, username, role, full_name, active FROM users WHERE username=?1 AND password_hash=?2 AND active=1",
        rusqlite::params![username, hash],
        |row| Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            role: row.get(2)?,
            full_name: row.get(3)?,
            active: row.get::<_, i64>(4)? != 0,
        }),
    );
    match result {
        Ok(user) => Ok(Some(user)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn get_users(state: State<DbState>) -> Result<Vec<User>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, username, role, full_name, active FROM users ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            role: row.get(2)?,
            full_name: row.get(3)?,
            active: row.get::<_, i64>(4)? != 0,
        }))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
fn add_user(
    username: String,
    password: String,
    role: String,
    full_name: Option<String>,
    state: State<DbState>,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let hash = hash_pw(&password);
    conn.execute(
        "INSERT INTO users(username, password_hash, role, full_name) VALUES(?1,?2,?3,?4)",
        rusqlite::params![username, hash, role, full_name],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn update_user(
    id: i64,
    username: String,
    role: String,
    full_name: Option<String>,
    active: bool,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE users SET username=?1, role=?2, full_name=?3, active=?4 WHERE id=?5",
        rusqlite::params![username, role, full_name, active as i64, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_user(id: i64, state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM users WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn change_password(
    id: i64,
    new_password: String,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let hash = hash_pw(&new_password);
    conn.execute(
        "UPDATE users SET password_hash=?1 WHERE id=?2",
        rusqlite::params![hash, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ========== Printers ==========

#[tauri::command]
fn get_printers() -> Result<Vec<String>, String> {
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"])
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout);
    let printers = text
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();
    Ok(printers)
}

#[tauri::command]
fn print_kitchen_ticket(
    printer_name: String,
    content: String,
) -> Result<(), String> {
    let tmp = std::env::temp_dir().join("kitchen_ticket.txt");
    std::fs::write(&tmp, content).map_err(|e| e.to_string())?;
    let path = tmp.to_string_lossy().to_string();
    std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!("Start-Process -FilePath '{}' -Verb PrintTo -ArgumentList '\"{}\"'", path, printer_name),
        ])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========== Per-User Report ==========

#[tauri::command]
fn get_user_report(
    user_id: i64,
    from: String,
    to: String,
    state: State<DbState>,
) -> Result<UserReport, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let (user_name, full_name): (String, Option<String>) = conn
        .query_row(
            "SELECT username, full_name FROM users WHERE id=?1",
            [user_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    let total_orders: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM orders WHERE status='closed' AND user_id=?1 AND date(closed_at) BETWEEN ?2 AND ?3",
            rusqlite::params![user_id, &from, &to],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let total_revenue: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total),0) FROM orders WHERE status='closed' AND user_id=?1 AND date(closed_at) BETWEEN ?2 AND ?3",
            rusqlite::params![user_id, &from, &to],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT o.id, o.table_id, t.number, o.status, o.total,
                    COALESCE(o.discount,0), o.note, o.created_at, o.closed_at,
                    o.user_id, u.username
             FROM orders o
             LEFT JOIN tables t ON o.table_id = t.id
             LEFT JOIN users u ON o.user_id = u.id
             WHERE o.status='closed' AND o.user_id=?1
                   AND date(o.closed_at) BETWEEN ?2 AND ?3
             ORDER BY o.closed_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let orders = stmt
        .query_map(rusqlite::params![user_id, &from, &to], |row| {
            Ok(Order {
                id: row.get(0)?,
                table_id: row.get(1)?,
                table_number: row.get(2)?,
                status: row.get(3)?,
                total: row.get(4)?,
                discount: row.get(5)?,
                note: row.get(6)?,
                created_at: row.get(7)?,
                closed_at: row.get(8)?,
                user_id: row.get(9)?,
                user_name: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .map(|r| r.map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(UserReport { user_id, user_name, full_name, from_date: from, to_date: to, total_orders, total_revenue, orders })
}

// ========== Admin: Edit Invoice ==========

#[tauri::command]
fn admin_edit_order(
    id: i64,
    note: Option<String>,
    discount: f64,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE orders SET note=?1, discount=?2, total=(
            COALESCE((SELECT SUM(quantity*price) FROM order_items WHERE order_id=?3), 0) - ?2
         ) WHERE id=?3",
        rusqlite::params![note, discount, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ========== Entry Point ==========

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("pos-restaurant");
    std::fs::create_dir_all(&data_dir).expect("Failed to create app data dir");
    let db_path = data_dir.join("pos_restaurant.db");

    let conn = Connection::open(&db_path).expect("Failed to open database");
    init_db(&conn).expect("Failed to initialize database");

    tauri::Builder::default()
        .manage(DbState(Mutex::new(conn)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_setting,
            get_categories,
            add_category,
            update_category,
            delete_category,
            get_menu_items,
            add_menu_item,
            update_menu_item,
            delete_menu_item,
            get_tables,
            add_table,
            update_table,
            delete_table,
            get_open_orders,
            get_orders_history,
            create_order,
            get_order_details,
            add_order_item,
            update_order_item_quantity,
            remove_order_item,
            close_order,
            cancel_order,
            get_daily_report,
            authenticate,
            get_users,
            add_user,
            update_user,
            delete_user,
            change_password,
            get_printers,
            print_kitchen_ticket,
            get_user_report,
            admin_edit_order,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
