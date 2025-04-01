import requests
import re
import pandas as pd
import matplotlib.pyplot as plt
from PIL import Image
from io import BytesIO
import base64
import duckdb 
import os
import lyricsgenius
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allows TSX to talk to Flask backend


def get_spotify_api_token():
    #spotify client ID and secret
    CLIENT_ID = os.getenv("Spotify_Client_ID")
    CLIENT_SECRET = os.getenv("Spotify_Client_Secret")
    
    # Spotify API token URL
    TOKEN_URL = 'https://accounts.spotify.com/api/token'
    
    # Encode Client ID and Secret in Base64
    auth_str = f"{CLIENT_ID}:{CLIENT_SECRET}"
    b64_auth_str = base64.b64encode(auth_str.encode()).decode()
    
    # Prepare headers and data for the token request
    headers = {
        'Authorization': f'Basic {b64_auth_str}',
    }
    data = {
        'grant_type': 'client_credentials',
    }
    
    # Request access token
    response = requests.post(TOKEN_URL, headers=headers, data=data)
    if response.status_code == 200:
        token_response = response.json()
        access_token = token_response['access_token']
        print(f"Access Token: {access_token}")
    else:
        print(f"Failed to get token. Status code: {response.status_code}")
    headers = {
        'Authorization': f'Bearer {access_token}'
    }
    response = requests.get('https://api.spotify.com/v1/artists/{artist_id}/albums', headers=headers)
    return access_token


# Replace with your Genius API token 
GENIUS_ACCESS_TOKEN = os.getenv("Rap_Genius_Access_Token")
genius = lyricsgenius.Genius(GENIUS_ACCESS_TOKEN)


SPOTIFY_API_TOKEN = get_spotify_api_token()

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



# Function to normalize text (remove special characters and make it lowercase)
def normalize_text(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', '', text)
    return text

# Function to search for an artist and get their ID on Spotify
def get_spotify_artist_id(artist_name):
    headers = {
        'Authorization': f'Bearer {SPOTIFY_API_TOKEN}'
    }
    search_url = f"https://api.spotify.com/v1/search?q={artist_name}&type=artist"
    response = requests.get(search_url, headers=headers)
    
    if response.status_code == 200:
        artists = response.json()["artists"]["items"]
        if artists:
            artist_id = artists[0]["id"]
            return artist_id
    return None

# Function to get albums by artist ID on Spotify
def get_spotify_albums(artist_id):
    headers = {
        'Authorization': f'Bearer {SPOTIFY_API_TOKEN}'
    }
    albums_url = f"https://api.spotify.com/v1/artists/{artist_id}/albums"
    response = requests.get(albums_url, headers=headers)

    if response.status_code == 200:
        albums = response.json()["items"]
        album_map = {album["name"]: album["id"] for album in albums}
        return album_map
    return None

# Function to get tracks from an album on Spotify
def get_spotify_album_tracks(album_id):
    headers = {
        'Authorization': f'Bearer {SPOTIFY_API_TOKEN}'
    }
    tracks_url = f"https://api.spotify.com/v1/albums/{album_id}/tracks"
    response = requests.get(tracks_url, headers=headers)
    
    if response.status_code == 200:
        tracks = response.json()["items"]
        track_names = [track["name"] for track in tracks]
        return track_names
    return None

# Function to search for lyrics on Genius using song names and get album art
def get_song_info_from_genius(song_name, artist_name):
    try:
        song = genius.search_song(song_name, artist_name)
        if song:
            lyrics = song.lyrics
            album_art_url = song.song_art_image_url
            return lyrics, album_art_url
        else:
            return "", None
    except Exception as e:
        print(f"Error fetching song from Genius: {e}")
        return "", None

# Function to count occurrences of a word in an album's lyrics and get album art
def count_word_occurrences(album_id, artist_name, word):
    tracks = get_spotify_album_tracks(album_id)
    if not tracks:
        return 0, None

    word_count = 0
    album_art = None
    for track_name in tracks:
        lyrics, track_album_art = get_song_info_from_genius(track_name, artist_name)
        word_count += normalize_text(lyrics).split().count(normalize_text(word))
        if track_album_art and not album_art:  # Get album art from the first track
            album_art = track_album_art
    
    return word_count, album_art

##### DB SECTION #######3

# Function to check if a result exists in DuckDB
def check_duckdb_cache(artist_name, album_name, word):
    result = con.execute(
        "SELECT Count, Album_Art FROM counts WHERE Artist = ? AND Album = ? AND Word = ?",
        [artist_name, album_name, word]
    ).fetchone()
    if result:
        count, album_art = result
        album_art = album_art if album_art and album_art.startswith('http') else None
        return count, album_art
    return None


# Function to store results in DuckDB including album art
def store_in_duckdb(artist_name, album_name, word, count, album_art):
    # Ensure album_art is a valid URL, otherwise insert NULL
    album_art_url = album_art if album_art and album_art.startswith('http') else None
    con.execute(
        "INSERT INTO counts (Artist, Album, Word, Count, Album_Art) VALUES (?, ?, ?, ?, ?)",
        [artist_name, album_name, word, count, album_art_url]
    )


