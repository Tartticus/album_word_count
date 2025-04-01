
import tkinter as tk
from tkinter import ttk, messagebox
import requests
from bs4 import BeautifulSoup
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




def console():
    artist_name = input("\nEnter the artist name: \n").lower()
    artist_id = get_spotify_artist_id(artist_name)

    if not artist_id:
        print("Artist not found on Spotify.")
        

    albums = get_spotify_albums(artist_id)
    if not albums:
        print("No albums found.")
        

    album_names = list(albums.keys())
    print("\n Albums found:")
    for idx, name in enumerate(album_names, 1):
        print(f"{idx}. {name}")

    while True:
        try:
            selected = int(input("\nEnter the number of the album you'd like to check: \n"))
            if 1 <= selected <= len(album_names):
                selected_album = album_names[selected - 1]
                album_id = albums[selected_album]
                break
            else:
                print("Please enter a valid number from the list.")
        except ValueError:
            print("Invalid input. Please enter a number.")

    word = input("\nEnter the word you'd like to search for: \n").strip().lower()

    # Normalize artist name for consistency in DB
    normalized_artist = artist_name.strip().lower()

    # Check cache
    cached = check_duckdb_cache(normalized_artist, selected_album, word)
    if cached:
        count, art = cached
        print(f"\n🗃 Cache hit! The word '{word}' appears {count} time(s) in '{selected_album}'.")
    else:
        print("\n Searching for lyrics and counting word occurrences...")
        count, album_art = count_word_occurrences(album_id, artist_name, word)
        store_in_duckdb(normalized_artist, selected_album, word, count, album_art)
        print(f"\n✅ The word '{word}' appears {count} time(s) in '{selected_album}'.")













# Function to update Treeview with latest df
def update_treeview():
    tree.delete(*tree.get_children())
    for _, row in df.iterrows():
        tree.insert("", "end", values=(row["Artist"], row["Album"], row["Word"], row["Count"]))

# Function to handle word counting and update df + treeview
def handle_word_count():
    artist_name = artist_entry.get().strip().lower()
    album_name = album_dropdown.get().strip()
    word = word_entry.get().strip().lower()

    if not artist_name or not album_name or not word:
        messagebox.showerror("Error", "Please fill out all fields.")
        return

    album_id = album_map.get(album_name)
    if not album_id:
        messagebox.showerror("Error", "Invalid album selected.")
        return

    cached_result = check_duckdb_cache(artist_name, album_name, word)
    if cached_result:
        count, album_art = cached_result
        messagebox.showinfo("Cache Hit", f"The word '{word}' appears {count} times in '{album_name}'.")
    else:
        count, album_art = count_word_occurrences(album_id, artist_name, word)
        store_in_duckdb(artist_name, album_name, word, count, album_art)
        messagebox.showinfo("Result", f"The word '{word}' appears {count} times in '{album_name}'.")

    global df
    if not ((df['Album'] == album_name) & (df['Word'] == word)).any():
        new_data = pd.DataFrame({'Artist': [artist_name], 'Album': [album_name], 'Word': [word], 'Count': [count], 'Album Art': [album_art]})
        df = pd.concat([df, new_data], ignore_index=True)
        update_treeview()
    else:
        messagebox.showinfo("Duplicate", "This word has already been counted for the selected album.")

# Function to update albums in dropdown after artist search
def update_albums_dropdown(artist_name):
    artist_id = get_spotify_artist_id(artist_name)
    if not artist_id:
        messagebox.showerror("Error", "Artist not found.")
        return
    albums = get_spotify_albums(artist_id)
    if albums:
        album_map.clear()
        album_map.update(albums)
        album_dropdown["values"] = list(albums.keys())
        if albums:
            album_dropdown.current(0)
    else:
        messagebox.showerror("Error", "No albums found.")

# Plot function with album art
def plot_results():
    global df
    if df.empty:
        messagebox.showinfo("No Data", "No data to plot.")
        return

    grouped = df.groupby(['Album', 'Word']).sum().reset_index()
    unique_albums = grouped['Album'].unique()
    word_groups = grouped['Word'].unique()
    bar_width = 0.35
    bar_positions = np.arange(len(unique_albums))

    fig, ax = plt.subplots(figsize=(12, 6))

    for word in word_groups:
        word_data = grouped[grouped['Word'] == word]
        ax.bar(word_data['Album'], word_data['Count'], width=bar_width, label=word)

    for i, (album, word, count) in enumerate(zip(grouped['Album'], grouped['Word'], grouped['Count'])):
        ax.text(i, count + 0.5, f'{word}', ha='center', va='bottom', fontsize=10)

    ax.set_ylabel('Word Occurrences')
    ax.set_title('Word Occurrences per Album')
    ax.set_xticks(bar_positions)
    ax.set_xticklabels([''] * len(unique_albums))  # Hide text labels

    for i, (album, art_url, count) in enumerate(zip(grouped['Album'], df['Album Art'], grouped['Count'])):
        if art_url:
            try:
                response = requests.get(art_url)
                img = Image.open(BytesIO(response.content))
                img.thumbnail((50, 50), Image.LANCZOS)
                x_position = (i + 0.5) / len(unique_albums)
                img_axis = fig.add_axes([x_position - 0.05, -0.1, 0.1, 0.1], anchor='C', zorder=-1)
                img_axis.imshow(img)
                img_axis.axis('off')
            except Exception as e:
                print(f"Error loading image for {album}: {e}")

    plt.subplots_adjust(bottom=0.03)
    plt.legend(title='Words')
    plt.show()

# ---------- GUI Setup ----------
root = tk.Tk()
root.title("Lyrics Word Counter")
root.geometry("700x500")
root.configure(bg="#1c1c3c")

album_map = {}

tk.Label(root, text="Artist Name:", bg="#1c1c3c", fg="white").pack(pady=5)
artist_entry = tk.Entry(root, width=40)
artist_entry.pack()

tk.Label(root, text="Select Album:", bg="#1c1c3c", fg="white").pack(pady=5)
album_dropdown = ttk.Combobox(root, width=40, state="readonly")
album_dropdown.pack()

tk.Label(root, text="Word to Count:", bg="#1c1c3c", fg="white").pack(pady=5)
word_entry = tk.Entry(root, width=40)
word_entry.pack()

button_frame = tk.Frame(root, bg="#1c1c3c")
button_frame.pack(pady=10)

tk.Button(button_frame, text="Search Artist", command=lambda: update_albums_dropdown(artist_entry.get())).grid(row=0, column=0, padx=10)
tk.Button(button_frame, text="Count Word", command=handle_word_count).grid(row=0, column=1, padx=10)
tk.Button(button_frame, text="Plot Results", command=plot_results).grid(row=0, column=2, padx=10)

result_frame = tk.Frame(root)
result_frame.pack(pady=10, fill=tk.BOTH, expand=True)

tree = ttk.Treeview(result_frame, columns=("Artist", "Album", "Word", "Count"), show="headings")
for col in ("Artist", "Album", "Word", "Count"):
    tree.heading(col, text=col)
    tree.column(col, anchor="center", width=120)

tree.pack(fill=tk.BOTH, expand=True)

root.mainloop()