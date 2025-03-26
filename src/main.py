
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
# Replace with your Genius API token and Spotify API token
GENIUS_API_TOKEN = os.getenv("Rap_Genius_Client_ID")
SPOTIFY_API_TOKEN = get_spotify_api_token()

# Initialize an empty DataFrame to store results
df = pd.DataFrame(columns=['Artist', 'Album', 'Word', 'Count', 'Album Art'])


# Duck DB Database for faster retrieval
con = duckdb.connect(database='lyrics_cache1.db')  # Persistent DuckDB database
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
    text = re.sub(r'[^a-zA-Z0-9 ]', '', text)
    return text.lower()

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
    headers = {
        'Authorization': f'Bearer {GENIUS_API_TOKEN}'
    }
    search_url = f"https://api.genius.com/search?q={song_name} {artist_name}"
    response = requests.get(search_url, headers=headers)
    
    if response.status_code == 200:
        hits = response.json()["response"]["hits"]
        if hits:
            song_url = hits[0]["result"]["url"]
            album_art_url = hits[0]["result"]["song_art_image_url"]
            return get_song_lyrics(song_url), album_art_url
    return "", None

# Function to scrape song lyrics from a Genius song URL
def get_song_lyrics(song_url):
    page = requests.get(song_url)
    soup = BeautifulSoup(page.text, 'html.parser')
    lyrics_div = soup.find('div', class_='lyrics') or soup.find('div', class_='Lyrics__Root-sc-1ynbvzw-0')
    return lyrics_div.get_text() if lyrics_div else ""

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

# Function to update albums dropdown
def update_albums_dropdown(artist_name):
    artist_id = get_spotify_artist_id(artist_name)
    if not artist_id:
        messagebox.showerror("Error", "Artist not found on Spotify.")
        return
    
    albums = get_spotify_albums(artist_id)
    if albums:
        album_dropdown["values"] = list(albums.keys())
        album_map.update(albums)
    else:
        messagebox.showerror("Error", "No albums found for the given artist on Spotify.")

#function tyhast counts the words

# Function to handle word count and check DuckDB cache first, updating the dialog list below
def handle_word_count():
    artist_name = artist_entry.get().lower()  # Convert artist name to lowercase for search
    album_name = album_dropdown.get()
    word = word_entry.get().lower()  # Convert word to lowercase for search

    if not artist_name or not album_name or not word:
        messagebox.showerror("Error", "Please provide all inputs")
        return

    album_id = album_map.get(album_name)
    if not album_id:
        messagebox.showerror("Error", "Invalid album selected")
        return

    # Initialize album_art variable
    album_art = None

    # Check if the result is already in DuckDB
    cached_result = check_duckdb_cache(artist_name, album_name, word)
    if cached_result is not None:
        count, album_art = cached_result  # Ensure album_art is retrieved from cache if available
        messagebox.showinfo("Cache Hit", f"Retrieved from cache: The word '{word}' appears {count} times in the album '{album_name}'.")
    else:
        count, album_art = count_word_occurrences(album_id, artist_name, word)
        store_in_duckdb(artist_name, album_name, word, count, album_art)
        messagebox.showinfo("Word Count", f"The word '{word}' appears {count} times in the album '{album_name}'.")

    # Append result to the DataFrame
    global df
    # Check if the word is already listed for this album
    if not ((df['Album'] == album_name) & (df['Word'] == word)).any():
        # Ensure album_art is assigned even if not from cache
        new_data = pd.DataFrame({'Artist': [artist_name], 'Album': [album_name], 'Word': [word], 'Count': [count], 'Album Art': [album_art]})
        df = pd.concat([df, new_data], ignore_index=True)
        # Update the dialog list with album and word
        listbox.insert(tk.END, f"Album: {album_name}, Word: {word}")
    else:
        messagebox.showinfo("Info", f"The word '{word}' for album '{album_name}' is already listed.")

    print(df)

#plot results
def plot_results():
    global df
    if df.empty:
        messagebox.showinfo("No Data", "No data to plot.")
        return

    # Group by 'Album' and 'Word' to display multiple words for each album
    grouped = df.groupby(['Album', 'Word']).sum().reset_index()

    # Set up the figure size, adjusting for multiple albums
    fig, ax = plt.subplots(figsize=(12, 6))

    # Unique albums and words
    unique_albums = grouped['Album'].unique()
    word_groups = grouped['Word'].unique()

    # Bar positions for each album
    bar_width = 0.35
    bar_positions = np.arange(len(unique_albums))  # Ensure consistent spacing between bars

    # Plot bars for each word group, with adjusted positions for each album
    for word in word_groups:
        word_data = grouped[grouped['Word'] == word]
        ax.bar(word_data['Album'], word_data['Count'], width=bar_width, label=word)

    # Add word labels on top of each bar
    for i, (album, word, count) in enumerate(zip(grouped['Album'], grouped['Word'], grouped['Count'])):
        ax.text(i, count + 0.5, f'{word}', ha='center', va='bottom', fontsize=10)

    # Set the labels and title
    ax.set_ylabel('Word Occurrences')
    ax.set_title('Word Occurrences per Album')

    # Adjust the x-ticks for the bars
    ax.set_xticks(bar_positions)
    ax.set_xticklabels([''] * len(unique_albums))  # Remove the album text labels

    # Add album art in place of the x-axis labels, centered below the bars
    for i, (album, art_url, count) in enumerate(zip(grouped['Album'], df['Album Art'], grouped['Count'])):
        if art_url:
            try:
                # Fetch and process the album art image
                response = requests.get(art_url)
                img = Image.open(BytesIO(response.content))
                img.thumbnail((50, 50), Image.LANCZOS)  # Resize the album art
                
                # Calculate the position of the image directly below the bar
                x_position = (i + 0.5) / len(unique_albums)  # Centering each image below the corresponding bar
                img_axis = fig.add_axes([x_position - 0.05, -0.1, 0.1, 0.1], anchor='C', zorder=-1)
                img_axis.imshow(img)
                img_axis.axis('off')  # Hide the axis around the image
            except Exception as e:
                print(f"Error loading image for {album}: {e}")

    # Adjust the layout to provide more space for the images
    plt.subplots_adjust(bottom=0.03)  # Increase bottom margin to fit images better
    
    plt.legend(title='Words')
    plt.show()



# Function to generate word cloud for selected album
def generate_word_cloud():
    artist_name = artist_entry.get().lower()  # Fetch artist from input and normalize it
    album_name = album_dropdown.get()  # Fetch the selected album name

    if not artist_name or not album_name:
        messagebox.showerror("Error", "Please provide both artist and album.")
        return

    # Get the album ID from the album_map (already populated in the dropdown)
    album_id = album_map.get(album_name)
    if not album_id:
        messagebox.showerror("Error", "Invalid album selected.")
        return

    # Fetch all tracks in the album using Spotify API
    tracks = get_spotify_album_tracks(album_id)
    if not tracks:
        messagebox.showerror("Error", "No tracks found for the selected album.")
        return

    all_lyrics = ""  # Variable to hold all the lyrics from the album

    for track_name in tracks:
        # Fetch the lyrics for each track using Genius API
        lyrics, _ = get_song_info_from_genius(track_name, artist_name)
        if lyrics:
            all_lyrics += lyrics + " "  # Concatenate the lyrics from each song

    # Normalize the concatenated lyrics (remove special characters and convert to lowercase)
    all_lyrics = re.sub(r'[^a-zA-Z\s]', '', all_lyrics).lower()

    # Generate the word cloud from the combined lyrics
    wordcloud = WordCloud(width=800, height=400, background_color='white').generate(all_lyrics)

    # Display the word cloud in a new window
    plt.figure(figsize=(10, 5))
    plt.imshow(wordcloud, interpolation='bilinear')
    plt.axis('off')
    plt.show()
    
    
# Create GUI
root = tk.Tk()
root.title("Lyrics Word Counter")

# Artist input
artist_label = tk.Label(root, text="Artist:")
artist_label.grid(row=0, column=0, padx=5, pady=5)
artist_entry = tk.Entry(root, width=50)
artist_entry.grid(row=0, column=1, padx=5, pady=5)

# Album selection
album_label = tk.Label(root, text="Select Album:")
album_label.grid(row=1, column=0, padx=5, pady=5)
album_map = {}
album_dropdown = ttk.Combobox(root, values=[], width=50)
album_dropdown.grid(row=1, column=1, padx=5, pady=5)

# Button to fetch albums
album_button = tk.Button(root, text="Get Albums", command=lambda: update_albums_dropdown(artist_entry.get()))
album_button.grid(row=1, column=2, padx=5, pady=5)

# Word input
word_label = tk.Label(root, text="Enter Word to Count:")
word_label.grid(row=2, column=0, padx=5, pady=5)
word_entry = tk.Entry(root, width=50)
word_entry.grid(row=2, column=1, padx=5, pady=5)

# Button to start word count
count_button = tk.Button(root, text="Count Word", command=handle_word_count)
count_button.grid(row=2, column=2, padx=5, pady=5)

# Button to plot results
plot_button = tk.Button(root, text="Plot Results", command=plot_results)
plot_button.grid(row=3, column=2, padx=5, pady=20)

# Add Listbox to display selected albums and words
listbox = tk.Listbox(root, width=50, height=10)
listbox.grid(row=4, column=1, padx=5, pady=5)

#Wordcloud
wordcloud_button = tk.Button(root, text="Generate Word Cloud", command=generate_word_cloud)
wordcloud_button.grid(row=4, column=2, padx=5, pady=20)


# Start the GUI loop
root.mainloop()
