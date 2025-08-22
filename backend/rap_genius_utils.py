import os
import lyricsgenius
from spotify_utils import get_spotify_album_tracks
import re
from dotenv import load_dotenv

load_dotenv()

# Replace with your Genius API token 
GENIUS_ACCESS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
genius = lyricsgenius.Genius(GENIUS_ACCESS_TOKEN)



def normalize_text(text):
    # Lowercase everything
    text = text.lower()
    
    # Remove punctuation/special characters
    text = re.sub(r'[^a-z0-9\s]', '', text)

    # Replace multiple spaces with one
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

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
def count_word_occurrences(album_id, artist_name, word, progress_callback=None):
    tracks = get_spotify_album_tracks(album_id)
    if not tracks:
        return 0, None

    word_count = 0
    album_art = None
    total_tracks = len(tracks)
    for idx, track_name in enumerate(tracks, 1):
        if progress_callback:
            try:
                progress_callback(track_name, idx, total_tracks)
            except:
                pass  # Ignore generator issues
                
        lyrics, track_album_art = get_song_info_from_genius(track_name, artist_name)
        if lyrics:
            # Normalize both the lyrics and the word for comparison
            normalized_lyrics = normalize_text(lyrics)
            normalized_word = normalize_text(word)
            # Split lyrics into words and count occurrences
            lyrics_words = normalized_lyrics.split()
            word_count += lyrics_words.count(normalized_word)
            print(f"Track: {track_name}, Word '{word}' found {lyrics_words.count(normalized_word)} times")
        if track_album_art and not album_art:  # Get album art from the first track
            album_art = track_album_art
    
    print(f"Total count for '{word}' in album: {word_count}")
    return word_count, album_art
