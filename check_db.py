import sqlite3

# Connect to database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Check meter_readings count
cursor.execute('SELECT COUNT(*) FROM meter_readings')
count = cursor.fetchone()[0]
print(f'Total meter_readings: {count}')

# Get monthly summary
cursor.execute('''
    SELECT 
        strftime('%Y-%m', ts) as month,
        COUNT(*) as reading_count,
        SUM(liters) as total_liters
    FROM meter_readings
    GROUP BY strftime('%Y-%m', ts)
    ORDER BY month DESC
''')

print('\nMonthly Summary:')
print('-' * 50)
for row in cursor.fetchall():
    month, count, total = row
    print(f'{month}: {count} readings, {total:.2f} liters')

# Get recent readings
print('\nRecent 5 readings:')
print('-' * 50)
cursor.execute('SELECT ts, liters FROM meter_readings ORDER BY ts DESC LIMIT 5')
for row in cursor.fetchall():
    ts, liters = row
    print(f'{ts}: {liters:.2f} liters')

conn.close()
