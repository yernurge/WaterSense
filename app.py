from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta
import sqlite3
import os

app = Flask(__name__)

# Configuration
DATABASE = 'database.db'
# Тариф: 480 ₸ за 1 кубометр (1 м³ = 1000 литров)
WATER_COST_PER_CUBIC_METER = 480
WATER_COST_PER_LITER = WATER_COST_PER_CUBIC_METER / 1000


# Database initialization
def init_db():
    """Initialize the database and create tables if they don't exist"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS water_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            liters REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Create meter_readings table for payment feature
    # Assumption: ts is stored in UTC, month boundaries computed in local time
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS meter_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts DATETIME NOT NULL,
            liters REAL NOT NULL
        )
    ''')
    conn.commit()
    conn.close()
    print("Database initialized successfully")

def get_db_connection():
    """Get a database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def add_test_data():
    """Add test data for demonstration if database is empty"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM water_data')
    count = cursor.fetchone()['count']
    
    if count == 0:
        print("Adding test data for demonstration...")
        # Add data for the last 30 days
        for i in range(30, 0, -1):
            date = datetime.now() - timedelta(days=i)
            # Generate random-ish data (between 10-20 liters per day)
            liters = 12 + (i % 8)
            cursor.execute(
                'INSERT INTO water_data (liters, timestamp) VALUES (?, ?)',
                (liters, date.strftime('%Y-%m-%d %H:%M:%S'))
            )
        conn.commit()
        print("Test data added successfully")
    conn.close()

def add_meter_readings_test_data():
    """Add test data to meter_readings table for payment feature
    
    This function populates the meter_readings table with sample data
    for the current month and previous month to allow testing of the
    payment functionality.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if meter_readings already has data
    cursor.execute('SELECT COUNT(*) as count FROM meter_readings')
    count = cursor.fetchone()['count']
    
    if count == 0:
        print("Adding meter readings test data...")
        now = datetime.now()
        
        # Add data for current month (daily readings)
        for day in range(1, now.day + 1):
            try:
                reading_date = datetime(now.year, now.month, day, 12, 0, 0)
                # Vary consumption: 3-7 liters per reading
                liters = 3.0 + (day % 5) * 1.0 + (day % 3) * 0.5
                
                cursor.execute(
                    'INSERT INTO meter_readings (ts, liters) VALUES (?, ?)',
                    (reading_date.strftime('%Y-%m-%d %H:%M:%S'), liters)
                )
            except ValueError:
                # Skip invalid dates
                continue
        
        # Add data for previous month
        if now.month == 1:
            prev_month = 12
            prev_year = now.year - 1
        else:
            prev_month = now.month - 1
            prev_year = now.year
        
        # Determine days in previous month
        if prev_month in [1, 3, 5, 7, 8, 10, 12]:
            days_in_prev_month = 31
        elif prev_month in [4, 6, 9, 11]:
            days_in_prev_month = 30
        else:
            # February - simple check
            if prev_year % 4 == 0 and (prev_year % 100 != 0 or prev_year % 400 == 0):
                days_in_prev_month = 29
            else:
                days_in_prev_month = 28
        
        for day in range(1, days_in_prev_month + 1):
            try:
                reading_date = datetime(prev_year, prev_month, day, 12, 0, 0)
                liters = 4.0 + (day % 7) * 0.8
                
                cursor.execute(
                    'INSERT INTO meter_readings (ts, liters) VALUES (?, ?)',
                    (reading_date.strftime('%Y-%m-%d %H:%M:%S'), liters)
                )
            except ValueError:
                continue
        
        conn.commit()
        print(f"Meter readings test data added for {prev_month}/{prev_year} and {now.month}/{now.year}")
    
    conn.close()

# Routes
@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/receive_data', methods=['POST'])
def receive_data():
    """Receive data from ESP32"""
    try:
        data = request.get_json()
        if not data or 'liters' not in data:
            return jsonify({'status': 'error', 'message': 'Missing liters parameter'}), 400
        
        liters = float(data['liters'])
        
        # Save to database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO water_data (liters) VALUES (?)',
            (liters,)
        )
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'ok',
            'received': liters,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/get_data')
def get_data():
    """Get water consumption data for frontend"""
    try:
        # Get time range parameter (default: last 30 days)
        days = request.args.get('days', 30, type=int)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get data grouped by day
        cursor.execute('''
            SELECT 
                DATE(timestamp) as date,
                SUM(liters) as total_liters
            FROM water_data
            WHERE timestamp >= datetime('now', '-' || ? || ' days')
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        ''', (days,))
        
        rows = cursor.fetchall()
        
        dates = [row['date'] for row in rows]
        liters = [round(row['total_liters'], 2) for row in rows]
        
        # Get today's consumption
        cursor.execute('''
            SELECT COALESCE(SUM(liters), 0) as today_liters
            FROM water_data
            WHERE DATE(timestamp) = DATE('now')
        ''')
        today_data = cursor.fetchone()
        today_liters = round(today_data['today_liters'], 2)
        
        # Get total consumption
        cursor.execute('SELECT COALESCE(SUM(liters), 0) as total FROM water_data')
        total_data = cursor.fetchone()
        total_liters = round(total_data['total'], 2)
        
        # Get average for last 7 days
        cursor.execute('''
            SELECT COALESCE(AVG(daily_total), 0) as avg_liters
            FROM (
                SELECT SUM(liters) as daily_total
                FROM water_data
                WHERE timestamp >= datetime('now', '-7 days')
                GROUP BY DATE(timestamp)
            )
        ''')
        avg_data = cursor.fetchone()
        avg_liters = round(avg_data['avg_liters'], 2)
        
        conn.close()
        
        return jsonify({
            'dates': dates,
            'liters': liters,
            'today_liters': today_liters,
            'today_cost': round(today_liters * WATER_COST_PER_LITER, 4),
            'total_liters': total_liters,
            'total_cost': round(total_liters * WATER_COST_PER_LITER, 4),
            'avg_7days': avg_liters,
            'cost_per_liter': WATER_COST_PER_LITER
        })
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/reset', methods=['POST'])
def reset_data():
    """Reset all data in the database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM water_data')
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'ok',
            'message': 'Database cleared successfully'
        })
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/pay')
def pay_page():
    """Страница оплаты — данные берутся из water_data (реальные с датчика)"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    # Суммарный расход за текущий месяц из water_data
    cursor.execute("""
        SELECT SUM(liters)
        FROM water_data
        WHERE strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')
    """)
    total_liters = cursor.fetchone()[0] or 0

    # Последнее показание
    cursor.execute("""
        SELECT timestamp, liters
        FROM water_data
        ORDER BY timestamp DESC
        LIMIT 1
    """)
    last_reading = cursor.fetchone()

    conn.close()

    # Пересчитываем в деньги
    total_cost = total_liters * WATER_COST_PER_LITER

    return render_template(
        'pay.html',
        total_liters=round(total_liters, 2),
        total_cost=round(total_cost, 2),
        last_reading=last_reading
    )

@app.route('/api/consumption')
def get_consumption():
    """Get water consumption summary for a specific month
    
    Query params:
        month: YYYY-MM format (optional, defaults to current month)
    
    Returns:
        JSON with month summary, total liters, price, and daily breakdown
    """
    try:
        # Get month parameter or use current month
        month_param = request.args.get('month')
        
        if month_param:
            # Parse YYYY-MM format
            try:
                year, month = map(int, month_param.split('-'))
                target_date = datetime(year, month, 1)
            except (ValueError, AttributeError):
                return jsonify({'error': 'Invalid month format. Use YYYY-MM'}), 400
        else:
            # Use current month
            now = datetime.now()
            target_date = datetime(now.year, now.month, 1)
        
        # Calculate month boundaries
        start_of_month = target_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Calculate start of next month
        if start_of_month.month == 12:
            start_of_next_month = start_of_month.replace(year=start_of_month.year + 1, month=1)
        else:
            start_of_next_month = start_of_month.replace(month=start_of_month.month + 1)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get total consumption for the month from meter_readings
        cursor.execute('''
            SELECT COALESCE(SUM(liters), 0) as total_liters
            FROM meter_readings
            WHERE ts >= ? AND ts < ?
        ''', (start_of_month.strftime('%Y-%m-%d %H:%M:%S'), 
              start_of_next_month.strftime('%Y-%m-%d %H:%M:%S')))
        
        result = cursor.fetchone()
        total_liters = round(result['total_liters'], 2)
        
        # Get daily breakdown
        cursor.execute('''
            SELECT 
                DATE(ts) as date,
                SUM(liters) as liters
            FROM meter_readings
            WHERE ts >= ? AND ts < ?
            GROUP BY DATE(ts)
            ORDER BY date ASC
        ''', (start_of_month.strftime('%Y-%m-%d %H:%M:%S'),
              start_of_next_month.strftime('%Y-%m-%d %H:%M:%S')))
        
        breakdown_rows = cursor.fetchall()
        breakdown = [
            {'date': row['date'], 'liters': round(row['liters'], 2)}
            for row in breakdown_rows
        ]
        
        conn.close()
        
        # Calculate total amount
        total_amount = round(total_liters * WATER_COST_PER_LITER, 3)
        
        # Format display month (e.g., "October 2025")
        month_names_en = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December']
        month_names_ru = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                         'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
        
        display_month_en = f"{month_names_en[start_of_month.month - 1]} {start_of_month.year}"
        display_month_ru = f"{month_names_ru[start_of_month.month - 1]} {start_of_month.year}"
        
        return jsonify({
            'month': start_of_month.strftime('%Y-%m'),
            'displayMonth': display_month_ru,
            'displayMonthEn': display_month_en,
            'liters': total_liters,
            'price_per_liter': WATER_COST_PER_LITER,
            'total_amount': total_amount,
            'breakdown': breakdown
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pay', methods=['POST'])
def process_payment():
    """Simulate payment processing
    
    Request body:
        {
            "method": "Kaspi" | "Halyk" | "Apple Pay" | "PayPal",
            "amount": 0.128
        }
    
    Returns:
        JSON with success status and message
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Missing request body'}), 400
        
        method = data.get('method')
        amount = data.get('amount')
        
        if not method:
            return jsonify({'error': 'Missing payment method'}), 400
        
        if amount is None:
            return jsonify({'error': 'Missing amount'}), 400
        
        try:
            amount = float(amount)
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid amount format'}), 400
        
        # Simulate successful payment
        # In a real application, this would integrate with actual payment gateways
        return jsonify({
            'success': True,
            'message': 'Payment simulated successfully',
            'method': method,
            'amount': amount,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Initialize database on startup
    init_db()
    
    # Add test data if database is empty
    add_test_data()
    add_meter_readings_test_data()
    
    # Run the Flask app
    print("Starting Smart Water Meter application...")
    print("Server running at http://localhost:5000")
    print("API endpoints:")
    print("  - POST /receive_data - Receive data from ESP32")
    print("  - GET /get_data - Get consumption data")
    print("  - POST /reset - Clear all data")
    print("  - GET /pay - Payment page")
    print("  - GET /api/consumption?month=YYYY-MM - Get monthly consumption")
    print("  - POST /api/pay - Process payment (simulated)")
    
    app.run(debug=True, host='0.0.0.0', port=5000)   