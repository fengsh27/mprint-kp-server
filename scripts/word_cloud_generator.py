import argparse
import csv
from collections import Counter

import matplotlib.colors as mcolors
from wordcloud import WordCloud


STOP_WORDS = {
    "Humans",
    "Female",
    "Male",
    "Adult",
    "Middle Aged",
    "Young Adult",
    "Aged",
    "Animals",
    "Surveys and Questionnaires",
}


PALETTES = {
  "blue": ["#4E79A7", "#5E85B8", "#3E6582", "#2E4E62"],
  "dark_blue": ["#0B2F4A", "#12395A", "#1B4A73", "#23558A"],
  "orange": ["#F28E2B", "#F4A65A", "#F7C788", "#D77A1B"],
  "green": ["#70AD47", "#80BB59", "#588938", "#42662A"],
  "slate": ["#2F3E46", "#354F52", "#52796F", "#84A98C"],
  "teal": ["#0F4C5C", "#1B5E6F", "#227C88", "#2E98A2"],
  "burgundy": ["#5A1A2C", "#6F2232", "#8A2D3B", "#A43A47"],
  "charcoal": ["#1F2933", "#323F4B", "#3E4C59", "#52606D"],
}


def parse_mesh_terms(csv_path: str, exclude_keywords: list[str]) -> Counter:
    counts: Counter = Counter()
    exclude_lower = [word.lower() for word in exclude_keywords if word]
    with open(csv_path, newline="", encoding="utf-8") as infile:
        reader = csv.DictReader(infile)
        for row in reader:
            for column in ("MeSH terms (Descriptor)", "MeSH terms (Qualifier)"):
                cell = row.get(column) or ""
                for term in (part.strip() for part in cell.split("|||")):
                    if not term or term in STOP_WORDS:
                        continue
                    if exclude_lower and any(word in term.lower() for word in exclude_lower):
                        continue
                    counts[term] += 1
    return counts


def generate_word_cloud(
    csv_path: str,
    output_path: str,
    exclude_keywords: list[str],
    theme: str,
) -> None:
    counts = parse_mesh_terms(csv_path, exclude_keywords)
    if not counts:
        with open(output_path, "w", encoding="utf-8") as outfile:
            outfile.write("")
        return

    palette = PALETTES.get(theme, PALETTES["green"])
    cmap = mcolors.LinearSegmentedColormap.from_list("custom_palette", palette)
    wc = WordCloud(
        width=2000,
        height=2000,
        background_color="white",
        colormap=cmap,
        collocations=False,
    ).generate_from_frequencies(dict(counts))

    svg_data = wc.to_svg()
    with open(output_path, "w", encoding="utf-8") as outfile:
        outfile.write(svg_data)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate MeSH word cloud SVG from CSV.")
    parser.add_argument("--csv", required=True, help="Input CSV file path.")
    parser.add_argument("--output", required=True, help="Output SVG file path.")
    parser.add_argument(
        "--search_words",
        default="",
        help="Comma-separated search words to exclude.",
    )
    parser.add_argument(
        "--theme",
        default="burgundy",
        choices=sorted(PALETTES.keys()),
        help="Color theme for the word cloud.",
    )
    args = parser.parse_args()

    exclude_keywords = [word.strip() for word in args.search_words.split(",") if word.strip()]
    generate_word_cloud(args.csv, args.output, exclude_keywords, args.theme)


if __name__ == "__main__":
    main()
