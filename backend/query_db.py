import sqlite3
import json

conn = sqlite3.connect('safenova.db')
c = conn.cursor()

tables = ["users", "contacts", "emergency_sessions"]
out = {}

for table in tables:
    c.execute(f"SELECT * FROM {table}")
    cols = [d[0] for d in c.description]
    rows = [dict(zip(cols, r)) for r in c.fetchall()]
    out[table] = rows

with open("db_content.txt", "w", encoding="utf-8") as f:
    f.write(json.dumps(out, indent=2))
