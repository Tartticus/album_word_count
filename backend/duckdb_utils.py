import requests
import pandas as pd
from io import BytesIO
import base64
import duckdb 
import os




# Initialize an empty DataFrame to store results
df = pd.DataFrame(columns=['Artist', 'Album', 'Word', 'Count', 'Album Art'])


# Duck DB Database for faster retrieval
con = duckdb.connect(database='lyrics_cache.db')  # Persistent DuckDB database
con.execute('''
    CREATE TABLE IF NOT EXISTS counts (
    Artist TEXT,
    Album TEXT,
    Word TEXT,
    Count INTEGER,
    Album_Art TEXT,
    PRIMARY KEY (Artist, Album, Word)
)

''')
con.close()

# Function to check if a result exists in DuckDB
def check_duckdb_cache(artist_name, album_name, word):
    con = duckdb.connect(database='lyrics_cache.db') 
    result = con.execute(
        "SELECT Count, Album_Art FROM counts WHERE Artist = ? AND Album = ? AND Word = ?",
        [artist_name, album_name, word]
    ).fetchone()
    if result:
        count, album_art = result
        album_art = album_art if album_art and album_art.startswith('http') else None
        return count, album_art
    con.close()
    return None


# Function to store results in DuckDB including album art
def store_in_duckdb(artist_name, album_name, word, count, album_art):
    con = duckdb.connect(database='lyrics_cache.db') 
    # Ensure album_art is a valid URL, otherwise insert NULL
    album_art_url = album_art if album_art and album_art.startswith('http') else None
    con.execute(
        "INSERT INTO counts (Artist, Album, Word, Count, Album_Art) VALUES (?, ?, ?, ?, ?)",
        [artist_name, album_name, word, count, album_art_url]
    )
    con.close()