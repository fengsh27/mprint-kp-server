import pandas as pd
import numpy as np
import os
import matplotlib.colors as mcolors
from wordcloud import WordCloud
from collections import Counter


def create_circular_mask(w, h):
    """generate a circular mask"""
    x, y = np.ogrid[:h, :w]
    center_x, center_y = w // 2, h // 2
    dist = np.sqrt((x - center_x)**2 + (y - center_y)**2)
    return (dist <= min(center_x, center_y)).astype(np.uint8) * 255

def generate_mesh_wordcloud(data_df, exclude_keywords, output_file="wordcloud.svg", theme="green"):
    """
    Generate MeSH-based word cloud and save.
    Parameters:
    - data_df: Pandas DataFrame including MeSH term columns, including the papers need to be ranked.
    - exclude_keywords: synonyms of searched keywords.
    - output_file: output file name
    - theme: color options, green/blue/orange
    """
    
    # Stop Words (high freq useless terms)
    stop_words = ['Humans','Female','Male','Adult','Middle Aged','Young Adult',
                  'Aged','Animals','Surveys and Questionnaires']
    
    # color list for each color theme
    palettes = {
        'blue': ['#4E79A7', '#5E85B8', '#3E6582', '#2E4E62'],
        'orange': ['#F28E2B', '#F4A65A', '#F7C788', '#D77A1B'],
        'green': ['#70AD47', '#80BB59', '#588938', '#42662A']
    }
    current_palette = palettes.get(theme, palettes['green'])

    
    # preprocess MeSH terms
    target_columns = ['MeSH terms (Descriptor)', 'MeSH terms (Qualifier)']
    
    all_phrases = []
    for col_name in target_columns:
        if col_name in data_df.columns:
            for cell in data_df[col_name].dropna():
                parts = [p.strip() for p in cell.split('|||') if p.strip()]
                all_phrases.extend(parts)
        else:
            print(f"Warning: Column '{col_name}' not found in dataframe. Skipping.")

    if not all_phrases:
        print("Error: No text data found in the specified MeSH columns.")
        return
    
    # Count term frequency  
    selected_freq = Counter(all_phrases)

    # remove stop words from frequency list
    freq_clean_stop_words = {
        word: count 
        for word, count in selected_freq.items() 
        if word not in stop_words
    }
    
    # remove search keywords from frequency list
    freq_clean = {
        word: count 
        for word, count in freq_clean_stop_words.items() 
        if not any(bad_word.lower() in word.lower() for bad_word in exclude_keywords)
    }

    if not freq_clean:
        print("Warning: No words left to plot after filtering!")
        return

    # plot
    W, H = 2000, 2000
    raw_mask = create_circular_mask(W, H)
    mask = 255 - raw_mask
    cmap = mcolors.LinearSegmentedColormap.from_list('custom_palette', current_palette)
    wc = WordCloud(
        width=W,
        height=H,
        background_color='white',
        mask=mask,
        colormap=cmap,
        collocations=False
    ).generate_from_frequencies(freq_clean)

    # Save the image
    svg_data = wc.to_svg()
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(svg_data)
        print(f"Success: Saved wordcloud as '{output_file}' using theme '{theme}'")
    except IOError as e:
        print(f"Error saving file: {e}")



if __name__ == "__main__":
    
    # data input
    base_folder = '/users/PCON0020/liuxf2021/2025_07_ranking_task/a_keyword_ranking'
    INPUT_FILE = 'final_clean_publication_prediction_maternal_251015.txt'
    all_publication = pd.read_csv(os.path.join(base_folder, INPUT_FILE), sep='$')
    
    # keyword input (searched keywords)
    my_keywords = ['infant', 'clinical trial']

    #plot and save image.
    generate_mesh_wordcloud(
        data_df=my_selected_paper,  # input data
        exclude_keywords=my_keywords, # input keywords
        output_file="result_green.svg", # set output name
        theme="green" # set color
    )