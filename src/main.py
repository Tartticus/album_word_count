import tkinter as tk
from tkinter import ttk, messagebox
import requests
from bs4 import BeautifulSoup
import re
import os
import threading

# Replace with your Genius API token
GENIUS_API_TOKEN = 'zMs-ogdbxt0F5CzmO52iLZ9A3jgj3ZZQWvNTNyTSm05x7z7yaLgWSlJFMa7cX92f'

# Function to normalize text
def normalize_text(text):
    text = re.sub(r'[^a-zA-Z0-9 ]', '', text)
    return text.lower()

# Function to scrape artist's albums from Genius
def get_artist_albums(artist_name):
    artist_name_normalized = artist_name.replace(" ", "-").lower()
    url = f"https://genius.com/artists/{artist_name_normalized}"
   
    response = requests.get(url)
    if response.status_code != 200:
        return None
   
    soup = BeautifulSoup(response.text, 'html.parser')
    album_tags = soup.find_all('a', class_='mini_card')
   
    albums = {}
    for album in album_tags:
        album_title = album.find('div', class_='mini_card-title').get_text()
        album_id = album['href']  # Link to the album
        albums[album_title] = album_id
   
    return albums

# Function to get lyrics for all songs in an album (scraping approach)
def get_album_songs_and_lyrics(album_url):
    response = requests.get(album_url)
    soup = BeautifulSoup(response.text, 'html.parser')
   
    song_links = [a['href'] for a in soup.find_all('a', class_='u-display_block')]
    lyrics = ""
   
    for link in song_links:
        song_page = requests.get(link)
        song_soup = BeautifulSoup(song_page.text, 'html.parser')
        lyrics_div = song_soup.find('div', class_='lyrics') or song_soup.find('div', class_='Lyrics__Root-sc-1ynbvzw-0')
        if lyrics_div:
            lyrics += lyrics_div.get_text(separator="\n")
   
    return lyrics

# Function to count occurrences of a word in an album's lyrics
def count_word_occurrences(album_url, word):
    lyrics = get_album_songs_and_lyrics(album_url)
    word_count = normalize_text(lyrics).split().count(normalize_text(word))
    return word_count

# Function to update albums dropdown
def update_albums_dropdown(artist_name):
    albums = get_artist_albums(artist_name)
    if albums:
        album_dropdown["values"] = list(albums.keys())
        album_map.update(albums)
    else:
        messagebox.showerror("Error", "No albums found for the given artist")

# Function to handle word count
def handle_word_count():
    artist_name = artist_entry.get()
    album_name = album_dropdown.get()
    word = word_entry.get()

    if not artist_name or not album_name or not word:
        messagebox.showerror("Error", "Please provide all inputs")
        return

    album_url = album_map.get(album_name)
    if not album_url:
        messagebox.showerror("Error", "Invalid album selected")
        return

    count = count_word_occurrences(album_url, word)
    messagebox.showinfo("Word Count", f"The word '{word}' appears {count} times in the album '{album_name}'.")

# Create GUI
root = tk.Tk()
root.title("Lyrics Word Counter")

# Artist input
artist_label = tk.Label(root, text="Artist:")
artist_label.pack(pady=5)
artist_entry = tk.Entry(root, width=50)
artist_entry.pack(pady=5)

# Album selection
album_label = tk.Label(root, text="Select Album:")
album_label.pack(pady=5)
album_map = {}
album_dropdown = ttk.Combobox(root, values=[], width=50)
album_dropdown.pack(pady=5)

# Button to fetch albums
album_button = tk.Button(root, text="Get Albums", command=lambda: update_albums_dropdown(artist_entry.get()))
album_button.pack(pady=5)

# Word input
word_label = tk.Label(root, text="Enter Word to Count:")
word_label.pack(pady=5)
word_entry = tk.Entry(root, width=50)
word_entry.pack(pady=5)

# Button to start word count
count_button = tk.Button(root, text="Count Word", command=handle_word_count)
count_button.pack(pady=20)

# Start the GUI loop
root.mainloop()
