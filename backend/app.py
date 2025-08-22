from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from spotify_utils import get_spotify_artist_id, get_spotify_albums
from rap_genius_utils import get_song_info_from_genius, count_word_occurrences, genius
from duckdb_utils import check_duckdb_cache, store_in_duckdb
from dotenv import load_dotenv
import json

load_dotenv()

app = Flask(__name__)
CORS(app)


@app.route("/albums", methods=["POST"])
def get_albums():
    #Endpoint that retrieves album art for various albums
    data = request.get_json()
    artist = data.get("artist", "").strip().lower()

    artist_id = get_spotify_artist_id(artist)
    if not artist_id:
        return jsonify({"error": "Artist not found"}), 404

    albums = get_spotify_albums(artist_id)
    if not albums:
        return jsonify({"error": "No albums found"}), 404

    # Convert to JSON-friendly format
    try:
        album_map =  existing_albums
    except Exception as e:
        existing_albums = None
        album_map = []
        pass
        
    for album in albums.get("items", []):
        if album.get("images"):
            album_map.append({
                "id": album["id"],
                "name": album["name"],
                "images": album["images"]  # this is already an array of {url, height, width}
            })
    existing_albums = album_map
    return jsonify({"albums": album_map})

@app.route("/get-lyrics", methods=["POST"])
def get_lyrics():
    """Endpoint to fetch lyrics for a specific track"""
    data = request.get_json()
    artist = data.get("artist", "").strip()
    track = data.get("track", "").strip()
    
    if not artist or not track:
        return jsonify({"error": "Missing artist or track"}), 400
    
    try:
        lyrics, _ = get_song_info_from_genius(track, artist)
        return jsonify({"lyrics": lyrics})
    except Exception as e:
        print(f"Error fetching lyrics: {e}")
        return jsonify({"lyrics": ""})

@app.route("/count-word-stream", methods=["POST"])
def count_word_stream():
    """Endpoint for counting album words with real-time progress updates"""
    data = request.get_json()
    artist = data.get("artist", "").strip().lower()
    album_id = data.get("albumId")
    album_name = data.get("albumName")
    words = data.get("words", [])

    if not isinstance(words, list):
        return jsonify({"error": "`words` must be a list"}), 400
    
    if not all([artist, album_id, album_name]):
        return jsonify({"error": "Missing required parameters"}), 400
    
    def generate():
        if words:
            word = words[0].strip().lower()
            
            # Check DuckDB cache first
            cached = check_duckdb_cache(artist, album_name, word)
            if cached:
                count, album_art = cached
                result = {
                    "artist": artist,
                    "album": album_name,
                    "word": word,
                    "count": count,
                    "albumArt": album_art,
                    "completed": True
                }
                yield f"data: {json.dumps(result)}\n\n"
            else:
                # Get tracks first to show progress
                from spotify_utils import get_spotify_album_tracks
                tracks = get_spotify_album_tracks(album_id)
                if not tracks:
                    yield f"data: {json.dumps({'error': 'No tracks found'})}\n\n"
                    return
                
                total_tracks = len(tracks)
                word_count = 0
                album_art = None
                
                for idx, track_name in enumerate(tracks, 1):
                    # Send progress update
                    progress_data = {
                        "progress": {
                            "currentSong": track_name,
                            "songIndex": idx,
                            "totalSongs": total_tracks
                        }
                    }
                    yield f"data: {json.dumps(progress_data)}\n\n"
                    
                    # Get lyrics and count
                    from rap_genius_utils import get_song_info_from_genius, normalize_text
                    lyrics, track_album_art = get_song_info_from_genius(track_name, artist)
                    if lyrics:
                        normalized_lyrics = normalize_text(lyrics)
                        normalized_word = normalize_text(word)
                        lyrics_words = normalized_lyrics.split()
                        track_count = lyrics_words.count(normalized_word)
                        word_count += track_count
                        print(f"Track: {track_name}, Word '{word}' found {track_count} times")
                    
                    if track_album_art and not album_art:
                        album_art = track_album_art
                
                count = word_count
                
                store_in_duckdb(artist, album_name, word, count, album_art)
                
                # Send final result
                result = {
                    "artist": artist,
                    "album": album_name,
                    "word": word,
                    "count": count,
                    "albumArt": album_art,
                    "completed": True
                }
                yield f"data: {json.dumps(result)}\n\n"
    
    return Response(generate(), mimetype='text/event-stream',
                   headers={'Cache-Control': 'no-cache',
                           'Connection': 'keep-alive'})

@app.route("/count-word", methods=["POST"])
def count_word():
    # endpoint for counting album words 
    data = request.get_json()
    artist = data.get("artist", "").strip().lower()
    album_id = data.get("albumId")
    album_name = data.get("albumName")
    words = data.get("words", [])

    if not isinstance(words, list):
        return jsonify({"error": "`words` must be a list"}), 400
    
    if not all([artist, album_id, album_name]):
        return jsonify({"error": "Missing required parameters"}), 400
    
    # Process only the first word for now (frontend sends one word at a time)
    if words:
        word = words[0].strip().lower()
        print(f"Processing word '{word}' for album '{album_name}' by artist '{artist}'")
        
        # Check DuckDB cache
        cached = check_duckdb_cache(artist, album_name, word)
        if cached:
            count, album_art = cached
            print(f"Found cached result: {count}")
        else:
            print("No cache found, counting from lyrics...")
            count, album_art = count_word_occurrences(album_id, artist, word)
            store_in_duckdb(artist, album_name, word, count, album_art)
            print(f"Stored new result: {count}")
    
        return jsonify({
            "artist": artist,
            "album": album_name,
            "word": word,
            "count": count,
            "albumArt": album_art
        })
    else:
        return jsonify({"error": "No words provided"}), 400

if __name__ == "__main__":
    app.run(debug=True)