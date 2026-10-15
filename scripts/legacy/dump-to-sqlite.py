"""Convert a phpMyAdmin MySQL dump into a SQLite file (all columns TEXT/raw values)."""
import re
import sqlite3
import sys

src, dst = sys.argv[1], sys.argv[2]

ESC = {"0": "\0", "n": "\n", "r": "\r", "t": "\t", "Z": "\x1a", "b": "\b"}


def parse_values(s, i):
    """Parse '(...),(...);' starting at s[i]; yield tuples."""
    n = len(s)
    rows = []
    while i < n:
        while i < n and s[i] in " \n\r\t,":
            i += 1
        if i >= n or s[i] == ";":
            break
        assert s[i] == "(", s[i:i + 50]
        i += 1
        row = []
        while True:
            while s[i] in " \n\r\t":
                i += 1
            if s[i] == "'":
                i += 1
                buf = []
                while True:
                    c = s[i]
                    if c == "\\":
                        nx = s[i + 1]
                        buf.append(ESC.get(nx, nx))
                        i += 2
                    elif c == "'":
                        if i + 1 < n and s[i + 1] == "'":
                            buf.append("'")
                            i += 2
                        else:
                            i += 1
                            break
                    else:
                        buf.append(c)
                        i += 1
                row.append("".join(buf))
            else:
                j = i
                while s[j] not in ",)":
                    j += 1
                tok = s[i:j].strip()
                i = j
                if tok.upper() == "NULL":
                    row.append(None)
                else:
                    try:
                        row.append(int(tok))
                    except ValueError:
                        try:
                            row.append(float(tok))
                        except ValueError:
                            row.append(tok)
            while s[i] in " \n\r\t":
                i += 1
            if s[i] == ",":
                i += 1
                continue
            if s[i] == ")":
                i += 1
                break
        rows.append(row)
    return rows


with open(src, encoding="utf-8", errors="replace") as f:
    text = f.read()

db = sqlite3.connect(dst)
create_re = re.compile(r"CREATE TABLE `(\w+)` \((.*?)\n\)[^;]*;", re.S)
for m in create_re.finditer(text):
    table, body = m.group(1), m.group(2)
    cols = re.findall(r"^\s*`(\w+)`", body, re.M)
    db.execute(f'DROP TABLE IF EXISTS "{table}"')
    db.execute(f'CREATE TABLE "{table}" ({", ".join(chr(34) + c + chr(34) for c in cols)})')

ins_re = re.compile(r"INSERT INTO `(\w+)` \(([^)]*)\) VALUES\s*")
total = 0
for m in ins_re.finditer(text):
    table = m.group(1)
    cols = [c.strip(" `") for c in m.group(2).split(",")]
    rows = parse_values(text, m.end())
    ph = ",".join("?" * len(cols))
    db.executemany(
        f'INSERT INTO "{table}" ({",".join(chr(34) + c + chr(34) for c in cols)}) VALUES ({ph})', rows
    )
    total += len(rows)
db.commit()
print("rows inserted:", total)
for (t,) in db.execute("select name from sqlite_master where type='table' order by name"):
    print(t, db.execute(f'select count(*) from "{t}"').fetchone()[0])
