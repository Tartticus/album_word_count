import os
import lyricsgenius


# Replace with your Genius API token 
GENIUS_ACCESS_TOKEN = os.getenv("Rap_Genius_Access_Token")
genius = lyricsgenius.Genius(GENIUS_ACCESS_TOKEN)


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
