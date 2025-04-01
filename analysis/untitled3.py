# -*- coding: utf-8 -*-
"""
Created on Wed Mar 26 02:19:58 2025

@author: Matth
"""

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
        lyrics, _ = genius(track_name, artist_name)
        if lyrics:
            all_lyrics += lyrics + " "  # Concatenate the lyrics from each song

    # Normalize the concatenated lyrics (remove special characters and convert to lowercase)
    all_lyrics = re.sub(r'[^a-zA-Z\s]', '', all_lyrics).lower()

    # Generate the word cloud from the combined lyrics
    WordCloud = wordcloud(width=800, height=400, background_color='white').generate(all_lyrics)

    # Display the word cloud in a new window
    plt.figure(figsize=(10, 5))
    plt.imshow(WordCloud, interpolation='bilinear')
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